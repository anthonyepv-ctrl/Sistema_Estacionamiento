const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

/**
 * Convierte una fecha YYYY-MM-DD al rango completo del día en hora peruana (UTC-5).
 */
function obtenerRangoFechaPeru(fechaStr) {
  const inicioDia = new Date(`${fechaStr}T00:00:00-05:00`);
  const finDia = new Date(`${fechaStr}T23:59:59.999-05:00`);
  return { inicioDia, finDia };
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD considerando la zona horaria de Perú (UTC-5).
 */
function obtenerFechaHoyPeru() {
  const ahora = new Date();
  const opciones = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
  const partes = new Intl.DateTimeFormat('en-US', opciones).formatToParts(ahora);
  const yyyy = partes.find((p) => p.type === 'year').value;
  const mm = partes.find((p) => p.type === 'month').value;
  const dd = partes.find((p) => p.type === 'day').value;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * GET /api/reportes/diario?fecha=YYYY-MM-DD
 * Consulta y agrupa los montos cobrados en la tabla de salidas por método de pago.
 * Provee la lógica de cuadre de caja (dinero físico vs digital).
 * Tarea: UPAO-54 / Historia: UPAO-17
 */
router.get('/diario', async (req, res) => {
  const { fecha } = req.query;
  const hoyPeru = obtenerFechaHoyPeru();

  let fechaConsulta = fecha || hoyPeru;

  // 1. Validar formato de fecha YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaConsulta)) {
    return res.status(400).json({
      error: 'Formato de fecha inválido. Utilice el formato YYYY-MM-DD.'
    });
  }

  // 2. Bloquear fechas futuras
  if (fechaConsulta > hoyPeru) {
    return res.status(400).json({
      error: 'Seleccione una fecha válida que no sea futura.'
    });
  }

  try {
    const { inicioDia, finDia } = obtenerRangoFechaPeru(fechaConsulta);

    // 3. Consultar pagos registrados en el rango del día en BD
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

    // 4. Lógica de agrupación por método de pago y cuadre de caja
    let totalEfectivo = 0;
    let totalYape = 0;
    let cantidadEfectivo = 0;
    let cantidadYape = 0;
    const movimientos = [];

    for (const p of pagos) {
      const monto = Number(p.monto) || 0;
      const metodo = (p.metodoPago?.nombre || 'Efectivo').trim();
      const metodoNorm = metodo.toLowerCase();

      if (metodoNorm.includes('efectivo')) {
        totalEfectivo += monto;
        cantidadEfectivo += 1;
      } else if (metodoNorm.includes('yape')) {
        totalYape += monto;
        cantidadYape += 1;
      }

      // Hora formateada en horario de Perú (24 horas)
      const horaSalida = new Date(p.fechaHora).toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      movimientos.push({
        id: p.id,
        placa: p.estadia?.placa || 'SIN-PLACA',
        tipoVehiculo: p.estadia?.tipoVehiculo?.nombre || 'Automóvil / Camioneta',
        horaSalida,
        metodoPago: metodo,
        monto: Number(monto.toFixed(2))
      });
    }

    const totalGeneral = Number((totalEfectivo + totalYape).toFixed(2));
    const totalTransacciones = cantidadEfectivo + cantidadYape;

    const porcentajeFisico = totalGeneral > 0 ? Number(((totalEfectivo / totalGeneral) * 100).toFixed(1)) : 0;
    const porcentajeDigital = totalGeneral > 0 ? Number(((totalYape / totalGeneral) * 100).toFixed(1)) : 0;

    // Formato de fecha para presentación peruana
    const [yyyy, mm, dd] = fechaConsulta.split('-');
    const fechaFormateada = `${dd}/${mm}/${yyyy}`;

    // Estructura de cuadre de caja financiero
    const cuadre = {
      dineroFisico: {
        metodo: 'Efectivo',
        descripcion: 'Efectivo en caja física para arqueo',
        total: Number(totalEfectivo.toFixed(2)),
        cantidadCobros: cantidadEfectivo,
        porcentaje: porcentajeFisico
      },
      dineroDigital: {
        metodo: 'Yape',
        descripcion: 'Cobros digitales para contrastar en app Yape / banco',
        total: Number(totalYape.toFixed(2)),
        cantidadCobros: cantidadYape,
        porcentaje: porcentajeDigital
      },
      totalGeneral,
      totalTransacciones,
      estadoCuadre: totalGeneral > 0 ? 'CON_MOVIMIENTOS' : 'SIN_MOVIMIENTOS'
    };

    return res.status(200).json({
      fecha: fechaConsulta,
      fechaFormateada,
      cuadre,
      totalEfectivo: Number(totalEfectivo.toFixed(2)),
      totalYape: Number(totalYape.toFixed(2)),
      totalGeneral,
      movimientos
    });

  } catch (error) {
    console.error('Error al procesar reporte de ingresos diarios:', error);
    return res.status(500).json({
      error: 'No se pudo cargar la recaudación. Intente nuevamente.'
    });
  }
});

module.exports = router;
