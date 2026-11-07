const express = require('express');
const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');

const router = express.Router();

/**
 * Consulta la cantidad de estadías activas (horaSalida IS NULL) agrupadas por tipo de vehículo.
 * Se agrupa por idTipoVehiculo en lugar de consultar dos nombres fijos, para no perder de vista
 * estadías de otros tipos (p. ej. "Reserva Web") que también ocupan un espacio físico.
 */
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
  const otrosEnCochera = totalActivas - ocupadosAutos - ocupadosMotos;

  return { ocupadosAutos, ocupadosMotos, otrosEnCochera };
}

/**
 * Fórmula formal de disponibilidad con piso matemático:
 * Disponibles = max(0, Capacidad - EnCochera - ReservasVigentes)
 */
function calcularDisponibles(capacidad, enCochera, reservasVigentes = 0) {
  return Math.max(0, capacidad - enCochera - reservasVigentes);
}

/**
 * GET /api/publico/disponibilidad
 * Endpoint público sin autenticación para que conductores consulten disponibilidad en tiempo real.
 */
router.get('/disponibilidad', async (req, res) => {
  try {
    const capacidad = obtenerCapacidad();
    const { ocupadosAutos, ocupadosMotos, otrosEnCochera } = await obtenerEstadiasActivasPorTipo();

    // En Sprint 2, la entidad reserva es trabajo futuro (UPAO-21), por lo que reservasVigentes = 0
    const reservasVigentesAutos = 0;
    const reservasVigentesMotos = 0;

    const disponiblesAutos = calcularDisponibles(capacidad.capacidadAutos, ocupadosAutos, reservasVigentesAutos);
    const disponiblesMotos = calcularDisponibles(capacidad.capacidadMotos, ocupadosMotos, reservasVigentesMotos);

    const totalCapacidad = capacidad.capacidadAutos + capacidad.capacidadMotos;
    const totalEnCochera = ocupadosAutos + ocupadosMotos + otrosEnCochera;
    const totalReservas = reservasVigentesAutos + reservasVigentesMotos;
    const totalDisponibles = disponiblesAutos + disponiblesMotos;

    if (otrosEnCochera > 0) {
      console.warn(
        `[disponibilidad] ${otrosEnCochera} estadía(s) activa(s) de un tipo distinto de "Automóvil / Camioneta" y "Motocicleta". ` +
        'No se descuentan de los cupos por tipo; revisar la política de aforo (DEF-77-02 del plan de pruebas UPAO-77).'
      );
    }

    // Los cupos cambian en segundos: ninguna caché intermedia debe servirlos.
    res.set('Cache-Control', 'no-store, max-age=0');

    return res.json({
      autos: {
        capacidad: capacidad.capacidadAutos,
        enCochera: ocupadosAutos,
        reservasVigentes: reservasVigentesAutos,
        disponibles: disponiblesAutos
      },
      motos: {
        capacidad: capacidad.capacidadMotos,
        enCochera: ocupadosMotos,
        reservasVigentes: reservasVigentesMotos,
        disponibles: disponiblesMotos
      },
      total: {
        capacidad: totalCapacidad,
        enCochera: totalEnCochera,
        reservasVigentes: totalReservas,
        disponibles: totalDisponibles,
        otrosEnCochera
      },
      ultimaActualizacion: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad pública de espacios:', error);
    return res.status(500).json({ error: 'No se pudo consultar la disponibilidad de espacios.' });
  }
});

module.exports = router;
