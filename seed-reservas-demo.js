require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./src/config/prisma');

async function seedConductorYReservas() {
  const contrasenaHash = await bcrypt.hash('123456', 10);
  
  // 1. Crear o actualizar Conductor
  const conductor = await prisma.usuario.upsert({
    where: { usuario: 'conductor_demo' },
    update: { contrasena: contrasenaHash },
    create: {
      usuario: 'conductor_demo',
      nombre: 'Juan Pérez (Conductor)',
      contrasena: contrasenaHash,
      rol: 'CONDUCTOR',
      dni: '72345678',
      celular: '987654321'
    }
  });
  console.log('Conductor listo:', conductor.usuario);

  // 2. Tipo de vehiculo Auto
  const tipoAuto = await prisma.tipoVehiculo.findFirst({ where: { nombre: 'Automóvil / Camioneta' } });

  // 3. Crear vehículos
  const vehiculo1 = await prisma.vehiculoConductor.upsert({
    where: { idUsuario_placa: { idUsuario: conductor.id, placa: 'ABC-123' } },
    update: {},
    create: {
      idUsuario: conductor.id,
      placa: 'ABC-123',
      idTipoVehiculo: tipoAuto.id
    }
  });

  const vehiculo2 = await prisma.vehiculoConductor.upsert({
    where: { idUsuario_placa: { idUsuario: conductor.id, placa: 'XYZ-789' } },
    update: {},
    create: {
      idUsuario: conductor.id,
      placa: 'XYZ-789',
      idTipoVehiculo: tipoAuto.id
    }
  });

  // 4. Limpiar reservas anteriores de este conductor para tener un set limpio
  await prisma.reserva.deleteMany({ where: { idUsuario: conductor.id } });

  const now = new Date();
  const en30Min = new Date(now.getTime() + 30 * 60 * 1000);
  const hace2Horas = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const hace1Hora = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  // Reserva 1: VIGENTE (con botón Anular)
  const resVigente = await prisma.reserva.create({
    data: {
      codigo: 'RES-1001',
      idUsuario: conductor.id,
      idVehiculo: vehiculo1.id,
      idTipoVehiculo: tipoAuto.id,
      fechaReserva: now,
      fechaLimite: en30Min,
      estado: 'VIGENTE',
      montoAdelanto: 4.50,
      pasarelaPagoId: 'chr_test_vigente_1001',
      pasarelaProveedor: 'culqi',
      estadoPago: 'PAGADO'
    }
  });

  // Reserva 2: UTILIZADA (sin botón Anular)
  const resUtilizada = await prisma.reserva.create({
    data: {
      codigo: 'RES-1002',
      idUsuario: conductor.id,
      idVehiculo: vehiculo2.id,
      idTipoVehiculo: tipoAuto.id,
      fechaReserva: hace2Horas,
      fechaLimite: hace1Hora,
      estado: 'UTILIZADA',
      montoAdelanto: 4.50,
      pasarelaPagoId: 'chr_test_utilizada_1002',
      pasarelaProveedor: 'culqi',
      estadoPago: 'PAGADO'
    }
  });

  // Reserva 3: ANULADA (sin botón Anular)
  const resAnulada = await prisma.reserva.create({
    data: {
      codigo: 'RES-1003',
      idUsuario: conductor.id,
      idVehiculo: vehiculo1.id,
      idTipoVehiculo: tipoAuto.id,
      fechaReserva: hace2Horas,
      fechaLimite: hace1Hora,
      estado: 'ANULADA',
      montoAdelanto: 4.50,
      pasarelaPagoId: 'chr_test_anulada_1003',
      pasarelaProveedor: 'culqi',
      estadoPago: 'REEMBOLSADO',
      fechaAnulacion: hace1Hora
    }
  });

  // Reserva 4: VENCIDA (sin botón Anular)
  const resVencida = await prisma.reserva.create({
    data: {
      codigo: 'RES-1004',
      idUsuario: conductor.id,
      idVehiculo: vehiculo2.id,
      idTipoVehiculo: tipoAuto.id,
      fechaReserva: hace2Horas,
      fechaLimite: hace1Hora,
      estado: 'VENCIDA',
      montoAdelanto: 4.50,
      pasarelaPagoId: 'chr_test_vencida_1004',
      pasarelaProveedor: 'culqi',
      estadoPago: 'PAGADO'
    }
  });

  console.log('Reservas de prueba creadas exitosamente:');
  console.log('- VIGENTE:', resVigente.codigo, '(ID:', resVigente.id, ')');
  console.log('- UTILIZADA:', resUtilizada.codigo);
  console.log('- ANULADA:', resAnulada.codigo);
  console.log('- VENCIDA:', resVencida.codigo);
}

seedConductorYReservas()
  .catch(console.error)
  .finally(() => process.exit(0));
