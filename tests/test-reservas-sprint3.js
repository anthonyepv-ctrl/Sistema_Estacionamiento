require('dotenv').config();
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

async function confirmarPaymentIntentEnStripe(paymentIntentId) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const body = new URLSearchParams();
  body.append('payment_method', 'pm_card_visa');

  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Error confirmando PaymentIntent en Stripe: ${data?.error?.message || res.status}`);
  }
  return data;
}

async function ejecutarPruebas() {
  console.log('=== INICIANDO SUITE INTEGRAL SPRINT 3 (UPAO-21, UPAO-22, UPAO-8, UPAO-23) ===');
  const srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  const capacidadOriginal = obtenerCapacidad();
  const sufijo = String(Date.now()).slice(-4);
  const usuarioTest = `cond_sp3_${sufijo}`;
  const dniTest = `7485${sufijo}`;
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

    // 2. Verificar configuración de pasarela Stripe
    const resCfg = await fetch(`${BASE_URL}/api/reservas/config-pasarela`, {
      headers: headersConductor
    });
    const cfg = await resCfg.json();
    if (!resCfg.ok || !cfg.habilitado || !String(cfg.publishableKey).startsWith('pk_test_')) {
      throw new Error(`Configuración Stripe inválida: ${JSON.stringify(cfg)}`);
    }
    console.log('✅ [SP3-02] Configuración de pasarela Stripe verificada (pk_test_... activa).');

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

    // 4. Crear intención de pago Stripe + confirmar con tarjeta Visa de prueba + crear Reserva #1 (UPAO-21)
    const resDispAntes = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispAntes = await resDispAntes.json();
    const reservasAutosAntes = dispAntes.autos.reservasVigentes;

    const resIntencion1 = await fetch(`${BASE_URL}/api/reservas/intencion-pago`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ idVehiculo })
    });
    const intencion1 = await resIntencion1.json();
    if (!resIntencion1.ok || !intencion1.paymentIntentId) {
      throw new Error(`Fallo al crear PaymentIntent #1: ${JSON.stringify(intencion1)}`);
    }

    await confirmarPaymentIntentEnStripe(intencion1.paymentIntentId);

    const resCrear1 = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({
        idVehiculo,
        paymentIntentId: intencion1.paymentIntentId
      })
    });
    const dataReserva1 = await resCrear1.json();
    if (resCrear1.status !== 201 || dataReserva1.reserva.estado !== 'VIGENTE') {
      throw new Error(`Fallo al crear Reserva #1: ${JSON.stringify(dataReserva1)}`);
    }
    console.log(`✅ [SP3-04] Reserva #1 (${dataReserva1.reserva.codigo}) creada con pago Stripe (${intencion1.paymentIntentId}).`);

    // 5. Verificar descuento de cupo en vista pública (UPAO-21 / UPAO-20)
    const resDispDurante = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
    const dispDurante = await resDispDurante.json();
    if (dispDurante.autos.reservasVigentes !== reservasAutosAntes + 1) {
      throw new Error(`El cupo de reservasVigentes no se incrementó: antes=${reservasAutosAntes}, ahora=${dispDurante.autos.reservasVigentes}`);
    }
    console.log('✅ [SP3-05] Disponibilidad pública refleja la reserva vigente en tiempo real.');

    // 6. Anular Reserva #1 y verificar reembolso en Stripe + liberación de cupo (UPAO-22)
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
    console.log(`✅ [SP3-06] Reserva #1 anulada con reembolso Stripe (${dataAnular.reserva.estadoPago}) y cupo liberado (UPAO-22).`);

    // 7. Crear Reserva #2 -> Buscar y Confirmar en Garita como Recepcionista (UPAO-8) -> Registrar Salida -> Consultar Historial (UPAO-23)
    const resIntencion2 = await fetch(`${BASE_URL}/api/reservas/intencion-pago`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({ idVehiculo })
    });
    const intencion2 = await resIntencion2.json();
    await confirmarPaymentIntentEnStripe(intencion2.paymentIntentId);

    const resCrear2 = await fetch(`${BASE_URL}/api/reservas`, {
      method: 'POST',
      headers: headersConductor,
      body: JSON.stringify({
        idVehiculo,
        paymentIntentId: intencion2.paymentIntentId
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

    console.log('\n🎉 TODAS LAS PRUEBAS DEL SPRINT 3 PASARON EXITOSAMENTE (12/12).');
  } finally {
    // Limpieza de datos de prueba en staging
    try {
      const u = await prisma.usuario.findUnique({ where: { usuario: usuarioTest } });
      if (u) {
        await prisma.pago.deleteMany({ where: { estadia: { placa: placaTest } } });
        await prisma.estadia.deleteMany({ where: { placa: placaTest } });
        await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
        await prisma.usuario.delete({ where: { id: u.id } });
      }
    } catch (e) {
      console.error('Aviso limpiando datos de prueba:', e.message);
    }
    try {
      guardarCapacidad(capacidadOriginal);
    } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
  }
}

ejecutarPruebas().catch((err) => {
  console.error('❌ ERROR EN SUITE SPRINT 3:', err);
  process.exit(1);
});
