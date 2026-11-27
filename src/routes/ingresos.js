const express = require('express');

const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');
const { validarPlacaYTipo } = require('../utils/placas');

const router = express.Router();

// Base de la llave de bloqueo por aforo (PostgreSQL advisory lock). El id del tipo de
// vehículo se suma para que autos y motos no se bloqueen entre sí.
const LLAVE_LOCK_AFORO = 770000;

router.post('/', async (req, res) => {
  const { placa: placaRaw, tipo, nota } = req.body || {};
  const validacion = validarPlacaYTipo(placaRaw, tipo);

  if (!validacion.ok) {
    return res.status(400).json({ error: validacion.error });
  }

  const { placa, config } = validacion;

  // Sanitización y validación del campo opcional nota (máx. 250 caracteres)
  let notaFinal = null;
  if (nota !== undefined && nota !== null) {
    if (typeof nota !== 'string') {
      return res.status(400).json({ error: 'La nota debe ser una cadena de texto válida.' });
    }
    const notaTrimmed = nota.trim();
    if (notaTrimmed.length > 250) {
      return res.status(400).json({ error: 'La nota no puede exceder los 250 caracteres.' });
    }
    notaFinal = notaTrimmed.length > 0 ? notaTrimmed : null;
  }

  try {
    const tipoVehiculo = await prisma.tipoVehiculo.findUnique({ where: { nombre: config.nombre } });

    if (!tipoVehiculo) {
      return res.status(500).json({ error: 'No está configurado el tipo de vehículo.' });
    }

    const tarifa = await prisma.tarifa.findFirst({
      where: { idTipoVehiculo: tipoVehiculo.id, estado: true }
    });

    if (!tarifa) {
      return res.status(500).json({ error: 'No hay una tarifa vigente para este tipo de vehículo.' });
    }

    const usuario = req.sesion && req.sesion.sub
      ? await prisma.usuario.findUnique({ where: { id: Number(req.sesion.sub) } })
      : null;

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario de sesión no válido.' });
    }

    // Registro atómico dentro de una transacción para evitar sobrecupo por concurrencia (DEF-77-10)
    const estadia = await prisma.$transaction(async (tx) => {
      // Un lock de transacción por tipo de vehículo serializa los ingresos simultáneos:
      // sin él, dos peticiones leen el mismo aforo y ambas insertan (el aislamiento por
      // defecto de PostgreSQL no bloquea el conteo). Se libera al cerrar la transacción.
      const llaveAforo = LLAVE_LOCK_AFORO + tipoVehiculo.id;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${llaveAforo})`;

      const estadiaActiva = await tx.estadia.findFirst({ where: { placa, horaSalida: null } });

      if (estadiaActiva) {
        const err = new Error(`El vehículo con placa ${placa} ya registra un ingreso activo.`);
        err.statusCode = 409;
        throw err;
      }

      const reservaVigente = await tx.reserva.findFirst({
        where: {
          estado: 'VIGENTE',
          fechaLimite: { gte: new Date() },
          vehiculo: { placa }
        },
        select: { codigo: true }
      });

      if (reservaVigente) {
        const err = new Error(
          `La placa ${placa} tiene una reserva vigente (${reservaVigente.codigo}). Confirme el ingreso desde el aviso de reserva o en 'Buscar Reservas' para descontar su adelanto.`
        );
        err.statusCode = 409;
        throw err;
      }

      const capacidadConfig = obtenerCapacidad();
      const capacidadTipo = tipo === 'auto' ? capacidadConfig.capacidadAutos : capacidadConfig.capacidadMotos;

      const [ocupadosTipo, reservasVigentesTipo] = await Promise.all([
        tx.estadia.count({
          where: { idTipoVehiculo: tipoVehiculo.id, horaSalida: null }
        }),
        tx.reserva.count({
          where: {
            idTipoVehiculo: tipoVehiculo.id,
            estado: 'VIGENTE',
            fechaLimite: { gte: new Date() }
          }
        })
      ]);

      if (ocupadosTipo + reservasVigentesTipo >= capacidadTipo) {
        const err = new Error(`No hay espacios disponibles para ${tipo === 'auto' ? 'automóviles' : 'motocicletas'}. Aforo completo.`);
        err.statusCode = 409;
        throw err;
      }

      return tx.estadia.create({
        data: {
          placa,
          idTipoVehiculo: tipoVehiculo.id,
          idTarifa: tarifa.id,
          idUsuario: usuario.id,
          horaIngreso: new Date(),
          nota: notaFinal
        }
      });
    });

    return res.status(201).json({
      id: estadia.id,
      placa: estadia.placa,
      tipo: tipoVehiculo.nombre,
      horaIngreso: estadia.horaIngreso,
      nota: estadia.nota,
      idUsuario: usuario.id,
      usuario: usuario.nombre,
      mensaje: `Ingreso registrado: Placa [${placa}]`
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ error: `El vehículo con placa ${placa} ya registra un ingreso activo.` });
    }

    console.error(error);
    return res.status(500).json({ error: 'No se pudo registrar el ingreso.' });
  }
});

router.get('/activos', async (req, res) => {
  try {
    const estadias = await prisma.estadia.findMany({
      where: { horaSalida: null },
      include: {
        tipoVehiculo: true,
        usuario: true
      },
      orderBy: { horaIngreso: 'desc' }
    });

    return res.json(
      estadias.map((estadia) => ({
        id: estadia.id,
        placa: estadia.placa,
        tipo: estadia.tipoVehiculo.nombre,
        horaIngreso: estadia.horaIngreso,
        nota: estadia.nota ?? null,
        idUsuarioIngreso: estadia.idUsuario,
        usuarioIngreso: estadia.usuario ? estadia.usuario.nombre : null,
        rolUsuarioIngreso: estadia.usuario ? estadia.usuario.rol : null
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron obtener los ingresos activos.' });
  }
});

module.exports = router;
