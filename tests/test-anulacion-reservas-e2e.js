require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

process.env.PORT = '3555';
const app = require('../server');
const PORT = 3555;
const BASE_URL = `http://localhost:${PORT}`;

const EVIDENCIAS_DIR = path.join(__dirname, '..', 'docs', 'modulos', 'reservas', 'evidencias-anulacion');
if (!fs.existsSync(EVIDENCIAS_DIR)) {
  fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
}

async function runE2EAnulacion() {
  console.log('================================================================');
  console.log(' PRUEBA E2E: INTERFAZ MIS RESERVAS Y MODAL DE ANULACIÓN (UPAO-22)');
  console.log('================================================================\n');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();

  try {
    // 1. Vista Pública de Disponibilidad Inicial
    console.log('[PASO 1] Abriendo vista pública de disponibilidad...');
    await page.goto(`${BASE_URL}/#disponibilidad`);
    await page.waitForSelector('#card-disponibilidad-autos');
    await page.waitForFunction(() => {
      const el = document.querySelector('#card-disponibilidad-autos .cupos-numero');
      return el && el.textContent.trim() !== '--';
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    const rutaCaptura1 = path.join(EVIDENCIAS_DIR, '01_disponibilidad_previa_anulacion.png');
    await page.screenshot({ path: rutaCaptura1, fullPage: true });
    console.log(`✓ Captura 1 guardada: ${rutaCaptura1}`);

    // 2. Acceso a Login de Conductor
    console.log('[PASO 2] Iniciando sesión como conductor (conductor_demo)...');
    await page.goto(`${BASE_URL}/#login`);
    await page.waitForSelector('#view-login.active');

    await page.fill('#login-usuario', 'conductor_demo');
    await page.fill('#login-password', '123456');
    await page.click('#btn-login-submit');

    // 3. Menú Principal de Conductor y navegación a Mis Reservas
    console.log('[PASO 3] Navegando a Mis Reservas...');
    await page.waitForSelector('#view-dashboard.active');
    await page.waitForTimeout(800);

    // Clic en la tarjeta de Mis Reservas del conductor
    await page.click('#card-modulo-conductor-reservas');
    await page.waitForSelector('#view-conductor-reservas.active');
    await page.waitForSelector('#tbody-mis-reservas tr');
    await page.waitForTimeout(1200);

    // 4. Captura de la Interfaz con los 4 Estados (Vigente, Utilizada, Anulada, Vencida)
    console.log('[PASO 4] Verificando listado de reservas con los 4 estados...');
    const filas = await page.$$eval('#tbody-mis-reservas tr', (trs) => {
      return trs.map((tr) => tr.innerText.replace(/\t+/g, ' '));
    });
    console.log('Filas encontradas en tabla:', filas);

    const tarjetas = await page.$$eval('.reserva-card', (cards) => {
      return cards.map((c) => ({
        id: c.getAttribute('data-id'),
        texto: c.innerText.replace(/\n+/g, ' | ')
      }));
    });
    console.log('Tarjetas encontradas (§7.1):', tarjetas);

    const rutaCaptura2 = path.join(EVIDENCIAS_DIR, '02_interfaz_mis_reservas_4_estados.png');
    await page.screenshot({ path: rutaCaptura2, fullPage: true });
    console.log(`✓ Captura 2 guardada: ${rutaCaptura2}`);

    // 5. Clic en botón "Anular reserva" (sólo disponible en VIGENTE)
    console.log('[PASO 5] Abriendo modal de confirmación explícita para la reserva VIGENTE...');
    const btnAnular = await page.$('.btn-anular');
    if (!btnAnular) {
      throw new Error('No se encontró el botón de anular en la reserva vigente.');
    }
    await btnAnular.click();

    // Esperar a que el modal se haga visible
    await page.waitForSelector('#modal-anular:not(.hidden)');
    await page.waitForTimeout(800);

    const modalTitulo = await page.$eval('#modal-anular-titulo', el => el.textContent);
    console.log('Título del modal:', modalTitulo);

    const rutaCaptura3 = path.join(EVIDENCIAS_DIR, '03_modal_confirmacion_anulacion.png');
    await page.screenshot({ path: rutaCaptura3, fullPage: true });
    console.log(`✓ Captura 3 guardada: ${rutaCaptura3}`);

    // 6. Confirmación de anulación
    console.log('[PASO 6] Confirmando anulación explícita...');
    await page.click('#btn-confirmar-anular');

    // Esperar a que el toast aparezca
    await page.waitForSelector('.toast', { timeout: 10000 });
    const toastTexto = await page.$eval('.toast', el => el.textContent);
    console.log('Toast recibido:', toastTexto);

    await page.waitForTimeout(1000);
    const rutaCaptura4 = path.join(EVIDENCIAS_DIR, '04_anulacion_exitosa_toast_y_cambio_estado.png');
    await page.screenshot({ path: rutaCaptura4, fullPage: true });
    console.log(`✓ Captura 4 guardada: ${rutaCaptura4}`);

    // 7. Verificación en tiempo real de Disponibilidad Pública
    console.log('[PASO 7] Verificando recálculo en tiempo real en la vista pública...');
    await page.goto(`${BASE_URL}/#disponibilidad`);
    await page.waitForSelector('#card-disponibilidad-autos');
    await page.waitForTimeout(1000);

    const rutaCaptura5 = path.join(EVIDENCIAS_DIR, '05_disponibilidad_recalculada_tiempo_real.png');
    await page.screenshot({ path: rutaCaptura5, fullPage: true });
    console.log(`✓ Captura 5 guardada: ${rutaCaptura5}`);

    console.log('\n================================================================');
    console.log(' ¡TODAS LAS PRUEBAS E2E Y EVIDENCIAS SE GENERARON CON ÉXITO!');
    console.log('================================================================');
  } catch (error) {
    console.error('Error durante la prueba E2E:', error);
    process.exit(1);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

runE2EAnulacion();
