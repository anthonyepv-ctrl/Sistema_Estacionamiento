const express = require('express');
const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');
const { autorizar } = require('../config/auth');
const { normalizarPlaca } = require('../utils/placas');
const {
  stripeConfigurado,
  obtenerLlavePublica,
  crearPaymentIntentReserva,
  obtenerPaymentIntent,
  reembolsarPaymentIntent
} = require('../config/stripe');

const router = express.Router();

const LLAVE_LOCK_AFORO = 770000;
const TOLERANCIA_MINUTOS = 30;

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
 * Devuelve si Stripe está habilitado y su clave pública (pk_test_...).
 */
router.get('/config-pasarela', autorizar('CONDUCTOR', 'RECEPCIONISTA', 'DUENO'), (req, res) => {
  return res.json({
    habilitado: stripeConfigurado(),
    publishableKey: stripeConfigurado() ? obtenerLlavePublica() : null,
    toleranciaMinutos: TOLERANCIA_MINUTOS
  });
});

/**
 * POST /api/reservas/intencion-pago (UPAO-21)
 * Valida cupo, no duplicidad y crea el PaymentIntent en Stripe (1 hora de tarifa vigente).
 */
router.post('/intencion-pago', autorizar('CONDUCTOR'), async (req, res) => {
  const idVehiculo = Number((req.body || {}).idVehiculo);
  if (!Number.isInteger(idVehiculo) || idVehiculo <= 0) {
    return res.status(400).json({ error: 'Seleccione un vehículo válido de su cuenta.' });
  }

  try {
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

    const montoAdelanto = Number(tarifa.precioHora);
    const intent = await crearPaymentIntentReserva({
      montoSoles: montoAdelanto,
      codigoReserva: `TMP-${req.sesion.sub}-${Date.now()}`,
      idUsuario: req.sesion.sub,
      placa: vehiculo.placa
    });

    return res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      montoAdelanto,
      placa: vehiculo.placa,
      tipo: vehiculo.tipoVehiculo.nombre
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al iniciar pago de reserva:', error);
    return res.status(500).json({ error: 'No se pudo iniciar el pago de la reserva.' });
  }
});

/**
 * POST /api/reservas (UPAO-21)
 * Verifica que el PaymentIntent en Stripe esté `succeeded` y registra la reserva de forma atómica.
 */
router.post('/', autorizar('CONDUCTOR'), async (req, res) => {
  const { idVehiculo: idVehiculoRaw, paymentIntentId } = req.body || {};
  const idVehiculo = Number(idVehiculoRaw);

  if (!Number.isInteger(idVehiculo) || idVehiculo <= 0) {
    return res.status(400).json({ error: 'Seleccione un vehículo válido.' });
  }
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return res.status(400).json({ error: 'Falta la confirmación del pago de la reserva.' });
  }

  try {
    const intent = await obtenerPaymentIntent(paymentIntentId);
    if (intent.status !== 'succeeded') {
      return res.status(402).json({ error: 'El pago aún no fue aprobado por Stripe. No se registró la reserva.' });
    }

    const vehiculo = await prisma.vehiculoConductor.findUnique({
      where: { id: idVehiculo },
      include: { tipoVehiculo: true }
    });

    if (!vehiculo || vehiculo.idUsuario !== req.sesion.sub) {
      return res.status(404).json({ error: 'Vehículo no encontrado en su cuenta.' });
    }

    const reserva = await prisma.$transaction(async (tx) => {
      const llaveAforo = LLAVE_LOCK_AFORO + vehiculo.idTipoVehiculo;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${llaveAforo})`;

      await expirarReservasVencidas(tx);

      const yaPagado = await tx.reserva.findFirst({ where: { stripePaymentIntentId: intent.id } });
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
      const codigo = `RES-${String(Date.now()).slice(-6)}`;

      return tx.reserva.create({
        data: {
          codigo,
          idUsuario: req.sesion.sub,
          idVehiculo: vehiculo.id,
          idTipoVehiculo: vehiculo.idTipoVehiculo,
          fechaReserva: ahora,
          fechaLimite,
          estado: 'VIGENTE',
          montoAdelanto: Number(tarifa.precioHora),
          stripePaymentIntentId: intent.id,
          estadoPago: 'PAGADO'
        },
        include: {
          vehiculo: true,
          tipoVehiculo: true,
          usuario: { select: { id: true, nombre: true, dni: true, celular: true } }
        }
      });
    });

    return res.status(201).json({
      reserva: formatearReserva(reserva),
      mensaje: `Reserva ${reserva.codigo} confirmada para ${vehiculo.placa}.`
    });
  } catch (error) {
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
 * POST /api/reservas/:id/anular (UPAO-22)
 */
router.post('/:id/anular', autorizar('CONDUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de reserva inválido.' });
  }

  try {
    await expirarReservasVencidas();

    const reserva = await prisma.reserva.findUnique({
      where: { id },
      include: { vehiculo: true, tipoVehiculo: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    if (reserva.idUsuario !== req.sesion.sub) {
      return res.status(403).json({ error: 'No tiene permisos para anular esta reserva.' });
    }
    if (reserva.estado !== 'VIGENTE') {
      return res.status(409).json({ error: `La reserva ya se encuentra en estado ${reserva.estado} y no puede anularse.` });
    }

    if (reserva.stripePaymentIntentId) {
      await reembolsarPaymentIntent(reserva.stripePaymentIntentId);
    }

    const actualizada = await prisma.reserva.update({
      where: { id },
      data: {
        estado: 'ANULADA',
        estadoPago: 'REEMBOLSADO',
        fechaAnulacion: new Date()
      },
      include: { vehiculo: true, tipoVehiculo: true }
    });

    return res.json({
      reserva: formatearReserva(actualizada),
      mensaje: `Reserva ${actualizada.codigo} anulada y espacio liberado.`
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error al anular reserva:', error);
    return res.status(500).json({ error: 'No se pudo anular la reserva.' });
  }
});

/**
 * GET /api/reservas/por-placa/:placa (UPAO-8 - Recepcionista / Dueño)
 * Indica si la placa tiene una reserva VIGENTE (para avisar en el flujo normal de ingreso).
 */
router.get('/por-placa/:placa', autorizar('RECEPCIONISTA', 'DUENO'), async (req, res) => {
  try {
    await expirarReservasVencidas();
    const placa = normalizarPlaca(req.params.placa);
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

    const q = req.query.q ? String(req.query.q).trim() : '';
    const estadoFiltro = req.query.estado ? String(req.query.estado).trim().toUpperCase() : '';
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
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de reserva inválido.' });
  }

  const notaRaw = req.body && req.body.nota !== undefined && req.body.nota !== null ? String(req.body.nota).trim() : '';
  if (notaRaw.length > 250) {
    return res.status(400).json({ error: 'La nota no puede exceder los 250 caracteres.' });
  }
  const notaFinal = notaRaw.length > 0 ? notaRaw : null;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await expirarReservasVencidas(tx);

      const reserva = await tx.reserva.findUnique({
        where: { id },
        include: { vehiculo: true, tipoVehiculo: true }
      });

      if (!reserva) {
        const err = new Error('Reserva no encontrada.');
        err.statusCode = 404;
        throw err;
      }
      if (reserva.estado !== 'VIGENTE') {
        const err = new Error(`No se puede admitir el ingreso: la reserva está en estado ${reserva.estado}.`);
        err.statusCode = 409;
        throw err;
      }

      const llaveAforo = LLAVE_LOCK_AFORO + reserva.idTipoVehiculo;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${llaveAforo})`;

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
          nota: notaFinal
        }
      });

      return { reserva: reservaActualizada, estadia, placa: reserva.vehiculo.placa };
    });

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
