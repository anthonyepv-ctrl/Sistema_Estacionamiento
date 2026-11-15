/**
 * Verificación de las validaciones defensivas de ingreso y salida.
 *
 * Cubre los defectos D-02 (caracteres inválidos en la placa) y D-03 (identificador
 * de estadía corrupto) del informe de auditoría de noviembre 2026.
 *
 * No modifica datos: todos los casos usan entradas inválidas o IDs inexistentes.
 *
 * Ejecución:  npm run test:validaciones
 * Requiere el servidor en marcha (BASE_URL, por defecto http://localhost:3555).
 */
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3555';
let token = '';
let fallos = 0;
let revisiones = 0;

async function asegurarServidor() {
  try {
    const res = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    if (res.status) return;
  } catch (error) {
    process.env.PORT = '3555';
    require('../server');
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function solicitar(metodo, ruta, cuerpo, conToken = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (conToken && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${ruta}`, {
    method: metodo,
    headers,
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {})
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function comprobar(condicion, descripcion, detalle) {
  revisiones++;
  if (condicion) {
    console.log(`  [PASS] ${descripcion} — ${detalle}`);
  } else {
    fallos++;
    console.error(`  [FALLA] ${descripcion} — ${detalle}`);
  }
}

async function main() {
  await asegurarServidor();

  const login = await solicitar('POST', '/api/auth/login', { usuario: 'admin', contrasena: '123456' }, false);
  if (login.status !== 200 || !login.data?.token) {
    console.error('No se pudo iniciar sesión para ejecutar las validaciones.');
    process.exitCode = 1;
    return;
  }
  token = login.data.token;
  console.log('Sesión iniciada como DUEÑO.');

  console.log('\nD-02 · Caracteres inválidos en la placa');
  const placaInvalida = await solicitar('POST', '/api/ingresos', { placa: 'ABC@123', tipo: 'auto' });
  comprobar(placaInvalida.status === 400, 'Ingreso con ABC@123 responde 400', `HTTP ${placaInvalida.status}`);

  const placaXss = await solicitar('POST', '/api/ingresos', { placa: '<script>alert(1)</script>', tipo: 'auto' });
  comprobar(placaXss.status === 400, 'Ingreso con script responde 400', `HTTP ${placaXss.status}`);

  const placaVacia = await solicitar('POST', '/api/ingresos', { placa: '   ', tipo: 'auto' });
  comprobar(placaVacia.status === 400, 'Ingreso con placa vacía responde 400', `HTTP ${placaVacia.status}`);

  const salidaPlacaInvalida = await solicitar('POST', '/api/salidas', { placa: 'ABC@123' });
  comprobar(salidaPlacaInvalida.status === 400, 'Salida con placa ABC@123 responde 400', `HTTP ${salidaPlacaInvalida.status}`);

  console.log('\nD-03 · Identificador de estadía');
  for (const valor of [-1, 'null', 'abc', 0, '']) {
    if (valor === '') continue;
    const salida = await solicitar('POST', '/api/salidas', { estadiaId: valor });
    comprobar(salida.status === 400, `Salida con estadiaId ${JSON.stringify(valor)} responde 400`, `HTTP ${salida.status}`);
  }

  const inexistente = await solicitar('POST', '/api/salidas', { estadiaId: 999999999 });
  comprobar(inexistente.status === 404, 'Salida con ID válido inexistente responde 404', `HTTP ${inexistente.status}`);

  console.log('\nControles adicionales');
  const metodoInvalido = await solicitar('POST', '/api/salidas', { estadiaId: 999999999, metodoPago: 'Bitcoin' });
  comprobar(metodoInvalido.status === 400, 'Método de pago inválido responde 400', `HTTP ${metodoInvalido.status}`);

  const sinToken = await solicitar('GET', '/api/reportes/diario', undefined, false);
  comprobar(sinToken.status === 401, 'Reporte diario sin token responde 401', `HTTP ${sinToken.status}`);

  const publico = await solicitar('GET', '/api/publico/disponibilidad', undefined, false);
  comprobar(publico.status === 200, 'Disponibilidad pública responde 200', `HTTP ${publico.status}`);

  console.log('\n================================================');
  console.log(` Comprobaciones: ${revisiones} | Fallos: ${fallos}`);
  console.log(fallos === 0 ? ' VALIDACIONES DEFENSIVAS OK.' : ' HAY VALIDACIONES DEFENSIVAS FALLANDO.');
  console.log('================================================');

  process.exitCode = fallos === 0 ? 0 : 1;
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
