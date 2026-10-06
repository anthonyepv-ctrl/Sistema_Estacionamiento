# Guía rápida de Prisma — Sistema de Gestión de Cochera

Prisma es el **ORM** del proyecto: traduce código JavaScript a SQL. No escribes SQL; llamas métodos.

> Ya está configurado: `prisma/schema.prisma` (modelos) + `prisma/migrations/` (tablas creadas).

---

## 1. Conectar (una sola vez por archivo)

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // lee DATABASE_URL del .env automáticamente
```

No se abre ni cierra conexión a mano (a diferencia de un driver como mysql2).

---

## 2. Operaciones básicas (CRUD)

```js
// CREAR
const nuevo = await prisma.usuario.create({
  data: { usuario: 'alberth', contrasena: 'hash', rol: 'RECEPCIONISTA' }
});

// LEER TODOS
const usuarios = await prisma.usuario.findMany();

// LEER UNO por id
const uno = await prisma.usuario.findUnique({ where: { id: 1 } });

// LEER con filtro
const activas = await prisma.tarifa.findMany({ where: { estado: true } });

// ACTUALIZAR
await prisma.tarifa.update({
  where: { id: 3 },
  data: { precioHora: 5.0, precioFraccion: 3.0 }
});

// ELIMINAR
await prisma.pago.delete({ where: { id: 10 } });
```

---

## 3. Filtros y orden

```js
const estadias = await prisma.estadia.findMany({
  where: {
    horaSalida: null,                  // estadías activas
    placa: { startsWith: 'ABC' }       // placa que empieza con ABC
  },
  orderBy: { horaIngreso: 'desc' }
});
```

Operadores útiles: `equals`, `not`, `in`, `lt`, `lte`, `gt`, `gte`, `contains`, `startsWith`.

---

## 4. Relaciones (evita escribir JOINs)

```js
// Estadía con su tipo de vehículo, tarifa y usuario
const estadia = await prisma.estadia.findFirst({
  where: { horaSalida: null },
  include: {
    tipoVehiculo: true,
    tarifa: true,
    usuario: true,
    pago: true
  }
});
```

---

## 5. SQL puro (si algún día se necesita)

```js
const filas = await prisma.$queryRaw`SELECT COUNT(*) FROM estadia WHERE hora_salida IS NULL`;
```

---

## 6. Comandos del proyecto

| Comando | Para qué |
| --- | --- |
| `npm run db:deploy` | Aplicar migraciones (crear/actualizar tablas). |
| `npm run db:generate` | Regenerar el cliente tras cambiar el esquema. |
| `npm run db:studio` | Ver/editar datos en el navegador. |
| `npm run db:migrate` | Crear una migración nueva en desarrollo. |

---

## 7. Ojo: camelCase en JS vs snake_case en la BD

En el esquema se usó `@map` para que la BD siga `snake_case`. En JavaScript los campos van en **camelCase**:

| En la BD (SQL) | En JavaScript (Prisma) |
| --- | --- |
| `precio_hora` | `precioHora` |
| `precio_fraccion` | `precioFraccion` |
| `hora_ingreso` | `horaIngreso` |
| `hora_salida` | `horaSalida` |
| `id_tipo_vehiculo` | `idTipoVehiculo` |

Los **modelos** también cambian de nombre: `usuario`, `tipoVehiculo`, `tarifa`, `estadia`, `pago`, `metodoPago`.

---

## 8. Errores comunes

| Código | Significa | Ejemplo |
| --- | --- | --- |
| `P2002` | Valor duplicado en campo único | Registrar una placa con estadía activa repetida |
| `P2003` | FK inválida | Usar un `id_tipo_vehiculo` que no existe |
| `P2025` | Registro no encontrado | `update`/`delete` de un id inexistente |

Siempre envolver en `try/catch`:

```js
try {
  await prisma.estadia.create({ data: { ... } });
} catch (error) {
  console.error('Error de BD:', error.code, error.message);
}
```

---

## 9. Referencia oficial

- Documentación: https://www.prisma.io/docs
- Nuestro esquema: [`prisma/schema.prisma`](../../prisma/schema.prisma)
- Modelo de datos: [`Modelo_de_Datos.md`](Modelo_de_Datos.md)
