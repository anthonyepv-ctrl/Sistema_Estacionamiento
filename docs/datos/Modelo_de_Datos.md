# Modelo de Datos — Sistema de Gestión de Cochera

Base de datos **PostgreSQL**. Implementada con **Prisma 6** (migración inicial `20261005120000_init`).

## Archivos

| Archivo | Descripción |
| --- | --- |
| `prisma/schema.prisma` | Esquema Prisma (modelos, tipos y relaciones). |
| `prisma/migrations/20261005120000_init/migration.sql` | Migración inicial (tablas, PK, FK, CHECK, índices). |
| `diagrama-er.erd` | Diagrama entidad-relación editable (referencia visual). |
| `modelo-sprint1.png` | Imagen del modelo del Sprint 1. |

## Cómo aplicar la migración

1. Copiar `.env.example` a `.env` y completar `DATABASE_URL`.
2. `npm install`
3. `npm run db:deploy` — aplica las migraciones pendientes.
4. `npm run db:generate` — genera el cliente Prisma.
5. `npm run db:studio` — (opcional) explorar los datos.

---

## 1. Entidades (tablas)

Nombres en singular `snake_case`.

### usuario

Credenciales y rol de acceso al sistema.

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id_usuario` | SERIAL | PK |
| `usuario` | VARCHAR(50) | UNIQUE, NOT NULL — nombre de usuario para iniciar sesión (sin correo) |
| `nombre` | VARCHAR(100) | NOT NULL — nombre visible de la persona |
| `contrasena` | VARCHAR(255) | NOT NULL — se guardará hasheada |
| `rol` | ENUM `rol_usuario` | NOT NULL, DEFAULT `RECEPCIONISTA` — valores: `RECEPCIONISTA`, `DUEÑO` |

### tipo_vehiculo

Catálogo de categorías (Auto, Moto, Camioneta, Pesado, Reserva…).

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id_tipo_vehiculo` | SERIAL | PK |
| `nombre` | VARCHAR(50) | UNIQUE, NOT NULL |

### tarifa

Precios por hora y fracción para cada tipo de vehículo.

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id_tarifa` | SERIAL | PK |
| `id_tipo_vehiculo` | INTEGER | FK → `tipo_vehiculo`, NOT NULL |
| `precio_hora` | DECIMAL(10,2) | NOT NULL, CHECK `>= 0` |
| `precio_fraccion` | DECIMAL(10,2) | NOT NULL, CHECK `>= 0` |
| `estado` | BOOLEAN | NOT NULL, DEFAULT `true` (tarifa activa) |

### estadia

Registro de ingresos y salidas (tabla central).

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id_estadia` | SERIAL | PK |
| `placa` | VARCHAR(10) | NOT NULL |
| `id_tipo_vehiculo` | INTEGER | FK → `tipo_vehiculo`, NOT NULL |
| `id_tarifa` | INTEGER | FK → `tarifa`, NOT NULL |
| `id_usuario` | INTEGER | FK → `usuario`, NOT NULL |
| `id_pago` | INTEGER | FK → `pago`, UNIQUE, NULL (se completa al cobrar) |
| `hora_ingreso` | TIMESTAMP | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` |
| `hora_salida` | TIMESTAMP | NULL mientras la estadía está activa |

Índices/restricciones adicionales:

- Índice `estadia_placa_idx` sobre `placa`.
- Índice único parcial `estadia_placa_activa_key` sobre `placa` **donde `hora_salida IS NULL`** → una placa no puede tener dos estadías activas.
- CHECK `estadia_hora_salida_valida`: `hora_salida` es NULL o `>= hora_ingreso`.

### pago

Cobro de una estadía.

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id_pago` | SERIAL | PK |
| `id_metodo_pago` | INTEGER | FK → `metodo_pago`, NOT NULL |
| `monto` | DECIMAL(10,2) | NOT NULL, CHECK `>= 0` |
| `tiempo_horas` | DECIMAL(6,2) | NOT NULL, DEFAULT `0`, CHECK `>= 0` |
| `tiempo_fraccion` | DECIMAL(6,2) | NOT NULL, DEFAULT `0`, CHECK `>= 0` |
| `fecha_hora` | TIMESTAMP | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` |

### metodo_pago

Catálogo de formas de pago (Efectivo, Yape, POS…).

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id_metodo_pago` | SERIAL | PK |
| `nombre` | VARCHAR(50) | UNIQUE, NOT NULL |

---

## 2. Relaciones

| Origen | Destino | Cardinalidad |
| --- | --- | --- |
| `tipo_vehiculo.id_tipo_vehiculo` | `tarifa.id_tipo_vehiculo` | 1 — N |
| `tipo_vehiculo.id_tipo_vehiculo` | `estadia.id_tipo_vehiculo` | 1 — N |
| `tarifa.id_tarifa` | `estadia.id_tarifa` | 1 — N |
| `usuario.id_usuario` | `estadia.id_usuario` | 1 — N |
| `pago.id_pago` | `estadia.id_pago` | 1 — 1 (UNIQUE) |
| `metodo_pago.id_metodo_pago` | `pago.id_metodo_pago` | 1 — N |

Regla de borrado: `RESTRICT` en las FK de catálogos (no se puede borrar un tipo con tarifas/estadías), `SET NULL` en `estadia.id_pago`.

---

## 3. Reglas de negocio respaldadas por la BD

- Una **estadía activa** es aquella con `hora_salida IS NULL`.
- **No puede haber dos estadías activas con la misma placa** (índice único parcial).
- `hora_salida` nunca puede ser anterior a `hora_ingreso` (CHECK).
- **Precios, montos y tiempos no pueden ser negativos** (CHECK).
- Los catálogos (`tipo_vehiculo.nombre`, `metodo_pago.nombre`, `usuario.usuario`) son únicos.

---

## 4. Decisiones tomadas (respecto al ERD)

- Nombres de tabla en **singular `snake_case`**.
- `usuario.usuario` (UNIQUE) es la credencial de acceso (sin correo); `usuario.nombre` es el nombre visible.
- `pago.tiempo_horas` y `pago.tiempo_fraccion` pasaron de `TIME` a `DECIMAL(6,2)` (número de horas).
- `estadia.id_pago` es **UNIQUE** (relación 1:1 estadía–pago).
- Se eliminaron columnas duplicadas (`id_tipo` / `id_tipo_vehiculo`).
- Precisión monetaria explícita: `DECIMAL(10,2)`.

## 5. Pendientes

- **BD compartida:** configurar **Neon** y compartir el `DATABASE_URL` con el equipo (solo por privado, nunca en Git).
- Implementar **hash de contraseñas** (bcrypt) al crear usuarios.
- **Seed inicial:** tipos de vehículo, tarifas por defecto, métodos de pago y usuario dueño.
- Evaluar campo `correo` en `usuario` y campos de auditoría (`creado_en`, `actualizado_en`).
