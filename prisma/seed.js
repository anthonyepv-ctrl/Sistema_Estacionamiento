const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TIPOS = [
  { nombre: 'Automóvil / Camioneta', precioHora: 4.5, precioFraccion: 2.5 },
  { nombre: 'Motocicleta', precioHora: 2.5, precioFraccion: 1.5 },
  { nombre: 'Reserva Web', precioHora: 5.0, precioFraccion: 3.0 }
];

const METODOS_PAGO = ['Efectivo', 'Yape', 'Plin'];

const USUARIO_INICIAL = {
  usuario: 'admin@cochera.pe',
  contrasena: '123456',
  rol: 'DUENO'
};

async function main() {
  for (const tipo of TIPOS) {
    const tipoVehiculo = await prisma.tipoVehiculo.upsert({
      where: { nombre: tipo.nombre },
      update: {},
      create: { nombre: tipo.nombre }
    });

    const tarifaExistente = await prisma.tarifa.findFirst({
      where: { idTipoVehiculo: tipoVehiculo.id }
    });

    if (tarifaExistente) {
      await prisma.tarifa.update({
        where: { id: tarifaExistente.id },
        data: {
          precioHora: tipo.precioHora,
          precioFraccion: tipo.precioFraccion,
          estado: true
        }
      });
    } else {
      await prisma.tarifa.create({
        data: {
          idTipoVehiculo: tipoVehiculo.id,
          precioHora: tipo.precioHora,
          precioFraccion: tipo.precioFraccion
        }
      });
    }
  }

  for (const nombre of METODOS_PAGO) {
    await prisma.metodoPago.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
  }

  const contrasenaHash = await bcrypt.hash(USUARIO_INICIAL.contrasena, 10);

  await prisma.usuario.upsert({
    where: { usuario: USUARIO_INICIAL.usuario },
    update: { contrasena: contrasenaHash },
    create: {
      usuario: USUARIO_INICIAL.usuario,
      contrasena: contrasenaHash,
      rol: USUARIO_INICIAL.rol
    }
  });

  console.log('Seed completado: tipos de vehículo, tarifas, métodos de pago y usuario inicial.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
