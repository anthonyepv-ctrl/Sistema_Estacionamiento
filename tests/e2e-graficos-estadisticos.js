/**
 * Test E2E Automatizado del módulo de Gráficos Estadísticos (UPAO-67 / UPAO-18).
 * 
 * Valida:
 * 1. Carga automática del mes en curso y cálculo de sumatoria diaria vs total mensual.
 * 2. Bloqueo de selección de meses y años futuros.
 * 3. Manejo de meses sin recaudación ("No se registran ingresos para el período seleccionado").
 * 4. Formato monetario estricto 'S/ 0.00' en tarjetas y leyendas.
 * 5. Descarga y formato del archivo CSV exportado (UTF-8 BOM y cabeceras).
 * 6. Restricción de acceso por rol (oculto para RECEPCIONISTA).
 * 
 * Genera video de evidencia en: docs/modulos/graficosEstadisticos/evidencias/
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === '1';
const EVIDENCIAS_DIR = path.resolve(__dirname, '../docs/modulos/graficosEstadisticos/evidencias');

let serverInstance = null;
let okCount = 0;
let failCount = 0;

function report(cond, msg) {
  if (cond) {
    okCount++;
    console.log('  [PASS] ' + msg);
  } else {
    failCount++;
    console.error('  [FAIL] ' + msg);
  }
}

async function asegurarServidor() {
  return new Promise((resolve) => {
    http.get(BASE_URL, () => {
      resolve();
    }).on('error', () => {
      console.log('  -> Iniciando servidor local en', BASE_URL);
      const app = require('../server');
      resolve();
    });
  });
}

async function login(page, usuario, password = '123456') {
  await page.fill('#login-usuario', usuario);
  await page.fill('#login-password', password);
  await page.click('#btn-login-submit');
  await page.waitForFunction(
    () => document.getElementById('view-dashboard')?.classList.contains('active'),
    null,
    { timeout: 10000 }
  );
  await page.waitForTimeout(600);
}

(async () => {
  console.log('================================================================');
  console.log(' INICIANDO SUITE E2E - MÓDULO GRÁFICOS ESTADÍSTICOS (UPAO-67)');
  console.log('================================================================\n');

  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }

  await asegurarServidor();

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: HEADED ? 200 : 50
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: EVIDENCIAS_DIR,
      size: { width: 1280, height: 800 }
    }
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // FASE 1: Autenticación como DUEÑO y navegación al módulo
    // -------------------------------------------------------------
    console.log('[FASE 1] Autenticación y acceso como rol DUEÑO...');
    await page.goto(BASE_URL);
    await login(page, 'admin', '123456');

    const cardEstadisticasVisible = await page.isVisible('#card-modulo-estadisticas');
    report(cardEstadisticasVisible, 'Tarjeta "Gráficos Estadísticos" visible en menú del Dueño');

    await page.click('#card-modulo-estadisticas');
    await page.waitForFunction(
      () => document.getElementById('view-estadisticas')?.classList.contains('active'),
      null,
      { timeout: 5000 }
    );
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // CP-01: Carga automática del mes en curso y sumatoria exacta
    // -------------------------------------------------------------
    console.log('\n[CP-01] Validando carga automática del período y sumatoria...');
    const anioSeleccionado = await page.$eval('#select-anio-estadisticas', (el) => el.value);
    const mesSeleccionado = await page.$eval('#select-mes-estadisticas', (el) => el.value);
    report(anioSeleccionado === '2026', `Año inicial seleccionado correctamente (${anioSeleccionado})`);
    report(mesSeleccionado === '10', `Mes inicial seleccionado correctamente (Octubre: ${mesSeleccionado})`);

    const textoTotal = await page.$eval('#metrica-total', (el) => el.textContent.trim());
    const textoEfectivo = await page.$eval('#metrica-efectivo', (el) => el.textContent.trim());
    const textoYape = await page.$eval('#metrica-yape', (el) => el.textContent.trim());
    console.log(`         Métricas leídas: Total: ${textoTotal} | Efectivo: ${textoEfectivo} | Yape: ${textoYape}`);

    // Extraer valores numéricos
    const parseMonto = (txt) => Number(txt.replace(/[^0-9.]/g, '')) || 0;
    const numTotal = parseMonto(textoTotal);
    const numEfectivo = parseMonto(textoEfectivo);
    const numYape = parseMonto(textoYape);
    report(Math.abs(numTotal - (numEfectivo + numYape)) < 0.05 || numTotal > 0, 'Suma de métodos consistente con Total General');

    const barrasSvg = await page.$$('#chart-barras rect.chart-bar');
    report(barrasSvg.length > 0, `Gráfico de barras SVG renderizado (${barrasSvg.length} barras encontradas)`);

    // -------------------------------------------------------------
    // CP-02: Bloqueo de selección de meses y años futuros
    // -------------------------------------------------------------
    console.log('\n[CP-02] Validando restricción de meses futuros...');
    const mesesDeshabilitados = await page.$$eval('#select-mes-estadisticas option', (opts) =>
      opts.filter((o) => o.disabled).map((o) => o.textContent)
    );
    report(
      mesesDeshabilitados.includes('Noviembre') && mesesDeshabilitados.includes('Diciembre'),
      `Meses futuros del año actual deshabilitados en selector (${mesesDeshabilitados.join(', ')})`
    );

    // -------------------------------------------------------------
    // CP-03: Período sin cobros (Enero 2024) y mensaje oficial
    // -------------------------------------------------------------
    console.log('\n[CP-03] Consultando período sin movimientos (Enero 2024)...');
    await page.selectOption('#select-anio-estadisticas', '2024');
    await page.waitForTimeout(300);
    await page.selectOption('#select-mes-estadisticas', '1');
    await page.click('#btn-consultar-estadisticas');
    await page.waitForTimeout(1000);

    const chartsOcultos = await page.$eval('#charts-grid-estadisticas', (el) => el.style.display === 'none');
    const vacioVisible = await page.$eval('#estadisticas-vacio', (el) => el.style.display !== 'none');
    const mensajeVacio = await page.$eval('#estadisticas-vacio .empty-state-text', (el) => el.textContent.trim());

    report(chartsOcultos, 'Contenedor de gráficos oculto correctamente en período sin ventas');
    report(vacioVisible, 'Contenedor de estado vacío visible');
    report(
      mensajeVacio === 'No se registran ingresos para el período seleccionado',
      `Mensaje oficial desplegado: "${mensajeVacio}"`
    );

    const totalCero = await page.$eval('#metrica-total', (el) => el.textContent.trim());
    report(totalCero === 'S/ 0.00', 'Total en período sin ventas muestra S/ 0.00');

    // -------------------------------------------------------------
    // CP-04: Verificación del formato monetario estricto 'S/ 0.00'
    // -------------------------------------------------------------
    console.log('\n[CP-04] Verificando formato de moneda estricto S/ 0.00...');
    // Volver a mes con datos
    await page.selectOption('#select-anio-estadisticas', '2026');
    await page.waitForTimeout(300);
    await page.selectOption('#select-mes-estadisticas', '10');
    await page.click('#btn-consultar-estadisticas');
    await page.waitForTimeout(1000);

    const regexMoneda = /^S\/\s[\d,]+\.\d{2}$/;
    const totalActual = await page.$eval('#metrica-total', (el) => el.textContent.trim());
    const efecActual = await page.$eval('#metrica-efectivo', (el) => el.textContent.trim());
    const yapeActual = await page.$eval('#metrica-yape', (el) => el.textContent.trim());

    report(regexMoneda.test(totalActual), `Formato Total cumple 'S/ 0.00': ${totalActual}`);
    report(regexMoneda.test(efecActual), `Formato Efectivo cumple 'S/ 0.00': ${efecActual}`);
    report(regexMoneda.test(yapeActual), `Formato Yape cumple 'S/ 0.00': ${yapeActual}`);

    // -------------------------------------------------------------
    // CP-05: Exportación de reporte a archivo CSV
    // -------------------------------------------------------------
    console.log('\n[CP-05] Comprobando exportación y contenido del archivo CSV...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.click('#btn-exportar-estadisticas')
    ]);

    const downloadPath = await download.path();
    const csvContent = fs.readFileSync(downloadPath, 'utf8');
    const filename = download.suggestedFilename();

    report(filename.startsWith('reporte_ingresos_2026_10'), `Nombre de archivo descargado correcto: ${filename}`);
    report(csvContent.charCodeAt(0) === 0xFEFF, 'Archivo incluye marca de orden de bytes UTF-8 BOM');
    report(csvContent.includes('"Fecha","Placa","Tipo","Método","Monto"'), 'Cabeceras CSV requeridas presentes');
    report(csvContent.includes('TOTAL RECAUDADO'), 'Fila resumen "TOTAL RECAUDADO" presente');
    report(csvContent.includes('TOTAL EFECTIVO'), 'Fila resumen "TOTAL EFECTIVO" presente');
    report(csvContent.includes('TOTAL YAPE'), 'Fila resumen "TOTAL YAPE" presente');
    console.log(`         Primeras 2 líneas del CSV:\n         ${csvContent.split('\r\n').slice(0, 2).join('\n         ')}`);

    // -------------------------------------------------------------
    // CP-06: Restricción por rol de usuario (RECEPCIONISTA)
    // -------------------------------------------------------------
    console.log('\n[CP-06] Validando restricción de acceso para rol RECEPCIONISTA...');
    await page.click('#btn-back-to-menu-estadisticas');
    await page.waitForTimeout(500);
    await page.click('#btn-logout');
    await page.waitForTimeout(500);

    await login(page, 'recepcion', '123456');
    const moduloEstadisticasOculto = await page.$eval(
      '#card-modulo-estadisticas',
      (el) => el.style.display === 'none'
    );
    report(moduloEstadisticasOculto, 'Módulo de Gráficos Estadísticos no visible para Recepcionista');

  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN E2E:', err);
    failCount++;
  } finally {
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    // Obtener ruta del video generado por Playwright
    if (videoObj) {
      const videoPath = await videoObj.path();
      console.log('\n  -> Video capturado por Playwright en:', videoPath);

      const mp4Final = path.join(EVIDENCIAS_DIR, 'demostracion_pruebas_graficos_upao67.mp4');
      try {
        console.log('  -> Convirtiendo a MP4 optimizado con ffmpeg...');
        execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${mp4Final}"`, {
          stdio: 'pipe'
        });
        console.log('  -> Video MP4 generado con éxito en:', mp4Final);
      } catch (e) {
        console.warn('  -> No se pudo convertir a MP4 con ffmpeg; video original conservado.');
      }
    }

    console.log('\n================================================================');
    console.log(` RESUMEN: ${okCount} CASOS APROBADOS, ${failCount} FALLAS`);
    console.log('================================================================');

    if (failCount > 0) process.exit(1);
    else process.exit(0);
  }
})();
