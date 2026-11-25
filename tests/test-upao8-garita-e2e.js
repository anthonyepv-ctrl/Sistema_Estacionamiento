require('dotenv').config();
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const prisma = require('../src/config/prisma');

const PORT = 3565;
const BASE_URL = `http://localhost:${PORT}`;
const EVIDENCIAS_DIR = path.join(__dirname, '..', 'docs', 'modulos', 'reservas', 'evidencias-garita');
if (!fs.existsSync(EVIDENCIAS_DIR)) {
  fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
}

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
  throw new Error('El servidor E2E de garita UPAO-8 no respondió a tiempo.');
}

async function runE2EGarita() {
  console.log('================================================================');
  console.log(' PRUEBA E2E: INTERFAZ GARITA BUSCAR Y CONFIRMAR RESERVAS (UPAO-8)');
  console.log('================================================================\n');

  const srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  const suf = String(Date.now()).slice(-4);
  const usuarioCond = `cond_g8e2e_${suf}`;
  const dniCond = `7612${suf}`;
  const placaVig = `G8E-${suf.slice(1)}`;
  const placaMoto = `2${suf.slice(1)}-8M`;
  const idsEstadiasLimpiar = [];
  let browser = null;

  try {
    await esperarServidor();

    const rReg = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Luis Mendoza Garita',
        dni: dniCond,
        celular: '987654321',
        usuario: usuarioCond,
        contrasena: 'password123'
      })
    });
    const ses = await rReg.json();
    const uDb = await prisma.usuario.findUnique({ where: { usuario: usuarioCond } });
    const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${ses.token}` };

    const crearVeh = async (placa, tipo) => {
      const r = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ placa, tipo })
      });
      return r.json();
    };

    const vAuto = await crearVeh(placaVig, 'auto');
    const vMoto = await crearVeh(placaMoto, 'moto');

    const ahora = new Date();
    const codigoVig = `RES-G8V${suf}`;
    await prisma.reserva.createMany({
      data: [
        {
          codigo: codigoVig,
          idUsuario: uDb.id,
          idVehiculo: vAuto.id,
          idTipoVehiculo: 1,
          fechaReserva: ahora,
          fechaLimite: new Date(ahora.getTime() + 30 * 60 * 1000),
          estado: 'VIGENTE',
          montoAdelanto: 6.00,
          pasarelaPagoId: `chr_g8_vig_${suf}`,
          pasarelaProveedor: 'culqi',
          estadoPago: 'PAGADO'
        },
        {
          codigo: `RES-G8U${suf}`,
          idUsuario: uDb.id,
          idVehiculo: vMoto.id,
          idTipoVehiculo: 2,
          fechaReserva: new Date(ahora.getTime() - 90 * 60 * 1000),
          fechaLimite: new Date(ahora.getTime() - 60 * 60 * 1000),
          estado: 'UTILIZADA',
          montoAdelanto: 3.00,
          pasarelaPagoId: `chr_g8_uti_${suf}`,
          pasarelaProveedor: 'culqi',
          estadoPago: 'PAGADO'
        },
        {
          codigo: `RES-G8A${suf}`,
          idUsuario: uDb.id,
          idVehiculo: vAuto.id,
          idTipoVehiculo: 1,
          fechaReserva: new Date(ahora.getTime() - 180 * 60 * 1000),
          fechaLimite: new Date(ahora.getTime() - 150 * 60 * 1000),
          fechaAnulacion: new Date(ahora.getTime() - 170 * 60 * 1000),
          estado: 'ANULADA',
          montoAdelanto: 6.00,
          pasarelaPagoId: `chr_g8_anu_${suf}`,
          pasarelaProveedor: 'culqi',
          pasarelaReembolsoId: `ref_g8_anu_${suf}`,
          estadoPago: 'REEMBOLSADO'
        },
        {
          codigo: `RES-G8X${suf}`,
          idUsuario: uDb.id,
          idVehiculo: vMoto.id,
          idTipoVehiculo: 2,
          fechaReserva: new Date(ahora.getTime() - 240 * 60 * 1000),
          fechaLimite: new Date(ahora.getTime() - 210 * 60 * 1000),
          estado: 'VENCIDA',
          montoAdelanto: 3.00,
          pasarelaPagoId: `chr_g8_ven_${suf}`,
          pasarelaProveedor: 'culqi',
          estadoPago: 'PAGADO'
        }
      ]
    });

    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });

    // Login como RECEPCIONISTA
    await page.goto(`${BASE_URL}/#login`);
    await page.waitForSelector('#view-login.active');
    await page.fill('#login-usuario', 'recepcion');
    await page.fill('#login-password', '123456');
    await page.click('#btn-login-submit');
    await page.waitForSelector('#view-dashboard.active');

    // 1. Alerta RESERVADO en #view-ingreso al digitar la placa reservada
    await page.click('#card-modulo-ingreso');
    await page.waitForSelector('#view-ingreso.active');
    await page.fill('#input-placa', placaVig);
    await page.waitForSelector('#aviso-reserva-ingreso:not(.hidden)', { timeout: 8000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '01_alerta_reservado_en_ingreso.png'), fullPage: false });
    console.log('✓ Captura 1: 01_alerta_reservado_en_ingreso.png');

    // 2. Navegar por sidebar a Buscar Reservas en Garita y filtrar por el conductor de prueba (4 estados)
    await page.click('.sidebar-link[data-view="garita-reservas"]');
    await page.waitForSelector('#view-garita-reservas.active');
    await page.fill('#input-buscar-reserva-garita', dniCond);
    await page.click('#btn-buscar-reservas-garita');
    await page.waitForFunction((cod) => {
      const tb = document.getElementById('tbody-garita-reservas');
      return tb && tb.innerText.includes(cod);
    }, codigoVig, { timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '02_garita_buscar_reservas_estados.png'), fullPage: true });
    console.log('✓ Captura 2: 02_garita_buscar_reservas_estados.png');

    // 3. Filtrar por estado VIGENTE + código
    await page.selectOption('#select-estado-reserva-garita', 'VIGENTE');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '03_garita_filtro_vigente.png'), fullPage: false });
    console.log('✓ Captura 3: 03_garita_filtro_vigente.png');

    // 4. Confirmar ingreso desde la tabla de garita
    await page.click('.btn-confirmar-reserva-garita');
    await page.waitForSelector('.toast', { timeout: 10000 });
    const toastTxt = await page.$eval('.toast', (el) => el.textContent);
    console.log('✓ Toast confirmación garita:', toastTxt);
    await page.selectOption('#select-estado-reserva-garita', 'TODOS');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '04_garita_confirmacion_exitosa.png'), fullPage: true });
    console.log('✓ Captura 4: 04_garita_confirmacion_exitosa.png');

    // 5. Verificar estadía vinculada en módulo de Salida con adelanto reflejado
    await page.click('.sidebar-link[data-view="salida"]');
    await page.waitForSelector('#view-salida.active');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '05_salida_estadia_con_reserva.png'), fullPage: false });
    console.log('✓ Captura 5: 05_salida_estadia_con_reserva.png');

    const ests = await prisma.estadia.findMany({ where: { placa: placaVig, horaSalida: null } });
    ests.forEach((e) => idsEstadiasLimpiar.push(e.id));

    console.log('\n🎉 E2E GARITA UPAO-8 COMPLETO (5/5 CAPTURAS OK).');
  } finally {
    if (browser) await browser.close();
    try {
      if (idsEstadiasLimpiar.length > 0) {
        await prisma.estadia.deleteMany({ where: { id: { in: idsEstadiasLimpiar } } });
      }
      const u = await prisma.usuario.findUnique({ where: { usuario: usuarioCond } });
      if (u) {
        await prisma.estadia.deleteMany({ where: { placa: placaVig } });
        await prisma.reserva.deleteMany({ where: { idUsuario: u.id } });
        await prisma.vehiculoConductor.deleteMany({ where: { idUsuario: u.id } });
        await prisma.usuario.delete({ where: { id: u.id } });
      }
    } catch (e) {
      console.error('Aviso limpiando datos E2E garita:', e.message);
    }
    await prisma.$disconnect();
    srv.kill();
  }
}

runE2EGarita().catch((err) => {
  console.error('❌ ERROR E2E GARITA UPAO-8:', err);
  process.exit(1);
});
