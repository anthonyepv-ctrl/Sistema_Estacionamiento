const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../config/prisma');
const { firmarToken, autenticar } = require('../config/auth');

const router = express.Router();

const REGEX_DNI = /^\d{8}$/;
const REGEX_CELULAR = /^9\d{8}$/;

router.post('/registro-conductor', async (req, res) => {
  const { nombre, dni, celular, usuario, contrasena } = req.body || {};

  const nombreLimpio = String(nombre ?? '').trim();
  const dniLimpio = String(dni ?? '').trim();
  const celularLimpio = String(celular ?? '').trim();
  const usuarioLimpio = String(usuario ?? '').trim();
  const clave = String(contrasena ?? '');

  if (nombreLimpio.length < 3 || nombreLimpio.length > 100) {
    return res.status(400).json({ error: 'Ingrese su nombre completo (mínimo 3 caracteres).' });
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
  if (clave.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
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
        celular: celularLimpio
      }
    });

    return res.status(201).json({
      usuario: creado.usuario,
      nombre: creado.nombre,
      rol: creado.rol,
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

  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Ingrese usuario y contraseña.' });
  }

  try {
    const encontrado = await prisma.usuario.findUnique({
      where: { usuario: String(usuario).trim() }
    });

    if (!encontrado) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const esValida = await bcrypt.compare(String(contrasena), encontrado.contrasena);

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
