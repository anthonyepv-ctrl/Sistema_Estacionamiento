const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TIPOS = [
  { nombre: 'Automóvil / Camioneta', precioHora: 4.5, precioFraccion: 2.5 },
  { nombre: 'Motocicleta', precioHora: 2.5, precioFraccion: 1.5 },
  { nombre: 'Reserva Web', precioHora: 5.0, precioFraccion: 3.0 }
];

const USUARIOS = [
  { usuario: 'admin', nombre: 'Administrador', contrasena: '123456', rol: 'DUENO' },
  { usuario: 'recepcion', nombre: 'Recepcionista', contrasena: '123456', rol: 'RECEPCIONISTA' }
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

  for (const datos of USUARIOS) {
    const contrasenaHash = await bcrypt.hash(datos.contrasena, 10);

    await prisma.usuario.upsert({
      where: { usuario: datos.usuario },
      update: { contrasena: contrasenaHash, nombre: datos.nombre, rol: datos.rol },
      create: {
        usuario: datos.usuario,
        nombre: datos.nombre,
        contrasena: contrasenaHash,
        rol: datos.rol
      }
    });
  }

  console.log('Seed completado: tipos de vehículo, tarifas y usuarios (dueño y recepcionista).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
