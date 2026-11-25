require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const prisma = require('../src/config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const PORT = 3563;
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
  throw new Error('El servidor de pruebas UPAO-8 no respondió a tiempo.');
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
        return res.end(JSON.stringify({ id: `chr_u08_${Date.now()}`, object: 'charge', amount: body.amount }));
      }
      if (req.method === 'POST' && req.url === '/v2/refunds') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: `ref_u08_${Date.now()}`, object: 'refund', charge_id: body.charge_id }));
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

async function ejecutarSuiteUpao8() {
  console.log('=== INICIANDO SUITE DEDICADA UPAO-8 (GARITA: BUSCAR, CONFIRMAR Y DESCUENTO) ===');
  const mock = await iniciarMockCulqi();
  const srv = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      PAYMENT_GATEWAY: 'culqi',
      CULQI_API_BASE: mock.url,
      CULQI_PUBLIC_KEY: 'pk_test_u08mock123456',
      CULQI_SECRET_KEY: 'sk_test_u08mock123456',
      PASARELA_ENCRYPTION_KEY: 'u08-test-aes256-secret-key-32ch!'
    },
    stdio: 'pipe'
  });

  const capacidadOriginal = obtenerCapacidad();
  const configPasarelaOriginal = await prisma.configuracionPasarela.findUnique({ where: { proveedor: 'culqi' } });
  const suf = String(Date.now()).slice(-4);
  const usuarioCond = `cond_u08_${suf}`;
  const dniCond = `7788${suf}`;
  const nombreCond = `Carlos Garita ${suf}`;
  const placa1 = `G8A-${suf.slice(1)}`;
  const placa2 = `G8B-${suf.slice(1)}`;
  const placaWalkIn = `G8W-${suf.slice(1)}`;
  const idsPagosLimpiar = [];
  const idsEstadiasLimpiar = [];

  try {
    await esperarServidor();

    const disp0 = await (await fetch(`${BASE_URL}/api/publico/disponibilidad`)).json();
    if (disp0.autos.disponibles < 4) {
      guardarCapacidad({
        capacidadAutos: disp0.autos.enCochera + disp0.autos.reservasVigentes + 6,
        capacidadMotos: capacidadOriginal.capacidadMotos
      });
    }

    const login = async (usuario, contrasena) => {
      const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasena })
      });
      const d = await r.json();
      if (!r.ok || !d.token) throw new Error(`Fallo login ${usuario}`);
      return { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}` };
    };

    const hdrRecep = await login('recepcion', '123456');

    const rReg = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombreCond,
        dni: dniCond,
        celular: '987654321',
        usuario: usuarioCond,
        contrasena: 'password123'
      })
    });
    const dReg = await rReg.json();
    if (rReg.status !== 201 || !dReg.token) throw new Error(`Fallo registro conductor: ${JSON.stringify(dReg)}`);
    const hdrCond = { 'Content-Type': 'application/json', Authorization: `Bearer ${dReg.token}` };

    const crearVeh = async (placa) => {
      const r = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
        method: 'POST',
        headers: hdrCond,
        body: JSON.stringify({ placa, tipo: 'auto' })
      });
      const d = await r.json();
      if (r.status !== 201) throw new Error(`Fallo vehiculo ${placa}: ${JSON.stringify(d)}`);
      return d;
    };

    const v1 = await crearVeh(placa1);
    const v2 = await crearVeh(placa2);

    const crearRes = async (idVehiculo, tag) => {
      const r = await fetch(`${BASE_URL}/api/reservas`, {
        method: 'POST',
        headers: hdrCond,
        body: JSON.stringify({
          idVehiculo,
          sourceToken: `tkn_test_u08_${tag}`,
          email: 'u08@cochera.pe',
          idempotencyKey: `idem-u08-${tag}-${suf}`
        })
      });
      const d = await r.json();
      if (r.status !== 201 || !d.reserva) throw new Error(`Fallo reserva ${tag}: ${JSON.stringify(d)}`);
      return d.reserva;
    };

    const res1 = await crearRes(v1.id, 'r1');
    const res2 = await crearRes(v2.id, 'r2');

    // [U08-01] Búsqueda por código, placa con/sin guion, DNI, nombre y filtro de estado
    const consultas = [
      `q=${encodeURIComponent(res1.codigo)}`,
      `q=${encodeURIComponent(placa1)}`,
      `q=${encodeURIComponent(placa1.replace('-', ''))}`,
      `q=${encodeURIComponent(dniCond)}`,
      `q=${encodeURIComponent(nombreCond)}&estado=VIGENTE`
    ];
    for (const qs of consultas) {
      const r = await fetch(`${BASE_URL}/api/reservas?${qs}`, { headers: hdrRecep });
      const d = await r.json();
      if (!r.ok || !d.reservas.some((x) => x.id === res1.id)) {
        throw new Error(`[U08-01] Consulta falló (${qs}): ${r.status} ${JSON.stringify(d)}`);
      }
    }
    console.log('✅ [U08-01] Búsqueda en garita por código, placa (con/sin guion), DNI, nombre y estado OK.');

    // [U08-02] Detección automática /por-placa (con y sin guion) + bloqueo 409 en ingreso normal
    const pCon = await (await fetch(`${BASE_URL}/api/reservas/por-placa/${encodeURIComponent(placa1)}`, { headers: hdrRecep })).json();
    const pSin = await (await fetch(`${BASE_URL}/api/reservas/por-placa/${encodeURIComponent(placa1.replace('-', ''))}`, { headers: hdrRecep })).json();
    if (!pCon.reserva || pCon.reserva.id !== res1.id || !pSin.reserva || pSin.reserva.id !== res1.id) {
      throw new Error(`[U08-02] Detección /por-placa falló: ${JSON.stringify({ pCon, pSin })}`);
    }
    const rIngBloq = await fetch(`${BASE_URL}/api/ingresos`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: placa1, tipo: 'auto' })
    });
    if (rIngBloq.status !== 409) {
      throw new Error(`[U08-02] Ingreso normal con reserva vigente devolvió ${rIngBloq.status} en vez de 409`);
    }
    console.log('✅ [U08-02] Detección /por-placa (con/sin guion) y bloqueo 409 en ingreso normal OK.');

    // [U08-03] Protección de cupo reservado ante ingreso walk-in (DEF-08-02)
    const dispAhora = await (await fetch(`${BASE_URL}/api/publico/disponibilidad`)).json();
    guardarCapacidad({
      capacidadAutos: dispAhora.autos.enCochera + dispAhora.autos.reservasVigentes,
      capacidadMotos: capacidadOriginal.capacidadMotos
    });
    const rWalkIn = await fetch(`${BASE_URL}/api/ingresos`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ placa: placaWalkIn, tipo: 'auto' })
    });
    guardarCapacidad({
      capacidadAutos: dispAhora.autos.enCochera + dispAhora.autos.reservasVigentes + 5,
      capacidadMotos: capacidadOriginal.capacidadMotos
    });
    if (rWalkIn.status !== 409) {
      throw new Error(`[U08-03] Walk-in invadió espacio reservado: devolvió ${rWalkIn.status}`);
    }
    console.log('✅ [U08-03] Cupo reservado protegido ante ingreso walk-in cuando aforo+reservas == capacidad (409).');

    // [U08-04] Confirmación atómica concurrente (201 + 409, exactamente 1 estadía vinculada)
    const [c1, c2] = await Promise.all([
      fetch(`${BASE_URL}/api/reservas/${res1.id}/confirmar`, {
        method: 'POST',
        headers: hdrRecep,
        body: JSON.stringify({ nota: 'Ingreso puntual por garita' })
      }),
      fetch(`${BASE_URL}/api/reservas/${res1.id}/confirmar`, {
        method: 'POST',
        headers: hdrRecep,
        body: JSON.stringify({ nota: 'Doble clic concurrente' })
      })
    ]);
    const stConf = [c1.status, c2.status].sort();
    const bodyOk = c1.status === 201 ? await c1.json() : await c2.json();
    const estsRes1 = await prisma.estadia.findMany({ where: { idReserva: res1.id } });
    estsRes1.forEach((e) => idsEstadiasLimpiar.push(e.id));
    if (stConf[0] !== 201 || stConf[1] !== 409 || estsRes1.length !== 1 || bodyOk.estadoReserva !== 'UTILIZADA') {
      throw new Error(`[U08-04] Confirmación atómica falló: statuses=${stConf}, estadias=${estsRes1.length}`);
    }
    console.log('✅ [U08-04] Confirmación atómica concurrente OK (201 + 409, 1 estadía vinculada, estado UTILIZADA).');

    // [U08-05] Descuento automático del adelanto en salida
    const rSal = await fetch(`${BASE_URL}/api/salidas`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ estadiaId: bodyOk.estadiaId, metodoPago: 'Efectivo' })
    });
    const dSal = await rSal.json();
    if (dSal.salida && dSal.salida.idPago) idsPagosLimpiar.push(dSal.salida.idPago);
    const esperadoSaldo = Math.max(0, Number((dSal.salida.montoBruto - dSal.salida.adelantoReserva).toFixed(2)));
    if (
      rSal.status !== 200
      || Number(dSal.salida.adelantoReserva) !== Number(res1.montoAdelanto)
      || Number(dSal.salida.monto) !== esperadoSaldo
    ) {
      throw new Error(`[U08-05] Descuento en salida incorrecto: ${JSON.stringify(dSal)}`);
    }
    console.log(`✅ [U08-05] Descuento en salida verificado (bruto S/ ${dSal.salida.montoBruto.toFixed(2)} - adelanto S/ ${dSal.salida.adelantoReserva.toFixed(2)} = S/ ${dSal.salida.monto.toFixed(2)}).`);

    // [U08-06] Bloqueos de confirmación inválida (UTILIZADA, VENCIDA, 400, 404)
    const rConfUti = await fetch(`${BASE_URL}/api/reservas/${res1.id}/confirmar`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({})
    });
    await prisma.reserva.update({
      where: { id: res2.id },
      data: { fechaLimite: new Date(Date.now() - 5 * 60 * 1000) }
    });
    const rConfVenc = await fetch(`${BASE_URL}/api/reservas/${res2.id}/confirmar`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({})
    });
    const rNotaLarga = await fetch(`${BASE_URL}/api/reservas/${res2.id}/confirmar`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({ nota: 'X'.repeat(251) })
    });
    const r404 = await fetch(`${BASE_URL}/api/reservas/9999999/confirmar`, {
      method: 'POST',
      headers: hdrRecep,
      body: JSON.stringify({})
    });
    if (rConfUti.status !== 409 || rConfVenc.status !== 409 || rNotaLarga.status !== 400 || r404.status !== 404) {
      throw new Error(`[U08-06] Bloqueos inválidos: uti=${rConfUti.status}, venc=${rConfVenc.status}, nota=${rNotaLarga.status}, 404=${r404.status}`);
    }
    console.log('✅ [U08-06] Bloqueos 409 (UTILIZADA/VENCIDA), 400 (nota > 250) y 404 (inexistente) OK.');

    // [U08-07] RBAC estricto (CONDUCTOR -> 403, sin sesión -> 401)
    const rCondList = await fetch(`${BASE_URL}/api/reservas`, { headers: hdrCond });
    const rCondPlaca = await fetch(`${BASE_URL}/api/reservas/por-placa/${encodeURIComponent(placa1)}`, { headers: hdrCond });
    const rCondConf = await fetch(`${BASE_URL}/api/reservas/${res2.id}/confirmar`, {
      method: 'POST',
      headers: hdrCond,
      body: JSON.stringify({})
    });
    const rSinAuth = await fetch(`${BASE_URL}/api/reservas`);
    if (rCondList.status !== 403 || rCondPlaca.status !== 403 || rCondConf.status !== 403 || rSinAuth.status !== 401) {
      throw new Error(`[U08-07] RBAC falló: list=${rCondList.status}, placa=${rCondPlaca.status}, conf=${rCondConf.status}, unauth=${rSinAuth.status}`);
    }
    console.log('✅ [U08-07] RBAC estricto verificado (CONDUCTOR -> 403 en las 3 rutas de garita, sin sesión -> 401).');

    // [U08-08] Búsqueda sin coincidencias retorna lista vacía sin error
    const rVacio = await fetch(`${BASE_URL}/api/reservas?q=ZZZ-999-INEXISTENTE`, { headers: hdrRecep });
    const dVacio = await rVacio.json();
    if (rVacio.status !== 200 || !Array.isArray(dVacio.reservas) || dVacio.reservas.length !== 0) {
      throw new Error(`[U08-08] Búsqueda vacía falló: ${rVacio.status} ${JSON.stringify(dVacio)}`);
    }
    console.log('✅ [U08-08] Búsqueda sin coincidencias retorna HTTP 200 con lista vacía [].');

    console.log('\n🎉 TODAS LAS PRUEBAS DEDICADAS UPAO-8 PASARON (8/8 VERIFICACIONES).');
  } finally {
    try {
      if (idsEstadiasLimpiar.length > 0) {
        await prisma.estadia.deleteMany({ where: { id: { in: idsEstadiasLimpiar } } });
      }
      if (idsPagosLimpiar.length > 0) {
        await prisma.pago.deleteMany({ where: { id: { in: idsPagosLimpiar } } });
      }
      const u = await prisma.usuario.findUnique({ where: { usuario: usuarioCond } });
      if (u) {
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
      console.error('Aviso limpiando datos UPAO-8:', e.message);
    }
    try { guardarCapacidad(capacidadOriginal); } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
    mock.server.close();
  }
}

ejecutarSuiteUpao8().catch((err) => {
  console.error('❌ ERROR EN SUITE UPAO-8:', err);
  process.exit(1);
});
