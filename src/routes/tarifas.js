const express = require('express');

const prisma = require('../config/prisma');

const router = express.Router();

const REGEX_MONTO = /^\d+(\.\d{1,2})?$/;

function validarMonto(valor) {
  const texto = String(valor ?? '').trim();

  if (!REGEX_MONTO.test(texto)) {
    return false;
  }

  const numero = Number(texto);

  return numero >= 0.01 && numero <= 999.99;
}

router.get('/', async (req, res) => {
  try {
    const tarifas = await prisma.tarifa.findMany({
      include: { tipoVehiculo: true },
      orderBy: { id: 'asc' }
    });

    return res.json(
      tarifas.map((tarifa) => ({
        id: tarifa.id,
        tipo: tarifa.tipoVehiculo.nombre,
        precioHora: Number(tarifa.precioHora),
        precioFraccion: Number(tarifa.precioFraccion),
        estado: tarifa.estado
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron obtener las tarifas.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { precioHora, precioFraccion } = req.body || {};

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Identificador de tarifa inválido.' });
  }

  if (!validarMonto(precioHora) || !validarMonto(precioFraccion)) {
    return res.status(400).json({ error: 'Ingrese un monto numérico válido mayor a 0.00 (ej. 4.50).' });
  }

  try {
    const tarifa = await prisma.tarifa.update({
      where: { id },
      data: {
        precioHora: Number(precioHora),
        precioFraccion: Number(precioFraccion)
      }
    });

    return res.json({
      id: tarifa.id,
      precioHora: Number(tarifa.precioHora),
      precioFraccion: Number(tarifa.precioFraccion),
      mensaje: 'Tarifa actualizada correctamente'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tarifa no encontrada.' });
    }

    console.error(error);
    return res.status(500).json({ error: 'No se pudo actualizar la tarifa.' });
  }
});

module.exports = router;
