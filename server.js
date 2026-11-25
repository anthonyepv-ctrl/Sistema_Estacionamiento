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
const conductorRoutes = require('./src/routes/conductor');
const reservasRoutes = require('./src/routes/reservas');
const { autenticar, autorizar } = require('./src/config/auth');
const { cabecerasSeguridad, crearLimitadorTasa } = require('./src/middleware/seguridad');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cabecerasSeguridad);
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ventanaMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const limiteAuth = crearLimitadorTasa({
  nombre: 'auth',
  ventanaMs,
  maxPeticiones: Number(process.env.RATE_LIMIT_MAX_AUTH) || 20,
  mensaje: 'Demasiados intentos de autenticación o registro. Espere un minuto antes de reintentar.'
});
const limitePublico = crearLimitadorTasa({
  nombre: 'publico',
  ventanaMs,
  maxPeticiones: Number(process.env.RATE_LIMIT_MAX_PUBLIC) || 120,
  mensaje: 'Límite de consultas públicas excedido. Intente nuevamente en unos segundos.'
});
const limiteApi = crearLimitadorTasa({
  nombre: 'api',
  ventanaMs,
  maxPeticiones: Number(process.env.RATE_LIMIT_MAX_API) || 200,
  mensaje: 'Límite de solicitudes de API excedido. Intente nuevamente en unos segundos.'
});

// --- Rutas públicas -------------------------------------------------------
// Autenticación: el login debe ser accesible sin sesión.
// Disponibilidad: es la única consulta que el conductor ve sin iniciar sesión.
app.use('/api/auth', limiteAuth, authRoutes);
app.use('/api/publico', limitePublico, publicoRoutes);

// --- A partir de aquí, toda la API exige sesión válida --------------------
app.use('/api', limiteApi, autenticar);

app.use('/api/tarifas', tarifasRoutes);
app.use('/api/ingresos', ingresosRoutes);
app.use('/api/salidas', salidasRoutes);
app.use('/api/espacios', espaciosRoutes);
app.use('/api/conductor', autorizar('CONDUCTOR'), conductorRoutes);
app.use('/api/reservas', reservasRoutes);

// Reportes, gráficos y ocupación son información del negocio: solo el DUEÑO.
app.use('/api/reportes/ocupacion', autorizar('DUENO'), ocupacionRoutes);
app.use('/api/reportes', autorizar('DUENO'), reportesRoutes);
app.use('/api/ocupacion', autorizar('DUENO'), ocupacionRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'El tamaño de la solicitud excede el límite permitido (100 KB).' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo JSON de la solicitud no es válido.' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});

module.exports = app;
