/**
 * Auditoría de seguridad de la API — deuda abierta detectada en la subtarea UPAO-77.
 *
 * Comprueba, sin modificar datos, que las rutas sensibles exigen autenticación.
 * Mientras el defecto DEF-77-07 siga abierto este script termina con código 1:
 * es un diagnóstico de deuda, NO forma parte de `npm test`.
 *
 * Ejecución:  node tests/auditoria-seguridad-api.js
 * Requiere el servidor en marcha (BASE_URL, por defecto http://localhost:3555).
 *
 * Nada de lo que hace aquí cambia la base de datos: las rutas de escritura se sondean
 * con cargas inválidas y solo se evalúa el código de respuesta (401/403 = protegida).
 */
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3555';
let abiertas = 0;
let revisadas = 0;

function reportar(protegida, descripcion, detalle) {
  revisadas++;
  if (protegida) {
    console.log(`  [OK]    ${descripcion} — ${detalle}`);
  } else {
    abiertas++;
    console.log(`  [DEUDA] ${descripcion} — ${detalle}`);
  }
}

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE_URL + ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto.slice(0, 160), texto };
}

(async () => {
  console.log(`Auditoría de seguridad de la API — ${BASE_URL}\n`);
  console.log('Rutas que cualquier cliente de internet alcanza hoy:');

  const tarifas = await pedir('/api/tarifas/999999', {
    method: 'PUT',
    body: JSON.stringify({ precioHora: '1.00', precioFraccion: '1.00' })
  });
  reportar([401, 403].includes(tarifas.status), 'PUT /api/tarifas/:id (fijar precios)',
    `HTTP ${tarifas.status} — la ruta existe y responde sin sesión; un id válido sí cambia la tarifa`);

  const capacidad = await pedir('/api/espacios/capacidad', {
    method: 'PUT',
    body: JSON.stringify({ capacidadAutos: 'no-numero' })
  });
  reportar([401, 403].includes(capacidad.status), 'PUT /api/espacios/capacidad (cerrar o ampliar la cochera)',
    `HTTP ${capacidad.status} — el 400 lo produce la validación de datos, no un control de acceso`);

  const ingresos = await pedir('/api/ingresos/activos');
  reportar([401, 403].includes(ingresos.status), 'GET /api/ingresos/activos (placas y notas de clientes)',
    `HTTP ${ingresos.status}`);

  const reportes = await pedir('/api/reportes/exportar?periodo=mensual&anio=2026&mes=10');
  reportar([401, 403].includes(reportes.status), 'GET /api/reportes/exportar (recaudación exportable a CSV)',
    `HTTP ${reportes.status}`);

  const ocupacion = await pedir('/api/ocupacion?fechaInicio=2026-10-20&fechaFin=2026-10-30');
  reportar([401, 403].includes(ocupacion.status), 'GET /api/ocupacion (afluencia del negocio)',
    `HTTP ${ocupacion.status}`);

  const login = await pedir('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      usuario: process.env.AUDIT_USUARIO || 'admin',
      contrasena: process.env.AUDIT_CONTRASENA || '123456'
    })
  });
  const cuerpoLogin = (() => {
    try { return JSON.parse(login.texto); } catch { return {}; }
  })();
  const emiteCredencial = Boolean(cuerpoLogin.token || cuerpoLogin.accessToken || cuerpoLogin.jwt);
  reportar(emiteCredencial, 'POST /api/auth/login (emitir credencial de sesión)',
    `HTTP ${login.status} — respuesta: ${login.cuerpo} (solo identifica al usuario, no autoriza peticiones)`);

  console.log('\n================================================');
  console.log(` Rutas revisadas: ${revisadas} | sin autenticación: ${abiertas}`);
  if (abiertas > 0) {
    console.log('\n DEFECTO ABIERTO (DEF-77-07): la API no tiene control de acceso.');
    console.log(' El login del frontend solo decide qué pantallas se muestran: la API');
    console.log(' responde igual a cualquiera. Ver plan-pruebas.md para la propuesta.');
  } else {
    console.log(' Todas las rutas sensibles exigen autenticación.');
  }
  console.log('================================================');
  process.exitCode = abiertas > 0 ? 1 : 0;
})().catch((error) => {
  console.error('No se pudo completar la auditoría:', error.message);
  process.exit(1);
});
