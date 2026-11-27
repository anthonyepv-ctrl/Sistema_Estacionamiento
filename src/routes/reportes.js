const express = require('express');
const prisma = require('../config/prisma');
const { esFechaValida } = require('../utils/validaciones');

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

  if (fecha !== undefined && typeof fecha !== 'string') {
    return res.status(400).json({
      error: 'Formato de fecha inválido. Utilice el formato YYYY-MM-DD.'
    });
  }

  let fechaConsulta = fecha || hoyPeru;

  // 1. Validar formato y existencia real de la fecha YYYY-MM-DD en calendario
  if (!esFechaValida(fechaConsulta)) {
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

    // 3. Consultar pagos en garita y adelantos pagados de reservas online en el rango del día en BD
    const [pagos, reservasPagadas] = await Promise.all([
      prisma.pago.findMany({
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
      }),
      prisma.reserva.findMany({
        where: {
          estadoPago: 'PAGADO',
          fechaReserva: {
            gte: inicioDia,
            lte: finDia
          }
        },
        include: {
          vehiculo: true,
          tipoVehiculo: true
        },
        orderBy: {
          fechaReserva: 'desc'
        }
      })
    ]);

    // 4. Lógica de agrupación por método de pago y cuadre de caja (Efectivo, Yape, POS, Culqi Online y otros)
    let totalEfectivo = 0;
    let totalYape = 0;
    let totalPos = 0;
    let totalCulqi = 0;
    let totalOtros = 0;
    let cantidadEfectivo = 0;
    let cantidadYape = 0;
    let cantidadPos = 0;
    let cantidadCulqi = 0;
    let cantidadOtros = 0;
    const movimientosConFecha = [];

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
      } else if (metodoNorm.includes('pos') || metodoNorm.includes('tarjeta')) {
        totalPos += monto;
        cantidadPos += 1;
      } else {
        totalOtros += monto;
        cantidadOtros += 1;
      }

      const horaSalida = new Date(p.fechaHora).toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });

      movimientosConFecha.push({
        ts: new Date(p.fechaHora).getTime(),
        item: {
          id: p.id,
          placa: p.estadia?.placa || 'SIN-PLACA',
          tipoVehiculo: p.estadia?.tipoVehiculo?.nombre || 'Automóvil / Camioneta',
          horaSalida,
          metodoPago: metodo,
          monto: Number(monto.toFixed(2))
        }
      });
    }

    for (const r of reservasPagadas) {
      const monto = Number(r.montoAdelanto) || 0;
      if (monto <= 0) continue;
      totalCulqi += monto;
      cantidadCulqi += 1;

      const horaReserva = new Date(r.fechaReserva).toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });

      movimientosConFecha.push({
        ts: new Date(r.fechaReserva).getTime(),
        item: {
          id: `RES-${r.id}`,
          placa: r.vehiculo?.placa || 'RESERVA',
          tipoVehiculo: r.tipoVehiculo?.nombre || 'Automóvil / Camioneta',
          horaSalida: horaReserva,
          metodoPago: 'Culqi Online',
          monto: Number(monto.toFixed(2))
        }
      });
    }

    movimientosConFecha.sort((a, b) => b.ts - a.ts);
    const movimientos = movimientosConFecha.map((x) => x.item);

    const totalDigital = Number((totalYape + totalPos + totalCulqi + totalOtros).toFixed(2));
    const cantidadDigital = cantidadYape + cantidadPos + cantidadCulqi + cantidadOtros;
    const totalGeneral = Number((totalEfectivo + totalDigital).toFixed(2));
    const totalTransacciones = pagos.length + cantidadCulqi;

    const porcentajeFisico = totalGeneral > 0 ? Number(((totalEfectivo / totalGeneral) * 100).toFixed(1)) : 0;
    const porcentajeDigital = totalGeneral > 0 ? Number(((totalDigital / totalGeneral) * 100).toFixed(1)) : 0;

    // Formato de fecha para presentación peruana
    const [yyyy, mm, dd] = fechaConsulta.split('-');
    const fechaFormateada = `${dd}/${mm}/${yyyy}`;

    // Estructura de cuadre de caja financiero
    const metodoDigitalTexto = [
      cantidadYape > 0 ? 'Yape' : null,
      cantidadPos > 0 ? 'POS' : null,
      cantidadCulqi > 0 ? 'Culqi Online' : null
    ].filter(Boolean).join(' / ') || 'Yape';

    const cuadre = {
      dineroFisico: {
        metodo: 'Efectivo',
        descripcion: 'Efectivo en caja física para arqueo',
        total: Number(totalEfectivo.toFixed(2)),
        cantidadCobros: cantidadEfectivo,
        porcentaje: porcentajeFisico
      },
      dineroDigital: {
        metodo: metodoDigitalTexto,
        descripcion: 'Cobros digitales (Yape, POS y Culqi Online) para contrastar en banco',
        total: totalDigital,
        cantidadCobros: cantidadDigital,
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
      totalPos: Number(totalPos.toFixed(2)),
      totalCulqi: Number(totalCulqi.toFixed(2)),
      cantidadPos,
      cantidadCulqi,
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

const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function obtenerPartesPeru(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(fecha);
  const valor = (tipo) => Number(partes.find((parte) => parte.type === tipo).value);
  return { anio: valor('year'), mes: valor('month'), dia: valor('day'), hora: valor('hour'), minuto: valor('minute') };
}

function obtenerAhoraPeru() {
  return obtenerPartesPeru(new Date());
}

function obtenerRangoPeriodo(anio, mes) {
  if (mes) {
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return {
      inicio: new Date(`${anio}-${String(mes).padStart(2, '0')}-01T00:00:00.000-05:00`),
      fin: new Date(`${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}T23:59:59.999-05:00`),
      ultimoDia
    };
  }
  return {
    inicio: new Date(`${anio}-01-01T00:00:00.000-05:00`),
    fin: new Date(`${anio}-12-31T23:59:59.999-05:00`)
  };
}

function validarPeriodo(req) {
  const periodo = typeof req.query.periodo === 'string' ? req.query.periodo : (req.query.periodo === undefined ? 'mensual' : '');
  const anioRaw = typeof req.query.anio === 'string' ? req.query.anio.trim() : '';
  const mesRaw = typeof req.query.mes === 'string' ? req.query.mes.trim() : '';
  const anio = /^\d{4}$/.test(anioRaw) ? Number(anioRaw) : NaN;
  const mes = /^\d{1,2}$/.test(mesRaw) ? Number(mesRaw) : NaN;
  const ahora = obtenerAhoraPeru();

  if (periodo !== 'mensual' && periodo !== 'anual') {
    return { error: "Tipo de reporte no soportado. Valores permitidos: 'mensual' o 'anual'." };
  }
  if (!Number.isInteger(anio) || anio < 2024) {
    return { error: 'Año de consulta inválido. Ingrese un año válido a partir del 2024.' };
  }
  if (periodo === 'mensual' && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
    return { error: 'Mes de consulta inválido. El mes debe estar comprendido entre 1 y 12.' };
  }
  if (anio > ahora.anio) {
    return { error: 'No se pueden consultar períodos futuros. El año seleccionado es posterior al año actual.' };
  }
  if (periodo === 'mensual' && anio === ahora.anio && mes > ahora.mes) {
    return { error: 'No se pueden consultar meses futuros. Seleccione el mes actual o uno anterior.' };
  }

  return { periodo, anio, mes: periodo === 'mensual' ? mes : null };
}

function redondear(valor) {
  return Number(Number(valor || 0).toFixed(2));
}

function formatearMoneda(valor) {
  return `S/ ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatearFechaHoraPeru(fecha) {
  const partes = obtenerPartesPeru(new Date(fecha));
  return `${String(partes.dia).padStart(2, '0')}/${String(partes.mes).padStart(2, '0')}/${partes.anio} ${String(partes.hora).padStart(2, '0')}:${String(partes.minuto).padStart(2, '0')}`;
}

function normalizarMetodo(nombre) {
  return String(nombre || '').trim() || 'Sin método';
}

async function consultarPagosPeriodo(anio, mes) {
  const rango = obtenerRangoPeriodo(anio, mes);
  const [pagosBase, reservasPagadas] = await Promise.all([
    prisma.pago.findMany({
      where: {
        fechaHora: {
          gte: rango.inicio,
          lte: rango.fin
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
        fechaHora: 'asc'
      }
    }),
    prisma.reserva.findMany({
      where: {
        estadoPago: 'PAGADO',
        fechaReserva: {
          gte: rango.inicio,
          lte: rango.fin
        }
      },
      include: {
        vehiculo: true,
        tipoVehiculo: true
      },
      orderBy: {
        fechaReserva: 'asc'
      }
    })
  ]);

  const pagosReservas = reservasPagadas
    .filter((r) => Number(r.montoAdelanto) > 0)
    .map((r) => ({
      id: `RES-${r.id}`,
      monto: r.montoAdelanto,
      fechaHora: r.fechaReserva,
      metodoPago: { nombre: 'Culqi Online' },
      estadia: {
        placa: r.vehiculo ? r.vehiculo.placa : 'RESERVA',
        tipoVehiculo: r.tipoVehiculo || { nombre: 'Automóvil / Camioneta' }
      }
    }));

  const pagos = [...pagosBase, ...pagosReservas].sort(
    (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()
  );

  return { pagos, rango };
}

/**
 * Función central de agregación estadística (UPAO-18 / UPAO-65 / UPAO-66).
 * Calcula totales, serie diaria por método de pago, concurrencia horaria y consolidado por método.
 */
async function generarReporteGraficos(periodo, anio, mes) {
  const { pagos, rango } = await consultarPagosPeriodo(anio, mes);
  const metodos = new Map();
  const dias = new Map();
  const meses = new Map();
  const horas = new Map();
  let totalGeneral = 0;

  for (const pago of pagos) {
    const monto = redondear(pago.monto);
    const partes = obtenerPartesPeru(new Date(pago.fechaHora));
    const metodo = normalizarMetodo(pago.metodoPago ? pago.metodoPago.nombre : null);
    totalGeneral = redondear(totalGeneral + monto);

    if (!metodos.has(metodo)) metodos.set(metodo, { nombre: metodo, monto: 0, cantidad: 0 });
    const itemMetodo = metodos.get(metodo);
    itemMetodo.monto = redondear(itemMetodo.monto + monto);
    itemMetodo.cantidad += 1;

    const claveDia = `${partes.anio}-${partes.mes}-${partes.dia}`;
    if (!dias.has(claveDia)) dias.set(claveDia, { monto: 0, vehiculos: 0 });
    const itemDia = dias.get(claveDia);
    itemDia.monto = redondear(itemDia.monto + monto);
    itemDia.vehiculos += 1;

    if (!meses.has(partes.mes)) meses.set(partes.mes, { monto: 0, vehiculos: 0 });
    const itemMes = meses.get(partes.mes);
    itemMes.monto = redondear(itemMes.monto + monto);
    itemMes.vehiculos += 1;

    if (partes.hora >= 0 && partes.hora <= 23) {
      if (!horas.has(partes.hora)) horas.set(partes.hora, { vehiculos: 0, monto: 0 });
      const itemHora = horas.get(partes.hora);
      itemHora.vehiculos += 1;
      itemHora.monto = redondear(itemHora.monto + monto);
    }
  }

  const porMetodo = [...metodos.values()]
    .map((item) => ({
      ...item,
      porcentaje: totalGeneral > 0 ? redondear((item.monto / totalGeneral) * 100) : 0
    }))
    .sort((a, b) => b.monto - a.monto);

  const itemEf = porMetodo.find((item) => item.nombre.toLowerCase().includes('efectivo'));
  const itemYa = porMetodo.find((item) => item.nombre.toLowerCase().includes('yape'));
  const itemPo = porMetodo.find((item) => item.nombre.toLowerCase().includes('pos'));
  const totalEfectivo = redondear(itemEf ? itemEf.monto : 0);
  const totalYape = redondear(itemYa ? itemYa.monto : 0);
  const totalPos = redondear(itemPo ? itemPo.monto : 0);
  const porcentajeEfectivo = totalGeneral > 0 ? redondear((totalEfectivo / totalGeneral) * 100) : 0;
  const porcentajeYape = totalGeneral > 0 ? redondear((totalYape / totalGeneral) * 100) : 0;
  const porcentajePos = totalGeneral > 0 ? redondear((totalPos / totalGeneral) * 100) : 0;

  let serieDiaria = [];
  if (periodo === 'mensual') {
    serieDiaria = Array.from({ length: rango.ultimoDia }, (_, indice) => {
      const dia = indice + 1;
      const item = dias.get(`${anio}-${mes}-${dia}`) || { monto: 0, vehiculos: 0 };
      return { dia, monto: item.monto, efectivo: 0, yape: 0, pos: 0, vehiculos: item.vehiculos };
    });

    for (const pago of pagos) {
      const partes = obtenerPartesPeru(new Date(pago.fechaHora));
      const metodo = normalizarMetodo(pago.metodoPago ? pago.metodoPago.nombre : null).toLowerCase();
      const fila = serieDiaria[partes.dia - 1];
      if (!fila) continue;
      if (metodo.includes('efectivo')) fila.efectivo = redondear(fila.efectivo + redondear(pago.monto));
      if (metodo.includes('yape')) fila.yape = redondear(fila.yape + redondear(pago.monto));
      if (metodo.includes('pos')) fila.pos = redondear(fila.pos + redondear(pago.monto));
    }
  }

  let serieMensual = [];
  if (periodo === 'anual') {
    serieMensual = MESES_ES.map((nombre, indice) => {
      const numeroMes = indice + 1;
      const item = meses.get(numeroMes) || { monto: 0, vehiculos: 0 };
      return { mes: numeroMes, nombre, monto: item.monto, vehiculos: item.vehiculos };
    });
  }

  const concurrenciaHoraria = Array.from({ length: 24 }, (_, hora) => {
    const item = horas.get(hora) || { vehiculos: 0, monto: 0 };
    return { hora, vehiculos: item.vehiculos, monto: item.monto };
  });

  const etiquetaPeriodo = periodo === 'anual' ? `Año ${anio}` : `${MESES_ES[mes - 1]} ${anio}`;

  return {
    periodo,
    anio,
    mes,
    etiquetaPeriodo,
    tieneDatos: pagos.length > 0,
    mensaje: pagos.length > 0 ? null : 'No se registran ingresos para el período seleccionado',
    totales: {
      totalGeneral,
      totalEfectivo,
      totalYape,
      totalPos,
      concurrenciaTotal: pagos.length,
      porcentajeEfectivo,
      porcentajeYape,
      porcentajePos,
      porMetodo
    },
    serieDiaria,
    concurrenciaHoraria,
    serieMensual
  };
}

/**
 * GET /api/reportes/graficos?periodo=mensual|anual&anio=YYYY&mes=MM
 * Datos reales para el dashboard estadístico del dueño (UPAO-18 / UPAO-65).
 */
router.get('/graficos', async (req, res) => {
  const validacion = validarPeriodo(req);
  if (validacion.error) {
    return res.status(400).json({ error: validacion.error });
  }

  const { periodo, anio, mes } = validacion;

  try {
    const resultado = await generarReporteGraficos(periodo, anio, mes);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener gráficos estadísticos:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los datos estadísticos.' });
  }
});

/**
 * GET /api/reportes/graficos-mes?mes=MM&anio=YYYY
 * Endpoint específico de agregaciones mensuales (UPAO-18 / UPAO-66).
 * Valida meses futuros con HTTP 400 y retorna la serie diaria y consolidado por método de pago.
 */
router.get('/graficos-mes', async (req, res) => {
  req.query.periodo = 'mensual';
  const validacion = validarPeriodo(req);
  if (validacion.error) {
    return res.status(400).json({ error: validacion.error });
  }

  const { anio, mes } = validacion;

  try {
    const resultado = await generarReporteGraficos('mensual', anio, mes);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener agregaciones mensuales (graficos-mes):', error);
    return res.status(500).json({ error: 'No se pudieron obtener los datos estadísticos mensuales.' });
  }
});

/**
 * GET /api/reportes/exportar?periodo=mensual|anual&anio=YYYY&mes=MM
 * Genera el CSV compatible con Excel (UTF-8 BOM) con las columnas requeridas.
 */
router.get('/exportar', async (req, res) => {
  const validacion = validarPeriodo(req);
  if (validacion.error) {
    return res.status(400).json({ error: validacion.error });
  }

  const { periodo, anio, mes } = validacion;

  try {
    const { pagos } = await consultarPagosPeriodo(anio, mes);
    const filas = [['Fecha', 'Placa', 'Tipo', 'Método', 'Monto']];
    let totalGeneral = 0;
    let totalEfectivo = 0;
    let totalYape = 0;
    let totalPos = 0;
    let totalCulqi = 0;

    for (const pago of pagos) {
      const monto = redondear(pago.monto);
      const metodo = normalizarMetodo(pago.metodoPago ? pago.metodoPago.nombre : null);
      totalGeneral = redondear(totalGeneral + monto);
      if (metodo.toLowerCase().includes('efectivo')) totalEfectivo = redondear(totalEfectivo + monto);
      if (metodo.toLowerCase().includes('yape')) totalYape = redondear(totalYape + monto);
      if (metodo.toLowerCase().includes('pos')) totalPos = redondear(totalPos + monto);
      if (metodo.toLowerCase().includes('culqi')) totalCulqi = redondear(totalCulqi + monto);

      filas.push([
        formatearFechaHoraPeru(pago.fechaHora),
        pago.estadia ? pago.estadia.placa : 'SIN-PLACA',
        pago.estadia && pago.estadia.tipoVehiculo ? pago.estadia.tipoVehiculo.nombre : 'Sin tipo',
        metodo,
        formatearMoneda(monto)
      ]);
    }

    filas.push(['TOTAL RECAUDADO', '', '', '', formatearMoneda(totalGeneral)]);
    filas.push(['TOTAL EFECTIVO', '', '', '', formatearMoneda(totalEfectivo)]);
    filas.push(['TOTAL YAPE', '', '', '', formatearMoneda(totalYape)]);
    if (totalPos > 0) {
      filas.push(['TOTAL POS', '', '', '', formatearMoneda(totalPos)]);
    }
    if (totalCulqi > 0) {
      filas.push(['TOTAL CULQI ONLINE', '', '', '', formatearMoneda(totalCulqi)]);
    }
    filas.push(['TOTAL VEHÍCULOS ATENDIDOS', '', '', '', String(pagos.length)]);

    const contenido = `\uFEFF${filas.map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
    const nombreArchivo = periodo === 'mensual'
      ? `reporte_ingresos_${anio}_${String(mes).padStart(2, '0')}.csv`
      : `reporte_ingresos_${anio}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send(contenido);
  } catch (error) {
    console.error('Error al exportar el reporte estadístico:', error);
    return res.status(500).json({ error: 'No se pudo exportar el reporte.' });
  }
});

module.exports = router;
