/**
 * Test E2E del módulo Ingreso (UPAO-41).
 *
 * Requiere el servidor corriendo (npm run dev) y la BD accesible.
 * Ejecutar:  npm run test:e2e
 * Opciones:  HEADED=1 (navegador visible) · VIDEO=1 (graba video en ./evidencia)
 */
require('dotenv').config();
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === '1';
const VIDEO = process.env.VIDEO === '1';
const PLACAS_PRUEBA = ['ABC-123', 'AB-1234', '1234-AB'];

const prisma = new PrismaClient();

let ok = 0;
let fail = 0;
function check(cond, msg) {
  if (cond) {
    ok++;
    console.log('  [OK]    ' + msg);
  } else {
    fail++;
    console.log('  [FALLA] ' + msg);
  }
}

async function limpiarPrueba() {
  try {
    await prisma.estadia.deleteMany({ where: { placa: { in: PLACAS_PRUEBA } } });
  } catch (e) {
    console.warn('  (aviso) no se pudo limpiar la data de prueba: ' + e.message);
  }
}

async function login(page, usuario) {
  await page.fill('#login-usuario', usuario);
  await page.fill('#login-password', '123456');
  await page.click('#btn-login-submit');
  await page.waitForFunction(
    () => document.getElementById('view-dashboard')?.classList.contains('active'),
    null,
    { timeout: 10000 }
  );
  await page.waitForTimeout(500);
}

(async () => {
  await limpiarPrueba();

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 350 : 0 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ...(VIDEO ? { recordVideo: { dir: 'evidencia', size: { width: 1280, height: 800 } } } : {})
  });
  const page = await context.newPage();

  try {
    console.log('CP-02 Login dueno (admin) -> solo Configurar Tarifas');
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await login(page, 'admin');
    check(await page.isVisible('#card-modulo-tarifas'), 'dueno VE "Configurar Tarifas"');
    check(!(await page.isVisible('#card-modulo-ingreso')), 'dueno NO ve "Registrar Ingreso"');
    await page.click('#btn-logout');
    await page.waitForFunction(() => document.getElementById('view-login')?.classList.contains('active'), null, { timeout: 10000 });
    await page.waitForTimeout(500);

    console.log('CP-01 Login recepcionista (recepcion) -> solo Registrar Ingreso');
    await login(page, 'recepcion');
    check(await page.isVisible('#card-modulo-ingreso'), 'recepcionista VE "Registrar Ingreso"');
    check(!(await page.isVisible('#card-modulo-tarifas')), 'recepcionista NO ve "Configurar Tarifas"');

    console.log('CP-03 Abrir modulo de ingreso');
    await page.click('#card-modulo-ingreso');
    await page.waitForFunction(() => document.getElementById('view-ingreso')?.classList.contains('active'), null, { timeout: 10000 });
    check(await page.isVisible('#form-registrar-ingreso'), 'abre el modulo de ingreso');
    await page.waitForTimeout(500);

    console.log('CP-04 Deteccion auto: ABC123');
    await page.fill('#input-placa', 'ABC123');
    await page.waitForTimeout(700);
    check((await page.inputValue('#input-placa')) === 'ABC-123', 'ABC123 -> ABC-123');
    check((await page.inputValue('#select-tipo-ingreso')) === 'auto', 'tipo preseleccionado Automovil');

    console.log('CP-05 Deteccion moto: AB1234');
    await page.fill('#input-placa', 'AB1234');
    await page.waitForTimeout(700);
    check((await page.inputValue('#input-placa')) === 'AB-1234', 'AB1234 -> AB-1234');
    check((await page.inputValue('#select-tipo-ingreso')) === 'moto', 'tipo preseleccionado Motocicleta');

    console.log('CP-06 Deteccion moto: 1234AB');
    await page.fill('#input-placa', '1234AB');
    await page.waitForTimeout(700);
    check((await page.inputValue('#input-placa')) === '1234-AB', '1234AB -> 1234-AB');

    console.log('CP-07 Bloqueo de espacios');
    await page.fill('#input-placa', 'ABC');
    await page.click('#input-placa');
    await page.keyboard.type(' ');
    await page.waitForTimeout(400);
    check(!(await page.inputValue('#input-placa')).includes(' '), 'no permite escribir espacios');

    console.log('CP-08 Placa vacia -> error');
    await page.fill('#input-placa', '');
    await page.click('#btn-registrar-ingreso');
    await page.waitForTimeout(800);
    const fbVacia = (await page.locator('.input-feedback.visible').first().textContent().catch(() => '')) || '';
    check(/Ingrese la placa/i.test(fbVacia), 'muestra error de placa vacia');

    console.log('CP-09 Placa invalida -> error');
    await page.fill('#input-placa', 'AB1');
    await page.locator('#input-placa').blur();
    await page.waitForTimeout(700);
    const fbInvalida = (await page.locator('.input-feedback.visible').first().textContent().catch(() => '')) || '';
    check(/placa v[aá]lida/i.test(fbInvalida), 'muestra error de formato');

    console.log('CP-10 Registrar ingreso valido');
    await page.fill('#input-placa', 'ABC123');
    await page.waitForTimeout(600);
    await page.click('#btn-registrar-ingreso');
    await page.waitForTimeout(2500);
    const t1 = (await page.locator('.toast').allTextContents()).join(' | ');
    check(/Ingreso registrado/i.test(t1), 'registra y muestra toast verde');

    console.log('CP-11 Duplicado');
    await page.waitForTimeout(4200);
    await page.fill('#input-placa', 'ABC123');
    await page.waitForTimeout(600);
    await page.click('#btn-registrar-ingreso');
    await page.waitForTimeout(2500);
    const t2 = (await page.locator('.toast').allTextContents()).join(' | ');
    check(/ya registra un ingreso activo/i.test(t2), 'bloquea duplicado con toast rojo');

    console.log('');
    console.log('RESULTADO: ' + ok + ' OK, ' + fail + ' FALLA');
  } catch (e) {
    fail++;
    console.error('ERROR en el test: ' + e.message);
  } finally {
    await context.close();
    await browser.close();
    await limpiarPrueba();
    await prisma.$disconnect();
    process.exitCode = fail === 0 ? 0 : 1;
  }
})();
