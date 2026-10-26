const express = require('express');

const prisma = require('../config/prisma');

const router = express.Router();

const METODOS_PERMITIDOS = ['Efectivo', 'Yape', 'POS'];

async function asegurarMetodoPago(nombre) {
  return prisma.metodoPago.upsert({
    where: { nombre },
    update: {},
    create: { nombre }
  });
}

function calcularTiempoYCobro(horaIngreso, horaSalida, precioHora, precioFraccion) {
  const diffMs = Math.max(0, horaSalida.getTime() - horaIngreso.getTime());
  const horasCompletas = Math.floor(diffMs / 3600000);
  const minutos = Math.floor((diffMs % 3600000) / 60000);
  const hayFraccion = (diffMs % 3600000) > 0;

  const monto = (horasCompletas * precioHora) + (hayFraccion ? precioFraccion : 0);

  return {
    horasCompletas,
    minutos,
    tiempoHoras: horasCompletas,
    tiempoFraccion: hayFraccion ? Number((minutos / 60).toFixed(2)) : 0,
    monto: Number(monto.toFixed(2))
  };
}

// Endpoint para listar vehículos activos en cochera para el módulo de salida
router.get('/activos', async (req, res) => {
  try {
    const estadias = await prisma.estadia.findMany({
      where: { horaSalida: null },
      include: {
        tipoVehiculo: true,
        usuario: true,
        tarifa: true
      },
      orderBy: { horaIngreso: 'desc' }
    });

    return res.json(
      estadias.map((estadia) => ({
        id: estadia.id,
        placa: estadia.placa,
        tipo: estadia.tipoVehiculo.nombre,
        horaIngreso: estadia.horaIngreso,
        tarifaHora: estadia.tarifa ? Number(estadia.tarifa.precioHora).toFixed(2) : null,
        tarifaFraccion: estadia.tarifa ? Number(estadia.tarifa.precioFraccion).toFixed(2) : null,
        nota: estadia.nota ?? null,
        usuarioIngreso: estadia.usuario ? estadia.usuario.nombre : null
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron obtener los vehículos activos para salida.' });
  }
});

router.get('/metodos-pago', async (req, res) => {
  try {
    for (const nombre of METODOS_PERMITIDOS) {
      await asegurarMetodoPago(nombre);
    }

    const metodos = await prisma.metodoPago.findMany({ orderBy: { id: 'asc' } });
    return res.json(metodos.map((m) => ({ id: m.id, nombre: m.nombre })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron obtener los métodos de pago.' });
  }
});

router.post('/', async (req, res) => {
  const { estadiaId, placa, metodoPago = 'Efectivo' } = req.body || {};

  if (!estadiaId && !placa) {
    return res.status(400).json({ error: 'Debe especificar el vehículo para registrar la salida.' });
  }

  if (!METODOS_PERMITIDOS.includes(metodoPago)) {
    return res.status(400).json({
      error: `Método de pago no válido. Permitidos: ${METODOS_PERMITIDOS.join(', ')}.`
    });
  }

  try {
    const whereCond = estadiaId
      ? { id: Number(estadiaId), horaSalida: null }
      : { placa: String(placa).trim().toUpperCase(), horaSalida: null };

    const estadia = await prisma.estadia.findFirst({
      where: whereCond,
      include: {
        tipoVehiculo: true,
        tarifa: true
      }
    });

    if (!estadia) {
      return res.status(404).json({ error: 'No se encontró una estadía activa para el vehículo especificado.' });
    }

    let tarifa = estadia.tarifa;
    if (!tarifa) {
      tarifa = await prisma.tarifa.findFirst({
        where: { idTipoVehiculo: estadia.idTipoVehiculo, estado: true }
      });
    }

    if (!tarifa) {
      return res.status(500).json({ error: 'No hay una tarifa vigente para procesar el cobro de este vehículo.' });
    }

    const metodo = await asegurarMetodoPago(metodoPago);
    const horaSalida = new Date();
    const cobro = calcularTiempoYCobro(
      new Date(estadia.horaIngreso),
      horaSalida,
      Number(tarifa.precioHora),
      Number(tarifa.precioFraccion)
    );

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoPago = await tx.pago.create({
        data: {
          idMetodoPago: metodo.id,
          monto: cobro.monto,
          tiempoHoras: cobro.tiempoHoras,
          tiempoFraccion: cobro.tiempoFraccion,
          fechaHora: horaSalida
        }
      });

      const estadiaActualizada = await tx.estadia.update({
        where: { id: estadia.id },
        data: {
          horaSalida,
          idPago: nuevoPago.id
        },
        include: {
          tipoVehiculo: true
        }
      });

      return { nuevoPago, estadiaActualizada };
    });

    return res.status(200).json({
      mensaje: `Salida registrada: Placa [${resultado.estadiaActualizada.placa}] · S/ ${cobro.monto.toFixed(2)} · ${metodo.nombre}`,
      salida: {
        idEstadia: resultado.estadiaActualizada.id,
        placa: resultado.estadiaActualizada.placa,
        tipo: resultado.estadiaActualizada.tipoVehiculo.nombre,
        horaIngreso: estadia.horaIngreso,
        horaSalida,
        tiempo: `${cobro.horasCompletas} h ${cobro.minutos} min`,
        monto: cobro.monto,
        metodoPago: metodo.nombre,
        idPago: resultado.nuevoPago.id
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo registrar la salida y el cobro del vehículo.' });
  }
});

module.exports = router;
