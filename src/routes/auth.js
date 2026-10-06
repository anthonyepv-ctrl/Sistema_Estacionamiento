const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../config/prisma');

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
      rol: encontrado.rol
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

module.exports = router;
