require('dotenv').config();
const { spawn } = require('child_process');
const prisma = require('../src/config/prisma');

const PORT = 3564;
const BASE_URL = `http://localhost:${PORT}`;

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function esperarServidor(intentos = 35) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
      if (r.ok) return true;
    } catch (_) {}
    await esperar(250);
  }
  throw new Error('El servidor de pruebas de seguridad/bot no respondió a tiempo.');
}

async function ejecutarSuiteAtaqueBot() {
  console.log('=== INICIANDO SUITE DE SEGURIDAD Y ATAQUE TIPO BOT (FUERZA BRUTA, SATURACIÓN, XSS/SQLi, IDOR) ===');
  const srv = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX_AUTH: '8',
      RATE_LIMIT_MAX_PUBLIC: '12',
      RATE_LIMIT_MAX_API: '40'
    },
    stdio: 'pipe'
  });

  const suf = String(Date.now()).slice(-4);
  const usuarioA = `bot_victima_${suf}`;
  const usuarioB = `bot_atacante_${suf}`;

  try {
    await esperarServidor();

    // [BOT-01] Cabeceras defensivas HTTP y ocultación de X-Powered-By
    const resHdr = await fetch(`${BASE_URL}/api/publico/disponibilidad`, {
      headers: { 'X-Forwarded-For': '10.10.1.1' }
    });
    if (
      resHdr.headers.get('x-content-type-options') !== 'nosniff'
      || resHdr.headers.get('x-frame-options') !== 'DENY'
      || !resHdr.headers.get('referrer-policy')
      || resHdr.headers.get('x-powered-by') !== null
    ) {
      throw new Error('[BOT-01] Cabeceras de seguridad incompletas o X-Powered-By expuesto.');
    }
    console.log('✅ [BOT-01] Cabeceras de seguridad (nosniff, DENY, Referrer-Policy) activas y X-Powered-By eliminado.');

    // [BOT-02] Bot de fuerza bruta en login -> HTTP 429 + Retry-After
    let bloqueadoLogin = false;
    let retryAfterLogin = null;
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.2.99' },
        body: JSON.stringify({ usuario: 'admin', contrasena: `clave_falsa_${i}` })
      });
      if (r.status === 429) {
        bloqueadoLogin = true;
        retryAfterLogin = r.headers.get('retry-after');
        break;
      }
    }
    if (!bloqueadoLogin || !retryAfterLogin) {
      throw new Error('[BOT-02] Bot de fuerza bruta en login NO fue bloqueado con HTTP 429.');
    }
    console.log(`✅ [BOT-02] Bot de fuerza bruta en /api/auth/login bloqueado con HTTP 429 (Retry-After: ${retryAfterLogin}s).`);

    // [BOT-03] Bot de saturación en endpoint público -> HTTP 429
    let bloqueadoPublico = false;
    for (let i = 0; i < 18; i++) {
      const r = await fetch(`${BASE_URL}/api/publico/disponibilidad`, {
        headers: { 'X-Forwarded-For': '10.10.3.88' }
      });
      if (r.status === 429) {
        bloqueadoPublico = true;
        break;
      }
    }
    if (!bloqueadoPublico) {
      throw new Error('[BOT-03] Bot de saturación en /api/publico/disponibilidad NO fue bloqueado con HTTP 429.');
    }
    console.log('✅ [BOT-03] Bot de saturación en /api/publico/disponibilidad bloqueado con HTTP 429.');

    // [BOT-04] Bomba JSON (> 100 KB) -> HTTP 413 Payload Too Large sin caer el servidor
    const bomba = JSON.stringify({ usuario: 'admin', contrasena: 'A'.repeat(130 * 1024) });
    const r413 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.4.77' },
      body: bomba
    });
    if (r413.status !== 413) {
      throw new Error(`[BOT-04] Payload > 100KB devolvió ${r413.status} en vez de 413.`);
    }
    console.log('✅ [BOT-04] Payload gigante (>100 KB) rechazado con HTTP 413 Payload Too Large.');

    // [BOT-05] JSON malformado -> HTTP 400 limpio (sin 500 ni stacktrace)
    const rMalJson = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.5.66' },
      body: '{"usuario":"admin", roto'
    });
    if (rMalJson.status !== 400) {
      throw new Error(`[BOT-05] JSON malformado devolvió ${rMalJson.status} en vez de 400.`);
    }
    console.log('✅ [BOT-05] JSON malformado rechazado limpiamente con HTTP 400.');

    // [BOT-06] Inyección SQL y XSS en login, búsqueda en garita y placas
    const rSqliLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.6.10' },
      body: JSON.stringify({ usuario: "admin' OR '1'='1", contrasena: "' OR '1'='1" })
    });
    if (rSqliLogin.status !== 401) {
      throw new Error(`[BOT-06] Login SQLi devolvió ${rSqliLogin.status} en vez de 401.`);
    }

    const rRecep = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.6.11' },
      body: JSON.stringify({ usuario: 'recepcion', contrasena: '123456' })
    });
    const dRecep = await rRecep.json();
    const hdrRecep = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dRecep.token}`,
      'X-Forwarded-For': '10.10.6.11'
    };

    const rSqliSearch = await fetch(
      `${BASE_URL}/api/reservas?q=${encodeURIComponent("'; DROP TABLE reserva; --")}`,
      { headers: hdrRecep }
    );
    const dSqliSearch = await rSqliSearch.json();
    if (rSqliSearch.status !== 200 || !Array.isArray(dSqliSearch.reservas) || dSqliSearch.reservas.length !== 0) {
      throw new Error(`[BOT-06] Búsqueda SQLi falló: ${rSqliSearch.status}`);
    }

    const rXssPlaca = await fetch(`${BASE_URL}/api/ingresos`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: '<script>alert(1)</script>', tipo: 'auto' })
    });
    if (rXssPlaca.status !== 400) {
      throw new Error(`[BOT-06] Placa XSS devolvió ${rXssPlaca.status} en vez de 400.`);
    }
    console.log('✅ [BOT-06] Payloads SQLi y XSS neutralizados (401 login, consulta parametrizada segura, 400 placa).');

    // [BOT-07] Token manipulado + escalación de privilegios (CONDUCTOR -> rutas DUEÑO/GARITA)
    const regCond = async (usuario, dni, ip) => {
      const r = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify({ nombre: `Test ${usuario}`, dni, celular: '987654321', usuario, contrasena: 'password123' })
      });
      const d = await r.json();
      if (r.status !== 201 || !d.token) throw new Error(`Fallo registro ${usuario}: ${JSON.stringify(d)}`);
      return { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}`, 'X-Forwarded-For': ip };
    };

    const hdrA = await regCond(usuarioA, `7411${suf}`, '10.10.7.1');
    const hdrB = await regCond(usuarioB, `7422${suf}`, '10.10.7.2');

    const tokenManipulado = `${hdrA.Authorization.slice(0, -4)}XXXX`;
    const rFake = await fetch(`${BASE_URL}/api/reservas/mias`, {
      headers: { Authorization: tokenManipulado, 'X-Forwarded-For': '10.10.7.3' }
    });
    const rEsc1 = await fetch(`${BASE_URL}/api/reportes/diario`, { headers: hdrA });
    const rEsc2 = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: hdrA,
      body: JSON.stringify({ publishableKey: 'pk_test_hack123456', secretKey: 'sk_test_hack123456' })
    });
    const rEsc3 = await fetch(`${BASE_URL}/api/reservas`, { headers: hdrA });
    if (rFake.status !== 401 || rEsc1.status !== 403 || rEsc2.status !== 403 || rEsc3.status !== 403) {
      throw new Error(`[BOT-07] Escalación/Token falló: fake=${rFake.status}, rep=${rEsc1.status}, cfg=${rEsc2.status}, gar=${rEsc3.status}`);
    }
    console.log('✅ [BOT-07] Token manipulado (401) y escalación de privilegios de CONDUCTOR (403) bloqueados.');

    // [BOT-08] Ataque IDOR: Conductor B intenta eliminar vehículo de Conductor A
    const rVehA = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
      method: 'POST',
      headers: hdrA,
      body: JSON.stringify({ placa: `BTA-${suf.slice(1)}`, tipo: 'auto' })
    });
    const vehA = await rVehA.json();
    const rIdor = await fetch(`${BASE_URL}/api/conductor/vehiculos/${vehA.id}`, {
      method: 'DELETE',
      headers: hdrB
    });
    const vehSigue = await prisma.vehiculoConductor.findUnique({ where: { id: vehA.id } });
    if (![403, 404].includes(rIdor.status) || !vehSigue) {
      throw new Error(`[BOT-08] IDOR permitió tocar vehículo ajeno: status=${rIdor.status}`);
    }
    console.log(`✅ [BOT-08] Ataque IDOR bloqueado (HTTP ${rIdor.status}) y recurso ajeno intacto.`);

    console.log('\n🎉 TODAS LAS PRUEBAS DE SEGURIDAD Y ATAQUE BOT PASARON (8/8 VERIFICACIONES).');
  } finally {
    try {
      const us = await prisma.usuario.findMany({ where: { usuario: { in: [usuarioA, usuarioB] } } });
      for (const u of us) {
        await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
        await prisma.usuario.delete({ where: { id: u.id } });
      }
    } catch (e) {
      console.error('Aviso limpiando datos bot:', e.message);
    }
    await prisma.$disconnect();
    srv.kill();
  }
}

ejecutarSuiteAtaqueBot().catch((err) => {
  console.error('❌ ERROR EN SUITE ATAQUE/BOT:', err);
  process.exit(1);
});
