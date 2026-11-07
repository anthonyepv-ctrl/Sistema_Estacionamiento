const express = require('express');

const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');

const router = express.Router();

const BLOQUES_HORARIOS = [
  { bloque: '06:00 - 08:00', inicio: 6, fin: 8 },
  { bloque: '08:00 - 10:00', inicio: 8, fin: 10 },
  { bloque: '10:00 - 12:00', inicio: 10, fin: 12 },
  { bloque: '12:00 - 14:00', inicio: 12, fin: 14 },
  { bloque: '14:00 - 16:00', inicio: 14, fin: 16 },
  { bloque: '16:00 - 18:00', inicio: 16, fin: 18 },
  { bloque: '18:00 - 20:00', inicio: 18, fin: 20 },
  { bloque: '20:00 - 22:00', inicio: 20, fin: 22 },
  { bloque: '22:00 - 06:00', inicio: 22, fin: 6 }
];

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

  return {
    anio: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    hora: valor('hour'),
    minuto: valor('minute')
  };
}

function obtenerHoyPeru() {
  const partes = obtenerPartesPeru(new Date());
  return `${partes.anio}-${String(partes.mes).padStart(2, '0')}-${String(partes.dia).padStart(2, '0')}`;
}

function esFechaValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;

  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return fecha.getUTCFullYear() === anio
    && fecha.getUTCMonth() === mes - 1
    && fecha.getUTCDate() === dia;
}

function validarRango(req) {
  const fechaInicio = String(req.query.fechaInicio || req.query.inicio || '').trim();
  const fechaFin = String(req.query.fechaFin || req.query.fin || '').trim();
  const hoy = obtenerHoyPeru();

  if (!fechaInicio || !fechaFin) {
    return { error: 'Debe ingresar la fecha de inicio y la fecha de fin.' };
  }

  if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) {
    return { error: 'Formato de fecha inválido. Utilice YYYY-MM-DD.' };
  }

  if (fechaInicio > fechaFin) {
    return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin' };
  }

  if (fechaInicio > hoy || fechaFin > hoy) {
    return { error: 'No se pueden consultar reportes de fechas futuras' };
  }

  return {
    fechaInicio,
    fechaFin,
    inicio: new Date(`${fechaInicio}T00:00:00.000-05:00`),
    fin: new Date(`${fechaFin}T23:59:59.999-05:00`)
  };
}

function obtenerEstadiasPeriodo(inicio, fin) {
  return prisma.estadia.findMany({
    where: {
      horaIngreso: { lte: fin },
      OR: [
        { horaSalida: null },
        { horaSalida: { gte: inicio } }
      ]
    },
    include: {
      tipoVehiculo: true
    },
    orderBy: {
      horaIngreso: 'asc'
    }
  });
}

function esMotocicleta(estadia) {
  return estadia.tipoVehiculo.nombre.toLowerCase().includes('moto');
}

function obtenerIndiceBloque(hora) {
  if (hora >= 6 && hora < 8) return 0;
  if (hora >= 8 && hora < 10) return 1;
  if (hora >= 10 && hora < 12) return 2;
  if (hora >= 12 && hora < 14) return 3;
  if (hora >= 14 && hora < 16) return 4;
  if (hora >= 16 && hora < 18) return 5;
  if (hora >= 18 && hora < 20) return 6;
  if (hora >= 20 && hora < 22) return 7;
  return 8;
}

function calcularAforoMaximo(estadias, inicio, fin) {
  const ahora = new Date();
  const eventos = [];

  for (const estadia of estadias) {
    const inicioEstadia = new Date(Math.max(estadia.horaIngreso.getTime(), inicio.getTime()));
    const finEstimado = estadia.horaSalida || ahora;
    const finEstadia = new Date(Math.min(finEstimado.getTime(), fin.getTime()));

    if (finEstadia.getTime() < inicioEstadia.getTime()) continue;

    const moto = esMotocicleta(estadia);
    eventos.push({ fecha: inicioEstadia, delta: 1, moto });
    eventos.push({ fecha: finEstadia, delta: -1, moto });
  }

  eventos.sort((a, b) => {
    const diferencia = a.fecha.getTime() - b.fecha.getTime();
    if (diferencia !== 0) return diferencia;
    return b.delta - a.delta;
  });

  let autosActuales = 0;
  let motosActuales = 0;
  let maximoAutos = 0;
  let maximoMotos = 0;
  let maximoSimultaneo = 0;

  for (const evento of eventos) {
    if (evento.moto) {
      motosActuales += evento.delta;
      maximoMotos = Math.max(maximoMotos, motosActuales);
    } else {
      autosActuales += evento.delta;
      maximoAutos = Math.max(maximoAutos, autosActuales);
    }

    maximoSimultaneo = Math.max(maximoSimultaneo, autosActuales + motosActuales);
  }

  return {
    aforoMaximoAutos: maximoAutos,
    aforoMaximoMotos: maximoMotos,
    aforoMaximoSimultaneo: maximoSimultaneo
  };
}

function redondear(valor) {
  return Number(Number(valor || 0).toFixed(2));
}

function formatearFecha(partes) {
  return `${String(partes.dia).padStart(2, '0')}/${String(partes.mes).padStart(2, '0')}/${partes.anio}`;
}

function formatearHora(partes) {
  return `${String(partes.hora).padStart(2, '0')}:${String(partes.minuto).padStart(2, '0')}`;
}

router.get('/', async (req, res) => {
  const validacion = validarRango(req);

  if (validacion.error) {
    return res.status(400).json({ error: validacion.error });
  }

  const { fechaInicio, fechaFin, inicio, fin } = validacion;

  try {
    const estadias = await obtenerEstadiasPeriodo(inicio, fin);
    const capacidad = obtenerCapacidad();
    const capacidadTotalCochera = capacidad.capacidadAutos + capacidad.capacidadMotos;

    const estadiasIngreso = estadias.filter((estadia) => (
      estadia.horaIngreso.getTime() >= inicio.getTime()
      && estadia.horaIngreso.getTime() <= fin.getTime()
    ));

    let totalAutos = 0;
    let totalMotos = 0;
    const conteoBloques = new Array(BLOQUES_HORARIOS.length).fill(0);

    for (const estadia of estadiasIngreso) {
      if (esMotocicleta(estadia)) {
        totalMotos += 1;
      } else {
        totalAutos += 1;
      }

      const partes = obtenerPartesPeru(estadia.horaIngreso);
      conteoBloques[obtenerIndiceBloque(partes.hora)] += 1;
    }

    const totalVehiculos = estadiasIngreso.length;
    const aforo = calcularAforoMaximo(estadias, inicio, fin);
    const sinDatos = estadias.length === 0;
    const maximoBloque = Math.max(...conteoBloques);

    const bloquesHorarios = sinDatos
      ? []
      : BLOQUES_HORARIOS.map((bloque, indice) => {
        const item = {
          bloque: bloque.bloque,
          cantidad: conteoBloques[indice],
          porcentaje: totalVehiculos > 0 ? redondear((conteoBloques[indice] / totalVehiculos) * 100) : 0
        };

        if (maximoBloque > 0 && conteoBloques[indice] === maximoBloque) {
          item.esPico = true;
        }

        return item;
      });

    const respuesta = {
      rango: {
        fechaInicio,
        fechaFin
      },
      resumen: {
        totalVehiculos,
        totalAutos,
        totalMotos,
        aforoMaximoSimultaneo: aforo.aforoMaximoSimultaneo,
        aforoMaximoAutos: aforo.aforoMaximoAutos,
        aforoMaximoMotos: aforo.aforoMaximoMotos,
        capacidadTotalCochera
      },
      bloquesHorarios,
      sinDatos
    };

    if (sinDatos) {
      respuesta.mensaje = 'No se registran movimientos ni ingresos para el período seleccionado';
    }

    return res.json(respuesta);
  } catch (error) {
    console.error('Error al consultar el nivel de ocupación:', error);
    return res.status(500).json({ error: 'No se pudo consultar el nivel de ocupación.' });
  }
});

router.get('/exportar', async (req, res) => {
  const validacion = validarRango(req);

  if (validacion.error) {
    return res.status(400).json({ error: validacion.error });
  }

  const formato = String(req.query.formato || 'csv').toLowerCase();

  if (formato !== 'csv' && formato !== 'excel') {
    return res.status(400).json({ error: "Formato de exportación no soportado. Valores permitidos: 'csv' o 'excel'." });
  }

  const { fechaInicio, fechaFin, inicio, fin } = validacion;

  try {
    const estadias = await obtenerEstadiasPeriodo(inicio, fin);
    const ahora = new Date();
    const filas = [[
      'ID_Estadia',
      'Placa',
      'Tipo_Vehiculo',
      'Fecha_Ingreso',
      'Hora_Ingreso',
      'Fecha_Salida',
      'Hora_Salida',
      'Tiempo_Horas',
      'Estado'
    ]];

    for (const estadia of estadias) {
      const partesIngreso = obtenerPartesPeru(estadia.horaIngreso);
      const partesSalida = estadia.horaSalida ? obtenerPartesPeru(estadia.horaSalida) : null;
      const finCalculo = estadia.horaSalida || ahora;
      const tiempoHoras = Math.max(0, (finCalculo.getTime() - estadia.horaIngreso.getTime()) / 3600000);

      filas.push([
        String(estadia.id),
        estadia.placa,
        estadia.tipoVehiculo.nombre,
        formatearFecha(partesIngreso),
        formatearHora(partesIngreso),
        partesSalida ? formatearFecha(partesSalida) : '',
        partesSalida ? formatearHora(partesSalida) : '',
        tiempoHoras.toFixed(2),
        estadia.horaSalida ? 'FINALIZADA' : 'ACTIVA'
      ]);
    }

    const contenido = `\uFEFF${filas
      .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')}`;
    const nombreArchivo = `reporte_ocupacion_${fechaInicio}_${fechaFin}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    return res.send(contenido);
  } catch (error) {
    console.error('Error al exportar el reporte de ocupación:', error);
    return res.status(500).json({ error: 'No se pudo exportar el reporte de ocupación.' });
  }
});

module.exports = router;
