require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const prisma = require('../src/config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const PORT = 3559;
const BASE_URL = `http://localhost:${PORT}`;

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function esperarServidor(intentos = 30) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
      if (r.ok) return true;
    } catch (_) {}
    await esperar(250);
  }
  throw new Error('El servidor de pruebas unitarias Culqi no respondió a tiempo.');
}

function iniciarMockCulqi() {
  const registros = { charges: [], refunds: [] };
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => { rawBody += chunk; });
    req.on('end', () => {
      let body = {};
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) {}

      if (req.method === 'POST' && req.url === '/v2/charges') {
        registros.charges.push({ headers: req.headers, body });
        const id = `chr_test_${Date.now()}_${registros.charges.length}`;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id, object: 'charge', amount: body.amount, currency_code: body.currency_code }));
      }

      if (req.method === 'POST' && req.url === '/v2/refunds') {
        registros.refunds.push({ headers: req.headers, body });
        const id = `ref_test_${Date.now()}_${registros.refunds.length}`;
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
      resolve({ server, url: `http://127.0.0.1:${port}/v2`, registros });
    });
  });
}

async function ejecutarPruebasUnitarias() {
  console.log('=== INICIANDO SUITE UNITARIA/CONTRATO CULQI PERÚ ===');
  const mock = await iniciarMockCulqi();
  const srv = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      PAYMENT_GATEWAY: 'culqi',
      CULQI_API_BASE: mock.url,
      CULQI_PUBLIC_KEY: 'pk_test_mock12345678',
      CULQI_SECRET_KEY: 'sk_test_mock12345678',
      PASARELA_ENCRYPTION_KEY: 'test-aes256-secret-key-32-chars!!'
    },
    stdio: 'pipe'
  });

  const capacidadOriginal = obtenerCapacidad();
  const sufijo = String(Date.now()).slice(-4);
  const usuarioTest = `cond_unit_${sufijo}`;
  const dniTest = `7685${sufijo}`;
  const placaMoto = `1${sufijo.slice(1)}-9M`;

  try {
    await esperarServidor();

    const resDisp = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const disp = await resDisp.json();
    if (disp.motos.disponibles < 2) {
      guardarCapacidad({
        capacidadAutos: capacidadOriginal.capacidadAutos,
        capacidadMotos: disp.motos.enCochera + disp.motos.reservasVigentes + 5
      });
    }

    const resLoginDueno = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'admin', contrasena: '123456' })
    });
    const sesionDueno = await resLoginDueno.json();
    if (!resLoginDueno.ok || !sesionDueno.token) {
      throw new Error(`Fallo login DUEÑO: ${JSON.stringify(sesionDueno)}`);
    }
    const headersDueno = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesionDueno.token}`
    };

    // 1. Verificar config-pasarela
    const resCfg = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, { headers: headersDueno });
    const cfg = await resCfg.json();
    if (!resCfg.ok || cfg.proveedor !== 'culqi' || Number(cfg.montoMinimoSoles) !== 3) {
      throw new Error(`Configuración inválida en /config-pasarela: ${JSON.stringify(cfg)}`);
    }
    console.log('✅ [UNIT-01] GET /config-pasarela devuelve proveedor culqi y mínimo S/ 3.00.');

    // 2. Validar rechazo rk_test_, mezcla test/live y persistencia cifrada AES-256-GCM en PostgreSQL
    const resRk = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ publishableKey: 'pk_test_1234567890ab', secretKey: 'rk_test_1234567890ab' })
    });
    if (resRk.status !== 400) {
      throw new Error(`Se esperaba 400 para rk_test_, obtuvo ${resRk.status}`);
    }

    const resMix = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ publishableKey: 'pk_test_1234567890ab', secretKey: 'sk_live_1234567890ab' })
    });
    if (resMix.status !== 400) {
      throw new Error(`Se esperaba 400 para mezcla test/live, obtuvo ${resMix.status}`);
    }

    const skPruebaPanel = 'sk_test_secreto_panel_9988';
    const resSave = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ publishableKey: 'pk_test_panel_99887766', secretKey: skPruebaPanel })
    });
    const saveData = await resSave.json();
    if (!resSave.ok || saveData.origen !== 'panel_dueno') {
      throw new Error(`Fallo al guardar llaves en BD: ${JSON.stringify(saveData)}`);
    }

    const filaDb = await prisma.configuracionPasarela.findUnique({ where: { proveedor: 'culqi' } });
    if (!filaDb || !filaDb.llaveSecretaCifrada.startsWith('v1:') || filaDb.llaveSecretaCifrada.includes(skPruebaPanel)) {
      throw new Error('La llave secreta no se almacenó cifrada correctamente en configuracion_pasarela.');
    }

    const resRestaurar = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ restaurarPorDefecto: true })
    });
    const restData = await resRestaurar.json();
    if (!resRestaurar.ok || restData.origen !== 'servidor_env') {
      throw new Error(`Fallo al restaurar llaves del servidor: ${JSON.stringify(restData)}`);
    }
    console.log('✅ [UNIT-02] Validación de llaves Culqi y cifrado AES-256-GCM en PostgreSQL verificados.');

    // 3. Registrar conductor + motocicleta y verificar piso S/ 3.00
    const resReg = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Conductor Moto Unit',
        dni: dniTest,
        celular: '987650001',
        usuario: usuarioTest,
        contrasena: 'password123'
      })
    });
    const sesionCond = await resReg.json();
    if (!resReg.ok || !sesionCond.token) {
      throw new Error(`Fallo registro conductor: ${JSON.stringify(sesionCond)}`);
    }
    const headersCond = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesionCond.token}` };

    const resVeh = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
      method: 'POST',
      headers: headersCond,
      body: JSON.stringify({ placa: placaMoto, tipo: 'moto' })
    });
    const dataVeh = await resVeh.json();
    if (resVeh.status !== 201 || !dataVeh.id) {
      throw new Error(`Fallo registro moto: ${JSON.stringify(dataVeh)}`);
    }

    const resListVeh = await fetch(`${BASE_URL}/api/conductor/vehiculos`, { headers: headersCond });
    const listVeh = await resListVeh.json();
    const vehMoto = (listVeh.vehiculos || []).find((v) => v.id === dataVeh.id);
    if (!vehMoto || Number(vehMoto.precioAdelanto) < 3) {
      throw new Error(`El piso mínimo S/ 3.00 no se aplicó en /conductor/vehiculos: ${JSON.stringify(vehMoto)}`);
    }

    const resPrep = await fetch(`${BASE_URL}/api/reservas/preparar-pago`, {
      method: 'POST',
      headers: headersCond,
      body: JSON.stringify({ idVehiculo: dataVeh.id })
    });
    const prepData = await resPrep.json();
    if (!resPrep.ok || prepData.montoCentimos !== 300 || prepData.yapeHabilitado !== true) {
      throw new Error(`Respuesta inesperada en preparar-pago para moto: ${JSON.stringify(prepData)}`);
    }
    console.log('✅ [UNIT-03] Piso mínimo S/ 3.00 (300 céntimos) aplicado a Motocicleta correctamente.');

    // 4. Crear reserva -> verificar mock /v2/charges con Idempotency-Key
    const resCrear = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersCond,
      body: JSON.stringify({
        idVehiculo: dataVeh.id,
        sourceToken: 'tkn_test_unit_123456',
        email: 'moto.test@cochera.pe',
        idempotencyKey: `unit-idem-${sufijo}`
      })
    });
    const dataCrear = await resCrear.json();
    if (resCrear.status !== 201 || !dataCrear.reserva || dataCrear.reserva.pasarelaProveedor !== 'culqi') {
      throw new Error(`Fallo creando reserva con mock Culqi: ${JSON.stringify(dataCrear)}`);
    }
    const chargeReq = mock.registros.charges[0];
    if (
      !chargeReq
      || chargeReq.body.amount !== 300
      || chargeReq.body.currency_code !== 'PEN'
      || chargeReq.headers['idempotency-key'] !== `unit-idem-${sufijo}`
    ) {
      throw new Error(`Payload/headers inválidos enviados a Culqi /v2/charges: ${JSON.stringify(chargeReq)}`);
    }
    console.log('✅ [UNIT-04] Cargo Culqi /v2/charges verificado (300 céntimos PEN + Idempotency-Key + DB).');

    // 5. Anular reserva -> verificar mock /v2/refunds
    const resAnular = await fetch(`${BASE_URL}/api/reservas/${dataCrear.reserva.id}/anular`, {
      method: 'POST',
      headers: headersCond,
      body: JSON.stringify({})
    });
    const dataAnular = await resAnular.json();
    if (!resAnular.ok || dataAnular.reserva.estado !== 'ANULADA' || !dataAnular.reserva.pasarelaReembolsoId) {
      throw new Error(`Fallo anulando reserva con mock Culqi: ${JSON.stringify(dataAnular)}`);
    }
    const refundReq = mock.registros.refunds[0];
    if (
      !refundReq
      || refundReq.body.reason !== 'solicitud_comprador'
      || !refundReq.headers['idempotency-key']
    ) {
      throw new Error(`Payload/headers inválidos enviados a Culqi /v2/refunds: ${JSON.stringify(refundReq)}`);
    }
    console.log('✅ [UNIT-05] Reembolso Culqi /v2/refunds verificado (reason: solicitud_comprador + pasarelaReembolsoId).');
    console.log('\n🎉 TODAS LAS PRUEBAS UNITARIAS CULQI PASARON (5/5).');
  } finally {
    try {
      const u = await prisma.usuario.findUnique({ where: { usuario: usuarioTest } });
      if (u) {
        await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
        await prisma.usuario.delete({ where: { id: u.id } });
      }
      await prisma.configuracionPasarela.deleteMany({ where: { proveedor: 'culqi' } });
    } catch (e) {
      console.error('Aviso limpiando datos de prueba unitarios:', e.message);
    }
    try { guardarCapacidad(capacidadOriginal); } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
    mock.server.close();
  }
}

ejecutarPruebasUnitarias().catch((err) => {
  console.error('❌ ERROR EN SUITE UNITARIA CULQI:', err);
  process.exit(1);
});
