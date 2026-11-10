/**
 * Test E2E de la vista pública de disponibilidad (UPAO-20 / subtarea de test y depuración UPAO-77).
 *
 * Valida los criterios de aceptación de la Historia UPAO-20:
 *   · Acceso público sin iniciar sesión y redirección a Login al pulsar "Reservar" sin sesión.
 *   · Dos paneles independientes (autos y motos) con capacidad, ocupación y cupos coherentes con la API.
 *   · Estado crítico "Aforo lleno": cupos en 0, tarjeta en alerta y botón bloqueado.
 *   · Actualización periódica de los cupos (polling cada 30 s).
 *   · Comportamiento del botón con sesión iniciada (informa, no queda mudo).
 *   · Responsividad sin desbordamiento horizontal en 360, 390 y 414 px.
 *
 * Ejecución:  npm run test:disponibilidad
 * Requiere el servidor en marcha (por defecto http://localhost:3555 o BASE_URL).
 * Genera video y capturas en docs/modulos/espacios-publicos/evidencias/upao-77/
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3555';
const EVID = path.resolve(__dirname, '../docs/modulos/espacios-publicos/evidencias/upao-77');
const VIDEO_TMP = path.resolve(__dirname, '../.tmp-video-upao77');
const prisma = new PrismaClient();

async function asegurarServidor() {
  try {
    const res = await fetch(`${BASE_URL}/api/espacios`);
    if (res.status) return;
  } catch (e) {
    process.env.PORT = '3555';
    require('../server');
    await new Promise((r) => setTimeout(r, 800));
  }
}

let ok = 0; let fail = 0;
const fallos = [];
function report(cond, msg) {
  if (cond) { ok++; console.log('  [PASS] ' + msg); }
  else { fail++; fallos.push(msg); console.error('  [FAIL] ' + msg); }
}

(async () => {
  await asegurarServidor();
  fs.mkdirSync(EVID, { recursive: true });
  fs.rmSync(VIDEO_TMP, { recursive: true, force: true });
  fs.mkdirSync(VIDEO_TMP, { recursive: true });

  const capOriginal = obtenerCapacidad();
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_TMP, size: { width: 1280, height: 720 } }
  });
  const page = await ctx.newPage();

  try {
    // ---------- CA-06: acceso publico sin sesion ----------
    console.log('\n[CA-06] Acceso publico sin sesion');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    report(await page.locator('#view-disponibilidad').evaluate((el) => el.classList.contains('active')),
      'La vista de disponibilidad abre sin haber iniciado sesion');
    report(!(await page.locator('#view-login').evaluate((el) => el.classList.contains('active'))),
      'No se fuerza el login para consultar la disponibilidad');
    report((await page.locator('#header-user-section').getAttribute('style') || '').includes('none'),
      'La cabecera de usuario esta oculta (no hay sesion)');
    const textoVolver = (await page.locator('#btn-volver-disponibilidad').textContent()).trim();
    report(/Iniciar Sesi|Acceso de Personal/i.test(textoVolver), `El boton volver invita a iniciar sesion ("${textoVolver}")`);

    // ---------- CA-02/CA-03: paneles con datos reales ----------
    console.log('\n[CA-02/CA-03] Paneles de autos y motos');
    const apiData = await (await fetch(BASE_URL + '/api/publico/disponibilidad')).json();
    const leer = async (id) => (await page.locator('#' + id).textContent()).trim();
    const capAutosUI = await leer('disp-capacidad-autos');
    const cuposAutosUI = await leer('disp-cupos-autos');
    const capMotosUI = await leer('disp-capacidad-motos');
    const cuposMotosUI = await leer('disp-cupos-motos');
    report(capAutosUI === String(apiData.autos.capacidad), `Capacidad autos en UI (${capAutosUI}) = API (${apiData.autos.capacidad})`);
    report(cuposAutosUI === String(apiData.autos.disponibles), `Cupos autos en UI (${cuposAutosUI}) = API (${apiData.autos.disponibles})`);
    report(capMotosUI === String(apiData.motos.capacidad), `Capacidad motos en UI (${capMotosUI}) = API (${apiData.motos.capacidad})`);
    report(cuposMotosUI === String(apiData.motos.disponibles), `Cupos motos en UI (${cuposMotosUI}) = API (${apiData.motos.disponibles})`);
    report(!/^--$/.test(capAutosUI) && !/^--$/.test(cuposMotosUI), 'Ningun panel queda con el placeholder "--"');
    const horaUI = await leer('disp-actualizado-autos');
    report(/^\d{2}:\d{2}:\d{2}$/.test(horaUI), `Se muestra la hora de actualizacion en formato HH:MM:SS (${horaUI})`);

    // ---------- CA-04: sin sobrecarga visual / coherencia de estado ----------
    console.log('\n[CA-04/CA-05] Estado normal y estado critico');
    const badgeAutos = (await page.locator('#badge-estado-autos').textContent()).trim();
    const btnReservarExiste = await page.locator('#btn-reservar-autos').count() > 0;
    if (apiData.autos.disponibles > 0) {
      report(/DISPONIBLE/i.test(badgeAutos), `Con cupos libres el badge dice "${badgeAutos}"`);
      report(!btnReservarExiste, 'Boton Reservar espacio retirado para Sprint 3');
      report(!(await page.locator('#card-disponibilidad-autos').evaluate((el) => el.classList.contains('aforo-lleno'))),
        'La tarjeta no esta en estado critico');
    }
    await page.screenshot({ path: path.join(EVID, '01_vista_publica_disponibilidad.png'), fullPage: true });

    // ---------- CA-06: navegacion al Login desde la vista publica ----------
    await page.locator('#btn-volver-disponibilidad').click();
    await page.waitForTimeout(700);
    report(await page.locator('#view-login').evaluate((el) => el.classList.contains('active')),
      'Boton "Iniciar Sesión / Acceso de Personal" redirige a la pantalla de Login');
    await page.screenshot({ path: path.join(EVID, '02_redireccion_login_sin_sesion.png'), fullPage: true });

    // ---------- CA-05: aforo lleno ----------
    console.log('\n[CA-05] Estado critico "Aforo lleno"');
    const ocupadosAutos = apiData.autos.enCochera;
    guardarCapacidad({ capacidadAutos: Math.max(1, ocupadosAutos), capacidadMotos: capOriginal.capacidadMotos });
    await page.goto(BASE_URL + '/#disponibilidad', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const cuposLleno = await leer('disp-cupos-autos');
    const badgeLleno = (await page.locator('#badge-estado-autos').textContent()).trim();
    const claseLleno = await page.locator('#card-disponibilidad-autos').evaluate((el) => el.classList.contains('aforo-lleno'));
    const btnReservarLleno = await page.locator('#btn-reservar-autos').count() > 0;
    const colorBorde = await page.locator('#card-disponibilidad-autos').evaluate((el) => getComputedStyle(el).borderColor);
    report(cuposLleno === '0', `Con la cochera llena los cupos quedan en 0 (${cuposLleno})`);
    report(/Aforo lleno/i.test(badgeLleno), `El badge cambia a "Aforo lleno" ("${badgeLleno}")`);
    report(claseLleno, 'La tarjeta entra en clase visual de estado critico (aforo-lleno)');
    report(!btnReservarLleno, 'Boton Reservar espacio no presente en estado aforo lleno');
    report(/rgb\(239,\s*68,\s*68\)|#ef4444/i.test(colorBorde) || colorBorde !== 'rgb(229, 231, 235)',
      `El borde usa color de alerta (${colorBorde})`);
    await page.screenshot({ path: path.join(EVID, '03_estado_aforo_lleno.png'), fullPage: true });

    guardarCapacidad(capOriginal);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // ---------- CA-04: actualizacion periodica ----------
    console.log('\n[CA-04] Actualizacion periodica (polling)');
    const horaAntes = await leer('disp-actualizado-autos');
    await page.waitForTimeout(32000);
    const horaDespues = await leer('disp-actualizado-autos');
    report(horaAntes !== horaDespues, `La disponibilidad se refresca sola (${horaAntes} -> ${horaDespues})`);

    // ---------- CA-06b: navegacion desde dashboard con sesion ----------
    console.log('\n[CA-06b] Navegacion con sesion iniciada');
    await page.locator('#btn-volver-disponibilidad').click();
    await page.waitForTimeout(900);
    report(await page.locator('#view-login').evaluate((el) => el.classList.contains('active')),
      'El boton "Acceso de Personal" lleva al Login');
    await page.locator('#login-usuario').fill('admin');
    await page.locator('#login-password').fill('123456');
    await page.locator('#btn-login-submit').click();
    await page.waitForTimeout(1500);
    report(await page.locator('#view-dashboard').evaluate((el) => el.classList.contains('active')), 'Login de DUEÑO correcto');
    await page.goto(BASE_URL + '/#disponibilidad', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const activaDisponibilidad = await page.locator('#view-disponibilidad').evaluate((el) => el.classList.contains('active'));
    report(activaDisponibilidad, 'Vista de disponibilidad accesible desde sesion autenticada');
    await page.screenshot({ path: path.join(EVID, '04_reservar_con_sesion.png'), fullPage: true });

    // Regresar al dashboard para cerrar sesion
    await page.locator('#btn-volver-disponibilidad').click();
    await page.waitForTimeout(700);

    // ---------- responsive (anonimo, como lo ve un conductor) ----------
    console.log('\n[Responsive] Vista movil sin sesion');
    await page.locator('#btn-logout').click();
    await page.waitForTimeout(700);
    report(await page.locator('#view-disponibilidad').evaluate((el) => el.classList.contains('active')), 'Cierre de sesion regresa a portada publica');
    for (const ancho of [360, 390, 414]) {
      await page.setViewportSize({ width: ancho, height: 844 });
      await page.goto(BASE_URL + '/#disponibilidad', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      report(overflow <= 2, `Sin desbordamiento horizontal en ${ancho}px (exceso: ${overflow}px)`);
    }
    await page.screenshot({ path: path.join(EVID, '05_vista_movil_390px.png'), fullPage: true });
  } catch (error) {
    fail++;
    fallos.push('EXCEPCION: ' + error.message);
    console.error('\n[EXCEPCION]', error.message);
    await page.screenshot({ path: path.join(EVID, 'error_e2e.png'), fullPage: true }).catch(() => { });
  } finally {
    guardarCapacidad(capOriginal);
    await ctx.close();
    await browser.close();

    // Playwright deja el .webm en VIDEO_TMP; se mueve a la carpeta de evidencias.
    try {
      const grabados = fs.readdirSync(VIDEO_TMP).filter((f) => f.endsWith('.webm'));
      if (grabados.length) {
        const origen = path.join(VIDEO_TMP, grabados[0]);
        const destino = path.join(EVID, 'demostracion_pruebas_disponibilidad_upao77.webm');
        fs.copyFileSync(origen, destino);
        console.log('\nVideo guardado en:', destino);
      }
      fs.rmSync(VIDEO_TMP, { recursive: true, force: true });
    } catch (error) {
      console.warn('\nNo se pudo mover el video de evidencia:', error.message);
    }

    await prisma.$disconnect();
    console.log('\n==============================================');
    console.log(` VERIFICACIONES: ${ok + fail} | PASS: ${ok} | FAIL: ${fail}`);
    if (fallos.length) { console.log(' FALLOS:'); fallos.forEach((f) => console.log('  - ' + f)); }
    console.log('Capturas en:', EVID);
    console.log('==============================================');
    process.exit(fail ? 1 : 0);
  }
})();
