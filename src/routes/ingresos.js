const express = require('express');

const prisma = require('../config/prisma');
const { obtenerCapacidad } = require('../config/espacios');

const router = express.Router();

const TIPO_VEHICULO = {
  auto: { nombre: 'Automóvil / Camioneta', regex: /^[A-Z0-9]{3}-?[A-Z0-9]{3}$/ },
  moto: { nombre: 'Motocicleta', regex: /^([A-Z0-9]{2,4}-?[A-Z0-9]{2,4}|[A-Z]{3}-?\d{4})$/ }
};

function analizarPlaca(limpio) {
  if (limpio.length >= 7) {
    return { tipo: 'moto', corte: 3 };
  }

  if (/^\d/.test(limpio)) {
    return { tipo: 'moto', corte: 4 };
  }

  if (limpio.length === 6 && /\d{4}$/.test(limpio)) {
    return { tipo: 'moto', corte: 2 };
  }

  return { tipo: 'auto', corte: 3 };
}

function normalizarPlaca(valor) {
  const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length === 0) return '';

  const { corte } = analizarPlaca(limpio);
  if (limpio.length <= corte) return limpio;

  const maxLen = limpio.length >= 7 ? 7 : 6;
  return `${limpio.slice(0, corte)}-${limpio.slice(corte, maxLen)}`;
}

router.post('/', async (req, res) => {
  const { placa: placaRaw, tipo, nota, idUsuario, usuario: nombreUsuario } = req.body || {};
  const config = TIPO_VEHICULO[tipo];

  if (!config) {
    return res.status(400).json({ error: 'Seleccione un tipo de vehículo válido (auto o moto).' });
  }

  const placa = normalizarPlaca(placaRaw);
  const alfanumerico = String(placaRaw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!placa) {
    return res.status(400).json({ error: 'Ingrese la placa del vehículo.' });
  }

  // Validación de coherencia estricta entre formato de placa y tipo de vehículo seleccionado (Prevención de errores humanos / Poka-Yoke)
  const analisis = analizarPlaca(alfanumerico);
  if (analisis.tipo !== tipo) {
    const esperado = analisis.tipo === 'auto' ? 'Automóvil / Camioneta' : 'Motocicleta';
    const seleccionado = tipo === 'auto' ? 'Automóvil / Camioneta' : 'Motocicleta';
    return res.status(400).json({
      error: `Incoherencia de vehículo: la placa ${placa} corresponde a ${esperado} según la norma oficial MTC, no puede registrarse como ${seleccionado}.`
    });
  }

  if (!config.regex.test(placa)) {
    return res.status(400).json({ error: 'Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A).' });
  }

  // Sanitización y validación del campo opcional nota (máx. 250 caracteres)
  let notaFinal = null;
  if (nota !== undefined && nota !== null) {
    if (typeof nota !== 'string') {
      return res.status(400).json({ error: 'La nota debe ser una cadena de texto válida.' });
    }
    const notaTrimmed = nota.trim();
    if (notaTrimmed.length > 250) {
      return res.status(400).json({ error: 'La nota no puede exceder los 250 caracteres.' });
    }
    notaFinal = notaTrimmed.length > 0 ? notaTrimmed : null;
  }

  try {
    const tipoVehiculo = await prisma.tipoVehiculo.findUnique({ where: { nombre: config.nombre } });

    if (!tipoVehiculo) {
      return res.status(500).json({ error: 'No está configurado el tipo de vehículo.' });
    }

    const estadiaActiva = await prisma.estadia.findFirst({ where: { placa, horaSalida: null } });

    if (estadiaActiva) {
      return res.status(409).json({ error: `El vehículo con placa ${placa} ya registra un ingreso activo.` });
    }

    const capacidadConfig = obtenerCapacidad();
    const capacidadTipo = tipo === 'auto' ? capacidadConfig.capacidadAutos : capacidadConfig.capacidadMotos;

    const ocupadosTipo = await prisma.estadia.count({
      where: { idTipoVehiculo: tipoVehiculo.id, horaSalida: null }
    });

    if (ocupadosTipo >= capacidadTipo) {
      return res.status(409).json({
        error: `No hay espacios disponibles para ${tipo === 'auto' ? 'automóviles' : 'motocicletas'}. Aforo completo.`
      });
    }

    const tarifa = await prisma.tarifa.findFirst({
      where: { idTipoVehiculo: tipoVehiculo.id, estado: true }
    });

    if (!tarifa) {
      return res.status(500).json({ error: 'No hay una tarifa vigente para este tipo de vehículo.' });
    }

    let usuario = null;
    if (idUsuario) {
      usuario = await prisma.usuario.findUnique({ where: { id: Number(idUsuario) } });
    } else if (nombreUsuario) {
      usuario = await prisma.usuario.findUnique({ where: { usuario: String(nombreUsuario).trim() } });
    }

    if (!usuario) {
      usuario = await prisma.usuario.findFirst({
        where: { rol: 'RECEPCIONISTA' },
        orderBy: { id: 'asc' }
      }) || await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
    }

    if (!usuario) {
      return res.status(500).json({ error: 'No hay un usuario configurado para registrar el ingreso.' });
    }

    const estadia = await prisma.estadia.create({
      data: {
        placa,
        idTipoVehiculo: tipoVehiculo.id,
        idTarifa: tarifa.id,
        idUsuario: usuario.id,
        nota: notaFinal
      }
    });

    return res.status(201).json({
      id: estadia.id,
      placa: estadia.placa,
      tipo: tipoVehiculo.nombre,
      horaIngreso: estadia.horaIngreso,
      nota: estadia.nota,
      idUsuario: usuario.id,
      usuario: usuario.nombre,
      mensaje: `Ingreso registrado: Placa [${placa}]`
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: `El vehículo con placa ${placa} ya registra un ingreso activo.` });
    }

    console.error(error);
    return res.status(500).json({ error: 'No se pudo registrar el ingreso.' });
  }
});

router.get('/activos', async (req, res) => {
  try {
    const estadias = await prisma.estadia.findMany({
      where: { horaSalida: null },
      include: {
        tipoVehiculo: true,
        usuario: true
      },
      orderBy: { horaIngreso: 'desc' }
    });

    return res.json(
      estadias.map((estadia) => ({
        id: estadia.id,
        placa: estadia.placa,
        tipo: estadia.tipoVehiculo.nombre,
        horaIngreso: estadia.horaIngreso,
        nota: estadia.nota ?? null,
        usuarioIngreso: estadia.usuario ? estadia.usuario.nombre : null
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron obtener los ingresos activos.' });
  }
});

module.exports = router;
