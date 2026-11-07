/**
 * Prueba de integridad del cobro — regresión del defecto DEF-77-09 (UPAO-77).
 *
 * Comprueba que un doble envío simultáneo de "Registrar salida" sobre la misma estadía
 * NO genera dos pagos. Antes de la corrección se creaban dos registros en `pago`, uno de
 * ellos huérfano, y la recaudación de los reportes quedaba inflada.
 *
 * Ejecución:  npm run test:integridad
 * Requiere el servidor en marcha (BASE_URL, por defecto http://localhost:3555).
 * Escribe y borra sus propios registros (placas con prefijo ZZT) en la base de datos configurada.
 */
require('dotenv').config();
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3555';
const prisma = new PrismaClient();
const PREFIJO = 'ZZT';

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

async function post(ruta, cuerpo) {
  const r = await fetch(BASE_URL + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  let data = null;
  try { data = JSON.parse(texto); } catch { data = texto; }
  return { status: r.status, data };
}

async function limpiar() {
  const estadias = await prisma.estadia.findMany({
    where: { placa: { startsWith: PREFIJO } },
    select: { id: true }
  });
  for (const estadia of estadias) {
    const pagos = await prisma.pago.findMany({ where: { estadia: { id: estadia.id } }, select: { id: true } });
    await prisma.estadia.delete({ where: { id: estadia.id } }).catch(() => { });
    if (pagos.length) await prisma.pago.deleteMany({ where: { id: { in: pagos.map((p) => p.id) } } });
  }
  const huerfanos = await prisma.pago.findMany({
    where: { estadia: null },
    select: { id: true },
    orderBy: { id: 'desc' },
    take: 10
  });
  if (huerfanos.length) await prisma.pago.deleteMany({ where: { id: { in: huerfanos.map((p) => p.id) } } });
}

(async () => {
  await asegurarServidor();
  await limpiar();

  const tipoAuto = await prisma.tipoVehiculo.findUnique({ where: { nombre: 'Automóvil / Camioneta' } });
  const tarifa = await prisma.tarifa.findFirst({ where: { idTipoVehiculo: tipoAuto.id }, orderBy: { id: 'asc' } });
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  const pagosAntes = await prisma.pago.count();

  const estadia = await prisma.estadia.create({
    data: {
      placa: `${PREFIJO}-IDEM`,
      idTipoVehiculo: tipoAuto.id,
      idTarifa: tarifa.id,
      idUsuario: usuario.id,
      horaIngreso: new Date(Date.now() - 90 * 60 * 1000)
    }
  });

  try {
    const [a, b] = await Promise.all([
      post('/api/salidas', { estadiaId: estadia.id, metodoPago: 'Efectivo' }),
      post('/api/salidas', { estadiaId: estadia.id, metodoPago: 'Yape' })
    ]);

    const pagosDespues = await prisma.pago.count();
    const creados = pagosDespues - pagosAntes;
    const vinculados = await prisma.pago.count({ where: { estadia: { id: estadia.id } } });
    const codigos = [a.status, b.status].sort();

    console.log('[INT-01] Doble clic simultáneo en "Registrar salida"');
    console.log(`         respuestas HTTP: ${a.status} y ${b.status}`);
    console.log(`         pagos creados: ${creados} | vinculados a la estadía: ${vinculados}`);

    assert.strictEqual(creados, 1, `Se esperaba exactamente 1 pago y se crearon ${creados}`);
    assert.strictEqual(vinculados, 1, 'La estadía debe quedar vinculada a un único pago');
    assert.deepStrictEqual(codigos, [200, 409], `Se esperaba 200 + 409 y se obtuvo ${codigos.join(' + ')}`);

    console.log('  [PASS] Una sola operación cobra; la segunda se rechaza con 409 y no deja pagos huérfanos.');
  } finally {
    await limpiar();
    const pagosFinal = await prisma.pago.count();
    console.log(`\nLimpieza: pagos antes=${pagosAntes} despues=${pagosFinal}`);
    assert.strictEqual(pagosFinal, pagosAntes, 'La prueba no debe dejar registros de pago');
    await prisma.$disconnect();
  }

  console.log('\nRESULTADO: integridad del cobro OK.');
  process.exit(0);
})().catch(async (error) => {
  console.error('\n[FALLO]', error.message);
  await limpiar().catch(() => { });
  await prisma.$disconnect();
  process.exit(1);
});
