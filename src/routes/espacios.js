const express = require('express');

const prisma = require('../config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../config/espacios');

const router = express.Router();

async function obtenerEstadiasActivasPorTipo() {
  const [tipoAuto, tipoMoto] = await Promise.all([
    prisma.tipoVehiculo.findUnique({ where: { nombre: 'Automóvil / Camioneta' } }),
    prisma.tipoVehiculo.findUnique({ where: { nombre: 'Motocicleta' } })
  ]);

  const [ocupadosAutos, ocupadosMotos] = await Promise.all([
    tipoAuto ? prisma.estadia.count({ where: { idTipoVehiculo: tipoAuto.id, horaSalida: null } }) : 0,
    tipoMoto ? prisma.estadia.count({ where: { idTipoVehiculo: tipoMoto.id, horaSalida: null } }) : 0
  ]);

  return { ocupadosAutos, ocupadosMotos };
}

function calcularEstadoAforo(capacidad, ocupados) {
  const disponiblesAutos = Math.max(0, capacidad.capacidadAutos - ocupados.ocupadosAutos);
  const disponiblesMotos = Math.max(0, capacidad.capacidadMotos - ocupados.ocupadosMotos);

  const totalCapacidad = capacidad.capacidadAutos + capacidad.capacidadMotos;
  const totalOcupados = ocupados.ocupadosAutos + ocupados.ocupadosMotos;
  const totalDisponibles = disponiblesAutos + disponiblesMotos;

  const porcentajeAutos = capacidad.capacidadAutos > 0
    ? Math.round((ocupados.ocupadosAutos / capacidad.capacidadAutos) * 100)
    : 0;

  const porcentajeMotos = capacidad.capacidadMotos > 0
    ? Math.round((ocupados.ocupadosMotos / capacidad.capacidadMotos) * 100)
    : 0;

  const porcentajeTotal = totalCapacidad > 0
    ? Math.round((totalOcupados / totalCapacidad) * 100)
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
      disponibles: disponiblesAutos,
      porcentaje: porcentajeAutos
    },
    motos: {
      capacidad: capacidad.capacidadMotos,
      ocupados: ocupados.ocupadosMotos,
      disponibles: disponiblesMotos,
      porcentaje: porcentajeMotos
    },
    total: {
      capacidad: totalCapacidad,
      ocupados: totalOcupados,
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

    return res.json(estado);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo consultar el estado de espacios.' });
  }
});

router.put('/capacidad', async (req, res) => {
  const { capacidadAutos, capacidadMotos } = req.body || {};

  if (capacidadAutos === undefined && capacidadMotos === undefined) {
    return res.status(400).json({
      error: 'Debe especificar al menos una capacidad a actualizar (capacidadAutos o capacidadMotos).'
    });
  }

  if (capacidadAutos !== undefined && (!Number.isInteger(Number(capacidadAutos)) || Number(capacidadAutos) < 1)) {
    return res.status(400).json({ error: 'La capacidad de autos debe ser un número entero mayor a 0.' });
  }

  if (capacidadMotos !== undefined && (!Number.isInteger(Number(capacidadMotos)) || Number(capacidadMotos) < 1)) {
    return res.status(400).json({ error: 'La capacidad de motos debe ser un número entero mayor a 0.' });
  }

  try {
    const ocupados = await obtenerEstadiasActivasPorTipo();

    if (capacidadAutos !== undefined && Number(capacidadAutos) < ocupados.ocupadosAutos) {
      return res.status(400).json({
        error: `La capacidad de autos (${capacidadAutos}) no puede ser menor a los autos actualmente en cochera (${ocupados.ocupadosAutos}).`
      });
    }

    if (capacidadMotos !== undefined && Number(capacidadMotos) < ocupados.ocupadosMotos) {
      return res.status(400).json({
        error: `La capacidad de motos (${capacidadMotos}) no puede ser menor a las motos actualmente en cochera (${ocupados.ocupadosMotos}).`
      });
    }

    const nuevaCapacidad = guardarCapacidad({
      capacidadAutos: capacidadAutos !== undefined ? Number(capacidadAutos) : undefined,
      capacidadMotos: capacidadMotos !== undefined ? Number(capacidadMotos) : undefined
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
