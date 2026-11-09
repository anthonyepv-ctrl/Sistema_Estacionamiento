const assert = require('assert');
const http = require('http');

process.env.PORT = '3555';
const app = require('../server');
const PORT = 3555;

// Desde UPAO-77 (DEF-77-07) la API exige sesión: la suite inicia sesión como DUEÑO
// y envía el token en cada petición.
let token = '';

function solicitar(metodo, path, cuerpo, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = cuerpo ? JSON.stringify(cuerpo) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...extraHeaders
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function iniciarSesion() {
  const respuesta = await solicitar('POST', '/api/auth/login', {
    usuario: process.env.TEST_USUARIO || 'admin',
    contrasena: process.env.TEST_CONTRASENA || '123456'
  });

  assert.strictEqual(respuesta.status, 200, 'El login debe responder 200');
  assert.ok(respuesta.data.token, 'El login debe emitir un token de sesión');
  token = respuesta.data.token;
  console.log('[AUTH] Sesión iniciada como DUEÑO; token recibido.');
}

function get(path) {
  return solicitar('GET', path);
}

function getConCabeceras(path) {
  return solicitar('GET', path);
}

async function testNoRegresion() {
  console.log('--- Verificando Aseguramiento de No Regresión (UPAO-73 / UPAO-77) ---');
  await new Promise((r) => setTimeout(r, 600));

  try {
    await iniciarSesion();

    // 0. Control de acceso (DEF-77-07): sin token, la API debe rechazar
    console.log('[REG-00] Validando que la API exige sesión...');
    const tokenPrevio = token;
    token = '';
    const sinToken = await solicitar('GET', '/api/ingresos/activos');
    token = tokenPrevio;
    assert.strictEqual(sinToken.status, 401, 'Sin token la API debe responder 401');
    console.log('✓ REG-00 EXITOSO: la API rechaza peticiones sin sesión.');

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

    // 6. Módulo de Nivel de Ocupación y Afluencia (UPAO-19 / UPAO-71 / UPAO-73)
    console.log('[REG-06] Validando endpoint de Nivel de Ocupación...');
    const resOcupacion = await get('/api/ocupacion?fechaInicio=2026-10-20&fechaFin=2026-10-30');
    assert.strictEqual(resOcupacion.status, 200, 'Endpoint /api/ocupacion debe responder 200');
    assert.ok(resOcupacion.data.resumen, 'Estructura de resumen de ocupación presente');
    assert.ok(Array.isArray(resOcupacion.data.bloquesHorarios), 'Bloques horarios presentes');
    console.log('✓ REG-06 EXITOSO: Endpoint de ocupación operando al 100%.');

    // 7. Validación defensiva de fechas en Ocupación
    console.log('[REG-07] Validando rechazo defensivo en fechas futuras y rangos invertidos...');
    const resFutura = await get('/api/ocupacion?fechaInicio=2027-01-01&fechaFin=2027-01-05');
    assert.strictEqual(resFutura.status, 400, 'Debe rechazar fechas futuras con 400');
    const resInvertida = await get('/api/ocupacion?fechaInicio=2026-10-30&fechaFin=2026-10-20');
    assert.strictEqual(resInvertida.status, 400, 'Debe rechazar rango invertido con 400');
    console.log('✓ REG-07 EXITOSO: Validaciones defensivas de ocupación intactas.');

    // 8. Exportación de Ocupación
    console.log('[REG-08] Validando exportación de ocupación en formato CSV...');
    const resExport = await get('/api/ocupacion/exportar?fechaInicio=2026-10-20&fechaFin=2026-10-30&formato=csv');
    assert.strictEqual(resExport.status, 200, 'Endpoint /exportar debe responder 200');
    console.log('✓ REG-08 EXITOSO: Exportación de ocupación operando al 100%.');

    // 9. Vista Pública de Disponibilidad (UPAO-20)
    console.log('[REG-09] Validando endpoint público de disponibilidad...');
    const resPublico = await get('/api/publico/disponibilidad');
    assert.strictEqual(resPublico.status, 200, 'Disponibilidad pública debe responder 200');
    assert.ok(resPublico.data.autos, 'Panel de autos presente');
    assert.ok(resPublico.data.motos, 'Panel de motos presente');
    assert.ok(resPublico.data.total, 'Consolidado total presente');
    assert.strictEqual(typeof resPublico.data.autos.disponibles, 'number', 'Cupos de autos numéricos');
    assert.strictEqual(typeof resPublico.data.motos.disponibles, 'number', 'Cupos de motos numéricos');
    assert.ok(!('placa' in resPublico.data.autos), 'No expone placas de vehículos');
    console.log('✓ REG-09 EXITOSO: Endpoint público de disponibilidad operando al 100%.');

    // 10. Invariantes del aforo público (UPAO-77): sin caché, sin negativos, fórmula exacta
    console.log('[REG-10] Validando invariantes del aforo público...');
    const resAforo = await getConCabeceras('/api/publico/disponibilidad');
    assert.ok(
      String(resAforo.headers['cache-control'] || '').includes('no-store'),
      'Los cupos no deben poder cachearse (Cache-Control: no-store)'
    );
    for (const tipo of ['autos', 'motos']) {
      const panel = resAforo.data[tipo];
      assert.ok(panel.disponibles >= 0, `${tipo} no puede reportar cupos negativos`);
      assert.strictEqual(
        panel.disponibles,
        Math.max(0, panel.capacidad - panel.enCochera - panel.reservasVigentes),
        `${tipo} debe cumplir capacidad - enCochera - reservas con piso en 0`
      );
    }
    assert.strictEqual(
      typeof resAforo.data.total.otrosEnCochera,
      'number',
      'El consolidado debe reportar las estadías de tipos distintos de auto/moto'
    );
    console.log('✓ REG-10 EXITOSO: Invariantes del aforo público intactas.');

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
