require('dotenv').config();
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const prisma = require('../src/config/prisma');

const PORT = 3568;
const BASE_URL = `http://localhost:${PORT}`;
const EVIDENCIAS_DIR = path.join(__dirname, '..', 'docs', 'modulos', 'reservas', 'evidencias-historial');
if (!fs.existsSync(EVIDENCIAS_DIR)) {
  fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
}

async function esperarServidor(intentos = 35) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${BASE_URL}/api/publico/disponibilidad`);
      if (r.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El servidor E2E de historial UPAO-23 no respondió a tiempo.');
}

async function runE2EHistorial() {
  console.log('=== PRUEBA E2E: HISTORIAL DEL CONDUCTOR (UPAO-23) ===');

  const srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  const suf = String(Date.now()).slice(-4);
  const usuarioCond = `cond_h23e_${suf}`;
  const placa = `EVH-${suf.slice(1)}`;
  let browser = null;

  try {
    await esperarServidor();

    const rCond = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Carlos Vega Historial',
        dni: `7512${suf}`,
        celular: '987654321',
        usuario: usuarioCond,
        contrasena: 'password123'
      })
    });
    const sesCond = await rCond.json();
    const hdrCond = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesCond.token}` };

    const rVeh = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
      method: 'POST',
      headers: hdrCond,
      body: JSON.stringify({ placa, tipo: 'auto' })
    });
    const veh = await rVeh.json();

    const rRec = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'recepcion', contrasena: '123456' })
    });
    const sesRec = await rRec.json();
    const hdrRec = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesRec.token}` };

    // 1. Estadía finalizada
    const rIng1 = await fetch(`${BASE_URL}/api/ingresos`, {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({ placa, tipo: 'auto' })
    });
    const ing1 = await rIng1.json();
    if (!rIng1.ok) {
      throw new Error(`Error creando estadía E2E: ${rIng1.status} ${JSON.stringify(ing1)}`);
    }
    const idEstadia1 = ing1.estadia ? ing1.estadia.id : ing1.id;
    const rSal1 = await fetch(`${BASE_URL}/api/salidas`, {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({ estadiaId: idEstadia1, metodoPago: 'Efectivo' })
    });
    if (!rSal1.ok) {
      throw new Error(`Error registrando salida E2E: ${rSal1.status} ${await rSal1.text()}`);
    }

    // 2. Estadía en cochera vinculada a reserva
    const uDb = await prisma.usuario.findUnique({ where: { usuario: usuarioCond } });
    const resDb = await prisma.reserva.create({
      data: {
        codigo: `RES-E23${suf}`,
        idUsuario: uDb.id,
        idVehiculo: veh.id,
        idTipoVehiculo: 1,
        fechaReserva: new Date(),
        fechaLimite: new Date(Date.now() + 30 * 60 * 1000),
        estado: 'VIGENTE',
        montoAdelanto: 6.00,
        pasarelaPagoId: `chr_e23_${suf}`,
        pasarelaProveedor: 'culqi',
        estadoPago: 'PAGADO'
      }
    });
    const rConf = await fetch(`${BASE_URL}/api/reservas/${resDb.id}/confirmar`, {
      method: 'POST',
      headers: hdrRec,
      body: JSON.stringify({})
    });
    if (!rConf.ok) {
      throw new Error(`Error confirmando reserva E2E: ${rConf.status} ${await rConf.text()}`);
    }

    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });

    await page.goto(`${BASE_URL}/#login`);
    await page.waitForSelector('#view-login.active');
    await page.fill('#login-usuario', usuarioCond);
    await page.fill('#login-password', 'password123');
    await page.click('#btn-login-submit');
    await page.waitForSelector('#view-dashboard.active');

    await page.click('#card-modulo-conductor-historial');
    await page.waitForSelector('#view-conductor-historial.active');
    await page.waitForFunction((p) => {
      const tb = document.getElementById('tbody-historial-conductor');
      return tb && tb.innerText.includes(p);
    }, placa, { timeout: 8000 });
    await page.waitForTimeout(300);

    const tablaFit = await page.evaluate(() => {
      const cont = document.querySelector('#view-conductor-historial .table-container');
      const tbl = document.querySelector('#view-conductor-historial .data-table');
      return {
        containerWidth: cont ? cont.clientWidth : 0,
        tableWidth: tbl ? tbl.scrollWidth : 0,
        overflow: Boolean(cont && tbl && tbl.scrollWidth > cont.clientWidth + 1)
      };
    });
    if (tablaFit.overflow) {
      throw new Error(`Tabla Historial desborda horizontalmente: ${JSON.stringify(tablaFit)}`);
    }
    console.log('✓ Tabla Historial 1 línea sin desborde:', JSON.stringify(tablaFit));
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '01_historial_completo.png'), fullPage: false });
    console.log('✓ Captura 1: 01_historial_completo.png');

    await page.selectOption('#select-estado-historial-conductor', 'EN_COCHERA');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '02_historial_filtro_en_cochera.png'), fullPage: false });
    console.log('✓ Captura 2: 02_historial_filtro_en_cochera.png');

    await page.selectOption('#select-estado-historial-conductor', 'FINALIZADA');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '03_historial_filtro_finalizadas.png'), fullPage: false });
    console.log('✓ Captura 3: 03_historial_filtro_finalizadas.png');

    console.log('\n🎉 E2E HISTORIAL UPAO-23 COMPLETO (3/3 CAPTURAS OK).');
  } finally {
    if (browser) await browser.close();
    try {
      const ests = await prisma.estadia.findMany({ where: { placa }, select: { idPago: true } });
      const idsPago = ests.map((e) => e.idPago).filter(Boolean);
      await prisma.estadia.deleteMany({ where: { placa } });
      if (idsPago.length > 0) await prisma.pago.deleteMany({ where: { id: { in: idsPago } } });
      const u = await prisma.usuario.findUnique({ where: { usuario: usuarioCond } });
      if (u) {
        await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
        await prisma.usuario.delete({ where: { id: u.id } });
      }
    } catch (e) {
      console.error('Aviso limpiando E2E UPAO-23:', e.message);
    }
    await prisma.$disconnect();
    srv.kill();
  }
}

runE2EHistorial().catch((err) => {
  console.error('❌ ERROR E2E HISTORIAL UPAO-23:', err);
  process.exit(1);
});
