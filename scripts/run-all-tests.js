const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  { nombre: 'Culqi Unitaria & Cifrado AES-256-GCM', archivo: 'tests/test-pasarela-culqi-unit.js', env: {} },
  { nombre: 'UPAO-22 Anulación, Concurrencia y Reembolso', archivo: 'tests/test-upao22-anulacion.js', env: {} },
  { nombre: 'UPAO-8 Búsqueda en Recepción, Confirmación y Descuento', archivo: 'tests/test-upao8-garita.js', env: {} },
  { nombre: 'UPAO-23 Historial de Estadías del Conductor', archivo: 'tests/test-upao23-historial.js', env: {} },
  { nombre: 'Sprint 3 Integral (Mock Pasarela)', archivo: 'tests/test-reservas-sprint3.js', env: { CULQI_MOCK: '1' } },
  { nombre: 'Seguridad / Ataque Bot (Rate Limit, 413, XSS/SQLi, IDOR)', archivo: 'tests/test-ataque-bot.js', env: {} },
  { nombre: 'Seguridad de API (RBAC / Sesiones)', archivo: 'tests/test-seguridad-api.js', env: {} },
  { nombre: 'No Regresión (Sprints 1 y 2)', archivo: 'tests/test-no-regresion.js', env: {} },
  { nombre: 'Auditoría Batalla de Errores (Backend + E2E)', archivo: 'tests/test-auditoria-batalla.js', env: { CULQI_MOCK: '1' } }
];

console.log('========================================================================');
console.log(' EJECUCIÓN AUTOMATIZADA DE PRUEBAS — SISTEMA DE GESTIÓN DE COCHERA');
console.log('========================================================================\n');

const resultados = [];
const inicioTotal = Date.now();

for (const suite of SUITES) {
  const t0 = Date.now();
  console.log(`\n▶ [${resultados.length + 1}/${SUITES.length}] ${suite.nombre}`);
  console.log(`  Comando: node ${suite.archivo}`);

  const proc = spawnSync(process.execPath, [path.join(process.cwd(), suite.archivo)], {
    stdio: 'inherit',
    env: { ...process.env, ...suite.env }
  });

  const duracionMs = Date.now() - t0;
  const ok = proc.status === 0;
  resultados.push({ nombre: suite.nombre, ok, codigo: proc.status, duracionMs });

  if (!ok) {
    console.error(`\n❌ FALLÓ: ${suite.nombre} (exit code ${proc.status})`);
  }
}

const totalMs = Date.now() - inicioTotal;
const aprobadas = resultados.filter((r) => r.ok).length;

console.log('\n========================================================================');
console.log(' RESUMEN FINAL DE PRUEBAS AUTOMATIZADAS');
console.log('========================================================================');
for (const r of resultados) {
  const icono = r.ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${icono} | ${(r.duracionMs / 1000).toFixed(1).padStart(5)}s | ${r.nombre}`);
}
console.log('------------------------------------------------------------------------');
console.log(`TOTAL: ${aprobadas}/${resultados.length} suites aprobadas en ${(totalMs / 1000).toFixed(1)}s`);
console.log('========================================================================\n');

process.exit(aprobadas === resultados.length ? 0 : 1);
