const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../config/prisma');
const { firmarToken, autenticar, leerTokenDeCabecera, revocarToken } = require('../config/auth');

const router = express.Router();

const REGEX_DNI = /^\d{8}$/;
const REGEX_CELULAR = /^9\d{8}$/;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/registro-conductor', async (req, res) => {
  const { nombre, dni, celular, correo, usuario, contrasena, aceptoTerminos } = req.body || {};

  if (
    typeof nombre !== 'string'
    || typeof usuario !== 'string'
    || typeof contrasena !== 'string'
    || (typeof dni !== 'string' && typeof dni !== 'number')
    || (typeof celular !== 'string' && typeof celular !== 'number')
  ) {
    return res.status(400).json({ error: 'Complete todos los campos requeridos con formato válido.' });
  }

  let correoLimpio = null;
  if (correo !== undefined && correo !== null && String(correo).trim() !== '') {
    if (typeof correo !== 'string') {
      return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
    }
    const candidate = correo.trim().toLowerCase();
    if (candidate.length > 120 || !REGEX_CORREO.test(candidate)) {
      return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
    }
    correoLimpio = candidate;
  }

  const nombreLimpio = nombre.trim();
  const dniLimpio = String(dni).trim();
  const celularLimpio = String(celular).trim();
  const usuarioLimpio = usuario.trim();
  const clave = contrasena;

  if (nombreLimpio.length < 3 || nombreLimpio.length > 100 || /[<>]/.test(nombreLimpio)) {
    return res.status(400).json({ error: 'Ingrese su nombre completo (3 a 100 caracteres, sin símbolos < ni >).' });
  }
  if (!REGEX_DNI.test(dniLimpio)) {
    return res.status(400).json({ error: 'Ingrese un número de documento válido (DNI: 8 dígitos).' });
  }
  if (!REGEX_CELULAR.test(celularLimpio)) {
    return res.status(400).json({ error: 'Ingrese un número celular válido de 9 dígitos que inicie con 9.' });
  }
  if (!/^[a-zA-Z0-9._-]{4,50}$/.test(usuarioLimpio)) {
    return res.status(400).json({ error: 'El usuario debe tener entre 4 y 50 caracteres alfanuméricos.' });
  }
  if (clave.length < 6 || clave.length > 72 || clave.trim().length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 72 caracteres válidos.' });
  }

  try {
    const existente = await prisma.usuario.findFirst({
      where: {
        OR: [{ usuario: usuarioLimpio }, { dni: dniLimpio }]
      },
      select: { usuario: true, dni: true }
    });

    if (existente) {
      const campo = existente.dni === dniLimpio ? 'DNI' : 'usuario';
      return res.status(409).json({ error: `Ya existe una cuenta registrada con ese ${campo}.` });
    }

    const hash = await bcrypt.hash(clave, 10);
    const creado = await prisma.usuario.create({
      data: {
        usuario: usuarioLimpio,
        nombre: nombreLimpio,
        contrasena: hash,
        rol: 'CONDUCTOR',
        dni: dniLimpio,
        celular: celularLimpio,
        correo: correoLimpio,
        aceptoTerminosEn: aceptoTerminos === true ? new Date() : null
      }
    });

    return res.status(201).json({
      usuario: creado.usuario,
      nombre: creado.nombre,
      rol: creado.rol,
      correo: creado.correo,
      token: firmarToken(creado),
      expiraEnHoras: Number(process.env.AUTH_TTL_HORAS) || 8
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El usuario o DNI ya se encuentra registrado.' });
    }
    console.error('Error al registrar conductor:', error);
    return res.status(500).json({ error: 'No se pudo completar el registro de conductor.' });
  }
});

router.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body || {};

  if (typeof usuario !== 'string' || typeof contrasena !== 'string' || !usuario.trim() || !contrasena) {
    return res.status(400).json({ error: 'Ingrese usuario y contraseña.' });
  }

  if (contrasena.length > 72) {
    return res.status(400).json({ error: 'La contraseña excede la longitud máxima permitida.' });
  }

  try {
    const encontrado = await prisma.usuario.findUnique({
      where: { usuario: usuario.trim() }
    });

    if (!encontrado) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (encontrado.activo === false) {
      return res.status(403).json({ error: 'Su cuenta se encuentra desactivada. Contacte al administrador.' });
    }

    const esValida = await bcrypt.compare(contrasena, encontrado.contrasena);

    if (!esValida) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    return res.json({
      usuario: encontrado.usuario,
      nombre: encontrado.nombre,
      rol: encontrado.rol,
      token: firmarToken(encontrado),
      expiraEnHoras: Number(process.env.AUTH_TTL_HORAS) || 8
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

router.post('/logout', autenticar, (req, res) => {
  const token = leerTokenDeCabecera(req);
  if (token) revocarToken(token);
  return res.json({ mensaje: 'Sesión cerrada correctamente.' });
});

router.put('/cambiar-contrasena', autenticar, async (req, res) => {
  const { contrasenaActual, contrasenaNueva } = req.body || {};
  if (typeof contrasenaActual !== 'string' || typeof contrasenaNueva !== 'string') {
    return res.status(400).json({ error: 'Ingrese la contraseña actual y la nueva.' });
  }
  if (contrasenaNueva.length < 6 || contrasenaNueva.length > 72 || contrasenaNueva.trim().length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener entre 6 y 72 caracteres válidos.' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.sesion.sub } });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const coincide = await bcrypt.compare(contrasenaActual, usuario.contrasena);
    if (!coincide) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }
    if (contrasenaActual === contrasenaNueva) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual.' });
    }
    const hash = await bcrypt.hash(contrasenaNueva, 10);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { contrasena: hash }
    });
    return res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  }
});

/**
 * Devuelve la sesión asociada al token enviado. Sirve al frontend para restaurar
 * el estado tras una recarga sin volver a pedir credenciales.
 */
router.get('/sesion', autenticar, (req, res) => {
  return res.json({
    usuario: req.sesion.usuario,
    nombre: req.sesion.nombre,
    rol: req.sesion.rol,
    expiraEn: new Date(req.sesion.exp).toISOString()
  });
});

module.exports = router;
