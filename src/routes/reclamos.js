const express = require('express');
const prisma = require('../config/prisma');
const { parsearIdEntero } = require('../utils/validaciones');

const publicoReclamosRouter = express.Router();
const adminReclamosRouter = express.Router();

const LLAVE_LOCK_RECLAMO = 790001;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textoLimpio(valor, min, max) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  if (limpio.length < min || limpio.length > max || /[<>]/.test(limpio)) return null;
  return limpio;
}

publicoReclamosRouter.post('/', async (req, res) => {
  const body = req.body || {};
  const tipo = typeof body.tipo === 'string' ? body.tipo.trim().toUpperCase() : '';
  const nombreConsumidor = textoLimpio(body.nombreConsumidor, 3, 120);
  const tipoDocumento = typeof body.tipoDocumento === 'string' ? body.tipoDocumento.trim().toUpperCase() : '';
  const numeroDocumento = typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim().toUpperCase() : '';
  const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : '';
  const telefono = typeof body.telefono === 'string' ? body.telefono.trim().replace(/[^\d+]/g, '') : '';
  const domicilio = textoLimpio(body.domicilio, 5, 200);
  const servicio = textoLimpio(body.servicio, 3, 100);
  const detalle = textoLimpio(body.detalle, 10, 1000);
  const pedido = textoLimpio(body.pedido, 5, 500);

  if (!['RECLAMO', 'QUEJA'].includes(tipo)) {
    return res.status(400).json({ error: 'Seleccione tipo válido: RECLAMO o QUEJA.' });
  }
  if (!nombreConsumidor) {
    return res.status(400).json({ error: 'Ingrese el nombre completo del consumidor (3 a 120 caracteres).' });
  }
  if (!['DNI', 'CE', 'RUC'].includes(tipoDocumento)) {
    return res.status(400).json({ error: 'Tipo de documento inválido (DNI, CE o RUC).' });
  }
  const docValido = (tipoDocumento === 'DNI' && /^\d{8}$/.test(numeroDocumento))
    || (tipoDocumento === 'RUC' && /^\d{11}$/.test(numeroDocumento))
    || (tipoDocumento === 'CE' && /^[A-Z0-9]{8,12}$/.test(numeroDocumento));
  if (!docValido) {
    return res.status(400).json({ error: 'El número de documento no corresponde al formato seleccionado.' });
  }
  if (!correo || correo.length > 120 || !REGEX_CORREO.test(correo)) {
    return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
  }
  if (!/^\+?\d{7,15}$/.test(telefono)) {
    return res.status(400).json({ error: 'Ingrese un teléfono de contacto válido (7 a 15 dígitos).' });
  }
  if (!domicilio) {
    return res.status(400).json({ error: 'Ingrese su dirección o domicilio (mínimo 5 caracteres).' });
  }
  if (!servicio) {
    return res.status(400).json({ error: 'Indique el servicio relacionado (ej. Reserva web o Estacionamiento).' });
  }
  if (!detalle) {
    return res.status(400).json({ error: 'Describa el detalle del reclamo o queja (10 a 1000 caracteres).' });
  }
  if (!pedido) {
    return res.status(400).json({ error: 'Indique su solicitud o pedido concreto (5 a 500 caracteres).' });
  }

  let montoReclamado = null;
  if (body.montoReclamado !== undefined && body.montoReclamado !== null && String(body.montoReclamado).trim() !== '') {
    const num = Number(body.montoReclamado);
    if (!Number.isFinite(num) || num < 0 || num > 99999) {
      return res.status(400).json({ error: 'El monto reclamado debe estar entre 0.00 y 99999.00.' });
    }
    montoReclamado = Number(num.toFixed(2));
  }

  try {
    const creado = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LLAVE_LOCK_RECLAMO})`;
      const anio = new Date().getUTCFullYear();
      const totalAnio = await tx.reclamo.count({
        where: { codigo: { startsWith: `LR-${anio}-` } }
      });
      const correlativo = String(totalAnio + 1).padStart(4, '0');
      const codigo = `LR-${anio}-${correlativo}`;

      return tx.reclamo.create({
        data: {
          codigo,
          tipo,
          nombreConsumidor,
          tipoDocumento,
          numeroDocumento,
          correo,
          telefono,
          domicilio,
          servicio,
          montoReclamado,
          detalle,
          pedido,
          estado: 'PENDIENTE'
        }
      });
    });

    return res.status(201).json({
      reclamo: {
        id: creado.id,
        codigo: creado.codigo,
        tipo: creado.tipo,
        nombreConsumidor: creado.nombreConsumidor,
        tipoDocumento: creado.tipoDocumento,
        numeroDocumento: creado.numeroDocumento,
        correo: creado.correo,
        servicio: creado.servicio,
        montoReclamado: creado.montoReclamado !== null ? Number(creado.montoReclamado) : null,
        estado: creado.estado,
        creadoEn: creado.creadoEn
      },
      plazoRespuesta: '15 días hábiles improrrogables (Ley N.° 31435)',
      mensaje: `Hoja de reclamación ${creado.codigo} registrada correctamente.`
    });
  } catch (error) {
    console.error('Error al registrar reclamo:', error);
    return res.status(500).json({ error: 'No se pudo registrar la hoja de reclamación.' });
  }
});

adminReclamosRouter.get('/', async (req, res) => {
  try {
    const reclamos = await prisma.reclamo.findMany({
      orderBy: { creadoEn: 'desc' },
      take: 100
    });
    return res.json({
      reclamos: reclamos.map((r) => ({
        ...r,
        montoReclamado: r.montoReclamado !== null ? Number(r.montoReclamado) : null
      }))
    });
  } catch (error) {
    console.error('Error al listar reclamos:', error);
    return res.status(500).json({ error: 'No se pudieron consultar los reclamos.' });
  }
});

adminReclamosRouter.patch('/:id', async (req, res) => {
  const id = parsearIdEntero(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Identificador de reclamo inválido.' });
  }
  const estado = typeof (req.body || {}).estado === 'string' ? req.body.estado.trim().toUpperCase() : '';
  if (!['PENDIENTE', 'ATENDIDO'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido. Use PENDIENTE o ATENDIDO.' });
  }
  try {
    const actualizado = await prisma.reclamo.update({
      where: { id },
      data: { estado }
    });
    return res.json({ reclamo: actualizado, mensaje: `Reclamo ${actualizado.codigo} marcado como ${actualizado.estado}.` });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Reclamo no encontrado.' });
    }
    console.error('Error al actualizar reclamo:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el reclamo.' });
  }
});

module.exports = {
  publicoReclamosRouter,
  adminReclamosRouter
};
