require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const prisma = require('../src/config/prisma');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const PORT = 3562;
const BASE_URL = `http://localhost:${PORT}`;
const EVIDENCIAS_DIR = path.join(__dirname, '..', 'docs', 'modulos', 'reservas', 'evidencias-anulacion');
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
  throw new Error('El servidor E2E de anulación no respondió a tiempo.');
}

function iniciarMockCulqi() {
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (c) => { rawBody += c; });
    req.on('end', () => {
      let body = {};
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) {}
      if (req.method === 'POST' && req.url === '/v2/refunds') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          id: `ref_e2e_${Date.now()}`,
          object: 'refund',
          charge_id: body.charge_id,
          amount: body.amount,
          reason: body.reason
        }));
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

async function runE2EAnulacion() {
  console.log('================================================================');
  console.log(' PRUEBA E2E: INTERFAZ MIS RESERVAS Y ANULACIÓN CULQI (UPAO-22)');
  console.log('================================================================\n');

  const mock = await iniciarMockCulqi();
  const srv = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      PAYMENT_GATEWAY: 'culqi',
      CULQI_API_BASE: mock.url,
      CULQI_PUBLIC_KEY: 'pk_test_e2e123456789',
      CULQI_SECRET_KEY: 'sk_test_e2e123456789',
      PASARELA_ENCRYPTION_KEY: 'e2e-test-aes256-secret-key-32ch!'
    },
    stdio: 'pipe'
  });

  const capacidadOriginal = obtenerCapacidad();
  const configPasarelaOriginal = await prisma.configuracionPasarela.findUnique({ where: { proveedor: 'culqi' } });
  const suf = String(Date.now()).slice(-4);
  const usuarioE2E = `cond_e2e_${suf}`;
  const dniE2E = `7811${suf}`;
  let browser = null;

  try {
    await esperarServidor();

    const rReg = await fetch(`${BASE_URL}/api/auth/registro-conductor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Conductor Prueba E2E',
        dni: dniE2E,
        celular: '987654321',
        usuario: usuarioE2E,
        contrasena: 'password123'
      })
    });
    const sesion = await rReg.json();
    if (rReg.status !== 201 || !sesion.token) throw new Error(`Fallo registro E2E: ${JSON.stringify(sesion)}`);
    const usuarioDb = await prisma.usuario.findUnique({ where: { usuario: usuarioE2E } });
    const idUsuarioE2E = usuarioDb.id;
    const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` };

    const crearVeh = async (placa, tipo) => {
      const r = await fetch(`${BASE_URL}/api/conductor/vehiculos`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ placa, tipo })
      });
      const d = await r.json();
      if (r.status !== 201) throw new Error(`Fallo vehiculo ${placa}: ${JSON.stringify(d)}`);
      return d;
    };

    const vAuto = await crearVeh(`E2A-${suf.slice(1)}`, 'auto');
    const vMoto = await crearVeh(`1${suf.slice(1)}-9M`, 'moto');

    const ahora = new Date();
    await prisma.reserva.createMany({
      data: [
        {
          codigo: `RES-VIG${suf}`,
          idUsuario: idUsuarioE2E,
          idVehiculo: vAuto.id,
          idTipoVehiculo: 1,
          fechaReserva: ahora,
          fechaLimite: new Date(ahora.getTime() + 30 * 60 * 1000),
          estado: 'VIGENTE',
          montoAdelanto: 6.00,
          pasarelaPagoId: `chr_e2e_vig_${suf}`,
          pasarelaProveedor: 'culqi',
          estadoPago: 'PAGADO'
        },
        {
          codigo: `RES-UTI${suf}`,
          idUsuario: idUsuarioE2E,
          idVehiculo: vMoto.id,
          idTipoVehiculo: 2,
          fechaReserva: new Date(ahora.getTime() - 90 * 60 * 1000),
          fechaLimite: new Date(ahora.getTime() - 60 * 60 * 1000),
          estado: 'UTILIZADA',
          montoAdelanto: 3.00,
          pasarelaPagoId: `chr_e2e_uti_${suf}`,
          pasarelaProveedor: 'culqi',
          estadoPago: 'PAGADO'
        },
        {
          codigo: `RES-ANU${suf}`,
          idUsuario: idUsuarioE2E,
          idVehiculo: vAuto.id,
          idTipoVehiculo: 1,
          fechaReserva: new Date(ahora.getTime() - 180 * 60 * 1000),
          fechaLimite: new Date(ahora.getTime() - 150 * 60 * 1000),
          fechaAnulacion: new Date(ahora.getTime() - 170 * 60 * 1000),
          estado: 'ANULADA',
          montoAdelanto: 6.00,
          pasarelaPagoId: `chr_e2e_anu_${suf}`,
          pasarelaProveedor: 'culqi',
          pasarelaReembolsoId: `ref_e2e_prev_${suf}`,
          estadoPago: 'REEMBOLSADO'
        },
        {
          codigo: `RES-VEN${suf}`,
          idUsuario: idUsuarioE2E,
          idVehiculo: vMoto.id,
          idTipoVehiculo: 2,
          fechaReserva: new Date(ahora.getTime() - 240 * 60 * 1000),
          fechaLimite: new Date(ahora.getTime() - 210 * 60 * 1000),
          estado: 'VENCIDA',
          montoAdelanto: 3.00,
          pasarelaPagoId: `chr_e2e_ven_${suf}`,
          pasarelaProveedor: 'culqi',
          estadoPago: 'PAGADO'
        }
      ]
    });

    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const page = await context.newPage();

    // 1. Vista Pública de Disponibilidad Inicial
    await page.goto(`${BASE_URL}/#disponibilidad`);
    await page.waitForSelector('#card-disponibilidad-autos');
    await page.waitForFunction(() => {
      const el = document.querySelector('#card-disponibilidad-autos .cupos-numero');
      return el && el.textContent.trim() !== '--';
    }, { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '01_disponibilidad_previa_anulacion.png'), fullPage: true });
    console.log('✓ Captura 1: 01_disponibilidad_previa_anulacion.png');

    // 2. Login y navegación a Mis Reservas (Desktop 1280px)
    await page.goto(`${BASE_URL}/#login`);
    await page.waitForSelector('#view-login.active');
    await page.fill('#login-usuario', usuarioE2E);
    await page.fill('#login-password', 'password123');
    await page.click('#btn-login-submit');
    await page.waitForSelector('#view-dashboard.active');
    await page.click('#card-modulo-conductor-reservas');
    await page.waitForSelector('#view-conductor-reservas.active');
    await page.waitForSelector('#tbody-mis-reservas tr');
    await page.waitForTimeout(800);

    const layoutCheck = await page.evaluate(() => {
      const desktop = document.querySelector('.reservas-vista-desktop');
      const mobile = document.querySelector('.reservas-vista-movil');
      const tbl = desktop.querySelector('table');
      return {
        desktopDisplay: getComputedStyle(desktop).display,
        mobileDisplay: getComputedStyle(mobile).display,
        overflow: tbl.scrollWidth > desktop.clientWidth
      };
    });
    console.log('✓ Layout Desktop 1280px:', layoutCheck);
    if (layoutCheck.desktopDisplay !== 'block' || layoutCheck.mobileDisplay !== 'none' || layoutCheck.overflow) {
      throw new Error(`Layout desktop inválido: ${JSON.stringify(layoutCheck)}`);
    }

    await page.locator('#view-conductor-reservas .card.card-table').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '02_interfaz_mis_reservas_4_estados.png'), fullPage: true });
    console.log('✓ Captura 2: 02_interfaz_mis_reservas_4_estados.png');

    // Captura 6: Vista móvil (390px) mostrando solo tarjetas sin tabla duplicada
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const mobileCheck = await page.evaluate(() => ({
      desktopDisplay: getComputedStyle(document.querySelector('.reservas-vista-desktop')).display,
      mobileDisplay: getComputedStyle(document.querySelector('.reservas-vista-movil')).display,
      cards: document.querySelectorAll('.reserva-card').length
    }));
    console.log('✓ Layout Móvil 390px:', mobileCheck);
    if (mobileCheck.desktopDisplay !== 'none' || mobileCheck.mobileDisplay !== 'grid' || mobileCheck.cards !== 4) {
      throw new Error(`Layout móvil inválido: ${JSON.stringify(mobileCheck)}`);
    }
    await page.locator('#contenedor-tarjetas-reservas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '06_interfaz_mis_reservas_movil.png'), fullPage: false });
    console.log('✓ Captura 6: 06_interfaz_mis_reservas_movil.png');

    // Volver a desktop para flujo de anulación
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.waitForTimeout(300);

    // 3. Abrir modal de confirmación explícita
    const btnAnular = page.locator('.reservas-vista-desktop .btn-anular').first();
    await btnAnular.click();
    await page.waitForSelector('#modal-anular:not(.hidden)');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '03_modal_confirmacion_anulacion.png'), fullPage: false });
    console.log('✓ Captura 3: 03_modal_confirmacion_anulacion.png');

    // 4. Confirmar anulación
    await page.click('#btn-confirmar-anular');
    await page.waitForSelector('.toast', { timeout: 10000 });
    const toastTexto = await page.$eval('.toast', (el) => el.textContent);
    console.log('✓ Toast recibido:', toastTexto);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '04_anulacion_exitosa_toast_y_cambio_estado.png'), fullPage: true });
    console.log('✓ Captura 4: 04_anulacion_exitosa_toast_y_cambio_estado.png');

    // 5. Disponibilidad pública recalculada
    await page.goto(`${BASE_URL}/#disponibilidad`);
    await page.waitForSelector('#card-disponibilidad-autos');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, '05_disponibilidad_recalculada_tiempo_real.png'), fullPage: true });
    console.log('✓ Captura 5: 05_disponibilidad_recalculada_tiempo_real.png');

    console.log('\n🎉 E2E UPAO-22 COMPLETO (6/6 CAPTURAS Y VALIDACIONES RESPONSIVE OK).');
  } finally {
    if (browser) await browser.close();
    try {
      const u = await prisma.usuario.findUnique({ where: { usuario: usuarioE2E } });
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
      console.error('Aviso limpiando datos E2E:', e.message);
    }
    try { guardarCapacidad(capacidadOriginal); } catch (_) {}
    await prisma.$disconnect();
    srv.kill();
    mock.server.close();
  }
}

runE2EAnulacion().catch((err) => {
  console.error('❌ ERROR E2E UPAO-22:', err);
  process.exit(1);
});
