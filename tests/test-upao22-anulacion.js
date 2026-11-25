require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const prisma = require('../src/config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const PORT = 3561;
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
  throw new Error('El servidor de pruebas UPAO-22 no respondió a tiempo.');
}

function iniciarMockCulqi() {
  const estado = {
    charges: [],
    refunds: [],
    delayRefundMs: 0,
    forzarErrorRefundStatus: null
  };

  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => { rawBody += chunk; });
    req.on('end', async () => {
      let body = {};
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) {}

      if (req.method === 'POST' && req.url === '/v2/charges') {
        estado.charges.push({ headers: req.headers, body });
        const id = `chr_u22_${Date.now()}_${estado.charges.length}`;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id, object: 'charge', amount: body.amount, currency_code: body.currency_code }));
      }

      if (req.method === 'POST' && req.url === '/v2/refunds') {
        if (estado.delayRefundMs > 0) {
          await esperar(estado.delayRefundMs);
        }
        if (estado.forzarErrorRefundStatus) {
          const code = estado.forzarErrorRefundStatus;
          res.writeHead(code, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user_message: 'Fallo simulado en Culqi Refunds' }));
        }
        estado.refunds.push({ headers: req.headers, body });
        const id = `ref_u22_${Date.now()}_${estado.refunds.length}`;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id, object: 'refund', charge_id: body.charge_id, amount: body.amount, reason: body.reason }));
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ user_message: 'Ruta mock no encontrada' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/v2`, estado });
    });
  });
}

async function ejecutarSuiteUpao22() {
  console.log('=== INICIANDO SUITE DEDICADA UPAO-22 (ANULAR RESERVA · CULQI PERÚ) ===');
  const mock = await iniciarMockCulqi();
  const srv = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      PAYMENT_GATEWAY: 'culqi',
      CULQI_API_BASE: mock.url,
      CULQI_PUBLIC_KEY: 'pk_test_u22mock123456',
      CULQI_SECRET_KEY: 'sk_test_u22mock123456',
      PASARELA_ENCRYPTION_KEY: 'u22-test-aes256-secret-key-32ch!'
    },
    stdio: 'pipe'
  });

  const capacidadOriginal = obtenerCapacidad();
  const configPasarelaOriginal = await prisma.configuracionPasarela.findUnique({ where: { proveedor: 'culqi' } });
  const suf = String(Date.now()).slice(-4);
  const usuariosCreados = [`cond_u22a_${suf}`, `cond_u22b_${suf}`];
  const idsEstadiasLimpiar = [];
  const idsReservasLimpiar = [];

  try {
    await esperarServidor();

    const resDispInit = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispInit = await resDispInit.json();
    if (dispInit.autos.disponibles < 5) {
      guardarCapacidad({
        capacidadAutos: dispInit.autos.enCochera + dispInit.autos.reservasVigentes + 10,
        capacidadMotos: capacidadOriginal.capacidadMotos
      });
    }

    // Login Dueño/Garita
    const resDueno = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'admin', contrasena: '123456' })
    });
    const sesionDueno = await resDueno.json();
    if (!resDueno.ok || !sesionDueno.token) throw new Error('Fallo login admin');
    const hdrDueno = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesionDueno.token}` };

    // Registrar 2 conductores
    const crearConductor = async (usuario, dni) => {
      const r = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: `Cond ${usuario}`, dni, celular: '987654321', usuario, contrasena: 'password123' })
      });
      const d = await r.json();
      if (r.status !== 201 || !d.token) throw new Error(`Fallo registro ${usuario}: ${JSON.stringify(d)}`);
      return { id: d.id, hdr: { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}` } };
    };

    const condA = await crearConductor(usuariosCreados[0], `7911${suf}`);
    const condB = await crearConductor(usuariosCreados[1], `7922${suf}`);

    const crearVeh = async (hdr, placa) => {
      const r = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ placa, tipo: 'auto' })
      });
      const d = await r.json();
      if (r.status !== 201 || !d.id) throw new Error(`Fallo vehiculo ${placa}: ${JSON.stringify(d)}`);
      return d;
    };

    const veh1 = await crearVeh(condA.hdr, `U2A-${suf.slice(1)}`);
    const veh2 = await crearVeh(condA.hdr, `U2B-${suf.slice(1)}`);
    const veh3 = await crearVeh(condA.hdr, `U2C-${suf.slice(1)}`);
    const veh4 = await crearVeh(condA.hdr, `U2D-${suf.slice(1)}`);

    const crearReserva = async (hdr, idVehiculo, tag) => {
      const r = await fetch(`${BASE_URL}/api/reservas`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({
          idVehiculo,
          sourceToken: `tkn_test_u22_${tag}`,
          email: 'u22@cochera.pe',
          idempotencyKey: `idem-u22-${tag}-${suf}`
        })
      });
      const d = await r.json();
      if (r.status !== 201 || !d.reserva) throw new Error(`Fallo reserva ${tag}: ${JSON.stringify(d)}`);
      idsReservasLimpiar.push(d.reserva.id);
      return d.reserva;
    };

    // [U22-01] DELETE /api/reservas/:id + reembolso Culqi + liberación inmediata de cupo
    const res1 = await crearReserva(condA.hdr, veh1.id, 'r1');
    const dispAntes = await (await fetch(`${BASE_URL}/api/publico/disponibilidad`)).json();

    const rDel1 = await fetch(`${BASE_URL}/api/reservas/${res1.id}`, { method: 'DELETE', headers: condA.hdr });
    const dDel1 = await rDel1.json();
    if (
      rDel1.status !== 200
      || dDel1.reserva.estado !== 'ANULADA'
      || dDel1.reserva.estadoPago !== 'REEMBOLSADO'
      || !dDel1.reserva.pasarelaReembolsoId
    ) {
      throw new Error(`[U22-01] Fallo DELETE anular: ${rDel1.status} ${JSON.stringify(dDel1)}`);
    }
    const dispDespues = await (await fetch(`${BASE_URL}/api/publico/disponibilidad`)).json();
    if (dispDespues.autos.disponibles !== dispAntes.autos.disponibles + 1) {
      throw new Error(`[U22-01] Cupo no liberado: antes=${dispAntes.autos.disponibles} despues=${dispDespues.autos.disponibles}`);
    }
    console.log('✅ [U22-01] DELETE /api/reservas/:id ejecutó refund Culqi y liberó +1 espacio inmediatamente.');

    // [U22-02] Validación de entrada, permisos y roles (400 / 404 / 403)
    const rBad = await fetch(`${BASE_URL}/api/reservas/abc`, { method: 'DELETE', headers: condA.hdr });
    const r404 = await fetch(`${BASE_URL}/api/reservas/9999999`, { method: 'DELETE', headers: condA.hdr });
    const rRole = await fetch(`${BASE_URL}/api/reservas/${res1.id}`, { method: 'DELETE', headers: hdrDueno });
    const res2 = await crearReserva(condA.hdr, veh2.id, 'r2');
    const rAjena = await fetch(`${BASE_URL}/api/reservas/${res2.id}`, { method: 'DELETE', headers: condB.hdr });
    if (rBad.status !== 400 || r404.status !== 404 || rRole.status !== 403 || rAjena.status !== 403) {
      throw new Error(`[U22-02] Códigos inválidos: 400=${rBad.status}, 404=${r404.status}, rol403=${rRole.status}, ajena403=${rAjena.status}`);
    }
    console.log('✅ [U22-02] Validaciones 400 (ID inválido), 404 (inexistente) y 403 (rol y propietario) OK.');

    // [U22-03] Re-anulación (409) y reserva vencida bajo lock (persiste VENCIDA + 0 refunds)
    const rReAnular = await fetch(`${BASE_URL}/api/reservas/${res1.id}`, { method: 'DELETE', headers: condA.hdr });
    if (rReAnular.status !== 409) throw new Error(`[U22-03] Re-anulación devolvió ${rReAnular.status}`);

    const refundsAntesExp = mock.estado.refunds.length;
    await prisma.reserva.update({
      where: { id: res2.id },
      data: { fechaLimite: new Date(Date.now() - 5 * 60 * 1000) }
    });
    const rVenc = await fetch(`${BASE_URL}/api/reservas/${res2.id}`, { method: 'DELETE', headers: condA.hdr });
    const dbVenc = await prisma.reserva.findUnique({ where: { id: res2.id } });
    if (rVenc.status !== 409 || dbVenc.estado !== 'VENCIDA' || mock.estado.refunds.length !== refundsAntesExp) {
      throw new Error(`[U22-03] Vencida inválida: status=${rVenc.status}, db=${dbVenc.estado}, refunds=${mock.estado.refunds.length - refundsAntesExp}`);
    }
    console.log('✅ [U22-03] Re-anulación (409) y expiración persistida como VENCIDA sin reembolso OK.');

    // [U22-04] Carrera financiera: DELETE /api/reservas/:id (300ms Culqi) vs POST /:id/confirmar (Garita)
    const res3 = await crearReserva(condA.hdr, veh3.id, 'r3');
    const refundsAntesRace = mock.estado.refunds.length;
    mock.estado.delayRefundMs = 300;
    const [rAnuRace, rConfRace] = await Promise.all([
      fetch(`${BASE_URL}/api/reservas/${res3.id}`, { method: 'DELETE', headers: condA.hdr }),
      fetch(`${BASE_URL}/api/reservas/${res3.id}/confirmar`, { method: 'POST', headers: hdrDueno, body: JSON.stringify({}) })
    ]);
    mock.estado.delayRefundMs = 0;

    const estadiasRace = await prisma.estadia.findMany({ where: { idReserva: res3.id } });
    estadiasRace.forEach((e) => idsEstadiasLimpiar.push(e.id));
    const dbRace = await prisma.reserva.findUnique({ where: { id: res3.id } });
    const refundsRace = mock.estado.refunds.length - refundsAntesRace;

    const ganoAnular = rAnuRace.status === 200 && rConfRace.status === 409 && dbRace.estado === 'ANULADA' && refundsRace === 1 && estadiasRace.length === 0;
    const ganoConfirmar = rConfRace.status === 201 && rAnuRace.status === 409 && dbRace.estado === 'UTILIZADA' && refundsRace === 0 && estadiasRace.length === 1;
    if (!ganoAnular && !ganoConfirmar) {
      throw new Error(`[U22-04] VIOLACIÓN DE EXCLUSIÓN MUTUA: anular=${rAnuRace.status}, confirmar=${rConfRace.status}, db=${dbRace.estado}, refunds=${refundsRace}, estadias=${estadiasRace.length}`);
    }
    console.log(`✅ [U22-04] Exclusión mutua Anular vs Confirmar Garita verificada (${ganoAnular ? 'ganó ANULAR: 1 refund, 0 estadías' : 'ganó GARITA: 0 refunds, 1 estadía'}).`);

    // [U22-05] Doble clic simultáneo en DELETE /api/reservas/:id
    const res4 = await crearReserva(condA.hdr, veh4.id, 'r4');
    const refundsAntesDbl = mock.estado.refunds.length;
    mock.estado.delayRefundMs = 200;
    const [d1, d2] = await Promise.all([
      fetch(`${BASE_URL}/api/reservas/${res4.id}`, { method: 'DELETE', headers: condA.hdr }),
      fetch(`${BASE_URL}/api/reservas/${res4.id}`, { method: 'DELETE', headers: condA.hdr })
    ]);
    mock.estado.delayRefundMs = 0;
    const codigosDbl = [d1.status, d2.status].sort();
    const refundsDbl = mock.estado.refunds.length - refundsAntesDbl;
    if (codigosDbl[0] !== 200 || codigosDbl[1] !== 409 || refundsDbl !== 1) {
      throw new Error(`[U22-05] Doble clic falló: statuses=${codigosDbl}, refunds=${refundsDbl}`);
    }
    console.log('✅ [U22-05] Doble clic simultáneo bloqueado (200 + 409, exactamente 1 refund en Culqi).');

    // [U22-06] Fallo de pasarela Culqi (500 / 400) -> 502 y reserva permanece VIGENTE intacta
    const res5 = await crearReserva(condA.hdr, veh1.id, 'r5');
    mock.estado.forzarErrorRefundStatus = 400;
    const rErr400 = await fetch(`${BASE_URL}/api/reservas/${res5.id}`, { method: 'DELETE', headers: condA.hdr });
    mock.estado.forzarErrorRefundStatus = 500;
    const rErr500 = await fetch(`${BASE_URL}/api/reservas/${res5.id}`, { method: 'DELETE', headers: condA.hdr });
    mock.estado.forzarErrorRefundStatus = null;
    const dbErr = await prisma.reserva.findUnique({ where: { id: res5.id } });
    if (
      rErr400.status !== 502
      || rErr500.status !== 502
      || dbErr.estado !== 'VIGENTE'
      || dbErr.estadoPago !== 'PAGADO'
      || dbErr.pasarelaReembolsoId !== null
      || dbErr.fechaAnulacion !== null
    ) {
      throw new Error(`[U22-06] Fallo rollback ante error Culqi: 400->${rErr400.status}, 500->${rErr500.status}, db=${JSON.stringify(dbErr)}`);
    }
    console.log('✅ [U22-06] Error Culqi (/v2/refunds) devuelve 502 y mantiene la reserva VIGENTE sin alterarla.');

    // [U22-07] Reserva sin pasarelaPagoId (null) -> ANULADA con estadoPago original (no REEMBOLSADO) y 0 refunds
    await prisma.reserva.update({
      where: { id: res5.id },
      data: { pasarelaPagoId: null }
    });
    const refundsAntesNull = mock.estado.refunds.length;
    const rNull = await fetch(`${BASE_URL}/api/reservas/${res5.id}`, { method: 'DELETE', headers: condA.hdr });
    const dNull = await rNull.json();
    if (
      rNull.status !== 200
      || dNull.reserva.estado !== 'ANULADA'
      || dNull.reserva.estadoPago !== 'PAGADO'
      || dNull.reserva.pasarelaReembolsoId !== null
      || mock.estado.refunds.length !== refundsAntesNull
    ) {
      throw new Error(`[U22-07] Reserva sin pago de pasarela falló: ${rNull.status} ${JSON.stringify(dNull)}`);
    }
    console.log('✅ [U22-07] Reserva sin pasarelaPagoId se anula sin marcar REEMBOLSADO falso y con 0 refunds.');

    console.log('\n🎉 TODAS LAS PRUEBAS DEDICADAS UPAO-22 PASARON (7/7 VERIFICACIONES).');
  } finally {
    try {
      if (idsEstadiasLimpiar.length > 0) {
        await prisma.estadia.deleteMany({ where: { id: { in: idsEstadiasLimpiar } } });
      }
      if (idsReservasLimpiar.length > 0) {
        await prisma.reserva.deleteMany({ where: { id: { in: idsReservasLimpiar } } });
      }
      const us = await prisma.usuario.findMany({ where: { usuario: { in: usuariosCreados } } });
      for (const u of us) {
        await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
        await prisma.usuario.delete({ where: { id: u.id } });
      }
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
      console.error('Aviso limpiando datos UPAO-22:', e.message);
    }
    try { guardarCapacidad(capacidadOriginal); } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
    mock.server.close();
  }
}

ejecutarSuiteUpao22().catch((err) => {
  console.error('❌ ERROR EN SUITE UPAO-22:', err);
  process.exit(1);
});
