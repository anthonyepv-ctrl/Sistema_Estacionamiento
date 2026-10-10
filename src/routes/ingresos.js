const express = require('express');

const prisma = require('../config/prisma');

const router = express.Router();

const TIPO_VEHICULO = {
  auto: { nombre: 'Automóvil / Camioneta', regex: /^[A-Z0-9]{3}-?[A-Z0-9]{3}$/ },
  moto: { nombre: 'Motocicleta', regex: /^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/ }
};

function analizarPlaca(limpio) {
  if (/^\d/.test(limpio)) {
    return { tipo: 'moto', corte: 4 };
  }

  const letras = (limpio.match(/^[A-Z]+/) || [''])[0].length;

  if (letras === 2 && /\d/.test(limpio)) {
    return { tipo: 'moto', corte: 2 };
  }

  return { tipo: 'auto', corte: 3 };
}

function normalizarPlaca(valor) {
  const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length === 0) return '';

  const { corte } = analizarPlaca(limpio);
  if (limpio.length <= corte) return limpio;

  return `${limpio.slice(0, corte)}-${limpio.slice(corte, 6)}`;
}

router.post('/', async (req, res) => {
  const { placa: placaRaw, tipo } = req.body || {};
  const config = TIPO_VEHICULO[tipo];

  if (!config) {
    return res.status(400).json({ error: 'Seleccione un tipo de vehículo válido (auto o moto).' });
  }

  const placa = normalizarPlaca(placaRaw);

  if (!placa) {
    return res.status(400).json({ error: 'Ingrese la placa del vehículo.' });
  }

  if (!config.regex.test(placa)) {
    return res.status(400).json({ error: 'Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A).' });
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

    const tarifa = await prisma.tarifa.findFirst({
      where: { idTipoVehiculo: tipoVehiculo.id, estado: true }
    });

    if (!tarifa) {
      return res.status(500).json({ error: 'No hay una tarifa vigente para este tipo de vehículo.' });
    }

    const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });

    if (!usuario) {
      return res.status(500).json({ error: 'No hay un usuario configurado para registrar el ingreso.' });
    }

    const estadia = await prisma.estadia.create({
      data: {
        placa,
        idTipoVehiculo: tipoVehiculo.id,
        idTarifa: tarifa.id,
        idUsuario: usuario.id
      }
    });

    return res.status(201).json({
      id: estadia.id,
      placa: estadia.placa,
      tipo: tipoVehiculo.nombre,
      horaIngreso: estadia.horaIngreso,
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
      include: { tipoVehiculo: true },
      orderBy: { horaIngreso: 'desc' }
    });

    return res.json(
      estadias.map((estadia) => ({
        id: estadia.id,
        placa: estadia.placa,
        tipo: estadia.tipoVehiculo.nombre,
        horaIngreso: estadia.horaIngreso
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudieron obtener los ingresos activos.' });
  }
});

module.exports = router;
