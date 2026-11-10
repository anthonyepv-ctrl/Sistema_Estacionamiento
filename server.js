require('dotenv').config();

const path = require('path');
const express = require('express');

const authRoutes = require('./src/routes/auth');
const tarifasRoutes = require('./src/routes/tarifas');
const ingresosRoutes = require('./src/routes/ingresos');
const salidasRoutes = require('./src/routes/salidas');
const espaciosRoutes = require('./src/routes/espacios');
const reportesRoutes = require('./src/routes/reportes');
const ocupacionRoutes = require('./src/routes/ocupacion');
const publicoRoutes = require('./src/routes/publico');
const { autenticar, autorizar } = require('./src/config/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Rutas públicas -------------------------------------------------------
// Autenticación: el login debe ser accesible sin sesión.
// Disponibilidad: es la única consulta que el conductor ve sin iniciar sesión.
app.use('/api/auth', authRoutes);
app.use('/api/publico', publicoRoutes);

// --- A partir de aquí, toda la API exige sesión válida --------------------
app.use('/api', autenticar);

app.use('/api/tarifas', tarifasRoutes);
app.use('/api/ingresos', ingresosRoutes);
app.use('/api/salidas', salidasRoutes);
app.use('/api/espacios', espaciosRoutes);

// Reportes, gráficos y ocupación son información del negocio: solo el DUEÑO.
app.use('/api/reportes/ocupacion', autorizar('DUENO'), ocupacionRoutes);
app.use('/api/reportes', autorizar('DUENO'), reportesRoutes);
app.use('/api/ocupacion', autorizar('DUENO'), ocupacionRoutes);

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

module.exports = app;
