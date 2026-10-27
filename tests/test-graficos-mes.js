const assert = require('assert');
const http = require('http');

process.env.PORT = '3456';
const app = require('../server');

const PORT = 3456;

function hacerPeticion(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- Iniciando Pruebas de API UPAO-66 (Agregaciones Mensuales) ---');

  // Esperar 500ms para asegurar que el servidor esté escuchando
  await new Promise((r) => setTimeout(r, 500));

  try {
    // Caso 1: Consulta mensual válida con datos (Octubre 2026)
    console.log('\n[TEST 1] GET /api/reportes/graficos-mes?mes=10&anio=2026 (mes válido con movimientos)');
    const res1 = await hacerPeticion('/api/reportes/graficos-mes?mes=10&anio=2026');
    assert.strictEqual(res1.status, 200, 'Debe responder HTTP 200');
    assert.strictEqual(res1.body.periodo, 'mensual');
    assert.strictEqual(res1.body.anio, 2026);
    assert.strictEqual(res1.body.mes, 10);
    assert.ok(Array.isArray(res1.body.serieDiaria), 'serieDiaria debe ser un arreglo');
    assert.strictEqual(res1.body.serieDiaria.length, 31, 'Octubre debe tener 31 días en serieDiaria');
    assert.ok(res1.body.totales, 'Debe incluir objeto de totales');
    assert.ok(Array.isArray(res1.body.totales.porMetodo), 'porMetodo debe ser arreglo');
    console.log('✓ TEST 1 EXITOSO: Serie diaria y consolidado por método retornados correctamente.');

    // Caso 2: Bloqueo de mes futuro en el año actual (Noviembre o Diciembre 2026)
    console.log('\n[TEST 2] GET /api/reportes/graficos-mes?mes=12&anio=2026 (mes futuro)');
    const res2 = await hacerPeticion('/api/reportes/graficos-mes?mes=12&anio=2026');
    assert.strictEqual(res2.status, 400, 'Debe rechazar con HTTP 400');
    assert.ok(res2.body.error.includes('No se pueden consultar meses futuros'), 'Mensaje de error coherente');
    console.log('✓ TEST 2 EXITOSO: Mes futuro bloqueado con HTTP 400.');

    // Caso 3: Bloqueo de año futuro (2027)
    console.log('\n[TEST 3] GET /api/reportes/graficos-mes?mes=5&anio=2027 (año futuro)');
    const res3 = await hacerPeticion('/api/reportes/graficos-mes?mes=5&anio=2027');
    assert.strictEqual(res3.status, 400, 'Debe rechazar con HTTP 400');
    assert.ok(res3.body.error.includes('No se pueden consultar períodos futuros'), 'Mensaje de error coherente');
    console.log('✓ TEST 3 EXITOSO: Año futuro bloqueado con HTTP 400.');

    // Caso 4: Parámetros inválidos (mes fuera de rango 1..12)
    console.log('\n[TEST 4] GET /api/reportes/graficos-mes?mes=15&anio=2026 (mes inválido)');
    const res4 = await hacerPeticion('/api/reportes/graficos-mes?mes=15&anio=2026');
    assert.strictEqual(res4.status, 400, 'Debe rechazar con HTTP 400');
    assert.ok(res4.body.error.includes('Mes de consulta inválido'), 'Mensaje de validación presente');
    console.log('✓ TEST 4 EXITOSO: Mes inválido validado con HTTP 400.');

    // Caso 5: Mes sin recaudación (Enero 2024)
    console.log('\n[TEST 5] GET /api/reportes/graficos-mes?mes=1&anio=2024 (período sin movimientos)');
    const res5 = await hacerPeticion('/api/reportes/graficos-mes?mes=1&anio=2024');
    assert.strictEqual(res5.status, 200, 'Debe responder HTTP 200');
    assert.strictEqual(res5.body.tieneDatos, false, 'tieneDatos debe ser false');
    assert.strictEqual(res5.body.mensaje, 'No se registran ingresos para el período seleccionado');
    console.log('✓ TEST 5 EXITOSO: Mes sin ventas retorna tieneDatos: false y mensaje informativo oficial.');

    // Caso 6: Exportación de reporte mensual a CSV
    console.log('\n[TEST 6] GET /api/reportes/exportar?periodo=mensual&anio=2026&mes=10 (exportación)');
    const res6 = await hacerPeticion('/api/reportes/exportar?periodo=mensual&anio=2026&mes=10');
    assert.strictEqual(res6.status, 200, 'Debe responder HTTP 200');
    assert.ok(res6.headers['content-type'].includes('text/csv'), 'Content-Type debe ser text/csv');
    assert.ok(res6.headers['content-disposition'].includes('reporte_ingresos_2026_10.csv'), 'Filename coherente');
    assert.ok(res6.body.includes('"Fecha","Placa","Tipo","Método","Monto"'), 'Cabeceras CSV formateadas');
    console.log('✓ TEST 6 EXITOSO: Exportación descargable generada con cabeceras requeridas.');

    console.log('\n======================================================');
    console.log(' TODOS LOS CASOS DE PRUEBA DE UPAO-66 PASARON CON ÉXITO');
    console.log('======================================================');
  } finally {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN LAS PRUEBAS:', err);
  process.exit(1);
});
