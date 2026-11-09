/**
 * Verificación del control de acceso de la API (DEF-77-07, corregido en UPAO-77).
 *
 * Comprueba que:
 *   1. Ningún endpoint interno responde sin token.
 *   2. El endpoint público de disponibilidad sigue abierto por diseño.
 *   3. El login emite una credencial de sesión.
 *   4. Un token manipulado se rechaza.
 *   5. El rol DUEÑO accede a reportes.
 *   6. El rol RECEPCIONISTA no accede a reportes ni modifica tarifas o capacidad.
 *
 * No modifica datos: las rutas de escritura se sondean con el token del rol equivocado,
 * que es rechazado antes de tocar la base de datos.
 *
 * Ejecución:  npm run test:seguridad
 * Requiere el servidor en marcha (BASE_URL, por defecto http://localhost:3555).
 * Termina con código 1 si alguna comprobación falla.
 */
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3555';
let fallos = 0;
let revisiones = 0;

async function asegurarServidor() {
  try {
    const res = await fetch(`${BASE_URL}/api/espacios`);
    if (res.status) return;
  } catch (e) {
    process.env.PORT = '3555';
    require('../server');
    await new Promise((r) => setTimeout(r, 800));
  }
}

function comprobar(condicion, descripcion, detalle) {
  revisiones++;
  if (condicion) {
    console.log(`  [PASS] ${descripcion} — ${detalle}`);
  } else {
    fallos++;
    console.log(`  [FAIL] ${descripcion} — ${detalle}`);
  }
}

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE_URL + ruta, {
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    ...opciones
  });
  const texto = await r.text();
  return { status: r.status, texto };
}

async function login(usuario, contrasena) {
  const r = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, contrasena })
  });
  return r.json();
}

const RUTAS_INTERNAS = [
  ['GET', '/api/ingresos/activos'],
  ['GET', '/api/salidas/activos'],
  ['GET', '/api/espacios'],
  ['GET', '/api/tarifas'],
  ['GET', '/api/reportes/diario'],
  ['GET', '/api/reportes/graficos-mes?mes=10&anio=2026'],
  ['GET', '/api/ocupacion?fechaInicio=2026-10-20&fechaFin=2026-10-30']
];

(async () => {
  await asegurarServidor();
  console.log(`Verificación del control de acceso — ${BASE_URL}\n`);

  console.log('1) Sin token, la API interna debe rechazar:');
  for (const [metodo, ruta] of RUTAS_INTERNAS) {
    const r = await pedir(ruta, { method: metodo });
    comprobar(r.status === 401, `${metodo} ${ruta}`, `HTTP ${r.status}`);
  }

  console.log('\n2) El endpoint público sigue abierto por diseño:');
  const publico = await pedir('/api/publico/disponibilidad');
  comprobar(publico.status === 200, 'GET /api/publico/disponibilidad', `HTTP ${publico.status}`);

  console.log('\n3) El login emite credencial:');
  const dueno = await login(process.env.TEST_USUARIO || 'admin', process.env.TEST_CONTRASENA || '123456');
  comprobar(Boolean(dueno.token), 'POST /api/auth/login', dueno.token ? 'token emitido' : 'sin token');

  console.log('\n4) Un token manipulado se rechaza:');
  const falso = dueno.token ? `${dueno.token.slice(0, -4)}AAAA` : 'x.y';
  const conFalso = await pedir('/api/reportes/diario', { headers: { Authorization: `Bearer ${falso}` } });
  comprobar(conFalso.status === 401, 'GET /api/reportes/diario con token alterado', `HTTP ${conFalso.status}`);

  console.log('\n5) Con token de DUEÑO se accede:');
  const hDueno = { Authorization: `Bearer ${dueno.token}` };
  const rDueno = await pedir('/api/reportes/diario', { headers: hDueno });
  comprobar(rDueno.status === 200, 'GET /api/reportes/diario (DUEÑO)', `HTTP ${rDueno.status}`);

  console.log('\n6) Con token de RECEPCIONISTA se restringe:');
  const recep = await login('recepcion', '123456');
  const hRecep = { Authorization: `Bearer ${recep.token}` };

  const reportesRecep = await pedir('/api/reportes/diario', { headers: hRecep });
  comprobar(reportesRecep.status === 403, 'GET /api/reportes/diario (RECEPCIONISTA)', `HTTP ${reportesRecep.status}`);

  const tarifasRecep = await pedir('/api/tarifas/1', {
    method: 'PUT',
    headers: hRecep,
    body: JSON.stringify({ precioHora: '1.00', precioFraccion: '1.00' })
  });
  comprobar(tarifasRecep.status === 403, 'PUT /api/tarifas/:id (RECEPCIONISTA)', `HTTP ${tarifasRecep.status}`);

  const capacidadRecep = await pedir('/api/espacios/capacidad', {
    method: 'PUT',
    headers: hRecep,
    body: JSON.stringify({ capacidadAutos: 99 })
  });
  comprobar(capacidadRecep.status === 403, 'PUT /api/espacios/capacidad (RECEPCIONISTA)', `HTTP ${capacidadRecep.status}`);

  const ingresosRecep = await pedir('/api/ingresos/activos', { headers: hRecep });
  comprobar(ingresosRecep.status === 200, 'GET /api/ingresos/activos (RECEPCIONISTA)', `HTTP ${ingresosRecep.status}`);

  console.log('\n================================================');
  console.log(` Comprobaciones: ${revisiones} | Fallos: ${fallos}`);
  if (fallos === 0) {
    console.log(' CONTROL DE ACCESO OK: la API exige sesión y respeta los roles.');
  } else {
    console.log(' HAY FALLOS DE CONTROL DE ACCESO.');
  }
  console.log('================================================');
  process.exit(fallos > 0 ? 1 : 0);
})().catch((error) => {
  console.error('No se pudo completar la verificación:', error.message);
  process.exit(1);
});
