require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const prisma = require('../src/config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const PORT = 3558;
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
  throw new Error('El servidor de pruebas no respondió a tiempo.');
}

function iniciarMockCulqi() {
  let seq = 0;
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => { rawBody += chunk; });
    req.on('end', () => {
      let body = {};
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) {}
      seq += 1;

      if (req.method === 'POST' && req.url === '/v2/charges') {
        if (String(body.source_id || '').includes('rechazado')) {
          res.writeHead(402, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ user_message: 'Tarjeta rechazada en pruebas.' }));
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          id: `chr_test_sp3_${Date.now()}_${seq}`,
          object: 'charge',
          amount: body.amount,
          currency_code: body.currency_code
        }));
      }

      if (req.method === 'POST' && req.url === '/v2/refunds') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          id: `ref_test_sp3_${Date.now()}_${seq}`,
          object: 'refund',
          charge_id: body.charge_id,
          amount: body.amount,
          reason: body.reason
        }));
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ user_message: 'Ruta mock Culqi no soportada' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/v2` });
    });
  });
}

async function crearTokenPruebaCulqi(usarMock) {
  if (usarMock) {
    return `tkn_test_sp3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  const publicKey = process.env.CULQI_PUBLIC_KEY;
  const res = await fetch('https://secure.culqi.com/v2/tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publicKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      card_number: process.env.CULQI_TEST_CARD || '4111111111111111',
      cvv: '123',
      expiration_month: '12',
      expiration_year: '2030',
      email: 'conductor.sp3@cochera.pe'
    })
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`Error generando token de prueba Culqi: ${data?.user_message || data?.merchant_message || res.status}`);
  }
  return data.id;
}

async function ejecutarPruebas() {
  console.log('=== INICIANDO SUITE INTEGRAL SPRINT 3 (UPAO-21, UPAO-22, UPAO-8, UPAO-23 · CULQI PERÚ) ===');

  const usarMock = process.env.CULQI_MOCK === '1'
    || !process.env.CULQI_PUBLIC_KEY
    || !process.env.CULQI_SECRET_KEY;

  const mockCulqi = usarMock ? await iniciarMockCulqi() : null;
  if (usarMock) {
    console.log('ℹ️  Modo CULQI_MOCK activo (sin llaves reales en .env).');
  }

  const envServidor = {
    ...process.env,
    PORT: String(PORT),
    PAYMENT_GATEWAY: 'culqi'
  };
  if (usarMock) {
    envServidor.CULQI_API_BASE = mockCulqi.url;
    envServidor.CULQI_PUBLIC_KEY = 'pk_test_mock_sprint3_1234';
    envServidor.CULQI_SECRET_KEY = 'sk_test_mock_sprint3_1234';
    envServidor.PASARELA_ENCRYPTION_KEY = envServidor.PASARELA_ENCRYPTION_KEY || 'test-aes256-secret-key-32-chars!!';
  }

  const srv = spawn(process.execPath, ['server.js'], {
    env: envServidor,
    stdio: 'pipe'
  });

  const capacidadOriginal = obtenerCapacidad();
  const sufijo = String(Date.now()).slice(-4);
  const usuarioTest = `cond_sp3_${sufijo}`;
  const usuarioTestB = `cond_sp3b_${sufijo}`;
  const dniTest = `7485${sufijo}`;
  const dniTestB = `7496${sufijo}`;
  const numPlaca = String(100 + (Number(sufijo) % 899));
  const placaTest = `BTP-${numPlaca}`;

  try {
    await esperarServidor();

    const resDispInit = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispInit = await resDispInit.json();
    if (dispInit.autos.disponibles < 2) {
      guardarCapacidad({
        capacidadAutos: dispInit.autos.enCochera + dispInit.autos.reservasVigentes + 5,
        capacidadMotos: capacidadOriginal.capacidadMotos
      });
    }

    // 1. Registro de Conductor (UPAO-21)
    const resReg = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Conductor Prueba Sprint 3',
        dni: dniTest,
        celular: '987654321',
        usuario: usuarioTest,
        contrasena: 'password123'
      })
    });
    const sesionConductor = await resReg.json();
    if (!resReg.ok || sesionConductor.rol !== 'CONDUCTOR' || !sesionConductor.token) {
      throw new Error(`Fallo registro conductor: ${JSON.stringify(sesionConductor)}`);
    }
    const headersConductor = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesionConductor.token}`
    };
    console.log(`✅ [SP3-01] Registro y autenticación de CONDUCTOR (${usuarioTest}) exitoso.`);

    // 2. Verificar configuración de pasarela Culqi
    const resCfg = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      headers: headersConductor
    });
    const cfg = await resCfg.json();
    if (!resCfg.ok || !cfg.habilitado || cfg.proveedor !== 'culqi' || !String(cfg.publishableKey).startsWith('pk_test_')) {
      throw new Error(`Configuración Culqi inválida: ${JSON.stringify(cfg)}`);
    }
    console.log('✅ [SP3-02] Configuración de pasarela Culqi verificada (pk_test_... activa).');

    // 2b. Autogestión de API Keys Culqi por rol DUEÑO (UPAO-21)
    const resPutCond = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersConductor,
      body: JSON.stringify({ publishableKey: 'pk_test_1234567890abcd', secretKey: 'sk_test_1234567890abcd' })
    });
    if (resPutCond.status !== 403) {
      throw new Error(`Se esperaba 403 para CONDUCTOR en PUT /config-pasarela, obtuvo ${resPutCond.status}`);
    }

    const resLoginDueno = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'admin', contrasena: '123456' })
    });
    const sesionDueno = await resLoginDueno.json();
    if (!resLoginDueno.ok || !sesionDueno.token) {
      throw new Error(`Fallo login DUEÑO en SP3-02b: ${JSON.stringify(sesionDueno)}`);
    }
    const headersDueno = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesionDueno.token}`
    };

    const resPutInv = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ publishableKey: 'clave_invalida', secretKey: 'sk_test_1234567890abcd' })
    });
    if (resPutInv.status !== 400) {
      throw new Error(`Se esperaba 400 con PK inválida, obtuvo ${resPutInv.status}`);
    }

    const resPutMix = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ publishableKey: 'pk_test_1234567890abcd', secretKey: 'sk_live_1234567890abcd' })
    });
    if (resPutMix.status !== 400) {
      throw new Error(`Se esperaba 400 al mezclar test/live, obtuvo ${resPutMix.status}`);
    }

    const resPutOk = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({
        publishableKey: 'pk_test_9999999999panel',
        secretKey: 'sk_test_9999999999panel'
      })
    });
    const putOkData = await resPutOk.json();
    if (!resPutOk.ok || putOkData.origen !== 'panel_dueno' || !putOkData.secretKeyMasked) {
      throw new Error(`Fallo al guardar claves del dueño: ${JSON.stringify(putOkData)}`);
    }

    const resRestaurar = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      method: 'PUT',
      headers: headersDueno,
      body: JSON.stringify({ restaurarPorDefecto: true })
    });
    const restaurarData = await resRestaurar.json();
    if (!resRestaurar.ok || restaurarData.origen !== 'servidor_env') {
      throw new Error(`Fallo al restaurar claves del servidor: ${JSON.stringify(restaurarData)}`);
    }
    console.log('✅ [SP3-02b] Autogestión de API Keys Culqi por DUEÑO (403/400/guardar/restaurar) verificada.');

    // 3. Validación Poka-Yoke + Registro de vehículo del conductor (UPAO-21)
    const resVehInvalido = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ placa: 'AAA-000', tipo: 'auto' })
    });
    if (resVehInvalido.status !== 400) {
      throw new Error('Se permitió registrar una placa repetitiva inválida AAA-000.');
    }

    const resVeh = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ placa: placaTest, tipo: 'auto' })
    });
    const dataVeh = await resVeh.json();
    if (resVeh.status !== 201 || !dataVeh.id) {
      throw new Error(`Fallo al registrar vehículo del conductor: ${JSON.stringify(dataVeh)}`);
    }
    const idVehiculo = dataVeh.id;
    console.log(`✅ [SP3-03] Vehículo ${placaTest} registrado con validación SUNARP/MTC y Poka-Yoke.`);

    // 4. Preparar pago + Token Culqi + crear Reserva #1 (UPAO-21)
    const resDispAntes = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispAntes = await resDispAntes.json();
    const reservasAutosAntes = dispAntes.autos.reservasVigentes;

    const resPrep1 = await fetch(`${BASE_URL}/api/reservas/preparar-pago`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ idVehiculo })
    });
    const prep1 = await resPrep1.json();
    if (!resPrep1.ok || !prep1.publishableKey || !prep1.montoCentimos) {
      throw new Error(`Fallo al preparar pago #1: ${JSON.stringify(prep1)}`);
    }

    const token1 = await crearTokenPruebaCulqi(usarMock);
    const resCrear1 = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({
        idVehiculo,
        sourceToken: token1,
        email: 'conductor.sp3@cochera.pe'
      })
    });
    const dataReserva1 = await resCrear1.json();
    if (resCrear1.status !== 201 || dataReserva1.reserva.estado !== 'VIGENTE') {
      throw new Error(`Fallo al crear Reserva #1: ${JSON.stringify(dataReserva1)}`);
    }
    console.log(`✅ [SP3-04] Reserva #1 (${dataReserva1.reserva.codigo}) creada con pago Culqi (${dataReserva1.reserva.pasarelaPagoId}).`);

    // 5. Verificar descuento de cupo en vista pública (UPAO-21 / UPAO-20)
    const resDispDurante = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispDurante = await resDispDurante.json();
    if (dispDurante.autos.reservasVigentes !== reservasAutosAntes + 1) {
      throw new Error(`El cupo de reservasVigentes no se incrementó: antes=${reservasAutosAntes}, ahora=${dispDurante.autos.reservasVigentes}`);
    }
    console.log('✅ [SP3-05] Disponibilidad pública refleja la reserva vigente en tiempo real.');

    // 6. Anular Reserva #1 y verificar reembolso en Culqi + liberación de cupo (UPAO-22)
    const resAnular = await fetch(`${BASE_URL}/api/reservas/${dataReserva1.reserva.id}/anular`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({})
    });
    const dataAnular = await resAnular.json();
    if (!resAnular.ok || dataAnular.reserva.estado !== 'ANULADA' || dataAnular.reserva.estadoPago !== 'REEMBOLSADO') {
      throw new Error(`Fallo al anular Reserva #1: ${JSON.stringify(dataAnular)}`);
    }

    const resDispDespuesAnular = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispDespuesAnular = await resDispDespuesAnular.json();
    if (dispDespuesAnular.autos.reservasVigentes !== reservasAutosAntes) {
      throw new Error('El cupo no se liberó tras anular la reserva.');
    }
    console.log(`✅ [SP3-06] Reserva #1 anulada con reembolso Culqi (${dataAnular.reserva.estadoPago}) y cupo liberado (UPAO-22).`);

    // 7. Crear Reserva #2 -> Buscar y Confirmar en Garita como Recepcionista (UPAO-8) -> Registrar Salida -> Consultar Historial (UPAO-23)
    const token2 = await crearTokenPruebaCulqi(usarMock);
    const resCrear2 = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({
        idVehiculo,
        sourceToken: token2,
        email: 'conductor.sp3@cochera.pe'
      })
    });
    const dataReserva2 = await resCrear2.json();
    if (resCrear2.status !== 201) {
      throw new Error(`Fallo al crear Reserva #2: ${JSON.stringify(dataReserva2)}`);
    }

    // Login como recepcionista
    const resLoginRec = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'recepcion', contrasena: '123456' })
    });
    const sesionRec = await resLoginRec.json();
    const headersRec = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesionRec.token}`
    };

    // Buscar reserva por código y por placa (UPAO-8)
    const resBuscar = await fetch(`${BASE_URL}/api/reservas?q=${encodeURIComponent(dataReserva2.reserva.codigo)}`, {
      headers: headersRec
    });
    const dataBuscar = await resBuscar.json();
    if (!resBuscar.ok || dataBuscar.reservas.length !== 1 || dataBuscar.reservas[0].placa !== placaTest) {
      throw new Error(`Búsqueda en garita falló: ${JSON.stringify(dataBuscar)}`);
    }
    console.log(`✅ [SP3-07] Búsqueda de reserva en garita (${dataReserva2.reserva.codigo} / ${placaTest}) exitosa (UPAO-8).`);

    const placaSinGuion = placaTest.replace('-', '').toLowerCase();
    const resBuscarSinGuion = await fetch(`${BASE_URL}/api/reservas?q=${placaSinGuion}`, { headers: headersRec });
    const dataBuscarSinGuion = await resBuscarSinGuion.json();
    if (!resBuscarSinGuion.ok || !dataBuscarSinGuion.reservas.some((r) => r.placa === placaTest)) {
      throw new Error(`La búsqueda por placa sin guion no encontró la reserva: ${JSON.stringify(dataBuscarSinGuion)}`);
    }

    const resPorPlaca = await fetch(`${BASE_URL}/api/reservas/por-placa/${encodeURIComponent(placaTest)}`, { headers: headersRec });
    const dataPorPlaca = await resPorPlaca.json();
    if (!resPorPlaca.ok || !dataPorPlaca.reserva || dataPorPlaca.reserva.estado !== 'VIGENTE') {
      throw new Error(`El aviso de reserva por placa falló: ${JSON.stringify(dataPorPlaca)}`);
    }
    console.log('✅ [SP3-07b] Placa con reserva vigente detectada en ingreso (con y sin guion).');

    const resIngresoNormalBloqueado = await fetch(`${BASE_URL}/api/ingresos`, {
      method: 'POST',
      headers: headersRec,
      body: JSON.stringify({ placa: placaTest, tipo: 'auto' })
    });
    if (resIngresoNormalBloqueado.status !== 409) {
      throw new Error(`Se esperaba 409 al intentar ingreso normal con reserva vigente, recibió ${resIngresoNormalBloqueado.status}`);
    }
    console.log('✅ [SP3-07c] Ingreso normal bloqueado (409) mientras existe reserva vigente.');

    // Confirmar ingreso en garita
    const resConfirmar = await fetch(`${BASE_URL}/api/reservas/${dataReserva2.reserva.id}/confirmar`, {
      method: 'POST',
      headers: headersRec,
      body: JSON.stringify({})
    });
    const dataConfirmar = await resConfirmar.json();
    if (resConfirmar.status !== 201 || dataConfirmar.estadoReserva !== 'UTILIZADA') {
      throw new Error(`Fallo al confirmar ingreso de reserva: ${JSON.stringify(dataConfirmar)}`);
    }
    console.log(`✅ [SP3-08] Reserva confirmada en garita -> Estadía #${dataConfirmar.estadiaId} iniciada.`);

    // Registrar salida (descontando adelanto de 1 hora -> saldo S/ 0.00)
    const resSalida = await fetch(`${BASE_URL}/api/salidas`, {
      method: 'POST',
      headers: headersRec,
      body: JSON.stringify({
        estadiaId: dataConfirmar.estadiaId,
        metodoPago: 'Efectivo'
      })
    });
    const dataSalida = await resSalida.json();
    if (!resSalida.ok || !dataSalida.salida || Number(dataSalida.salida.adelantoReserva) <= 0 || Number(dataSalida.salida.monto) !== 0) {
      throw new Error(`Fallo descuento de adelanto en salida: ${JSON.stringify(dataSalida)}`);
    }
    console.log(`✅ [SP3-09] Salida registrada descontando adelanto de S/ ${Number(dataSalida.salida.adelantoReserva).toFixed(2)} (saldo cobrado en garita: S/ ${Number(dataSalida.salida.monto).toFixed(2)}).`);

    // Consultar historial del conductor (UPAO-23)
    const resHistorial = await fetch(`${BASE_URL}/api/conductor/historial`, {
      headers: headersConductor
    });
    const dataHistorial = await resHistorial.json();
    if (!resHistorial.ok || dataHistorial.estadias.length !== 1 || dataHistorial.estadias[0].estado !== 'Finalizada') {
      throw new Error(`Fallo en historial de estadías del conductor: ${JSON.stringify(dataHistorial)}`);
    }
    console.log(`✅ [SP3-10] Historial de estadías del conductor verificado con estado FINALIZADA (UPAO-23).`);

    // 8. Casos negativos y límites completos (UPAO-21, UPAO-22, UPAO-8, UPAO-23)
    // 8.1 Sin token -> 401 en reservas e historial (UPAO-21 / UPAO-23)
    const resSinTokenReserva = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idVehiculo, sourceToken: 'tkn_test_invalido_123' })
    });
    if (resSinTokenReserva.status !== 401) {
      throw new Error(`Se esperaba 401 sin token en POST /api/reservas, recibió ${resSinTokenReserva.status}`);
    }
    const resSinTokenHistorial = await fetch(`${BASE_URL}/api/conductor/historial`);
    if (resSinTokenHistorial.status !== 401) {
      throw new Error(`Se esperaba 401 sin token en /api/conductor/historial, recibió ${resSinTokenHistorial.status}`);
    }
    console.log('✅ [SP3-11] Rechazo 401 sin sesión activa verificado en reservas e historial.');

    // 8.2 Sin espacios disponibles -> 409 (UPAO-21)
    const capAntesCero = obtenerCapacidad();
    const resDispParaCero = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispParaCero = await resDispParaCero.json();
    guardarCapacidad({
      capacidadAutos: dispParaCero.autos.enCochera + dispParaCero.autos.reservasVigentes,
      capacidadMotos: capAntesCero.capacidadMotos
    });
    const resCupoCero = await fetch(`${BASE_URL}/api/reservas/preparar-pago`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ idVehiculo })
    });
    guardarCapacidad(capAntesCero);
    if (resCupoCero.status !== 409) {
      throw new Error(`Se esperaba 409 sin cupos disponibles, recibió ${resCupoCero.status}`);
    }
    console.log('✅ [SP3-12] Bloqueo 409 con aforo lleno verificado.');

    // 8.3 Pago Culqi inválido/no aprobado -> 402 (UPAO-21) y doble reserva vigente -> 409 (UPAO-21)
    const resPagoNoConfirmado = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ idVehiculo, sourceToken: 'tkn_invalido' })
    });
    if (resPagoNoConfirmado.status !== 402) {
      throw new Error(`Se esperaba 402 con token inválido, recibió ${resPagoNoConfirmado.status}`);
    }
    console.log('✅ [SP3-13] Rechazo 402 cuando el token/pago Culqi no es válido.');

    // Crear Reserva #3 vigente para probar doble reserva, aislamiento entre conductores y vencimiento
    const token3 = await crearTokenPruebaCulqi(usarMock);
    const resCrear3 = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({
        idVehiculo,
        sourceToken: token3,
        email: 'conductor.sp3@cochera.pe'
      })
    });
    const dataReserva3 = await resCrear3.json();
    if (resCrear3.status !== 201) {
      throw new Error(`Fallo creando Reserva #3: ${JSON.stringify(dataReserva3)}`);
    }

    const resDobleReserva = await fetch(`${BASE_URL}/api/reservas/preparar-pago`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ idVehiculo })
    });
    if (resDobleReserva.status !== 409) {
      throw new Error(`Se esperaba 409 al intentar segunda reserva vigente para la misma placa, recibió ${resDobleReserva.status}`);
    }
    console.log('✅ [SP3-14] Bloqueo 409 de doble reserva vigente verificado.');

    // 8.4 Conductor B: aislamiento de historial/reservas (UPAO-23) y 403 al anular reserva ajena (UPAO-22)
    const resRegB = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Conductor Secundario B',
        dni: dniTestB,
        celular: '987654322',
        usuario: usuarioTestB,
        contrasena: 'password123'
      })
    });
    const sesionB = await resRegB.json();
    if (!resRegB.ok || !sesionB.token) {
      throw new Error(`Fallo registro conductor B: ${JSON.stringify(sesionB)}`);
    }
    const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesionB.token}` };

    const resHistB = await fetch(`${BASE_URL}/api/conductor/historial`, { headers: headersB });
    const dataHistB = await resHistB.json();
    const resMiasB = await fetch(`${BASE_URL}/api/reservas/mias`, { headers: headersB });
    const dataMiasB = await resMiasB.json();
    if (!resHistB.ok || dataHistB.estadias.length !== 0 || !resMiasB.ok || dataMiasB.reservas.length !== 0) {
      throw new Error('Se filtraron datos ajenos o historial no vacío para conductor B.');
    }
    console.log('✅ [SP3-15] Estado vacío y aislamiento estricto de historial/reservas verificado (UPAO-23).');

    const resAnularAjena = await fetch(`${BASE_URL}/api/reservas/${dataReserva3.reserva.id}/anular`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({})
    });
    if (resAnularAjena.status !== 403) {
      throw new Error(`Se esperaba 403 al anular reserva de otro conductor, recibió ${resAnularAjena.status}`);
    }
    console.log('✅ [SP3-16] Rechazo 403 al intentar anular reserva de otro conductor (UPAO-22).');

    // 8.5 Re-anular reserva ya anulada -> 409 (UPAO-22) y anular/confirmar reserva vencida -> 409 (UPAO-22 / UPAO-8)
    const resReAnular = await fetch(`${BASE_URL}/api/reservas/${dataReserva1.reserva.id}/anular`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({})
    });
    if (resReAnular.status !== 409) {
      throw new Error(`Se esperaba 409 al re-anular Reserva #1, recibió ${resReAnular.status}`);
    }

    await prisma.reserva.update({
      where: { id: dataReserva3.reserva.id },
      data: { fechaLimite: new Date(Date.now() - 5 * 60 * 1000) }
    });
    const resAnularVencida = await fetch(`${BASE_URL}/api/reservas/${dataReserva3.reserva.id}/anular`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({})
    });
    if (resAnularVencida.status !== 409) {
      throw new Error(`Se esperaba 409 al anular reserva vencida, recibió ${resAnularVencida.status}`);
    }
    const resConfirmarVencida = await fetch(`${BASE_URL}/api/reservas/${dataReserva3.reserva.id}/confirmar`, {
      method: 'POST',
      headers: headersRec,
      body: JSON.stringify({})
    });
    if (resConfirmarVencida.status !== 409) {
      throw new Error(`Se esperaba 409 al confirmar reserva vencida en garita, recibió ${resConfirmarVencida.status}`);
    }
    console.log('✅ [SP3-17] Rechazo 409 en anulación duplicada/vencida y en confirmación de reserva vencida.');

    // 8.6 Búsqueda en garita sin coincidencias -> [] (UPAO-8)
    const resSinCoincidencias = await fetch(`${BASE_URL}/api/reservas?q=ZZZ-999`, { headers: headersRec });
    const dataSinCoincidencias = await resSinCoincidencias.json();
    if (!resSinCoincidencias.ok || !Array.isArray(dataSinCoincidencias.reservas) || dataSinCoincidencias.reservas.length !== 0) {
      throw new Error(`La búsqueda inexistente no devolvió lista vacía: ${JSON.stringify(dataSinCoincidencias)}`);
    }
    console.log('✅ [SP3-18] Búsqueda en garita sin coincidencias retorna lista vacía (UPAO-8).');

    console.log('\n🎉 TODAS LAS PRUEBAS DEL SPRINT 3 PASARON EXITOSAMENTE (21/21 verificaciones).');
  } finally {
    // Limpieza de datos de prueba en staging
    try {
      for (const usr of [usuarioTest, usuarioTestB]) {
        const u = await prisma.usuario.findUnique({ where: { usuario: usr } });
        if (u) {
          await prisma.pago.deleteMany({ where: { estadia: { placa: placaTest } } });
          await prisma.estadia.deleteMany({ where: { placa: placaTest } });
          await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
          await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
          await prisma.usuario.delete({ where: { id: u.id } });
        }
      }
    } catch (e) {
      console.error('Aviso limpiando datos de prueba:', e.message);
    }
    try {
      guardarCapacidad(capacidadOriginal);
    } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
    if (mockCulqi) mockCulqi.server.close();
  }
}

ejecutarPruebas().catch((err) => {
  console.error('❌ ERROR EN SUITE SPRINT 3:', err);
  process.exit(1);
});
