const express = require('express');
const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');

const router = express.Router();

/**
 * Consulta la cantidad de estadías activas (horaSalida IS NULL) agrupadas por tipo de vehículo.
 */
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
    const { ocupadosAutos, ocupadosMotos } = await obtenerEstadiasActivasPorTipo();

    // En Sprint 2, la entidad reserva es trabajo futuro (UPAO-21), por lo que reservasVigentes = 0
    const reservasVigentesAutos = 0;
    const reservasVigentesMotos = 0;

    const disponiblesAutos = calcularDisponibles(capacidad.capacidadAutos, ocupadosAutos, reservasVigentesAutos);
    const disponiblesMotos = calcularDisponibles(capacidad.capacidadMotos, ocupadosMotos, reservasVigentesMotos);

    const totalCapacidad = capacidad.capacidadAutos + capacidad.capacidadMotos;
    const totalEnCochera = ocupadosAutos + ocupadosMotos;
    const totalReservas = reservasVigentesAutos + reservasVigentesMotos;
    const totalDisponibles = disponiblesAutos + disponiblesMotos;

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
        disponibles: totalDisponibles
      },
      ultimaActualizacion: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad pública de espacios:', error);
    return res.status(500).json({ error: 'No se pudo consultar la disponibilidad de espacios.' });
  }
});

module.exports = router;
