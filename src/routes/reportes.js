const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

/**
 * GET /api/reportes/diario?fecha=YYYY-MM-DD
 * Consulta la recaudación por fecha y método de pago.
 * Exclusivo para rol DUEÑO.
 */
router.get('/diario', async (req, res) => {
  const { fecha } = req.query;

  // Fecha por defecto: hoy (en zona horaria local de Perú UTC-5)
  let fechaConsulta;
  if (fecha) {
    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Utilice YYYY-MM-DD.' });
    }
    fechaConsulta = fecha;
  } else {
    const ahora = new Date();
    // Ajuste a fecha local
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    fechaConsulta = `${yyyy}-${mm}-${dd}`;
  }

  // Validar que no sea fecha futura
  const hoyStr = new Date().toISOString().split('T')[0];
  if (fechaConsulta > hoyStr) {
    return res.status(400).json({ error: 'Seleccione una fecha válida que no sea futura.' });
  }

  try {
    // Rango del día completo en UTC
    const inicioDia = new Date(`${fechaConsulta}T00:00:00.000Z`);
    const finDia = new Date(`${fechaConsulta}T23:59:59.999Z`);

    // Consultar pagos registrados en esa fecha
    const pagos = await prisma.pago.findMany({
      where: {
        fechaHora: {
          gte: inicioDia,
          lte: finDia
        }
      },
      include: {
        metodoPago: true,
        estadia: {
          include: {
            tipoVehiculo: true
          }
        }
      },
      orderBy: {
        fechaHora: 'desc'
      }
    });

    let totalEfectivo = 0;
    let totalYape = 0;
    const movimientos = [];

    for (const p of pagos) {
      const monto = Number(p.monto) || 0;
      const metodo = p.metodoPago?.nombre || 'Efectivo';

      if (metodo.toLowerCase() === 'efectivo') {
        totalEfectivo += monto;
      } else if (metodo.toLowerCase() === 'yape') {
        totalYape += monto;
      }

      movimientos.push({
        id: p.id,
        placa: p.estadia?.placa || 'SIN-PLACA',
        tipoVehiculo: p.estadia?.tipoVehiculo?.nombre || 'Vehículo',
        horaSalida: new Date(p.fechaHora).toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        metodoPago: metodo,
        monto: Number(monto.toFixed(2))
      });
    }

    const totalGeneral = Number((totalEfectivo + totalYape).toFixed(2));

    return res.json({
      fecha: fechaConsulta,
      totalEfectivo: Number(totalEfectivo.toFixed(2)),
      totalYape: Number(totalYape.toFixed(2)),
      totalGeneral,
      movimientos
    });
  } catch (error) {
    console.error('Error al consultar reporte de ingresos:', error);
    return res.status(500).json({ error: 'No se pudo cargar la recaudación. Intente nuevamente.' });
  }
});

module.exports = router;
