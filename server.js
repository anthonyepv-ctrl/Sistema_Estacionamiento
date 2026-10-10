require('dotenv').config();

const path = require('path');
const express = require('express');

const authRoutes = require('./src/routes/auth');
const tarifasRoutes = require('./src/routes/tarifas');
const ingresosRoutes = require('./src/routes/ingresos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/tarifas', tarifasRoutes);
app.use('/api/ingresos', ingresosRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
