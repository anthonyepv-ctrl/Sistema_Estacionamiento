const express = require('express');
const prisma = require('../config/prisma');
const { validarPlacaYTipo } = require('../utils/placas');

const router = express.Router();

/**
 * GET /api/conductor/vehiculos
 * Lista los vehículos registrados por el conductor autenticado.
 */
router.get('/vehiculos', async (req, res) => {
  try {
    const [vehiculos, tarifas] = await Promise.all([
      prisma.vehiculoConductor.findMany({
        where: { idUsuario: req.sesion.sub },
        include: { tipoVehiculo: { select: { id: true, nombre: true } } },
        orderBy: { creadoEn: 'desc' }
      }),
      prisma.tarifa.findMany({
        where: { estado: true },
        select: { idTipoVehiculo: true, precioHora: true }
      })
    ]);

    const mapaTarifas = new Map(tarifas.map((t) => [t.idTipoVehiculo, Number(t.precioHora)]));

    return res.json({
      vehiculos: vehiculos.map((v) => ({
        id: v.id,
        placa: v.placa,
        idTipoVehiculo: v.idTipoVehiculo,
        tipo: v.tipoVehiculo.nombre,
        tipoCodigo: v.tipoVehiculo.nombre === 'Motocicleta' ? 'moto' : 'auto',
        precioAdelanto: mapaTarifas.get(v.idTipoVehiculo) ?? null,
        creadoEn: v.creadoEn
      }))
    });
  } catch (error) {
    console.error('Error al listar vehículos del conductor:', error);
    return res.status(500).json({ error: 'No se pudieron obtener sus vehículos.' });
  }
});

/**
 * POST /api/conductor/vehiculos
 * Registra un nuevo vehículo en la cuenta del conductor con validación SUNARP/MTC y Poka-Yoke.
 */
router.post('/vehiculos', async (req, res) => {
  const { placa: placaRaw, tipo } = req.body || {};
  const validacion = validarPlacaYTipo(placaRaw, tipo);

  if (!validacion.ok) {
    return res.status(400).json({ error: validacion.error });
  }

  try {
    const tipoVehiculo = await prisma.tipoVehiculo.findUnique({
      where: { nombre: validacion.config.nombre }
    });

    if (!tipoVehiculo) {
      return res.status(500).json({ error: 'Tipo de vehículo no configurado en el sistema.' });
    }

    const creado = await prisma.vehiculoConductor.create({
      data: {
        idUsuario: req.sesion.sub,
        placa: validacion.placa,
        idTipoVehiculo: tipoVehiculo.id
      },
      include: { tipoVehiculo: { select: { id: true, nombre: true } } }
    });

    return res.status(201).json({
      id: creado.id,
      placa: creado.placa,
      idTipoVehiculo: creado.idTipoVehiculo,
      tipo: creado.tipoVehiculo.nombre,
      tipoCodigo: creado.tipoVehiculo.nombre === 'Motocicleta' ? 'moto' : 'auto',
      mensaje: `Vehículo ${creado.placa} registrado en tu cuenta.`
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: `La placa ${validacion.placa} ya está registrada en tu cuenta.` });
    }
    console.error('Error al registrar vehículo del conductor:', error);
    return res.status(500).json({ error: 'No se pudo registrar el vehículo.' });
  }
});

/**
 * DELETE /api/conductor/vehiculos/:id
 * Elimina un vehículo de la cuenta si no tiene reservas vigentes.
 */
router.delete('/vehiculos/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de vehículo inválido.' });
  }

  try {
    const vehiculo = await prisma.vehiculoConductor.findUnique({ where: { id } });
    if (!vehiculo || vehiculo.idUsuario !== req.sesion.sub) {
      return res.status(404).json({ error: 'Vehículo no encontrado en su cuenta.' });
    }

    const reservaActiva = await prisma.reserva.findFirst({
      where: { idVehiculo: id, estado: 'VIGENTE' }
    });
    if (reservaActiva) {
      return res.status(409).json({ error: 'No puede eliminar un vehículo con una reserva vigente.' });
    }

    await prisma.vehiculoConductor.delete({ where: { id } });
    return res.json({ mensaje: 'Vehículo eliminado de su cuenta.' });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'El vehículo tiene historial de reservas y no puede eliminarse.' });
    }
    console.error('Error al eliminar vehículo:', error);
    return res.status(500).json({ error: 'No se pudo eliminar el vehículo.' });
  }
});

/**
 * GET /api/conductor/historial (UPAO-23)
 * Historial de estadías (activas y finalizadas) únicamente de las placas del conductor autenticado.
 */
router.get('/historial', async (req, res) => {
  try {
    const placaFiltro = req.query.placa ? String(req.query.placa).trim().toUpperCase() : null;

    const vehiculos = await prisma.vehiculoConductor.findMany({
      where: { idUsuario: req.sesion.sub },
      select: { placa: true }
    });

    const placas = vehiculos.map((v) => v.placa);
    if (placas.length === 0) {
      return res.json({ estadias: [] });
    }

    const placasBuscadas = placaFiltro
      ? placas.filter((p) => p === placaFiltro)
      : placas;

    if (placasBuscadas.length === 0) {
      return res.json({ estadias: [] });
    }

    const estadias = await prisma.estadia.findMany({
      where: { placa: { in: placasBuscadas } },
      include: {
        tipoVehiculo: { select: { nombre: true } },
        pago: { include: { metodoPago: { select: { nombre: true } } } },
        reserva: { select: { codigo: true, montoAdelanto: true } }
      },
      orderBy: { horaIngreso: 'desc' }
    });

    return res.json({
      estadias: estadias.map((e) => ({
        id: e.id,
        placa: e.placa,
        tipo: e.tipoVehiculo.nombre,
        horaIngreso: e.horaIngreso,
        horaSalida: e.horaSalida,
        estado: e.horaSalida ? 'Finalizada' : 'En cochera',
        montoAdelanto: e.reserva ? Number(e.reserva.montoAdelanto) : 0,
        montoPagado: e.pago ? Number(e.pago.monto) : null,
        metodoPago: e.pago && e.pago.metodoPago ? e.pago.metodoPago.nombre : null,
        codigoReserva: e.reserva ? e.reserva.codigo : null
      }))
    });
  } catch (error) {
    console.error('Error al consultar historial del conductor:', error);
    return res.status(500).json({ error: 'No se pudo consultar su historial de estadías.' });
  }
});

module.exports = router;
