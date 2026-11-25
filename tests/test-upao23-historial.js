require('dotenv').config();
const assert = require('assert');
const { spawn } = require('child_process');
const prisma = require('../src/config/prisma');

const PORT = 3567;
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
  throw new Error('El servidor de pruebas UPAO-23 no respondió a tiempo.');
}

async function req(ruta, opts = {}) {
  const res = await fetch(`${BASE_URL}${ruta}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {}
  return { status: res.status, data: json };
}

async function runUpao23() {
  console.log('=== INICIANDO SUITE DEDICADA UPAO-23 (HISTORIAL DEL CONDUCTOR) ===');

  const srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  const suf = String(Date.now()).slice(-4);
  const userA = `cond_h23a_${suf}`;
  const userB = `cond_h23b_${suf}`;
  const dniA = `7710${suf}`;
  const dniB = `7720${suf}`;
  const placaA1 = `HVA-${suf.slice(1)}`;
  const placaB1 = `HVB-${suf.slice(1)}`;

  try {
    await esperarServidor();

    // 1. Registrar Conductor A y Conductor B
    const rA = await req('/api/auth/registro-conductor', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Conductor Historial A',
        dni: dniA,
        celular: '987111222',
        usuario: userA,
        contrasena: 'password123'
      })
    });
    assert.strictEqual(rA.status, 201);
    const hdrA = { Authorization: `Bearer ${rA.data.token}` };

    const rB = await req('/api/auth/registro-conductor', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Conductor Historial B',
        dni: dniB,
        celular: '987333444',
        usuario: userB,
        contrasena: 'password123'
      })
    });
    assert.strictEqual(rB.status, 201);
    const hdrB = { Authorization: `Bearer ${rB.data.token}` };

    // 2. Estado vacío inicial (CP-23-02)
    const rVacio = await req('/api/conductor/historial', { headers: hdrA });
    assert.strictEqual(rVacio.status, 200);
    assert.deepStrictEqual(rVacio.data.estadias, []);
    console.log('✅ [U23-01] Conductor nuevo recibe historial vacío sin filtraciones.');

    // 3. Registrar vehículo para A y para B
    const vA = await req('/api/conductor/vehiculos', {
      method: 'POST',
      headers: hdrA,
      body: JSON.stringify({ placa: placaA1, tipo: 'auto' })
    });
    assert.strictEqual(vA.status, 201);

    const vB = await req('/api/conductor/vehiculos', {
      method: 'POST',
      headers: hdrB,
      body: JSON.stringify({ placa: placaB1, tipo: 'auto' })
    });
    assert.strictEqual(vB.status, 201);

    // 4. Login recepcionista para generar una estadía finalizada y una activa para A, y una activa para B
    const rRec = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'recepcion', contrasena: '123456' })
    });
    assert.strictEqual(rRec.status, 200);
    const hdrRec = { Authorization: `Bearer ${rRec.data.token}` };

    // Estadía 1 (A): ingreso y salida
    const ingA1 = await req('/api/ingresos', {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({ placa: placaA1, tipo: 'auto' })
    });
    assert.strictEqual(ingA1.status, 201);

    const idEstadiaA1 = ingA1.data.estadia ? ingA1.data.estadia.id : ingA1.data.id;
    const salA1 = await req('/api/salidas', {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({ estadiaId: idEstadiaA1, metodoPago: 'Efectivo' })
    });
    assert.strictEqual(salA1.status, 200);

    // Estadía 2 (A): activa en cochera con reserva vinculada
    const uADb = await prisma.usuario.findUnique({ where: { usuario: userA } });
    const reservaA = await prisma.reserva.create({
      data: {
        codigo: `RES-H23${suf}`,
        idUsuario: uADb.id,
        idVehiculo: vA.data.id,
        idTipoVehiculo: 1,
        fechaReserva: new Date(),
        fechaLimite: new Date(Date.now() + 30 * 60 * 1000),
        estado: 'VIGENTE',
        montoAdelanto: 6.00,
        pasarelaPagoId: `chr_h23_${suf}`,
        pasarelaProveedor: 'culqi',
        estadoPago: 'PAGADO'
      }
    });

    const confA = await req(`/api/reservas/${reservaA.id}/confirmar`, {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({})
    });
    assert.strictEqual(confA.status, 201);

    // Estadía de Conductor B
    const ingB = await req('/api/ingresos', {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({ placa: placaB1, tipo: 'auto' })
    });
    assert.strictEqual(ingB.status, 201);

    // 5. Historial cronológico de A (CP-23-01)
    const rHistA = await req('/api/conductor/historial', { headers: hdrA });
    assert.strictEqual(rHistA.status, 200);
    assert.strictEqual(rHistA.data.estadias.length, 2);
    assert.strictEqual(rHistA.data.estadias[0].estado, 'En cochera');
    assert.strictEqual(rHistA.data.estadias[0].codigoReserva, reservaA.codigo);
    assert.strictEqual(rHistA.data.estadias[0].montoAdelanto, 6);
    assert.strictEqual(rHistA.data.estadias[1].estado, 'Finalizada');
    assert.ok(rHistA.data.estadias[1].montoPagado !== null);
    console.log('✅ [U23-02] Historial cronológico (En cochera + Finalizada + Reserva/Adelanto) verificado.');

    // 6. Filtro por estado (CP-23-03)
    const rActivas = await req('/api/conductor/historial?estado=EN_COCHERA', { headers: hdrA });
    assert.strictEqual(rActivas.status, 200);
    assert.strictEqual(rActivas.data.estadias.length, 1);
    assert.strictEqual(rActivas.data.estadias[0].estado, 'En cochera');

    const rFin = await req('/api/conductor/historial?estado=FINALIZADA', { headers: hdrA });
    assert.strictEqual(rFin.status, 200);
    assert.strictEqual(rFin.data.estadias.length, 1);
    assert.strictEqual(rFin.data.estadias[0].estado, 'Finalizada');
    console.log('✅ [U23-03] Filtro por estado (EN_COCHERA / FINALIZADA) verificado.');

    // 7. Aislamiento estricto entre Conductor A y B (CP-23-05)
    const rHistB = await req('/api/conductor/historial', { headers: hdrB });
    assert.strictEqual(rHistB.status, 200);
    assert.strictEqual(rHistB.data.estadias.length, 1);
    assert.strictEqual(rHistB.data.estadias[0].placa, placaB1);
    assert.ok(!rHistB.data.estadias.some((e) => e.placa === placaA1));
    console.log('✅ [U23-04] Aislamiento estricto entre Conductor A y B verificado.');

    // 8. Control de acceso 401 sin token y 403 para RECEPCIONISTA (CP-23-04)
    const rSinToken = await req('/api/conductor/historial');
    assert.strictEqual(rSinToken.status, 401);
    const rRecHist = await req('/api/conductor/historial', { headers: hdrRec });
    assert.strictEqual(rRecHist.status, 403);
    console.log('✅ [U23-05] Seguridad RBAC verificada (401 sin sesión, 403 rol distinto de Conductor).');

    console.log('\n🎉 TODAS LAS PRUEBAS DEDICADAS UPAO-23 PASARON (5/5).');
  } finally {
    try {
      const usuarios = await prisma.usuario.findMany({
        where: { usuario: { in: [userA, userB] } },
        select: { id: true }
      });
      const idsU = usuarios.map((u) => u.id);
      const ests = await prisma.estadia.findMany({
        where: { placa: { in: [placaA1, placaB1] } },
        select: { id: true, idPago: true }
      });
      const idsPago = ests.map((e) => e.idPago).filter(Boolean);
      await prisma.estadia.deleteMany({ where: { placa: { in: [placaA1, placaB1] } } });
      if (idsPago.length > 0) {
        await prisma.pago.deleteMany({ where: { id: { in: idsPago } } });
      }
      if (idsU.length > 0) {
        await prisma.reserva.deleteMany({ where: { idUsuario: { in: idsU } } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: { in: idsU } } });
        await prisma.usuario.deleteMany({ where: { id: { in: idsU } } });
      }
    } catch (e) {
      console.error('Aviso limpiando UPAO-23:', e.message);
    }
    await prisma.$disconnect();
    srv.kill();
  }
}

runUpao23().catch((err) => {
  console.error('❌ ERROR EN SUITE UPAO-23:', err);
  process.exit(1);
});
