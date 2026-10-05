# Modelo de Datos — Sistema de Gestión de Cochera

Documentación de la base de datos del sistema (base: `cochera-adev`, motor objetivo **PostgreSQL**).

## Archivos de referencia

| Archivo | Descripción |
| --- | --- |
| `diagrama-er.erd` | Diagrama entidad-relación editable (formato [erd-editor](https://erd-editor.io/)). |
| `modelo-sprint1.png` | Imagen del modelo correspondiente al Sprint 1. |

> El diagrama se versiona en `.erd` (JSON). Para editarlo, ábrelo con la extensión **ERD Editor** de VS Code o en https://erd-editor.io/.

---

## 1. Entidades (Tablas)

### TARIFA

Define los precios vigentes por tipo de vehículo.

| Columna | Tipo | Clave | Descripción |
| --- | --- | --- | --- |
| `id_tarifa` | INT | PK | Identificador de la tarifa. |
| `id_tipo_vehiculo` | INT | FK | Tipo de vehículo asociado. |
| `precio_hora` | DECIMAL | | Precio por hora o fracción de hora. |
| `precio_fraccion` | DECIMAL | | Precio por fracción. |
| `estado` | BOOLEAN | | `true` = tarifa activa, `false` = inactiva. |

### TIPO_VEHICULO

Catálogo de categorías de vehículo.

| Columna | Tipo | Clave | Descripción |
| --- | --- | --- | --- |
| `id_tipo` | INT | PK | Identificador del tipo. |
| `id_tipo_vehiculo` | INT | PK | Identificador de vehículo (según el diagrama). |
| `nombre` | VARCHAR | | Nombre de la categoría (AUTO, MOTO, CAMIONETA, PESADO). |
| `id_tarifa` | INT | FK | Tarifa aplicable al tipo. |

### ESTADIA

Registro de ingresos y salidas de vehículos (tabla central del sistema).

| Columna | Tipo | Clave | Descripción |
| --- | --- | --- | --- |
| `id_estadía` | INT | PK | Identificador de la estadía. |
| `id_tipo` | INT | FK | Tipo de vehículo. |
| `id_tipo_vehiculo` | INT | FK | Tipo de vehículo (referencia alterna). |
| `id_tarifa` | INT | FK | Tarifa aplicada al ingreso. |
| `id_pago` | INT | FK | Pago asociado (se completa al cobrar). |
| `id_usuario` | INT | FK | Usuario (operador) que registra la estadía. |
| `placa` | VARCHAR | | Placa del vehículo (MAYÚSCULAS, formato peruano). |
| `hora_ingreso` | DATETIME | | Fecha/hora de ingreso. Default `CURRENT_TIMESTAMP`. |
| `hora_salida` | DATETIME | | Fecha/hora de salida. `NULL` mientras la estadía esté activa. |

### PAGO

Detalle del cobro de una estadía.

| Columna | Tipo | Clave | Descripción |
| --- | --- | --- | --- |
| `id_pago` | INT | PK | Identificador del pago. |
| `id_metodo_pago` | INT | FK | Método de pago utilizado. |
| `monto` | DECIMAL | | Importe total cobrado (moneda PEN, `S/`). |
| `tiempo_horas` | TIME | | Tiempo cobrado en horas. |
| `tiempo_fraccion` | TIME | | Tiempo cobrado por fracción. |
| `fecha-hora` | DATETIME | | Fecha y hora del pago. |

### METODO_PAGO

Catálogo de formas de pago.

| Columna | Tipo | Clave | Descripción |
| --- | --- | --- | --- |
| `id_metodo_pago` | INT | PK | Identificador del método. |
| `nombre` | VARCHAR | | Nombre del método (Efectivo, Yape, POS, etc.). |

### USUARIO

Usuarios del sistema (operadores y administración).

| Columna | Tipo | Clave | Descripción |
| --- | --- | --- | --- |
| `id_usuario` | INT | PK | Identificador del usuario. |
| `nombre` | VARCHAR | | Nombre del usuario. |
| `rol` | ENUM('RECEPCIONISTA','DUEÑO') | | Rol del usuario. Default `RECEPCIONISTA`. |
| `contrasena` | VARCHAR | | Contraseña (debe almacenarse con hash). |

---

## 2. Relaciones

| Origen | Destino | Cardinalidad | Descripción |
| --- | --- | --- | --- |
| `TARIFA.id_tarifa` | `TIPO_VEHICULO.id_tarifa` | 1 — N | Una tarifa puede aplicar a varios tipos de vehículo. |
| `TARIFA.id_tarifa` | `ESTADIA.id_tarifa` | 1 — N | Una tarifa se usa en muchas estadías. |
| `TIPO_VEHICULO.id_tipo` | `ESTADIA.id_tipo` | 1 — N | Un tipo de vehículo tiene muchas estadías. |
| `TIPO_VEHICULO.id_tipo_vehiculo` | `ESTADIA.id_tipo_vehiculo` | 1 — N | Relación alterna tipo de vehículo → estadía. |
| `TIPO_VEHICULO.id_tipo_vehiculo` | `TARIFA.id_tipo` | 1 — N | Relación tipo de vehículo → tarifa. |
| `PAGO.id_pago` | `ESTADIA.id_pago` | 1 — N | Un pago puede referenciarse desde estadías. |
| `METODO_PAGO.id_metodo_pago` | `PAGO.id_metodo_pago` | 1 — N | Un método de pago se usa en muchos pagos. |
| `USUARIO.id_usuario` | `ESTADIA.id_usuario` | 1 — N | Un usuario registra muchas estadías. |

---

## 3. Reglas de negocio asociadas

- Una **estadía activa** se identifica porque `hora_salida` es `NULL`.
- No se permite un nuevo **ingreso** para una placa que ya tenga una estadía activa (`hora_salida IS NULL`).
- Al registrar la **salida** se calcula el importe (por hora y/o fracción según la tarifa) y se genera el **PAGO** asociado.
- La **tarifa aplicada** se toma de la tarifa vigente (`estado = true`) del tipo de vehículo al momento del ingreso.
- Los **montos** se expresan en Soles (PEN) con dos decimales.

---

## 4. Observaciones y pendientes del modelo

Puntos detectados en el diagrama actual que conviene revisar antes de generar las migraciones:

- **Columnas duplicadas:** `ESTADIA` tiene `id_tipo` e `id_tipo_vehiculo` apuntando al mismo concepto, y `TIPO_VEHICULO` mezcla `id_tipo` / `id_tipo_vehiculo`. Definir una única clave y eliminar duplicados.
- **Nombres con caracteres especiales:** `id_estadía` (tilde) y `fecha-hora` (guion). Se recomienda `id_estadia` y `fecha_hora` para evitar problemas en SQL/ORM.
- **Tipo `TIME` en montos de tiempo:** `PAGO.tiempo_horas` / `tiempo_fraccion` se modelan mejor como `DECIMAL` (número de horas) o `INT` (minutos).
- **Precisión de dinero:** definir explícitamente `DECIMAL(10,2)` para `monto`, `precio_hora` y `precio_fraccion`.
- **Seguridad:** `USUARIO.contrasena` debe almacenar un **hash** (bcrypt/argon2), nunca texto plano.
- **Índices y restricciones:** el diagrama no define `UNIQUE` (p. ej. `TIPO_VEHICULO.nombre`, `METODO_PAGO.nombre`) ni índices (`ESTADIA.placa`, `ESTADIA.hora_salida`).
- **Estados:** `TIPO_VEHICULO` no expone un campo `estado`; si se requiere activar/desactivar categorías, agregarlo.
- **Auditoría:** considerar campos `created_at` / `updated_at` en las tablas principales.
