/**
 * Prueba de concurrencia del aforo — regresión del defecto DEF-77-10 (UPAO-77).
 *
 * Deja la capacidad de autos en (ocupados + 1) y dispara dos ingresos simultáneos de
 * placas distintas. Solo uno debe entrar; el otro debe recibir 409 y el local no debe
 * superar la capacidad configurada.
 *
 * Antes de la corrección ambas peticiones respondían 201 y el estacionamiento quedaba
 * con más vehículos que plazas. La solución es un advisory lock por tipo de vehículo
 * dentro de la transacción de ingreso (src/routes/ingresos.js).
 *
 * Ejecución:  npm run test:concurrencia
 * Requiere el servidor en marcha (BASE_URL, por defecto http://localhost:3555).
 * Escribe y borra sus propios registros (placas con prefijo ZZA).
 */
require('dotenv').config();
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { obtenerCapacidad, guardarCapacidad } = require('../src/config/espacios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3555';
const prisma = new PrismaClient();
const PREFIJO = 'ZZA';

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

async function iniciarSesion() {
  const r = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: process.env.TEST_USUARIO || 'admin',
      contrasena: process.env.TEST_CONTRASENA || '123456'
    })
  });
  const data = await r.json();
  if (!data.token) throw new Error('No se obtuvo token de sesión en el login.');
  return data.token;
}

async function ingresar(placa, token) {
  const r = await fetch(BASE_URL + '/api/ingresos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ placa, tipo: 'auto' })
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function limpiar() {
  const estadias = await prisma.estadia.findMany({ where: { placa: { startsWith: PREFIJO } }, select: { id: true } });
  for (const estadia of estadias) {
    const pagos = await prisma.pago.findMany({ where: { estadia: { id: estadia.id } }, select: { id: true } });
    await prisma.estadia.delete({ where: { id: estadia.id } }).catch(() => { });
    if (pagos.length) await prisma.pago.deleteMany({ where: { id: { in: pagos.map((p) => p.id) } } });
  }
}

(async () => {
  await asegurarServidor();
  const capacidadOriginal = obtenerCapacidad();
  await limpiar();
  const token = await iniciarSesion();
  const tipoAuto = await prisma.tipoVehiculo.findUnique({ where: { nombre: 'Automóvil / Camioneta' } });

  try {
    const ocupados = await prisma.estadia.count({ where: { idTipoVehiculo: tipoAuto.id, horaSalida: null } });
    guardarCapacidad({ capacidadAutos: ocupados + 1, capacidadMotos: capacidadOriginal.capacidadMotos });

    console.log('[CONC-01] Dos ingresos simultáneos con 1 cupo libre');
    console.log(`          estado inicial: ${ocupados} autos dentro, capacidad ${ocupados + 1}`);

    const [a, b] = await Promise.all([
      ingresar(`${PREFIJO}-111`, token),
      ingresar(`${PREFIJO}-222`, token)
    ]);

    const dentroDespues = await prisma.estadia.count({
      where: { idTipoVehiculo: tipoAuto.id, horaSalida: null }
    });
    const codigos = [a.status, b.status].sort();

    console.log(`          respuestas: ${a.status} y ${b.status}`);
    console.log(`          autos dentro al final: ${dentroDespues} (máximo ${ocupados + 1})`);

    assert.deepStrictEqual(codigos, [201, 409], `Se esperaba 201 + 409 y se obtuvo ${codigos.join(' + ')}`);
    assert.ok(
      dentroDespues <= ocupados + 1,
      `Sobrecupo: hay ${dentroDespues} autos con capacidad para ${ocupados + 1}`
    );

    console.log('  [PASS] Solo un vehículo entra; el segundo se rechaza y no se supera el aforo.');
  } finally {
    await limpiar();
    guardarCapacidad(capacidadOriginal);
    const dentroFinal = await prisma.estadia.count({
      where: { idTipoVehiculo: tipoAuto.id, horaSalida: null }
    });
    console.log(`\nLimpieza: ${dentroFinal} autos dentro; capacidad restaurada a ${JSON.stringify(obtenerCapacidad())}`);
    await prisma.$disconnect();
  }

  console.log('\nRESULTADO: concurrencia del aforo OK.');
  process.exit(0);
})().catch(async (error) => {
  console.error('\n[FALLO]', error.message);
  await limpiar().catch(() => { });
  await prisma.$disconnect();
  process.exit(1);
});
