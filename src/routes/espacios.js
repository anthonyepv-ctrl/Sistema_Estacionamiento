const express = require('express');

const prisma = require('../config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../config/espacios');
const { autorizar } = require('../config/auth');
const { parsearEnteroRango } = require('../utils/validaciones');
const { expirarReservasVencidas } = require('./reservas');

const router = express.Router();

const CAPACIDAD_MAXIMA = 5000;

async function obtenerEstadiasActivasPorTipo() {
  await expirarReservasVencidas();

  const [tipoAuto, tipoMoto] = await Promise.all([
    prisma.tipoVehiculo.findUnique({ where: { nombre: 'Automóvil / Camioneta' } }),
    prisma.tipoVehiculo.findUnique({ where: { nombre: 'Motocicleta' } })
  ]);

  const [ocupadosAutos, ocupadosMotos, reservasVigentesAutos, reservasVigentesMotos] = await Promise.all([
    tipoAuto ? prisma.estadia.count({ where: { idTipoVehiculo: tipoAuto.id, horaSalida: null } }) : 0,
    tipoMoto ? prisma.estadia.count({ where: { idTipoVehiculo: tipoMoto.id, horaSalida: null } }) : 0,
    tipoAuto ? prisma.reserva.count({ where: { idTipoVehiculo: tipoAuto.id, estado: 'VIGENTE' } }) : 0,
    tipoMoto ? prisma.reserva.count({ where: { idTipoVehiculo: tipoMoto.id, estado: 'VIGENTE' } }) : 0
  ]);

  return { ocupadosAutos, ocupadosMotos, reservasVigentesAutos, reservasVigentesMotos };
}

function calcularEstadoAforo(capacidad, ocupados) {
  const reservasAutos = ocupados.reservasVigentesAutos || 0;
  const reservasMotos = ocupados.reservasVigentesMotos || 0;

  const disponiblesAutos = Math.max(0, capacidad.capacidadAutos - ocupados.ocupadosAutos - reservasAutos);
  const disponiblesMotos = Math.max(0, capacidad.capacidadMotos - ocupados.ocupadosMotos - reservasMotos);

  const totalCapacidad = capacidad.capacidadAutos + capacidad.capacidadMotos;
  const totalOcupados = ocupados.ocupadosAutos + ocupados.ocupadosMotos;
  const totalReservas = reservasAutos + reservasMotos;
  const totalDisponibles = disponiblesAutos + disponiblesMotos;

  const porcentajeAutos = capacidad.capacidadAutos > 0
    ? Math.min(100, Math.round(((ocupados.ocupadosAutos + reservasAutos) / capacidad.capacidadAutos) * 100))
    : 0;

  const porcentajeMotos = capacidad.capacidadMotos > 0
    ? Math.min(100, Math.round(((ocupados.ocupadosMotos + reservasMotos) / capacidad.capacidadMotos) * 100))
    : 0;

  const porcentajeTotal = totalCapacidad > 0
    ? Math.min(100, Math.round(((totalOcupados + totalReservas) / totalCapacidad) * 100))
    : 0;

  let nivelAforo = 'DISPONIBLE';
  if (totalDisponibles === 0 || porcentajeTotal >= 100) {
    nivelAforo = 'LLENO';
  } else if (porcentajeTotal >= 80) {
    nivelAforo = 'MEDIO';
  }

  return {
    autos: {
      capacidad: capacidad.capacidadAutos,
      ocupados: ocupados.ocupadosAutos,
      reservasVigentes: reservasAutos,
      disponibles: disponiblesAutos,
      porcentaje: porcentajeAutos
    },
    motos: {
      capacidad: capacidad.capacidadMotos,
      ocupados: ocupados.ocupadosMotos,
      reservasVigentes: reservasMotos,
      disponibles: disponiblesMotos,
      porcentaje: porcentajeMotos
    },
    total: {
      capacidad: totalCapacidad,
      ocupados: totalOcupados,
      reservasVigentes: totalReservas,
      disponibles: totalDisponibles,
      porcentaje: porcentajeTotal
    },
    nivelAforo
  };
}

router.get('/', async (req, res) => {
  try {
    const capacidad = obtenerCapacidad();
    const ocupados = await obtenerEstadiasActivasPorTipo();
    const estado = calcularEstadoAforo(capacidad, ocupados);

    const estadiasActivas = await prisma.estadia.findMany({
      where: { horaSalida: null },
      include: { tipoVehiculo: true },
      orderBy: { horaIngreso: 'desc' }
    });

    return res.json({
      ...estado,
      vehiculosActivos: estadiasActivas.map((estadia) => ({
        id: estadia.id,
        placa: estadia.placa,
        tipo: estadia.tipoVehiculo.nombre,
        horaIngreso: estadia.horaIngreso
      }))
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo consultar el estado de espacios.' });
  }
});

// Cambiar la capacidad es una función exclusiva del DUEÑO (DEF-77-07).
router.put('/capacidad', autorizar('DUENO'), async (req, res) => {
  const { capacidadAutos, capacidadMotos } = req.body || {};

  if (capacidadAutos === undefined && capacidadMotos === undefined) {
    return res.status(400).json({
      error: 'Debe especificar al menos una capacidad a actualizar (capacidadAutos o capacidadMotos).'
    });
  }

  const autosVal = capacidadAutos !== undefined ? parsearEnteroRango(capacidadAutos, 1, CAPACIDAD_MAXIMA) : undefined;
  const motosVal = capacidadMotos !== undefined ? parsearEnteroRango(capacidadMotos, 1, CAPACIDAD_MAXIMA) : undefined;

  if (capacidadAutos !== undefined && autosVal === null) {
    return res.status(400).json({ error: `La capacidad de autos debe ser un número entero entre 1 y ${CAPACIDAD_MAXIMA}.` });
  }

  if (capacidadMotos !== undefined && motosVal === null) {
    return res.status(400).json({ error: `La capacidad de motos debe ser un número entero entre 1 y ${CAPACIDAD_MAXIMA}.` });
  }

  try {
    const ocupados = await obtenerEstadiasActivasPorTipo();
    const comprometidosAutos = ocupados.ocupadosAutos + ocupados.reservasVigentesAutos;
    const comprometidosMotos = ocupados.ocupadosMotos + ocupados.reservasVigentesMotos;

    if (autosVal !== undefined && autosVal < comprometidosAutos) {
      return res.status(400).json({
        error: `La capacidad de autos (${autosVal}) no puede ser menor a los espacios comprometidos (${comprometidosAutos}: en cochera + reservas vigentes).`
      });
    }

    if (motosVal !== undefined && motosVal < comprometidosMotos) {
      return res.status(400).json({
        error: `La capacidad de motos (${motosVal}) no puede ser menor a los espacios comprometidos (${comprometidosMotos}: en cochera + reservas vigentes).`
      });
    }

    const nuevaCapacidad = guardarCapacidad({
      capacidadAutos: autosVal,
      capacidadMotos: motosVal
    });

    const estadoActualizado = calcularEstadoAforo(nuevaCapacidad, ocupados);

    return res.json({
      mensaje: 'Capacidad de espacios actualizada correctamente.',
      capacidad: nuevaCapacidad,
      estado: estadoActualizado
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo actualizar la capacidad de espacios.' });
  }
});

module.exports = router;
