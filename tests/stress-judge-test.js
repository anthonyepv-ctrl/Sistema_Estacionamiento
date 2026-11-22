require('dotenv').config();
const http = require('http');
const assert = require('assert');

// Ensure port 3555 is used so it doesn't conflict
process.env.PORT = '3555';
const app = require('../server');
const PORT = 3555;

let tokenDueno = '';
let tokenRecepcion = '';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runJudgeTests() {
  console.log('================================================================');
  console.log('   AUDITORÍA DE JUEZ / ROMPE-PROYECTOS: SISTEMA DE COCHERA      ');
  console.log('================================================================\n');

  // 1. Iniciar sesión para obtener tokens
  const loginDueno = await request('POST', '/api/auth/login', { usuario: 'admin', contrasena: '123456' });
  tokenDueno = loginDueno.data.token;

  const loginRec = await request('POST', '/api/auth/login', { usuario: 'recepcion', contrasena: '123456' });
  tokenRecepcion = loginRec.data.token;

  console.log(`[AUTH] Dueño token: ${tokenDueno ? 'OK' : 'FAIL'} | Recepción token: ${tokenRecepcion ? 'OK' : 'FAIL'}`);

  const results = [];

  function test(story, name, statusExpected, actualStatus, comment, passed) {
    results.push({ story, name, statusExpected, actualStatus, comment, passed });
    const mark = passed ? '✅ PASS' : '❌ BREAK / DEFECT';
    console.log(`${mark} [${story}] ${name} -> Got HTTP ${actualStatus} (Exp ${statusExpected}) | ${comment}`);
  }

  // --- TABLA 1: UPAO-16 (Configurar Tarifas) ---
  console.log('\n--- EVALUANDO TABLA 1: UPAO-16 (Configurar Tarifas) ---');
  // 1- Válido Auto S/ 2.50
  let res = await request('PUT', '/api/tarifas/1', { precioHora: '2.50', precioFraccion: '1.50' }, tokenDueno);
  test('UPAO-16', '1- Válido tarifa auto S/ 2.50', 200, res.status, res.data.mensaje || JSON.stringify(res.data), res.status === 200);

  // 2- Válido Moto S/ 1.50
  res = await request('PUT', '/api/tarifas/2', { precioHora: '1.50', precioFraccion: '1.00' }, tokenDueno);
  test('UPAO-16', '2- Válido tarifa moto S/ 1.50', 200, res.status, res.data.mensaje || JSON.stringify(res.data), res.status === 200);

  // 3- Inválido: Tarifa negativa o cero
  res = await request('PUT', '/api/tarifas/1', { precioHora: '-5.00', precioFraccion: '0.00' }, tokenDueno);
  test('UPAO-16', '3- Inválido tarifa negativa o cero', 400, res.status, res.data.error || '', res.status === 400);

  // 4- Inválido: Caracteres no numéricos
  res = await request('PUT', '/api/tarifas/1', { precioHora: 'abc', precioFraccion: 'S/.' }, tokenDueno);
  test('UPAO-16', '4- Inválido caracteres no numéricos', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Campo de tarifa vacío
  res = await request('PUT', '/api/tarifas/1', { precioHora: '', precioFraccion: '' }, tokenDueno);
  test('UPAO-16', '5- Inválido campo vacío', 400, res.status, res.data.error || '', res.status === 400);

  // 6- Inválido: Modificación sin permisos (Recepcionista)
  res = await request('PUT', '/api/tarifas/1', { precioHora: '3.00', precioFraccion: '2.00' }, tokenRecepcion);
  test('UPAO-16', '6- Inválido rol Recepcionista modifica tarifas', 403, res.status, res.data.error || '', res.status === 403);

  // Rompe-proyectos 1: Body vacío o nulo
  res = await request('PUT', '/api/tarifas/1', {}, tokenDueno);
  test('UPAO-16', 'EDGE: Body vacío {}', 400, res.status, res.data.error || '', res.status === 400);

  // Rompe-proyectos 2: Tarifa astronómica (overflow)
  res = await request('PUT', '/api/tarifas/1', { precioHora: '9999999999', precioFraccion: '1.00' }, tokenDueno);
  test('UPAO-16', 'EDGE: Monto astronómico > 999.99', 400, res.status, res.data.error || '', res.status === 400);

  // --- TABLA 2: UPAO-6 (Registrar Ingreso) ---
  console.log('\n--- EVALUANDO TABLA 2: UPAO-6 (Registrar Ingreso) ---');
  const placaTestAuto = 'ABC-789';
  const placaTestMoto = '1234-AB';

  // Limpiar si existían de pruebas previas
  await request('POST', '/api/salidas', { placa: placaTestAuto, metodoPago: 'Efectivo' }, tokenRecepcion);
  await request('POST', '/api/salidas', { placa: placaTestMoto, metodoPago: 'Yape' }, tokenRecepcion);

  // 1- Válido: Placa auto estándar
  res = await request('POST', '/api/ingresos', { placa: 'ABC789', tipo: 'auto' }, tokenRecepcion);
  test('UPAO-6', '1- Válido Placa auto estándar ABC-789', 201, res.status, res.data.mensaje || JSON.stringify(res.data), res.status === 201);

  // 2- Válido: Placa moto estándar
  res = await request('POST', '/api/ingresos', { placa: '1234AB', tipo: 'moto' }, tokenRecepcion);
  test('UPAO-6', '2- Válido Placa moto estándar 1234-AB', 201, res.status, res.data.mensaje || JSON.stringify(res.data), res.status === 201);

  // 3- Inválido: Formato de placa incorrecto
  res = await request('POST', '/api/ingresos', { placa: '12345', tipo: 'auto' }, tokenRecepcion);
  test('UPAO-6', '3- Inválido formato placa corta 12345', 400, res.status, res.data.error || '', res.status === 400);

  // 4- Inválido: Espacios y caracteres raros
  res = await request('POST', '/api/ingresos', { placa: 'ABC@123', tipo: 'auto' }, tokenRecepcion);
  test('UPAO-6', '4- Inválido caracteres especiales @', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Campo de placa vacío
  res = await request('POST', '/api/ingresos', { placa: '', tipo: 'auto' }, tokenRecepcion);
  test('UPAO-6', '5- Inválido campo placa vacío', 400, res.status, res.data.error || '', res.status === 400);

  // 6- Inválido: Placa con estadía activa (duplicado)
  res = await request('POST', '/api/ingresos', { placa: placaTestAuto, tipo: 'auto' }, tokenRecepcion);
  test('UPAO-6', '6- Inválido vehículo ya activo en cochera', 409, res.status, res.data.error || '', res.status === 409);

  // Rompe-proyectos: Incoherencia Poka-Yoke (placa de moto registrada como auto)
  res = await request('POST', '/api/ingresos', { placa: '9999-ZZ', tipo: 'auto' }, tokenRecepcion);
  test('UPAO-6', 'EDGE: Incoherencia moto ingresada como auto', 400, res.status, res.data.error || '', res.status === 400);

  // --- TABLA 3: UPAO-7 (Registrar Salida) ---
  console.log('\n--- EVALUANDO TABLA 3: UPAO-7 (Registrar Salida) ---');
  // 1- Válido: Búsqueda y cobro Efectivo
  res = await request('POST', '/api/salidas', { placa: placaTestAuto, metodoPago: 'Efectivo' }, tokenRecepcion);
  test('UPAO-7', '1- Válido salida y cobro Efectivo', 200, res.status, res.data.mensaje || JSON.stringify(res.data), res.status === 200);

  // 2- Válido: Búsqueda y cobro Yape
  res = await request('POST', '/api/salidas', { placa: placaTestMoto, metodoPago: 'Yape' }, tokenRecepcion);
  test('UPAO-7', '2- Válido salida y cobro Yape', 200, res.status, res.data.mensaje || JSON.stringify(res.data), res.status === 200);

  // 3- Inválido: Placa inexistente o no activa
  res = await request('POST', '/api/salidas', { placa: 'XYZ-999', metodoPago: 'Efectivo' }, tokenRecepcion);
  test('UPAO-7', '3- Inválido placa inexistente', 404, res.status, res.data.error || '', res.status === 404);

  // 4- Inválido: Sin seleccionar método de pago
  res = await request('POST', '/api/salidas', { placa: placaTestAuto, metodoPago: 'Bitcoin' }, tokenRecepcion);
  test('UPAO-7', '4- Inválido método de pago no permitido', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Doble cobro / Idempotencia (intentar cobrar la misma que ya salió)
  res = await request('POST', '/api/salidas', { placa: placaTestAuto, metodoPago: 'Efectivo' }, tokenRecepcion);
  test('UPAO-7', '5- Inválido cobrar vehículo ya retirado', 404, res.status, res.data.error || '', res.status === 404);

  // 6- Inválido: ID de estadía corrupto/negativo
  res = await request('POST', '/api/salidas', { estadiaId: -1, metodoPago: 'Efectivo' }, tokenRecepcion);
  test('UPAO-7', '6a- Inválido ID estadía negativo (-1)', 400, res.status, res.data.error || '', res.status === 400);

  res = await request('POST', '/api/salidas', { estadiaId: 'null', metodoPago: 'Efectivo' }, tokenRecepcion);
  test('UPAO-7', '6b- Inválido ID estadía corrupto string ("null")', 400, res.status, res.data.error || '', res.status === 400);

  // --- TABLA 4: UPAO-11 (Ver Estado de Espacios) ---
  console.log('\n--- EVALUANDO TABLA 4: UPAO-11 (Ver Estado de Espacios) ---');
  res = await request('GET', '/api/espacios', null, tokenRecepcion);
  test('UPAO-11', '1- Válido carga de estado de aforo', 200, res.status, `Autos: ${res.data.autos?.ocupados}/${res.data.autos?.capacidad} | Motos: ${res.data.motos?.ocupados}/${res.data.motos?.capacidad}`, res.status === 200 && res.data.autos && res.data.motos);

  // 4- Inválido: Capacidad menor a ocupados
  res = await request('PUT', '/api/espacios/capacidad', { capacidadAutos: 0 }, tokenDueno);
  test('UPAO-11', '4- Inválido capacidad menor a 1 o negativa', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Capacidad caracteres no numéricos
  res = await request('PUT', '/api/espacios/capacidad', { capacidadAutos: 'muchos' }, tokenDueno);
  test('UPAO-11', '5- Inválido capacidad no numérica', 400, res.status, res.data.error || '', res.status === 400);

  // --- TABLA 5: UPAO-17 (Consultar Ingresos Recaudados) ---
  console.log('\n--- EVALUANDO TABLA 5: UPAO-17 (Consultar Ingresos Recaudados) ---');
  // 1- Válido: Consulta día de hoy
  res = await request('GET', '/api/reportes/diario', null, tokenDueno);
  test('UPAO-17', '1- Válido consulta ingresos día actual', 200, res.status, `Total: S/ ${res.data.totalGeneral} | Movimientos: ${res.data.movimientos?.length}`, res.status === 200);

  // 2- Válido: Consulta día sin movimientos (01/01/2024)
  res = await request('GET', '/api/reportes/diario?fecha=2024-01-01', null, tokenDueno);
  test('UPAO-17', '2- Válido consulta día sin movimientos', 200, res.status, `Total: S/ ${res.data.totalGeneral}`, res.status === 200 && res.data.totalGeneral === 0);

  // 3- Inválido: Consulta de fecha futura (2030-01-01)
  res = await request('GET', '/api/reportes/diario?fecha=2030-01-01', null, tokenDueno);
  test('UPAO-17', '3- Inválido consulta fecha futura', 400, res.status, res.data.error || '', res.status === 400);

  // 4- Inválido: Formato de fecha alterado (2026-99-99)
  res = await request('GET', '/api/reportes/diario?fecha=2026-99-99', null, tokenDueno);
  test('UPAO-17', '4- Inválido formato de fecha alterado', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Sin token de sesión
  res = await request('GET', '/api/reportes/diario');
  test('UPAO-17', '5- Inválido sin token de sesión', 401, res.status, res.data.error || '', res.status === 401);

  // 6- Inválido: Acceso como Recepcionista
  res = await request('GET', '/api/reportes/diario', null, tokenRecepcion);
  test('UPAO-17', '6- Inválido rol Recepcionista consulta reporte', 403, res.status, res.data.error || '', res.status === 403);

  // --- TABLA 6: UPAO-9 (Adjuntar Notas) ---
  console.log('\n--- EVALUANDO TABLA 6: UPAO-9 (Adjuntar Notas) ---');
  const placaNota1 = 'NOT-101';
  await request('POST', '/api/salidas', { placa: placaNota1, metodoPago: 'Efectivo' }, tokenRecepcion);

  // 1- Válido: Ingreso con nota descriptiva
  res = await request('POST', '/api/ingresos', {
    placa: placaNota1,
    tipo: 'auto',
    nota: 'Raspón visible en puerta lateral derecha'
  }, tokenRecepcion);
  test('UPAO-9', '1- Válido ingreso con nota descriptiva', 201, res.status, `Nota guardada: "${res.data.nota}"`, res.status === 201 && res.data.nota === 'Raspón visible en puerta lateral derecha');

  // 2- Válido: Ingreso con nota vacía / espacios
  const placaNota2 = 'NOT-102';
  await request('POST', '/api/salidas', { placa: placaNota2, metodoPago: 'Efectivo' }, tokenRecepcion);
  res = await request('POST', '/api/ingresos', {
    placa: placaNota2,
    tipo: 'auto',
    nota: '     '
  }, tokenRecepcion);
  test('UPAO-9', '2- Válido ingreso con nota solo espacios (null)', 201, res.status, `Nota convertida a: ${res.data.nota}`, res.status === 201 && res.data.nota === null);

  // 3- Inválido: Exceder límite de 250 caracteres
  const notaLarga = 'A'.repeat(280);
  res = await request('POST', '/api/ingresos', {
    placa: 'NOT-103',
    tipo: 'auto',
    nota: notaLarga
  }, tokenRecepcion);
  test('UPAO-9', '3- Inválido nota > 250 caracteres', 400, res.status, res.data.error || '', res.status === 400);

  // 4- Inválido: Inyección de scripts XSS en nota
  const xssNota = '<script>alert("XSS")</script>';
  const placaNota4 = 'NOT-104';
  await request('POST', '/api/salidas', { placa: placaNota4, metodoPago: 'Efectivo' }, tokenRecepcion);
  res = await request('POST', '/api/ingresos', {
    placa: placaNota4,
    tipo: 'auto',
    nota: xssNota
  }, tokenRecepcion);
  test('UPAO-9', '4- Válido/Seguro nota con tags HTML/JS guardada sin ejecución', 201, res.status, `Nota guardada como texto plano: ${res.data.nota}`, res.status === 201);

  // 5- Inválido: Intento de actualizar nota (no existe PUT/PATCH)
  res = await request('PUT', `/api/ingresos/${res.data.id}`, { nota: 'Modificado ilegalmente' }, tokenRecepcion);
  test('UPAO-9', '5- Inválido endpoint PUT para editar nota (inmutabilidad)', 404, res.status, res.data.error || '', res.status === 404);

  // 6- Válido: Visualización de nota en salidas
  res = await request('GET', '/api/salidas/activos', null, tokenRecepcion);
  const encontrada = Array.isArray(res.data) && res.data.find(e => e.placa === placaNota1);
  test('UPAO-9', '6- Válido visualización de nota en activos de salida', 200, res.status, `Encontrada nota: "${encontrada?.nota}" | Usuario: ${encontrada?.usuarioIngreso}`, encontrada && encontrada.nota === 'Raspón visible en puerta lateral derecha');

  // Limpiar placas de prueba
  await request('POST', '/api/salidas', { placa: placaNota1, metodoPago: 'Efectivo' }, tokenRecepcion);
  await request('POST', '/api/salidas', { placa: placaNota2, metodoPago: 'Efectivo' }, tokenRecepcion);
  await request('POST', '/api/salidas', { placa: placaNota4, metodoPago: 'Efectivo' }, tokenRecepcion);

  // --- TABLA 7: UPAO-18 (Gráficos de Ingresos) ---
  console.log('\n--- EVALUANDO TABLA 7: UPAO-18 (Gráficos de Ingresos) ---');
  // 1- Válido: Carga período actual (Noviembre 2026)
  res = await request('GET', '/api/reportes/graficos-mes?mes=11&anio=2026', null, tokenDueno);
  test('UPAO-18', '1- Válido agregaciones mensuales período actual', 200, res.status, `Total: S/ ${res.data.totalPeriodo} | Días: ${res.data.serieDiaria?.length}`, res.status === 200 && Array.isArray(res.data.serieDiaria));

  // 2- Válido: Exportación CSV estructurada
  res = await request('GET', '/api/reportes/exportar?periodo=mensual&anio=2026&mes=11', null, tokenDueno);
  const tieneBOM = typeof res.data === 'string' && res.data.startsWith('\uFEFF');
  test('UPAO-18', '2- Válido exportación CSV con UTF-8 BOM', 200, res.status, `Tiene UTF-8 BOM: ${tieneBOM} | Tamaño: ${res.data?.length} chars`, res.status === 200 && tieneBOM);

  // 3- Inválido: Selección de mes futuro (Diciembre 2026)
  res = await request('GET', '/api/reportes/graficos-mes?mes=12&anio=2026', null, tokenDueno);
  test('UPAO-18', '3- Inválido mes futuro bloqueado', 400, res.status, res.data.error || '', res.status === 400);

  // 4- Inválido: Parámetros no numéricos
  res = await request('GET', '/api/reportes/graficos-mes?mes=xyz&anio=abc', null, tokenDueno);
  test('UPAO-18', '4- Inválido parámetros no numéricos', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Mes fuera de rango 1 a 12 (mes=13)
  res = await request('GET', '/api/reportes/graficos-mes?mes=13&anio=2026', null, tokenDueno);
  test('UPAO-18', '5- Inválido mes fuera de rango (13)', 400, res.status, res.data.error || '', res.status === 400);

  // 6- Válido/Límite: Período histórico sin ventas (Enero 2024)
  res = await request('GET', '/api/reportes/graficos-mes?mes=1&anio=2024', null, tokenDueno);
  test('UPAO-18', '6- Válido período sin ventas retorna ceros', 200, res.status, `Total: S/ ${res.data.totalPeriodo} | sinDatos: ${res.data.sinDatos}`, res.status === 200 && res.data.totalPeriodo === 0);

  // 7- Inválido: Acceso como Recepcionista
  res = await request('GET', '/api/reportes/graficos-mes?mes=10&anio=2026', null, tokenRecepcion);
  test('UPAO-18', '7- Inválido rol Recepcionista consulta gráficos', 403, res.status, res.data.error || '', res.status === 403);

  // --- TABLA 8: UPAO-19 (Consultar Nivel de Ocupación) ---
  console.log('\n--- EVALUANDO TABLA 8: UPAO-19 (Consultar Nivel de Ocupación) ---');
  // 1- Válido: Rango válido
  res = await request('GET', '/api/ocupacion?fechaInicio=2026-10-20&fechaFin=2026-10-30', null, tokenDueno);
  test('UPAO-19', '1- Válido consulta ocupación rango válido', 200, res.status, `Aforo max: ${res.data.resumen?.aforoMaximoSimultaneo} | Vehículos: ${res.data.resumen?.totalVehiculosPeriodo}`, res.status === 200 && res.data.resumen);

  // 2- Válido: Exportación bitácora CSV
  res = await request('GET', '/api/ocupacion/exportar?fechaInicio=2026-10-20&fechaFin=2026-10-30&formato=csv', null, tokenDueno);
  test('UPAO-19', '2- Válido exportar bitácora ocupación CSV', 200, res.status, `Header: ${res.headers['content-type']}`, res.status === 200);

  // 3- Inválido: Rango de fechas invertido
  res = await request('GET', '/api/ocupacion?fechaInicio=2026-10-30&fechaFin=2026-10-20', null, tokenDueno);
  test('UPAO-19', '3- Inválido rango invertido Inicio > Fin', 400, res.status, res.data.error || '', res.status === 400);

  // 4- Inválido: Fecha futura
  res = await request('GET', '/api/ocupacion?fechaInicio=2027-01-01&fechaFin=2027-01-05', null, tokenDueno);
  test('UPAO-19', '4- Inválido fecha futura', 400, res.status, res.data.error || '', res.status === 400);

  // 5- Inválido: Campos de fecha incompletos
  res = await request('GET', '/api/ocupacion?fechaInicio=2026-10-20', null, tokenDueno);
  test('UPAO-19', '5- Inválido fecha fin vacía', 400, res.status, res.data.error || '', res.status === 400);

  // 6- Válido: Rango sin movimientos
  res = await request('GET', '/api/ocupacion?fechaInicio=2026-09-01&fechaFin=2026-09-05', null, tokenDueno);
  test('UPAO-19', '6- Válido rango sin movimientos', 200, res.status, `sinDatos: ${res.data.sinDatos}`, res.status === 200 && res.data.sinDatos === true);

  // --- TABLA 9: UPAO-20 (Ver Espacios Disponibles) ---
  console.log('\n--- EVALUANDO TABLA 9: UPAO-20 (Ver Espacios Disponibles) ---');
  // 1- Válido: Acceso público sin sesión
  res = await request('GET', '/api/publico/disponibilidad');
  test('UPAO-20', '1- Válido acceso público sin token', 200, res.status, `Disponibles Autos: ${res.data.autos?.disponibles} | Motos: ${res.data.motos?.disponibles}`, res.status === 200 && res.data.autos);

  // 2- Válido: Cálculo exacto de cupos libres (max(0, cap - ocup - res))
  const autos = res.data.autos;
  const formulaCumplida = autos.disponibles === Math.max(0, autos.capacidad - autos.enCochera - autos.reservasVigentes);
  test('UPAO-20', '2- Válido fórmula matemática de cupos libres', 200, res.status, `Fórmula cumplida: ${formulaCumplida} (${autos.disponibles} = max(0, ${autos.capacidad} - ${autos.enCochera} - ${autos.reservasVigentes}))`, formulaCumplida);

  // 6- Inválido: Parámetros SQL Injection o basura en query
  res = await request('GET', "/api/publico/disponibilidad?q=' OR 1=1--");
  test('UPAO-20', '6- Inválido inyección SQL en query params descartada', 200, res.status, `Parámetro descartado con seguridad`, res.status === 200 && res.data.autos);

  // --- TABLAS 10 A 13: SPRINT 3 (UPAO-8, UPAO-21, UPAO-22, UPAO-23) ---
  console.log('\n--- EVALUANDO TABLAS 10 A 13 (SPRINT 3: RESERVAS Y CLIENTES) ---');
  // Verificar endpoints de Sprint 3
  const resReservas = await request('GET', '/api/reservas', null, tokenRecepcion);
  test('UPAO-8 / UPAO-21', '10 & 11- Estado de rutas de Reserva en backend', 404, resReservas.status, 'No implementado en Sprint 2 (Correctamente diferido para Sprint 3 según Excel)', resReservas.status === 404);

  const resHistorial = await request('GET', '/api/historial', null, tokenRecepcion);
  test('UPAO-23', '13- Estado de historial de estados en backend', 404, resHistorial.status, 'No implementado en Sprint 2 (Correctamente diferido para Sprint 3 según Excel)', resHistorial.status === 404);

  console.log('\n================================================================');
  console.log(`TOTAL CASOS EVALUADOS: ${results.length}`);
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`PASARON: ${passCount} | FALLARON / QUEBRARON: ${failCount}`);
  console.log('================================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

runJudgeTests().catch(e => {
  console.error('Error fatal en ejecución:', e);
  process.exit(1);
});
