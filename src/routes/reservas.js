const crypto = require('crypto');
const express = require('express');
const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');
const { autorizar } = require('../config/auth');
const { normalizarPlaca } = require('../utils/placas');
const { parsearIdEntero } = require('../utils/validaciones');
const {
  MONTO_MINIMO_RESERVA_SOLES,
  obtenerMinimoYapeSoles,
  calcularMontoAdelanto,
  obtenerProveedorActivo,
  obtenerEstadoPasarela,
  guardarCredencialesPasarela,
  restaurarCredencialesServidor,
  cobrarReserva,
  reembolsarCargo
} = require('../payments');

const router = express.Router();

const LLAVE_LOCK_AFORO = 770000;
const LLAVE_LOCK_RESERVA_NS = 780000;
const TOLERANCIA_MINUTOS = 30;
const REGEX_TOKEN_CULQI = /^(tkn|ype)_(test|live)_[A-Za-z0-9_-]{6,}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const anulacionesEnCurso = new Set();

/**
 * Marca como VENCIDA cualquier reserva VIGENTE cuya fechaLimite ya expiró.
 */
async function expirarReservasVencidas(tx = prisma) {
  await tx.reserva.updateMany({
    where: {
      estado: 'VIGENTE',
      fechaLimite: { lt: new Date() }
    },
    data: { estado: 'VENCIDA' }
  });
}

function esTipoAuto(nombreTipo) {
  return nombreTipo === 'Automóvil / Camioneta';
}

function formatearReserva(r) {
  return {
    id: r.id,
    codigo: r.codigo,
    estado: r.estado,
    estadoPago: r.estadoPago,
    montoAdelanto: Number(r.montoAdelanto),
    pasarelaProveedor: r.pasarelaProveedor || null,
    pasarelaPagoId: r.pasarelaPagoId || null,
    pasarelaReembolsoId: r.pasarelaReembolsoId || null,
    fechaReserva: r.fechaReserva,
    fechaLimite: r.fechaLimite,
    fechaAnulacion: r.fechaAnulacion,
    placa: r.vehiculo ? r.vehiculo.placa : null,
    tipo: r.tipoVehiculo ? r.tipoVehiculo.nombre : null,
    conductor: r.usuario
      ? { id: r.usuario.id, nombre: r.usuario.nombre, dni: r.usuario.dni, celular: r.usuario.celular }
      : null
  };
}

/**
 * GET /api/reservas/config-pasarela
 * Devuelve si la pasarela activa (Culqi Perú) está habilitada, su clave pública y reglas operativas.
 */
router.get('/config-pasarela', autorizar('CONDUCTOR', 'RECEPCIONISTA', 'DUENO'), async (req, res) => {
  try {
    const estado = await obtenerEstadoPasarela();
    const payload = {
      habilitado: estado.habilitado,
      proveedor: estado.proveedor,
      publishableKey: estado.publishableKey,
      toleranciaMinutos: TOLERANCIA_MINUTOS,
      montoMinimoSoles: MONTO_MINIMO_RESERVA_SOLES,
      yapeMinimoSoles: obtenerMinimoYapeSoles(),
      modo: estado.modo,
      origen: estado.origen
    };
    if (req.sesion.rol === 'DUENO') {
      payload.secretKeyMasked = estado.secretKeyMasked;
    }
    return res.json(payload);
  } catch (error) {
    console.error('Error al consultar configuración de pasarela:', error);
    return res.status(500).json({ error: 'No se pudo consultar la configuración de la pasarela.' });
  }
});

/**
 * PUT /api/reservas/config-pasarela (UPAO-21 - DUEÑO)
 * Permite al Product Owner / Dueño configurar o restaurar las API keys de Culqi desde la web.
 */
router.put('/config-pasarela', autorizar('DUENO'), async (req, res) => {
  const { publishableKey, secretKey, restaurarPorDefecto } = req.body || {};
  try {
    const estado = restaurarPorDefecto === true
      ? await restaurarCredencialesServidor()
      : await guardarCredencialesPasarela({
          publishableKey,
          secretKey,
          idUsuario: req.sesion.sub
        });

    const mensaje = restaurarPorDefecto === true
      ? 'Se restauraron las credenciales por defecto del servidor.'
      : 'Credenciales de pasarela Culqi actualizadas y guardadas en base de datos.';

    return res.json({
      ...estado,
      toleranciaMinutos: TOLERANCIA_MINUTOS,
      montoMinimoSoles: MONTO_MINIMO_RESERVA_SOLES,
      yapeMinimoSoles: obtenerMinimoYapeSoles(),
      mensaje
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al actualizar credenciales de pasarela:', error);
    return res.status(500).json({ error: 'No se pudieron actualizar las credenciales de la pasarela.' });
  }
});

/**
 * POST /api/reservas/preparar-pago (UPAO-21)
 * Pre-valida cupo, no duplicidad y calcula el monto exacto en PEN antes de abrir Checkout v4.
 */
router.post('/preparar-pago', autorizar('CONDUCTOR'), async (req, res) => {
  const idVehiculo = parsearIdEntero((req.body || {}).idVehiculo);
  if (!idVehiculo) {
    return res.status(400).json({ error: 'Seleccione un vehículo válido de su cuenta.' });
  }

  try {
    const estadoPasarela = await obtenerEstadoPasarela();
    if (!estadoPasarela.habilitado || !estadoPasarela.publishableKey) {
      return res.status(503).json({ error: 'La pasarela de pagos (Culqi) aún no está configurada en el servidor.' });
    }

    await expirarReservasVencidas();

    const vehiculo = await prisma.vehiculoConductor.findUnique({
      where: { id: idVehiculo },
      include: { tipoVehiculo: true }
    });

    if (!vehiculo || vehiculo.idUsuario !== req.sesion.sub) {
      return res.status(404).json({ error: 'Vehículo no encontrado en su cuenta.' });
    }

    const [estadiaActiva, reservaVigente, tarifa] = await Promise.all([
      prisma.estadia.findFirst({ where: { placa: vehiculo.placa, horaSalida: null } }),
      prisma.reserva.findFirst({ where: { idVehiculo: vehiculo.id, estado: 'VIGENTE' } }),
      prisma.tarifa.findFirst({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, estado: true } })
    ]);

    if (estadiaActiva) {
      return res.status(409).json({ error: `El vehículo ${vehiculo.placa} ya se encuentra dentro de la cochera.` });
    }
    if (reservaVigente) {
      return res.status(409).json({ error: `El vehículo ${vehiculo.placa} ya cuenta con una reserva vigente (${reservaVigente.codigo}).` });
    }
    if (!tarifa) {
      return res.status(500).json({ error: 'No hay una tarifa vigente configurada para este tipo de vehículo.' });
    }

    const capacidadConfig = obtenerCapacidad();
    const capacidadTipo = esTipoAuto(vehiculo.tipoVehiculo.nombre)
      ? capacidadConfig.capacidadAutos
      : capacidadConfig.capacidadMotos;

    const [enCochera, reservasVigentes] = await Promise.all([
      prisma.estadia.count({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, horaSalida: null } }),
      prisma.reserva.count({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, estado: 'VIGENTE' } })
    ]);

    if (enCochera + reservasVigentes >= capacidadTipo) {
      return res.status(409).json({ error: 'No hay espacios disponibles para este tipo de vehículo (Aforo lleno).' });
    }

    const precioTarifa = Number(tarifa.precioHora);
    const montoAdelanto = calcularMontoAdelanto(precioTarifa);
    const montoCentimos = Math.round(montoAdelanto * 100);
    const yapeMinimoSoles = obtenerMinimoYapeSoles();

    return res.json({
      proveedor: estadoPasarela.proveedor,
      publishableKey: estadoPasarela.publishableKey,
      montoAdelanto,
      montoCentimos,
      moneda: 'PEN',
      yapeHabilitado: montoAdelanto >= yapeMinimoSoles,
      yapeMinimoSoles,
      montoMinimoAplicado: montoAdelanto > precioTarifa,
      placa: vehiculo.placa,
      tipo: vehiculo.tipoVehiculo.nombre
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al preparar pago de reserva:', error);
    return res.status(500).json({ error: 'No se pudo preparar el pago de la reserva.' });
  }
});

/**
 * POST /api/reservas (UPAO-21)
 * Pre-valida cupo, ejecuta el cargo idempotente en Culqi y registra la reserva atópicamente
 * con reembolso compensatorio automático ante colisión de último cupo.
 */
router.post('/', autorizar('CONDUCTOR'), async (req, res) => {
  const { idVehiculo: idVehiculoRaw, sourceToken, email, idempotencyKey } = req.body || {};
  const idVehiculo = parsearIdEntero(idVehiculoRaw);

  if (!idVehiculo) {
    return res.status(400).json({ error: 'Seleccione un vehículo válido.' });
  }
  if (!sourceToken || typeof sourceToken !== 'string') {
    return res.status(400).json({ error: 'Falta el token de confirmación del pago.' });
  }
  const tokenLimpio = sourceToken.trim();
  if (!REGEX_TOKEN_CULQI.test(tokenLimpio)) {
    return res.status(402).json({ error: 'El token de pago es inválido o no fue aprobado por Culqi.' });
  }

  let cargo = null;
  let montoAdelanto = 0;

  try {
    const [vehiculo, usuario] = await Promise.all([
      prisma.vehiculoConductor.findUnique({
        where: { id: idVehiculo },
        include: { tipoVehiculo: true }
      }),
      prisma.usuario.findUnique({
        where: { id: req.sesion.sub },
        select: { id: true, dni: true }
      })
    ]);

    if (!vehiculo || vehiculo.idUsuario !== req.sesion.sub) {
      return res.status(404).json({ error: 'Vehículo no encontrado en su cuenta.' });
    }

    await expirarReservasVencidas();

    const [estadiaActivaPrev, reservaVigentePrev, tarifaPrev] = await Promise.all([
      prisma.estadia.findFirst({ where: { placa: vehiculo.placa, horaSalida: null } }),
      prisma.reserva.findFirst({ where: { idVehiculo: vehiculo.id, estado: 'VIGENTE' } }),
      prisma.tarifa.findFirst({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, estado: true } })
    ]);

    if (estadiaActivaPrev || reservaVigentePrev) {
      return res.status(409).json({
        error: `El vehículo ${vehiculo.placa} ya cuenta con una reserva vigente o un ingreso activo.`
      });
    }
    if (!tarifaPrev) {
      return res.status(500).json({ error: 'No hay una tarifa vigente configurada para este tipo de vehículo.' });
    }

    const capacidadPrevConfig = obtenerCapacidad();
    const capacidadPrevTipo = esTipoAuto(vehiculo.tipoVehiculo.nombre)
      ? capacidadPrevConfig.capacidadAutos
      : capacidadPrevConfig.capacidadMotos;

    const [enCocheraPrev, reservasPrev] = await Promise.all([
      prisma.estadia.count({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, horaSalida: null } }),
      prisma.reserva.count({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, estado: 'VIGENTE' } })
    ]);

    if (enCocheraPrev + reservasPrev >= capacidadPrevTipo) {
      return res.status(409).json({ error: 'No hay espacios disponibles para este tipo de vehículo (Aforo lleno).' });
    }

    montoAdelanto = calcularMontoAdelanto(tarifaPrev.precioHora);
    const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const emailFinal = REGEX_EMAIL.test(emailRaw)
      ? emailRaw
      : `conductor.${usuario && usuario.dni ? usuario.dni : req.sesion.sub}@cochera.pe`;

    const claveIdempotencia = (idempotencyKey && String(idempotencyKey).trim().slice(0, 64))
      || crypto.randomUUID();

    cargo = await cobrarReserva({
      montoSoles: montoAdelanto,
      sourceToken: tokenLimpio,
      email: emailFinal,
      idempotencyKey: claveIdempotencia,
      metadata: {
        placa: vehiculo.placa,
        idUsuario: String(req.sesion.sub)
      }
    });

    const reserva = await prisma.$transaction(async (tx) => {
      const llaveAforo = LLAVE_LOCK_AFORO + vehiculo.idTipoVehiculo;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${llaveAforo})`;

      await expirarReservasVencidas(tx);

      const yaPagado = await tx.reserva.findFirst({ where: { pasarelaPagoId: cargo.id } });
      if (yaPagado) {
        return yaPagado;
      }

      const [estadiaActiva, reservaVigente, tarifa] = await Promise.all([
        tx.estadia.findFirst({ where: { placa: vehiculo.placa, horaSalida: null } }),
        tx.reserva.findFirst({ where: { idVehiculo: vehiculo.id, estado: 'VIGENTE' } }),
        tx.tarifa.findFirst({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, estado: true } })
      ]);

      if (estadiaActiva || reservaVigente) {
        const err = new Error(`El vehículo ${vehiculo.placa} ya cuenta con una reserva vigente o un ingreso activo.`);
        err.statusCode = 409;
        throw err;
      }
      if (!tarifa) {
        const err = new Error('No hay tarifa vigente para este tipo de vehículo.');
        err.statusCode = 500;
        throw err;
      }

      const capacidadConfig = obtenerCapacidad();
      const capacidadTipo = esTipoAuto(vehiculo.tipoVehiculo.nombre)
        ? capacidadConfig.capacidadAutos
        : capacidadConfig.capacidadMotos;

      const [enCochera, reservasVigentes] = await Promise.all([
        tx.estadia.count({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, horaSalida: null } }),
        tx.reserva.count({ where: { idTipoVehiculo: vehiculo.idTipoVehiculo, estado: 'VIGENTE' } })
      ]);

      if (enCochera + reservasVigentes >= capacidadTipo) {
        const err = new Error('No hay espacios disponibles para este tipo de vehículo (Aforo lleno).');
        err.statusCode = 409;
        throw err;
      }

      const ahora = new Date();
      const fechaLimite = new Date(ahora.getTime() + TOLERANCIA_MINUTOS * 60 * 1000);
      const codigo = `RES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      return tx.reserva.create({
        data: {
          codigo,
          idUsuario: req.sesion.sub,
          idVehiculo: vehiculo.id,
          idTipoVehiculo: vehiculo.idTipoVehiculo,
          fechaReserva: ahora,
          fechaLimite,
          estado: 'VIGENTE',
          montoAdelanto,
          pasarelaPagoId: cargo.id,
          pasarelaProveedor: cargo.proveedor,
          estadoPago: 'PAGADO'
        },
        include: {
          vehiculo: true,
          tipoVehiculo: true,
          usuario: { select: { id: true, nombre: true, dni: true, celular: true } }
        }
      });
    }, { maxWait: 10000, timeout: 20000 });

    return res.status(201).json({
      reserva: formatearReserva(reserva),
      mensaje: `Reserva ${reserva.codigo} confirmada para ${vehiculo.placa}.`
    });
  } catch (error) {
    if (cargo && cargo.id) {
      let reembolsoComp = null;
      try {
        reembolsoComp = await reembolsarCargo({
          chargeId: cargo.id,
          montoSoles: montoAdelanto,
          reason: 'solicitud_comprador',
          idempotencyKey: `comp-${cargo.id}`
        });
        console.warn(`Reembolso compensatorio ejecutado: charge=${cargo.id}, refund=${reembolsoComp.id}`);
      } catch (compErr) {
        console.error(`CRÍTICO: Falló reembolso compensatorio para charge=${cargo.id}:`, compErr);
      }
      const status = error.statusCode || 409;
      return res.status(status).json({
        error: `${error.message || 'El espacio ya no estaba disponible.'} El cobro fue revertido automáticamente.`
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al confirmar reserva:', error);
    return res.status(500).json({ error: 'No se pudo confirmar la reserva.' });
  }
});

/**
 * GET /api/reservas/mias (UPAO-22)
 */
router.get('/mias', autorizar('CONDUCTOR'), async (req, res) => {
  try {
    await expirarReservasVencidas();
    const reservas = await prisma.reserva.findMany({
      where: { idUsuario: req.sesion.sub },
      include: {
        vehiculo: true,
        tipoVehiculo: true
      },
      orderBy: { fechaReserva: 'desc' }
    });

    return res.json({ reservas: reservas.map(formatearReserva) });
  } catch (error) {
    console.error('Error al listar reservas del conductor:', error);
    return res.status(500).json({ error: 'No se pudieron consultar sus reservas.' });
  }
});

/**
 * Controlador de Anulación de Reserva (UPAO-22)
 * Admite DELETE /api/reservas/:id y POST /api/reservas/:id/anular.
 * Protegido contra doble clic simultáneo y carrera con ingreso en garita.
 */
const anularReservaHandler = async (req, res) => {
  const id = parsearIdEntero(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID de reserva debe ser numérico.' });
  }

  if (anulacionesEnCurso.has(id)) {
    return res.status(409).json({ error: 'Ya hay una anulación en curso para esta reserva.' });
  }
  anulacionesEnCurso.add(id);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LLAVE_LOCK_RESERVA_NS}::int, ${id}::int)`;

      const resLock = await tx.reserva.findUnique({
        where: { id },
        include: { vehiculo: true, tipoVehiculo: true }
      });

      if (!resLock) {
        const err = new Error('Reserva no encontrada.');
        err.statusCode = 404;
        throw err;
      }
      if (resLock.idUsuario !== req.sesion.sub) {
        const err = new Error('No tiene permiso para anular esta reserva');
        err.statusCode = 403;
        throw err;
      }
      if (resLock.estado !== 'VIGENTE') {
        const err = new Error('Solo reservas vigentes pueden ser anuladas');
        err.statusCode = 409;
        throw err;
      }

      const ahora = new Date();
      if (resLock.fechaLimite < ahora) {
        await tx.reserva.update({
          where: { id },
          data: { estado: 'VENCIDA' }
        });
        return { expirada: true };
      }

      const proveedorActivo = obtenerProveedorActivo();
      if (resLock.pasarelaPagoId && resLock.pasarelaProveedor && resLock.pasarelaProveedor !== proveedorActivo) {
        const err = new Error(
          `Esta reserva fue cobrada con un proveedor previo (${resLock.pasarelaProveedor}) y no puede reembolsarse automáticamente desde ${proveedorActivo}.`
        );
        err.statusCode = 409;
        throw err;
      }

      let reembolso = null;
      if (resLock.pasarelaPagoId && !resLock.pasarelaReembolsoId) {
        reembolso = await reembolsarCargo({
          chargeId: resLock.pasarelaPagoId,
          montoSoles: Number(resLock.montoAdelanto),
          reason: 'solicitud_comprador',
          idempotencyKey: `refund-res-${resLock.id}`
        });
      }

      const actualizada = await tx.reserva.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          estadoPago: reembolso ? 'REEMBOLSADO' : resLock.estadoPago,
          pasarelaReembolsoId: reembolso ? reembolso.id : resLock.pasarelaReembolsoId,
          fechaAnulacion: new Date()
        },
        include: { vehiculo: true, tipoVehiculo: true }
      });

      return { expirada: false, actualizada, reembolsado: Boolean(reembolso) };
    }, { maxWait: 10000, timeout: 30000 });

    if (resultado.expirada) {
      return res.status(409).json({ error: 'Solo reservas vigentes pueden ser anuladas' });
    }

    return res.json({
      reserva: formatearReserva(resultado.actualizada),
      mensaje: resultado.reembolsado
        ? 'Reserva anulada y reembolso procesado'
        : 'Reserva anulada correctamente'
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al anular reserva:', error);
    return res.status(500).json({ error: 'No se pudo anular la reserva.' });
  } finally {
    anulacionesEnCurso.delete(id);
  }
};

router.delete('/:id', autorizar('CONDUCTOR'), anularReservaHandler);
router.post('/:id/anular', autorizar('CONDUCTOR'), anularReservaHandler);

/**
 * GET /api/reservas/por-placa/:placa (UPAO-8 - Recepcionista / Dueño)
 * Indica si la placa tiene una reserva VIGENTE (para avisar en el flujo normal de ingreso).
 */
router.get('/por-placa/:placa', autorizar('RECEPCIONISTA', 'DUENO'), async (req, res) => {
  try {
    await expirarReservasVencidas();
    const alfanum = String(req.params.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (alfanum.length < 6 || alfanum.length > 7) {
      return res.json({ reserva: null });
    }
    const placa = normalizarPlaca(alfanum);
    if (!placa) {
      return res.json({ reserva: null });
    }

    const reserva = await prisma.reserva.findFirst({
      where: { estado: 'VIGENTE', vehiculo: { placa } },
      include: {
        vehiculo: true,
        tipoVehiculo: true,
        usuario: { select: { id: true, nombre: true, dni: true, celular: true } }
      },
      orderBy: { fechaReserva: 'desc' }
    });

    return res.json({ reserva: reserva ? formatearReserva(reserva) : null });
  } catch (error) {
    console.error('Error al consultar reserva por placa:', error);
    return res.status(500).json({ error: 'No se pudo consultar la reserva de la placa.' });
  }
});

/**
 * GET /api/reservas (UPAO-8 - Recepcionista / Dueño)
 */
router.get('/', autorizar('RECEPCIONISTA', 'DUENO'), async (req, res) => {
  try {
    await expirarReservasVencidas();

    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const estadoFiltro = typeof req.query.estado === 'string' ? req.query.estado.trim().toUpperCase() : '';
    const where = {};

    if (q) {
      const qPlaca = normalizarPlaca(q);
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { vehiculo: { placa: { contains: q.toUpperCase(), mode: 'insensitive' } } },
        { vehiculo: { placa: { contains: qPlaca, mode: 'insensitive' } } },
        { usuario: { dni: { contains: q } } },
        { usuario: { nombre: { contains: q, mode: 'insensitive' } } }
      ];
    }

    if (estadoFiltro && ['VIGENTE', 'UTILIZADA', 'ANULADA', 'VENCIDA'].includes(estadoFiltro)) {
      where.estado = estadoFiltro;
    }

    const reservas = await prisma.reserva.findMany({
      where,
      include: {
        vehiculo: true,
        tipoVehiculo: true,
        usuario: { select: { id: true, nombre: true, dni: true, celular: true } }
      },
      orderBy: { fechaReserva: 'desc' },
      take: 50
    });

    return res.json({ reservas: reservas.map(formatearReserva) });
  } catch (error) {
    console.error('Error al buscar reservas:', error);
    return res.status(500).json({ error: 'No se pudieron buscar las reservas.' });
  }
});

/**
 * POST /api/reservas/:id/confirmar (UPAO-8 - Recepcionista / Dueño)
 */
router.post('/:id/confirmar', autorizar('RECEPCIONISTA', 'DUENO'), async (req, res) => {
  const id = parsearIdEntero(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Identificador de reserva inválido.' });
  }

  if (anulacionesEnCurso.has(id)) {
    return res.status(409).json({ error: 'La reserva está siendo anulada por el conductor en este momento.' });
  }

  const notaInput = req.body ? req.body.nota : undefined;
  if (notaInput !== undefined && notaInput !== null && typeof notaInput !== 'string') {
    return res.status(400).json({ error: 'La nota debe ser una cadena de texto válida.' });
  }
  const notaRaw = typeof notaInput === 'string' ? notaInput.trim() : '';
  if (notaRaw.length > 250) {
    return res.status(400).json({ error: 'La nota no puede exceder los 250 caracteres.' });
  }
  const notaFinal = notaRaw.length > 0 ? notaRaw : null;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await expirarReservasVencidas(tx);

      const reservaPrevia = await tx.reserva.findUnique({
        where: { id },
        select: { id: true, idTipoVehiculo: true }
      });

      if (!reservaPrevia) {
        const err = new Error('Reserva no encontrada.');
        err.statusCode = 404;
        throw err;
      }

      const llaveAforo = LLAVE_LOCK_AFORO + reservaPrevia.idTipoVehiculo;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${llaveAforo})`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LLAVE_LOCK_RESERVA_NS}::int, ${id}::int)`;

      const reserva = await tx.reserva.findUnique({
        where: { id },
        include: { vehiculo: true, tipoVehiculo: true }
      });

      if (!reserva || reserva.estado !== 'VIGENTE') {
        const err = new Error(`No se puede admitir el ingreso: la reserva está en estado ${reserva ? reserva.estado : 'NO_DISPONIBLE'}.`);
        err.statusCode = 409;
        throw err;
      }

      const ahora = new Date();
      if (reserva.fechaLimite < ahora) {
        await tx.reserva.update({
          where: { id },
          data: { estado: 'VENCIDA' }
        });
        return { expirada: true };
      }

      const estadiaActiva = await tx.estadia.findFirst({
        where: { placa: reserva.vehiculo.placa, horaSalida: null }
      });
      if (estadiaActiva) {
        const err = new Error(`El vehículo ${reserva.vehiculo.placa} ya registra un ingreso activo.`);
        err.statusCode = 409;
        throw err;
      }

      const tarifa = await tx.tarifa.findFirst({
        where: { idTipoVehiculo: reserva.idTipoVehiculo, estado: true }
      });
      if (!tarifa) {
        const err = new Error('No hay una tarifa vigente configurada para este tipo de vehículo.');
        err.statusCode = 500;
        throw err;
      }

      const reservaActualizada = await tx.reserva.update({
        where: { id },
        data: { estado: 'UTILIZADA' }
      });

      const estadia = await tx.estadia.create({
        data: {
          placa: reserva.vehiculo.placa,
          idTipoVehiculo: reserva.idTipoVehiculo,
          idTarifa: tarifa.id,
          idUsuario: req.sesion.sub,
          idReserva: reserva.id,
          horaIngreso: ahora,
          nota: notaFinal
        }
      });

      return { expirada: false, reserva: reservaActualizada, estadia, placa: reserva.vehiculo.placa };
    }, { maxWait: 10000, timeout: 20000 });

    if (resultado.expirada) {
      return res.status(409).json({ error: 'No se puede admitir el ingreso: la reserva está en estado VENCIDA.' });
    }

    return res.status(201).json({
      estadiaId: resultado.estadia.id,
      placa: resultado.placa,
      estadoReserva: resultado.reserva.estado,
      mensaje: `Reserva confirmada e ingreso registrado para ${resultado.placa}.`
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al confirmar reserva:', error);
    return res.status(500).json({ error: 'No se pudo confirmar el ingreso de la reserva.' });
  }
});

module.exports = router;
module.exports.expirarReservasVencidas = expirarReservasVencidas;
