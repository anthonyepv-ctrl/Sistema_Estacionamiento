const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TIPOS = [
  { nombre: 'Automóvil / Camioneta', precioHora: 4.5, precioFraccion: 2.5 },
  { nombre: 'Motocicleta', precioHora: 2.5, precioFraccion: 1.5 },
  { nombre: 'Reserva Web', precioHora: 5.0, precioFraccion: 3.0 }
];

const METODOS_PAGO = ['Efectivo', 'Yape', 'Plin'];

const USUARIOS_INICIALES = [
  { usuario: 'admin@cochera.pe', contrasena: '123456', rol: 'DUENO' },
  { usuario: 'recepcion', contrasena: '123456', rol: 'RECEPCIONISTA' }
];

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

  for (const datos of USUARIOS_INICIALES) {
    const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);

    await prisma.usuario.upsert({
      where: { usuario: datos.usuario },
      update: { contrasena: contrasenaHash },
      create: {
        usuario: datos.usuario,
        contrasena: contrasenaHash,
        rol: datos.rol
      }
    });
  }

  console.log('Seed completado: tipos de vehículo, tarifas, métodos de pago y usuarios iniciales.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
