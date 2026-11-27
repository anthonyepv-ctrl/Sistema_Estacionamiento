const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { parsearIdEntero } = require('../utils/validaciones');

const router = express.Router();
const REGEX_USUARIO = /^[a-zA-Z0-9._-]{4,50}$/;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_GESTIONABLES = ['RECEPCIONISTA', 'DUENO'];

router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        dni: true,
        celular: true,
        correo: true,
        activo: true
      },
      orderBy: { id: 'asc' }
    });
    return res.json({ usuarios });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los usuarios.' });
  }
});

router.post('/', async (req, res) => {
  const { usuario, nombre, contrasena, rol = 'RECEPCIONISTA', correo, celular } = req.body || {};

  if (typeof usuario !== 'string' || typeof nombre !== 'string' || typeof contrasena !== 'string') {
    return res.status(400).json({ error: 'Complete usuario, nombre y contraseña.' });
  }

  const usuarioLimpio = usuario.trim();
  const nombreLimpio = nombre.trim();
  const rolFinal = typeof rol === 'string' ? rol.trim().toUpperCase() : '';

  if (!REGEX_USUARIO.test(usuarioLimpio)) {
    return res.status(400).json({ error: 'El usuario debe tener entre 4 y 50 caracteres alfanuméricos.' });
  }
  if (nombreLimpio.length < 3 || nombreLimpio.length > 100 || /[<>]/.test(nombreLimpio)) {
    return res.status(400).json({ error: 'Ingrese un nombre válido (3 a 100 caracteres, sin símbolos < ni >).' });
  }
  if (contrasena.length < 6 || contrasena.length > 72 || contrasena.trim().length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 72 caracteres válidos.' });
  }
  if (!ROLES_GESTIONABLES.includes(rolFinal)) {
    return res.status(400).json({ error: 'Rol no permitido. Use RECEPCIONISTA o DUENO.' });
  }

  let correoLimpio = null;
  if (correo !== undefined && correo !== null && String(correo).trim() !== '') {
    const cand = String(correo).trim().toLowerCase();
    if (cand.length > 120 || !REGEX_CORREO.test(cand)) {
      return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
    }
    correoLimpio = cand;
  }

  let celularLimpio = null;
  if (celular !== undefined && celular !== null && String(celular).trim() !== '') {
    const cel = String(celular).trim();
    if (!/^9\d{8}$/.test(cel)) {
      return res.status(400).json({ error: 'El celular debe tener 9 dígitos e iniciar con 9.' });
    }
    celularLimpio = cel;
  }

  try {
    const hash = await bcrypt.hash(contrasena, 10);
    const creado = await prisma.usuario.create({
      data: {
        usuario: usuarioLimpio,
        nombre: nombreLimpio,
        contrasena: hash,
        rol: rolFinal,
        correo: correoLimpio,
        celular: celularLimpio,
        activo: true
      },
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        correo: true,
        celular: true,
        activo: true
      }
    });
    return res.status(201).json({ usuario: creado, mensaje: `Usuario ${creado.usuario} creado correctamente.` });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese identificador.' });
    }
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parsearIdEntero(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Identificador de usuario inválido.' });
  }

  const { nombre, rol, activo, contrasena, correo } = req.body || {};

  try {
    const objetivo = await prisma.usuario.findUnique({ where: { id } });
    if (!objetivo) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (id === req.sesion.sub && activo === false) {
      return res.status(409).json({ error: 'No puede desactivar su propia cuenta en sesión.' });
    }

    const data = {};
    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.trim().length > 100 || /[<>]/.test(nombre)) {
        return res.status(400).json({ error: 'Nombre inválido.' });
      }
      data.nombre = nombre.trim();
    }

    if (rol !== undefined) {
      const rolNorm = typeof rol === 'string' ? rol.trim().toUpperCase() : '';
      if (!ROLES_GESTIONABLES.includes(rolNorm)) {
        return res.status(400).json({ error: 'Rol no permitido. Use RECEPCIONISTA o DUENO.' });
      }
      if (objetivo.rol === 'CONDUCTOR') {
        return res.status(409).json({ error: 'No se puede cambiar el rol de una cuenta de Conductor desde personal.' });
      }
      data.rol = rolNorm;
    }

    if (activo !== undefined) {
      if (typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'El estado activo debe ser verdadero o falso.' });
      }
      data.activo = activo;
    }

    if (correo !== undefined) {
      if (correo === null || String(correo).trim() === '') {
        data.correo = null;
      } else {
        const cand = String(correo).trim().toLowerCase();
        if (cand.length > 120 || !REGEX_CORREO.test(cand)) {
          return res.status(400).json({ error: 'Correo electrónico inválido.' });
        }
        data.correo = cand;
      }
    }

    if (contrasena !== undefined && contrasena !== null && contrasena !== '') {
      if (typeof contrasena !== 'string' || contrasena.length < 6 || contrasena.length > 72 || contrasena.trim().length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 72 caracteres válidos.' });
      }
      data.contrasena = await bcrypt.hash(contrasena, 10);
    }

    if (objetivo.rol === 'DUENO' && (data.activo === false || (data.rol && data.rol !== 'DUENO'))) {
      const otrosDuenosActivos = await prisma.usuario.count({
        where: { rol: 'DUENO', activo: true, id: { not: id } }
      });
      if (otrosDuenosActivos === 0) {
        return res.status(409).json({ error: 'Debe permanecer al menos un Dueño activo en el sistema.' });
      }
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data,
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        dni: true,
        celular: true,
        correo: true,
        activo: true
      }
    });

    return res.json({ usuario: actualizado, mensaje: `Usuario ${actualizado.usuario} actualizado.` });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
  }
});

module.exports = router;
