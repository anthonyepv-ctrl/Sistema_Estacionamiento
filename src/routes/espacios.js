const express = require('express');

const prisma = require('../config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../config/espacios');
const { autorizar } = require('../config/auth');

const router = express.Router();

async function obtenerEstadiasActivasPorTipo() {
  const [tipos, agrupado] = await Promise.all([
    prisma.tipoVehiculo.findMany({ select: { id: true, nombre: true } }),
    prisma.estadia.groupBy({
      by: ['idTipoVehiculo'],
      where: { horaSalida: null },
      _count: { _all: true }
    })
  ]);

  const idPorNombre = new Map(tipos.map((tipo) => [tipo.nombre, tipo.id]));
  const conteoPorId = new Map(agrupado.map((fila) => [fila.idTipoVehiculo, fila._count._all]));
  const ocupadosAutos = conteoPorId.get(idPorNombre.get('Automóvil / Camioneta')) || 0;
  const ocupadosMotos = conteoPorId.get(idPorNombre.get('Motocicleta')) || 0;
  const totalActivas = agrupado.reduce((acumulado, fila) => acumulado + fila._count._all, 0);
  const otrosOcupados = totalActivas - ocupadosAutos - ocupadosMotos;

  return { ocupadosAutos, ocupadosMotos, otrosOcupados };
}

function calcularEstadoAforo(capacidad, ocupados) {
  const otrosOcupados = ocupados.otrosOcupados || 0;
  const disponiblesAutos = Math.max(0, capacidad.capacidadAutos - ocupados.ocupadosAutos);
  const disponiblesMotos = Math.max(0, capacidad.capacidadMotos - ocupados.ocupadosMotos);

  const totalCapacidad = capacidad.capacidadAutos + capacidad.capacidadMotos;
  const totalOcupados = ocupados.ocupadosAutos + ocupados.ocupadosMotos + otrosOcupados;
  const totalDisponibles = Math.max(0, totalCapacidad - totalOcupados);

  const porcentajeAutos = capacidad.capacidadAutos > 0
    ? Math.min(100, Math.round((ocupados.ocupadosAutos / capacidad.capacidadAutos) * 100))
    : 0;

  const porcentajeMotos = capacidad.capacidadMotos > 0
    ? Math.min(100, Math.round((ocupados.ocupadosMotos / capacidad.capacidadMotos) * 100))
    : 0;

  const porcentajeTotal = totalCapacidad > 0
    ? Math.min(100, Math.round((totalOcupados / totalCapacidad) * 100))
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
    otros: {
      ocupados: otrosOcupados
    },
    total: {
      capacidad: totalCapacidad,
      ocupados: totalOcupados,
      disponibles: totalDisponibles,
      porcentaje: porcentajeTotal,
      otrosEnCochera: otrosOcupados
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

  if (capacidadAutos !== undefined && (!Number.isInteger(Number(capacidadAutos)) || Number(capacidadAutos) < 0)) {
    return res.status(400).json({ error: 'La capacidad de autos debe ser un número entero mayor o igual a 0.' });
  }

  if (capacidadMotos !== undefined && (!Number.isInteger(Number(capacidadMotos)) || Number(capacidadMotos) < 0)) {
    return res.status(400).json({ error: 'La capacidad de motos debe ser un número entero mayor o igual a 0.' });
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
