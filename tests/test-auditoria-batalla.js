require('dotenv').config();
const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const prisma = require('../src/config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');
const { normalizarPlaca, validarPlacaYTipo } = require('../src/utils/placas');

const PORT = 3569;
const BASE_URL = `http://localhost:${PORT}`;

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function esperarServidor(intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
      if (r.ok) return true;
    } catch (_) {}
    await esperar(250);
  }
  throw new Error('El servidor de auditoría no respondió a tiempo.');
}

function iniciarMockCulqi() {
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (c) => { rawBody += c; });
    req.on('end', () => {
      let body = {};
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) {}
      if (req.method === 'POST' && req.url === '/v2/charges') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: `chr_aud_${Date.now()}`, object: 'charge', amount: body.amount }));
      }
      if (req.method === 'POST' && req.url === '/v2/refunds') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: `ref_aud_${Date.now()}`, object: 'refund', charge_id: body.charge_id }));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ user_message: 'Not found' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/v2` });
    });
  });
}

async function req(ruta, opciones = {}) {
  const res = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function ejecutarAuditoriaBatalla() {
  console.log('=== SUITE ADVERSARIAL DE AUDITORÍA — BATALLA DE ERRORES ===');

  const mock = await iniciarMockCulqi();
  const srv = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      RATE_LIMIT_MAX_AUTH: '60',
      PAYMENT_GATEWAY: 'culqi',
      CULQI_API_BASE: mock.url,
      CULQI_PUBLIC_KEY: 'pk_test_audmock123456',
      CULQI_SECRET_KEY: 'sk_test_audmock123456',
      PASARELA_ENCRYPTION_KEY: 'aud-test-aes256-secret-key-32ch!'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  srv.stderr.on('data', (chunk) => process.stderr.write(`[SRV-ERR] ${chunk}`));

  const capacidadOriginal = obtenerCapacidad();
  const configPasarelaOriginal = await prisma.configuracionPasarela.findUnique({ where: { proveedor: 'culqi' } });
  const suf = String(Date.now()).slice(-4);
  const usuarioCond = `cond_aud_${suf}`;
  const dniCond = `7391${suf}`;
  const placaAuto = `AUD-${suf.slice(1)}`;
  const placaMoto7 = `AUD-1${suf.slice(1)}`;
  const placaPos = `POS-${suf.slice(1)}`;
  const placaRes = `RES-${suf.slice(1)}`;
  const idsEstadiasLimpiar = [];
  const idsPagosLimpiar = [];
  const idsReclamosLimpiar = [];
  const codigosReclamosLimpiar = [];
  const usuariosLimpiarIds = [];
  const usuariosLimpiarNombres = [];

  try {
    await esperarServidor();

    const dispInit = await (await fetch(`${BASE_URL}/api/publico/disponibilidad`)).json();
    if (dispInit.autos.disponibles < 4 || dispInit.motos.disponibles < 2) {
      guardarCapacidad({
        capacidadAutos: dispInit.autos.enCochera + dispInit.autos.reservasVigentes + 6,
        capacidadMotos: dispInit.motos.enCochera + dispInit.motos.reservasVigentes + 4
      });
    }

    const login = async (usuario, contrasena) => {
      const r = await req('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario, contrasena })
      });
      assert.strictEqual(r.status, 200, `Login ${usuario} falló: ${JSON.stringify(r.data)}`);
      return { Authorization: `Bearer ${r.data.token}`, user: r.data };
    };

    const authDueno = await login('admin', '123456');
    const authRecep = await login('recepcion', '123456');
    const hdrDueno = { Authorization: authDueno.Authorization };
    const hdrRecep = { Authorization: authRecep.Authorization };

    const regCond = await req('/api/auth/registro-conductor', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Conductor Auditoria',
        dni: dniCond,
        celular: '987654321',
        usuario: usuarioCond,
        contrasena: 'password123'
      })
    });
    assert.strictEqual(regCond.status, 201, `Registro conductor falló: ${JSON.stringify(regCond.data)}`);
    const hdrCond = { Authorization: `Bearer ${regCond.data.token}` };

    // [CP-AUD-01] RBAC estricto: CONDUCTOR rechazado (403) en tarifas, ingresos, salidas y espacios
    const rbacRutas = [
      ['GET', '/api/tarifas'],
      ['GET', '/api/ingresos/activos'],
      ['POST', '/api/ingresos', { placa: placaAuto, tipo: 'auto' }],
      ['GET', '/api/salidas/activos'],
      ['POST', '/api/salidas', { estadiaId: 1, metodoPago: 'Efectivo' }],
      ['GET', '/api/espacios']
    ];
    for (const [method, ruta, body] of rbacRutas) {
      const r = await req(ruta, {
        method,
        headers: hdrCond,
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      assert.strictEqual(r.status, 403, `CP-AUD-01 falló: ${method} ${ruta} devolvió ${r.status} para CONDUCTOR`);
    }
    console.log('✅ [CP-AUD-01] RBAC estricto: CONDUCTOR bloqueado con 403 en tarifas, ingresos, salidas y espacios.');

    // [CP-AUD-02] Token con 3 segmentos rechazado (401) y credenciales > 72 chars / XSS en nombre rechazados (400)
    const token3Partes = `${authDueno.Authorization}.segmentoextra`;
    const rTok3 = await req('/api/espacios', { headers: { Authorization: token3Partes } });
    assert.strictEqual(rTok3.status, 401, `CP-AUD-02: token de 3 segmentos devolvió ${rTok3.status}`);

    const rPassLargo = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'admin', contrasena: 'A'.repeat(73) })
    });
    assert.strictEqual(rPassLargo.status, 400, `CP-AUD-02: login > 72 chars devolvió ${rPassLargo.status}`);

    const rNombreXss = await req('/api/auth/registro-conductor', {
      method: 'POST',
      body: JSON.stringify({
        nombre: '<img src=x onerror=alert(1)>',
        dni: `7392${suf}`,
        celular: '987654321',
        usuario: `xss_${suf}`,
        contrasena: 'password123'
      })
    });
    assert.strictEqual(rNombreXss.status, 400, `CP-AUD-02: nombre con HTML devolvió ${rNombreXss.status}`);
    console.log('✅ [CP-AUD-02] Token de 3 segmentos (401), contraseña > 72 chars (400) y HTML en nombre (400) bloqueados.');

    // [CP-AUD-03] IDs inválidos / INT4 overflow / NaN devuelven 400 limpio (nunca 500)
    const rSalNan = await req('/api/salidas', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ estadiaId: 'abc', metodoPago: 'Efectivo' })
    });
    const rSalOv = await req('/api/salidas', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ estadiaId: 999999999999, metodoPago: 'Efectivo' })
    });
    const rTarOv = await req('/api/tarifas/999999999999', {
      method: 'PUT',
      headers: hdrDueno,
      body: JSON.stringify({ precioHora: '5.00', precioFraccion: '2.50' })
    });
    const rVehOv = await req('/api/conductor/vehiculos/999999999999', {
      method: 'DELETE',
      headers: hdrCond
    });
    const rResOv = await req('/api/reservas/999999999999', {
      method: 'DELETE',
      headers: hdrCond
    });
    assert.strictEqual(rSalNan.status, 400, `Salida NaN devolvió ${rSalNan.status}`);
    assert.strictEqual(rSalOv.status, 400, `Salida overflow devolvió ${rSalOv.status}`);
    assert.strictEqual(rTarOv.status, 400, `Tarifa overflow devolvió ${rTarOv.status}`);
    assert.strictEqual(rVehOv.status, 400, `Vehiculo overflow devolvió ${rVehOv.status}`);
    assert.strictEqual(rResOv.status, 400, `Reserva overflow devolvió ${rResOv.status}`);
    console.log('✅ [CP-AUD-03] IDs NaN y overflow INT4 (>2147483647) retornan HTTP 400 limpio (cero 500).');

    // [CP-AUD-04] Fechas calendario inexistentes (2026-02-30) en /api/reportes/diario retornan 400 (nunca 500)
    const rFechaInv = await req('/api/reportes/diario?fecha=2026-02-30', { headers: hdrDueno });
    assert.strictEqual(rFechaInv.status, 400, `2026-02-30 devolvió ${rFechaInv.status}`);
    console.log('✅ [CP-AUD-04] Fecha de calendario inválida (2026-02-30) rechazada con HTTP 400.');

    // [CP-AUD-05] Placas MTC: rechazar AAA-000 y exceso de caracteres (ABC123999) tanto en placas.js como en /api/ingresos
    assert.strictEqual(validarPlacaYTipo('ABC123999', 'auto').ok, false, 'Debe rechazar exceso de caracteres');
    assert.strictEqual(normalizarPlaca('1234AB'), '1234-AB', 'Debe normalizar moto 1234-AB');
    assert.strictEqual(normalizarPlaca('ABC1234'), 'ABC-1234', 'Debe normalizar moto 7 chars ABC-1234');

    const rIng000 = await req('/api/ingresos', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: 'AAA-000', tipo: 'auto' })
    });
    const rIngLarga = await req('/api/ingresos', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: 'ABC123999', tipo: 'auto' })
    });
    assert.strictEqual(rIng000.status, 400, `AAA-000 en /api/ingresos devolvió ${rIng000.status}`);
    assert.strictEqual(rIngLarga.status, 400, `ABC123999 en /api/ingresos devolvió ${rIngLarga.status}`);
    console.log('✅ [CP-AUD-05] Validación MTC: AAA-000 y exceso de caracteres rechazados (400); motos 1234-AB/ABC-1234 soportadas.');

    // [CP-AUD-06] Spoofing de operador en /api/ingresos ignorado; siempre usa req.sesion.sub
    const rIngSpoof = await req('/api/ingresos', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: placaAuto, tipo: 'auto', idUsuario: 'abc_spoof', usuario: 'admin' })
    });
    assert.strictEqual(rIngSpoof.status, 201, `Ingreso con spoof body falló: ${JSON.stringify(rIngSpoof.data)}`);
    idsEstadiasLimpiar.push(rIngSpoof.data.id);
    assert.strictEqual(rIngSpoof.data.usuario, authRecep.user.nombre, 'El operador debe provenir de la sesión autenticada');
    console.log('✅ [CP-AUD-06] Spoofing de idUsuario/usuario en POST /api/ingresos neutralizado.');

    // [CP-AUD-07] Pago con POS contabilizado en /api/reportes/diario (totalPos, dineroDigital, totalGeneral)
    const rIngPos = await req('/api/ingresos', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: placaPos, tipo: 'auto' })
    });
    assert.strictEqual(rIngPos.status, 201);
    idsEstadiasLimpiar.push(rIngPos.data.id);

    const rSalPos = await req('/api/salidas', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: placaPos.replace('-', ''), metodoPago: 'POS' })
    });
    assert.strictEqual(rSalPos.status, 200, `Salida por placa sin guion + POS falló: ${JSON.stringify(rSalPos.data)}`);
    if (rSalPos.data.salida && rSalPos.data.salida.idPago) idsPagosLimpiar.push(rSalPos.data.salida.idPago);

    const rRepHoy = await req('/api/reportes/diario', { headers: hdrDueno });
    assert.strictEqual(rRepHoy.status, 200);
    assert.ok(rRepHoy.data.movimientos.some((m) => m.placa === placaPos && m.metodoPago === 'POS'), 'Movimiento POS debe listarse');
    assert.ok(rRepHoy.data.totalPos >= rSalPos.data.salida.monto, 'totalPos debe sumar el cobro POS');
    assert.strictEqual(
      Number((rRepHoy.data.totalEfectivo + rRepHoy.data.cuadre.dineroDigital.total).toFixed(2)),
      rRepHoy.data.totalGeneral,
      'Efectivo + Digital (Yape+POS) debe cuadrar con totalGeneral'
    );
    console.log('✅ [CP-AUD-07] Cobro POS contabilizado en Caja Diaria y salida por placa sin guion normalizada.');

    // [CP-AUD-08] DELETE /api/conductor/vehiculos/:id bloqueado (409) si tiene estadía activa en cochera
    const rVehAct = await req('/api/conductor/vehiculos', {
      method: 'POST',
      headers: hdrCond,
      body: JSON.stringify({ placa: placaAuto, tipo: 'auto' })
    });
    assert.strictEqual(rVehAct.status, 201);
    const rDelVehAct = await req(`/api/conductor/vehiculos/${rVehAct.data.id}`, {
      method: 'DELETE',
      headers: hdrCond
    });
    assert.strictEqual(rDelVehAct.status, 409, `Eliminar vehículo con estadía activa devolvió ${rDelVehAct.status}`);

    // Cerrar estadía de placaAuto para limpiar y probar estado
    const rSalAuto = await req('/api/salidas', {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ estadiaId: rIngSpoof.data.id, metodoPago: 'Efectivo' })
    });
    assert.strictEqual(rSalAuto.status, 200, `Salida auto falló: ${JSON.stringify(rSalAuto.data)}`);
    if (rSalAuto.data.salida && rSalAuto.data.salida.idPago) idsPagosLimpiar.push(rSalAuto.data.salida.idPago);
    console.log('✅ [CP-AUD-08] Bloqueo 409 al eliminar vehículo con estadía activa en cochera verificado.');

    // [CP-AUD-09] PUT /api/espacios/capacidad rechaza booleanos, >5000 y valores < ocupados+reservasVigentes
    const rCapBool = await req('/api/espacios/capacidad', {
      method: 'PUT',
      headers: hdrDueno,
      body: JSON.stringify({ capacidadAutos: true })
    });
    const rCapMax = await req('/api/espacios/capacidad', {
      method: 'PUT',
      headers: hdrDueno,
      body: JSON.stringify({ capacidadAutos: 999999 })
    });
    assert.strictEqual(rCapBool.status, 400, `Capacidad booleana devolvió ${rCapBool.status}`);
    assert.strictEqual(rCapMax.status, 400, `Capacidad > 5000 devolvió ${rCapMax.status}`);

    // Crear reserva para verificar /api/espacios descuento de reservasVigentes y protección en PUT /capacidad
    const rVehRes = await req('/api/conductor/vehiculos', {
      method: 'POST',
      headers: hdrCond,
      body: JSON.stringify({ placa: placaRes, tipo: 'auto' })
    });
    assert.strictEqual(rVehRes.status, 201);
    const rCrearRes = await req('/api/reservas', {
      method: 'POST',
      headers: hdrCond,
      body: JSON.stringify({
        idVehiculo: rVehRes.data.id,
        sourceToken: `tkn_test_aud_${suf}`,
        email: 'aud@cochera.pe',
        idempotencyKey: `idem-aud-${suf}`
      })
    });
    assert.strictEqual(rCrearRes.status, 201);
    const resObj = rCrearRes.data.reserva;

    const rEsp = await req('/api/espacios', { headers: hdrDueno });
    assert.strictEqual(rEsp.status, 200);
    assert.strictEqual(
      rEsp.data.autos.disponibles,
      Math.max(0, rEsp.data.autos.capacidad - rEsp.data.autos.ocupados - rEsp.data.autos.reservasVigentes),
      'GET /api/espacios debe descontar reservasVigentes de disponibles'
    );
    const comprometidos = rEsp.data.autos.ocupados + rEsp.data.autos.reservasVigentes;
    if (comprometidos > 1) {
      const rCapMenor = await req('/api/espacios/capacidad', {
        method: 'PUT',
        headers: hdrDueno,
        body: JSON.stringify({ capacidadAutos: comprometidos - 1 })
      });
      assert.strictEqual(rCapMenor.status, 400, 'PUT /capacidad debe rechazar capacidad menor a ocupados + reservasVigentes');
    }
    console.log('✅ [CP-AUD-09] GET/PUT /api/espacios integra reservasVigentes y valida límites estrictos (1..5000).');

    // [CP-AUD-10] Confirmar reserva con nota no-string -> 400; confirmar reserva válida -> estadía con adelanto
    const rNotaObj = await req(`/api/reservas/${resObj.id}/confirmar`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ nota: { malicioso: true } })
    });
    assert.strictEqual(rNotaObj.status, 400, `Nota objeto devolvió ${rNotaObj.status}`);

    const rConfOk = await req(`/api/reservas/${resObj.id}/confirmar`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ nota: 'Reserva auditada' })
    });
    assert.strictEqual(rConfOk.status, 201);
    idsEstadiasLimpiar.push(rConfOk.data.estadiaId);
    console.log('✅ [CP-AUD-10] Confirmación de reserva rechaza nota no-string (400) y vincula adelanto correctamente.');

    // [CP-AUD-11] Verificación E2E con Playwright:
    //  a) Aforo, Caja Diaria (sin datos demo falsos + botón POS), Estadísticas y Ocupación cargan con localStorage + sidebar visible
    //  b) Registrar Salida muestra descuento de adelanto de reserva en vivo (S/ 0.00 en vez de S/ 4.70)
    //  c) Conductor puede escribir placa moto 7 chars (ABC-1234)
    //  d) Todas las horas en UI están en zona horaria America/Lima 24h
    const browser = await chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext({ timezoneId: 'UTC', viewport: { width: 1366, height: 860 } });
      const page = await ctx.newPage();
      const erroresConsola = [];
      page.on('pageerror', (err) => erroresConsola.push(err.message));

      // Login como DUEÑO en contexto con browser TZ=UTC (para probar conversión forzada a America/Lima)
      await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle' });
      await page.fill('#login-usuario', 'admin');
      await page.fill('#login-password', '123456');
      await page.click('#btn-login-submit');
      await page.waitForFunction(() => document.getElementById('view-dashboard')?.classList.contains('active'));

      // 1. Aforo
      await page.click('#card-modulo-aforo');
      await page.waitForFunction(() => {
        const view = document.getElementById('view-aforo');
        const list = document.getElementById('parking-list');
        return view?.classList.contains('active') && list && !list.textContent.includes('Cargando estado');
      }, null, { timeout: 15000 });
      const sidebarVisibleAforo = await page.evaluate(() => !document.getElementById('app-sidebar').classList.contains('hidden'));
      const textoAforo = await page.textContent('#parking-list');
      assert.ok(sidebarVisibleAforo, 'Sidebar debe estar visible al abrir Visualizar Aforo');
      assert.ok(!textoAforo.includes('No se pudo cargar'), `Aforo falló con error: ${textoAforo}`);

      // 2. Caja Diaria (sin datos demo falsos para ayer/anteayer si no hay en BD, y mostrando el cobro POS de hoy)
      await page.click('#app-sidebar .sidebar-link[data-view="reportes"]');
      await page.waitForFunction(
        (placa) => {
          const view = document.getElementById('view-reportes');
          const tbody = document.getElementById('tabla-reportes-body');
          return view?.classList.contains('active') && tbody && tbody.textContent.includes(placa);
        },
        placaPos,
        { timeout: 15000 }
      );
      const totalCajaTxt = await page.textContent('#reporte-total-general');
      const cuerpoCaja = await page.textContent('#tabla-reportes-body');
      assert.ok(cuerpoCaja.includes(placaPos), 'Caja Diaria debe mostrar movimiento POS real de hoy');
      assert.ok(!totalCajaTxt.includes('NaN'), 'Total Caja Diaria no debe ser NaN');
      const tienePillPos = await page.isVisible('#pill-filtro-pos');
      assert.ok(tienePillPos, 'Caja Diaria debe exponer filtro POS');

      // Verificar fecha antigua sin datos -> no debe inventar placas demo (ACB-0000 / DEF-789)
      await page.fill('#input-fecha-reporte', '2024-01-15');
      await page.click('#btn-consultar-reporte');
      await page.waitForFunction(() => {
        const el = document.getElementById('reporte-vacio');
        return el && el.style.display !== 'none';
      }, null, { timeout: 15000 });
      const vacioVisible = await page.isVisible('#reporte-vacio');
      assert.ok(vacioVisible, 'Fecha sin movimientos reales debe mostrar estado vacío sin mock demo');

      // 3. Estadísticas
      await page.click('#app-sidebar .sidebar-link[data-view="estadisticas"]');
      await page.waitForFunction(() => {
        const view = document.getElementById('view-estadisticas');
        const per = document.getElementById('metrica-periodo');
        return view?.classList.contains('active') && per && per.textContent.trim() !== '—';
      }, null, { timeout: 15000 });
      const metricaPeriodo = await page.textContent('#metrica-periodo');
      assert.ok(metricaPeriodo && metricaPeriodo.trim() !== '—', `Estadísticas debe cargar datos reales (obtuvo: ${metricaPeriodo})`);

      // 4. Ocupación
      await page.click('#app-sidebar .sidebar-link[data-view="ocupacion"]');
      await page.waitForFunction(() => {
        const view = document.getElementById('view-ocupacion');
        const btn = document.getElementById('btn-consultar-ocupacion');
        return view?.classList.contains('active') && btn && !btn.disabled;
      }, null, { timeout: 15000 });
      const capOcupacion = await page.textContent('#ocupacion-aforo-maximo');
      assert.ok(!capOcupacion.includes('NaN'), 'Ocupación debe cargar sin errores');

      // Cerrar sesión y entrar como RECEPCIONISTA para verificar descuento de adelanto en Registrar Salida
      await page.click('#btn-user-menu');
      await page.click('#btn-logout');
      await page.waitForFunction(() => document.getElementById('view-disponibilidad')?.classList.contains('active'));
      await page.click('#btn-header-login');
      await page.fill('#login-usuario', 'recepcion');
      await page.fill('#login-password', '123456');
      await page.click('#btn-login-submit');
      await page.waitForFunction(() => document.getElementById('view-dashboard')?.classList.contains('active'));

      await page.click('#card-modulo-salida');
      await page.waitForFunction(
        (placa) => {
          const view = document.getElementById('view-salida');
          const tbody = document.getElementById('tabla-activos-body');
          return view?.classList.contains('active') && tbody && tbody.textContent.includes(placa);
        },
        placaRes,
        { timeout: 15000 }
      );
      const filaRes = page.locator(`#tabla-activos-body tr:has-text("${placaRes}")`);
      await filaRes.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('salida-resumen');
        return el && el.style.display !== 'none';
      }, null, { timeout: 5000 });

      const adelantoVisible = await page.isVisible('#salida-adelanto-row');
      const montoPreview = (await page.textContent('#salida-monto')).trim();
      assert.ok(adelantoVisible, 'Registrar Salida debe mostrar fila de adelanto de reserva');
      assert.strictEqual(montoPreview, 'S/ 0.00', `Preview de salida con reserva en 1ra hora debe ser S/ 0.00, obtuvo ${montoPreview}`);

      // Verificar conversión de hora a America/Lima aunque el navegador esté en UTC
      const horaLimaEsperada = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date(rConfOk.data ? Date.now() : Date.now()));
      const horaEntradaUI = (await page.textContent('#salida-hora-entrada')).trim();
      assert.ok(/^\d{2}:\d{2}$/.test(horaEntradaUI), `Hora entrada UI debe ser HH:MM 24h (${horaEntradaUI})`);
      assert.strictEqual(horaEntradaUI.slice(0, 2), horaLimaEsperada.slice(0, 2), `Hora entrada UI (${horaEntradaUI}) debe coincidir con hora Lima (${horaLimaEsperada}) incluso con browser en UTC`);

      // Cerrar sesión y probar input de placa moto 7 caracteres como CONDUCTOR
      await page.click('#btn-user-menu');
      await page.click('#btn-logout');
      await page.click('#btn-header-login');
      await page.fill('#login-usuario', usuarioCond);
      await page.fill('#login-password', 'password123');
      await page.click('#btn-login-submit');
      await page.waitForFunction(() => document.getElementById('view-dashboard')?.classList.contains('active'));
      await page.click('#card-modulo-conductor-reservas');
      await page.waitForFunction(() => document.getElementById('view-conductor-reservas')?.classList.contains('active'));
      await page.fill('#vehiculo-placa', placaMoto7.replace('-', ''));
      const valPlacaInput = await page.inputValue('#vehiculo-placa');
      const valTipoSelect = await page.inputValue('#vehiculo-tipo');
      assert.strictEqual(valPlacaInput, placaMoto7, `Input conductor debe aceptar placa moto 7 chars (${valPlacaInput})`);
      assert.strictEqual(valTipoSelect, 'moto', 'Debe autoseleccionar tipo moto');

      // [CP-AUD-18] E2E: Libro de Reclamaciones, Tarifas sin combobox redundante, Usuarios Admin y descarga CSV Blob
      await page.click('#btn-user-menu');
      await page.click('#btn-logout');
      await page.waitForFunction(() => document.getElementById('view-disponibilidad')?.classList.contains('active'));
      await page.click('#btn-abrir-libro-reclamaciones');
      await page.waitForFunction(() => !document.getElementById('modal-libro-reclamaciones')?.classList.contains('hidden'));
      await page.fill('#rec-nombre', 'Cliente E2E Auditoria');
      await page.selectOption('#rec-tipo-doc', 'DNI');
      await page.fill('#rec-num-doc', `7451${suf}`);
      await page.fill('#rec-telefono', '987654321');
      await page.fill('#rec-correo', `cliente_${suf}@correo.pe`);
      await page.fill('#rec-domicilio', 'Av. Larco 1234, Trujillo');
      await page.fill('#rec-detalle', 'Prueba automatizada de registro de reclamo legal Indecopi.');
      await page.fill('#rec-pedido', 'Validar emisión de constancia con código correlativo.');
      await page.click('#btn-enviar-reclamo');
      await page.waitForFunction(() => !document.getElementById('box-constancia-reclamo')?.classList.contains('hidden'), null, { timeout: 15000 });
      const codigoRecE2E = (await page.textContent('#rec-constancia-codigo')).trim();
      assert.ok(/^LR-\d{4}-\d{4}$/.test(codigoRecE2E), `Código de constancia Libro Reclamaciones inválido: ${codigoRecE2E}`);
      codigosReclamosLimpiar.push(codigoRecE2E);
      await page.click('#btn-cerrar-modal-reclamo');

      // Login DUEÑO para verificar Tarifas sin select redundante, Reportes Culqi, CSV Blob y Usuarios
      await page.click('#btn-header-login');
      await page.fill('#login-usuario', 'admin');
      await page.fill('#login-password', '123456');
      await page.click('#btn-login-submit');
      await page.waitForFunction(() => document.getElementById('view-dashboard')?.classList.contains('active'));

      await page.click('#card-modulo-tarifas');
      await page.waitForFunction(() => {
        const view = document.getElementById('view-tarifas');
        const filas = document.querySelectorAll('#tabla-tarifas-body tr');
        return view?.classList.contains('active') && filas.length >= 2;
      }, null, { timeout: 15000 });
      assert.strictEqual(await page.locator('#select-tipo-tarifa').count(), 0, 'Tarifas no debe tener combobox redundante #select-tipo-tarifa');
      const textoTablaTarifas = await page.textContent('#tabla-tarifas-body');
      assert.ok(!textoTablaTarifas.includes('Reserva Web'), 'Tarifas no debe mostrar fila fantasma Reserva Web');
      const segundaFila = page.locator('#tabla-tarifas-body tr').nth(1);
      await segundaFila.locator('.btn-editar-fila').click();
      assert.ok(await segundaFila.evaluate((el) => el.classList.contains('seleccionada')), 'Fila seleccionada en Tarifas debe resaltarse');
      const tituloTarifaAntes = (await page.textContent('#form-tarifa-title')).trim();
      await page.click('#btn-guardar-tarifa');
      await page.waitForFunction(() => {
        const toast = document.querySelector('.toast');
        return toast && toast.textContent.includes('Tarifa actualizada');
      }, null, { timeout: 10000 });
      assert.ok(await page.locator('#tabla-tarifas-body tr').nth(1).evaluate((el) => el.classList.contains('seleccionada')), 'Selección de Tarifa debe mantenerse tras guardar');
      assert.strictEqual((await page.textContent('#form-tarifa-title')).trim(), tituloTarifaAntes, 'Título de edición debe conservar la tarifa elegida');

      await page.click('#app-sidebar .sidebar-link[data-view="reportes"]');
      await page.waitForFunction(() => document.getElementById('view-reportes')?.classList.contains('active'));
      assert.ok(await page.isVisible('#pill-filtro-culqi'), 'Caja Diaria debe exponer filtro Culqi Online');

      await page.click('#app-sidebar .sidebar-link[data-view="estadisticas"]');
      await page.waitForFunction(() => {
        const view = document.getElementById('view-estadisticas');
        const btn = document.getElementById('btn-exportar-estadisticas');
        return view?.classList.contains('active') && btn && !btn.disabled;
      }, null, { timeout: 15000 });
      const [descargaCsv] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#btn-exportar-estadisticas')
      ]);
      assert.ok(descargaCsv.suggestedFilename().endsWith('.csv'), `Exportación Blob debe descargar .csv (${descargaCsv.suggestedFilename()})`);

      await page.click('#app-sidebar .sidebar-link[data-view="usuarios"]');
      await page.waitForFunction((cod) => {
        const view = document.getElementById('view-usuarios');
        const tbRec = document.getElementById('tbody-reclamos-admin');
        return view?.classList.contains('active') && tbRec && tbRec.textContent.includes(cod);
      }, codigoRecE2E, { timeout: 15000 });

      const userE2E = `rec_e2e_${suf}`;
      usuariosLimpiarNombres.push(userE2E);
      await page.fill('#usr-nombre', 'Recepcion E2E');
      await page.fill('#usr-usuario', userE2E);
      await page.selectOption('#usr-rol', 'RECEPCIONISTA');
      await page.fill('#usr-password', 'ClaveE2E123');
      await page.click('#btn-crear-usuario-admin');
      await page.waitForFunction((u) => {
        const tb = document.getElementById('tbody-usuarios-admin');
        return tb && tb.textContent.includes(u);
      }, userE2E, { timeout: 15000 });
      const filaUsr = page.locator(`#tbody-usuarios-admin tr:has-text("${userE2E}")`);
      await filaUsr.locator('.btn-toggle-usuario').click();
      await page.waitForFunction((u) => {
        const tb = document.getElementById('tbody-usuarios-admin');
        const fila = Array.from(tb?.querySelectorAll('tr') || []).find((tr) => tr.textContent.includes(u));
        return fila && fila.textContent.includes('INACTIVO');
      }, userE2E, { timeout: 10000 });

      assert.strictEqual(erroresConsola.length, 0, `Errores JS en navegador: ${erroresConsola.join(' | ')}`);
      await ctx.close();
    } finally {
      await browser.close();
    }
    console.log('✅ [CP-AUD-11] Verificación E2E (Aforo, Caja Diaria real, Estadísticas, Ocupación, Salida con adelanto, TZ Lima en browser UTC, placa moto 7 chars) OK.');
    console.log('✅ [CP-AUD-18] Verificación E2E (Libro de Reclamaciones, Tarifas sin select redundante, Culqi Online, Blob CSV, Usuarios Admin) OK.');

    // [CP-AUD-12] Libro de Reclamaciones API (correlativo único, validación y RBAC DUEÑO)
    const rRecBad = await req('/api/publico/reclamos', {
      method: 'POST',
      body: JSON.stringify({ tipo: 'INVALIDO', nombreConsumidor: 'A', detalle: 'corto' })
    });
    assert.strictEqual(rRecBad.status, 400, `CP-AUD-12: reclamo inválido devolvió ${rRecBad.status}`);

    const rRecOk = await req('/api/publico/reclamos', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'QUEJA',
        nombreConsumidor: 'Usuario API Reclamo',
        tipoDocumento: 'DNI',
        numeroDocumento: `7462${suf}`,
        correo: `api_${suf}@correo.pe`,
        telefono: '987654322',
        domicilio: 'Jr. Pizarro 450, Trujillo',
        servicio: 'Reserva web',
        montoReclamado: 4.7,
        detalle: 'Demora en validación de comprobante de prueba.',
        pedido: 'Emitir respuesta formal dentro del plazo.'
      })
    });
    assert.strictEqual(rRecOk.status, 201, `CP-AUD-12: POST reclamo falló (${JSON.stringify(rRecOk.data)})`);
    assert.ok(/^LR-\d{4}-\d{4}$/.test(rRecOk.data.reclamo.codigo), 'CP-AUD-12: código reclamo debe tener formato LR-YYYY-NNNN');
    idsReclamosLimpiar.push(rRecOk.data.reclamo.id);

    const rRecCond = await req('/api/reclamos', { headers: hdrCond });
    assert.strictEqual(rRecCond.status, 403, `CP-AUD-12: CONDUCTOR en GET /api/reclamos devolvió ${rRecCond.status}`);

    const rRecPatch = await req(`/api/reclamos/${rRecOk.data.reclamo.id}`, {
      method: 'PATCH',
      headers: hdrDueno,
      body: JSON.stringify({ estado: 'ATENDIDO' })
    });
    assert.strictEqual(rRecPatch.status, 200, `CP-AUD-12: PATCH reclamo falló (${rRecPatch.status})`);
    console.log('✅ [CP-AUD-12] Libro de Reclamaciones API (validación, correlativo, RBAC y atención DUEÑO) OK.');

    // [CP-AUD-13] Gestión de Usuarios, cambio de contraseña y revocación inmediata de JWT (/logout)
    const rUsrRecep = await req('/api/usuarios', { headers: hdrRecep });
    assert.strictEqual(rUsrRecep.status, 403, `CP-AUD-13: RECEPCIONISTA en GET /api/usuarios devolvió ${rUsrRecep.status}`);

    const usrApi = `rec_api_${suf}`;
    const rUsrCreate = await req('/api/usuarios', {
      method: 'POST',
      headers: hdrDueno,
      body: JSON.stringify({
        nombre: 'Recepcion API Test',
        usuario: usrApi,
        rol: 'RECEPCIONISTA',
        contrasena: 'Password123!'
      })
    });
    assert.strictEqual(rUsrCreate.status, 201, `CP-AUD-13: crear usuario falló (${JSON.stringify(rUsrCreate.data)})`);
    usuariosLimpiarIds.push(rUsrCreate.data.usuario.id);

    const authNuevo = await login(usrApi, 'Password123!');
    const rChgPwd = await req('/api/auth/cambiar-contrasena', {
      method: 'PUT',
      headers: { Authorization: authNuevo.Authorization },
      body: JSON.stringify({ contrasenaActual: 'Password123!', contrasenaNueva: 'NuevaPass456!' })
    });
    assert.strictEqual(rChgPwd.status, 200, `CP-AUD-13: cambiar contraseña falló (${rChgPwd.status})`);

    const rOldLogin = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: usrApi, contrasena: 'Password123!' })
    });
    assert.strictEqual(rOldLogin.status, 401, 'CP-AUD-13: contraseña anterior debe quedar invalidada');

    const authNuevo2 = await login(usrApi, 'NuevaPass456!');
    const rLogout = await req('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: authNuevo2.Authorization }
    });
    assert.strictEqual(rLogout.status, 200, `CP-AUD-13: /logout falló (${rLogout.status})`);
    const rPostLogout = await req('/api/espacios', { headers: { Authorization: authNuevo2.Authorization } });
    assert.strictEqual(rPostLogout.status, 401, `CP-AUD-13: token revocado en /logout siguió activo (${rPostLogout.status})`);

    const rUsrList = await req('/api/usuarios', { headers: hdrDueno });
    const adminRow = rUsrList.data.usuarios.find((u) => u.usuario === 'admin');
    const rSelfOff = await req(`/api/usuarios/${adminRow.id}`, {
      method: 'PUT',
      headers: hdrDueno,
      body: JSON.stringify({ activo: false })
    });
    assert.strictEqual(rSelfOff.status, 409, `CP-AUD-13: auto-desactivación de admin devolvió ${rSelfOff.status}`);

    const rOffOk = await req(`/api/usuarios/${rUsrCreate.data.usuario.id}`, {
      method: 'PUT',
      headers: hdrDueno,
      body: JSON.stringify({ activo: false })
    });
    assert.strictEqual(rOffOk.status, 200, 'CP-AUD-13: desactivar usuario de prueba falló');
    const rLoginDisabled = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: usrApi, contrasena: 'NuevaPass456!' })
    });
    assert.strictEqual(rLoginDisabled.status, 403, `CP-AUD-13: usuario inactivo pudo iniciar sesión (${rLoginDisabled.status})`);
    console.log('✅ [CP-AUD-13] Gestión Usuarios, cambio contraseña, guard auto-desactivación y revocación JWT (/logout) OK.');

    // [CP-AUD-14] Aislamiento de placa entre conductores y exclusión de tarifa 'Reserva Web'
    const usrCond2 = `cond_aud2_${suf}`;
    const regCond2 = await req('/api/auth/registro-conductor', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Conductor Aislado',
        dni: `7398${suf}`,
        celular: '987654329',
        usuario: usrCond2,
        contrasena: 'password123'
      })
    });
    assert.strictEqual(regCond2.status, 201, 'CP-AUD-14: registro conductor 2 falló');
    usuariosLimpiarNombres.push(usrCond2);
    const hdrCond2 = { Authorization: `Bearer ${regCond2.data.token}` };

    const placaComp = `CMP-${suf.slice(1)}`;
    const rVeh1 = await req('/api/conductor/vehiculos', {
      method: 'POST',
      headers: hdrCond,
      body: JSON.stringify({ placa: placaComp, tipo: 'auto' })
    });
    assert.strictEqual(rVeh1.status, 201, `CP-AUD-14: conductor 1 vehículo falló (${rVeh1.status})`);

    const rVeh2 = await req('/api/conductor/vehiculos', {
      method: 'POST',
      headers: hdrCond2,
      body: JSON.stringify({ placa: placaComp, tipo: 'auto' })
    });
    assert.strictEqual(rVeh2.status, 409, `CP-AUD-14: placa compartida entre cuentas no dio 409 (${rVeh2.status})`);

    const rTarifasClean = await req('/api/tarifas', { headers: hdrDueno });
    assert.strictEqual(rTarifasClean.status, 200);
    assert.ok(!rTarifasClean.data.some((t) => t.tipo === 'Reserva Web'), 'CP-AUD-14: GET /api/tarifas no debe devolver Reserva Web');
    console.log('✅ [CP-AUD-14] Aislamiento de placa entre cuentas (409) y exclusión de Reserva Web OK.');

    // [CP-AUD-15] Integración contable de Culqi Online en Caja Diaria y Gráficos
    const hoyLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    const rDiario = await req(`/api/reportes/diario?fecha=${hoyLima}`, { headers: hdrDueno });
    assert.strictEqual(rDiario.status, 200);
    const movCulqi = (rDiario.data.movimientos || []).find((m) => m.placa === placaRes && m.metodoPago === 'Culqi Online');
    assert.ok(movCulqi, `CP-AUD-15: Caja Diaria debe incluir cobro online Culqi de ${placaRes}`);
    assert.ok(Number(rDiario.data.totalCulqi) > 0, 'CP-AUD-15: totalCulqi debe ser > 0');
    assert.strictEqual(
      Number((rDiario.data.totalEfectivo + rDiario.data.cuadre.dineroDigital.total).toFixed(2)),
      rDiario.data.totalGeneral,
      'CP-AUD-15: Efectivo + Digital debe cuadrar con totalGeneral'
    );
    console.log('✅ [CP-AUD-15] Contabilidad de pagos Culqi Online integrada en Caja Diaria OK.');

    // [CP-AUD-16] Persistencia en BD de capacidad de espacios (DEF-77-08)
    const capPruebaAutos = capacidadOriginal.capacidadAutos + 1;
    const rCapPut = await req('/api/espacios/capacidad', {
      method: 'PUT',
      headers: hdrDueno,
      body: JSON.stringify({ capacidadAutos: capPruebaAutos, capacidadMotos: capacidadOriginal.capacidadMotos })
    });
    assert.strictEqual(rCapPut.status, 200, `CP-AUD-16: PUT capacidad falló (${rCapPut.status})`);
    const capBD = await prisma.configuracionEspacios.findUnique({ where: { id: 1 } });
    assert.ok(capBD && capBD.capacidadAutos === capPruebaAutos, 'CP-AUD-16: configuracion_espacios debe persistir en PostgreSQL');
    console.log('✅ [CP-AUD-16] Persistencia en BD de capacidad de espacios OK.');

    // [CP-AUD-17] Exportación CSV sin ?token= en URL y headers de seguridad CSP
    const rawDuenoToken = authDueno.Authorization.replace('Bearer ', '');
    const [anioActual, mesActual] = hoyLima.split('-').map((p) => Number(p));
    const qsExport = `periodo=mensual&anio=${anioActual}&mes=${mesActual}`;
    const rCsvQueryTok = await fetch(`${BASE_URL}/api/reportes/exportar?${qsExport}&token=${encodeURIComponent(rawDuenoToken)}`);
    assert.strictEqual(rCsvQueryTok.status, 401, `CP-AUD-17: ?token= en query string debe rechazarse con 401 (obtuvo ${rCsvQueryTok.status})`);
    const rCsvBearer = await fetch(`${BASE_URL}/api/reportes/exportar?${qsExport}`, {
      headers: hdrDueno
    });
    assert.strictEqual(rCsvBearer.status, 200, `CP-AUD-17: CSV con Bearer falló (${rCsvBearer.status})`);
    const cspHeader = rCsvBearer.headers.get('content-security-policy');
    assert.ok(cspHeader && cspHeader.includes("default-src 'self'"), 'CP-AUD-17: respuesta debe incluir header Content-Security-Policy');
    console.log('✅ [CP-AUD-17] Rechazo de ?token= en URL, descarga CSV con Bearer y header CSP OK.');

    console.log('\n🎉 TODOS LOS CASOS DE AUDITORÍA BATALLA DE ERRORES PASARON (18/18).');
  } finally {
    try {
      if (idsEstadiasLimpiar.length > 0) {
        await prisma.estadia.deleteMany({ where: { id: { in: idsEstadiasLimpiar } } });
      }
      if (idsPagosLimpiar.length > 0) {
        await prisma.pago.deleteMany({ where: { id: { in: idsPagosLimpiar } } });
      }
      if (idsReclamosLimpiar.length > 0) {
        await prisma.reclamo.deleteMany({ where: { id: { in: idsReclamosLimpiar } } });
      }
      if (codigosReclamosLimpiar.length > 0) {
        await prisma.reclamo.deleteMany({ where: { codigo: { in: codigosReclamosLimpiar } } });
      }
      const nombresUnicos = Array.from(new Set([usuarioCond, ...usuariosLimpiarNombres]));
      for (const nombreUsuario of nombresUnicos) {
        const u = await prisma.usuario.findUnique({ where: { usuario: nombreUsuario } });
        if (u) {
          await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
          await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
          await prisma.usuario.delete({ where: { id: u.id } });
        }
      }
      if (usuariosLimpiarIds.length > 0) {
        await prisma.usuario.deleteMany({ where: { id: { in: usuariosLimpiarIds } } });
      }
      await prisma.configuracionEspacios.upsert({
        where: { id: 1 },
        update: {
          capacidadAutos: capacidadOriginal.capacidadAutos,
          capacidadMotos: capacidadOriginal.capacidadMotos
        },
        create: {
          id: 1,
          capacidadAutos: capacidadOriginal.capacidadAutos,
          capacidadMotos: capacidadOriginal.capacidadMotos
        }
      });
      if (configPasarelaOriginal) {
        await prisma.configuracionPasarela.upsert({
          where: { proveedor: 'culqi' },
          update: {
            llavePublica: configPasarelaOriginal.llavePublica,
            llaveSecretaCifrada: configPasarelaOriginal.llaveSecretaCifrada,
            actualizadoPorId: configPasarelaOriginal.actualizadoPorId
          },
          create: {
            proveedor: configPasarelaOriginal.proveedor,
            llavePublica: configPasarelaOriginal.llavePublica,
            llaveSecretaCifrada: configPasarelaOriginal.llaveSecretaCifrada,
            actualizadoPorId: configPasarelaOriginal.actualizadoPorId
          }
        });
      }
    } catch (e) {
      console.error('Aviso limpiando datos de auditoría:', e.message);
    }
    try { guardarCapacidad(capacidadOriginal); } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
    mock.server.close();
  }
}

ejecutarAuditoriaBatalla().catch((err) => {
  console.error('❌ ERROR EN AUDITORÍA BATALLA DE ERRORES:', err);
  process.exit(1);
});
