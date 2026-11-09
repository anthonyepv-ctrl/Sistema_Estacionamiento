const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../config/prisma');
const { firmarToken, autenticar } = require('../config/auth');

const router = express.Router();

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
