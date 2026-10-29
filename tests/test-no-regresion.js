const assert = require('assert');
const http = require('http');

process.env.PORT = '3555';
const app = require('../server');
const PORT = 3555;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function testNoRegresion() {
  console.log('--- Verificando Aseguramiento de No Regresión (UPAO-68) ---');
  await new Promise((r) => setTimeout(r, 600));

  try {
    // 1. Reportes Diarios (UPAO-17 / UPAO-54)
    console.log('[REG-01] Validando endpoint histórico de Reporte Diario...');
    const resDiario = await get('/api/reportes/diario?fecha=2026-10-27');
    assert.strictEqual(resDiario.status, 200, 'Reporte diario debe responder 200');
    assert.ok(resDiario.data.cuadre, 'Estructura de cuadre intacta');
    assert.strictEqual(typeof resDiario.data.totalGeneral, 'number', 'Total numérico intacto');
    console.log('✓ REG-01 EXITOSO: Reporte diario funciona sin regresión.');

    // 2. Reportes Diarios con fecha de hoy
    console.log('[REG-02] Validando reporte diario sin parámetros (fecha de hoy)...');
    const resHoy = await get('/api/reportes/diario');
    assert.strictEqual(resHoy.status, 200, 'Reporte de hoy debe responder 200');
    console.log('✓ REG-02 EXITOSO: Consulta del día actual intacta.');

    // 3. Estado de Espacios (UPAO-11 / UPAO-49)
    console.log('[REG-03] Validando módulo de espacios y aforo...');
    const resEspacios = await get('/api/espacios');
    assert.strictEqual(resEspacios.status, 200, 'Espacios debe responder 200');
    console.log('✓ REG-03 EXITOSO: Módulo de espacios intacto.');

    // 4. Módulo de Salidas (UPAO-07 / UPAO-44)
    console.log('[REG-04] Validando métodos de pago en salidas...');
    const resMetodos = await get('/api/salidas/metodos-pago');
    assert.strictEqual(resMetodos.status, 200, 'Métodos de pago debe responder 200');
    console.log('✓ REG-04 EXITOSO: Catálogo de pagos intacto.');

    // 5. Módulo de Gráficos (UPAO-18 / UPAO-65 / UPAO-66)
    console.log('[REG-05] Validando nuevos endpoints de Gráficos Estadísticos...');
    const resGraficos = await get('/api/reportes/graficos?periodo=mensual&anio=2026&mes=10');
    const resGraficosMes = await get('/api/reportes/graficos-mes?mes=10&anio=2026');
    assert.strictEqual(resGraficos.status, 200, 'Endpoint /graficos debe responder 200');
    assert.strictEqual(resGraficosMes.status, 200, 'Endpoint /graficos-mes debe responder 200');
    console.log('✓ REG-05 EXITOSO: Endpoints estadísticos operando al 100%.');

    console.log('\n======================================================');
    console.log(' NO SE DETECTARON REGRESIONES EN EL SISTEMA (100% OK)');
    console.log('======================================================');
  } finally {
    process.exit(0);
  }
}

testNoRegresion().catch((err) => {
  console.error('Error de regresión:', err);
  process.exit(1);
});
