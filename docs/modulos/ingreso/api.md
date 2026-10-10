# Módulo Ingreso — API (UPAO-40)

Backend Express + Prisma para el registro de ingreso de vehículos.

## Endpoints

### POST `/api/ingresos`

Registra el ingreso de un vehículo (hora automática).

```json
// Petición  (tipo: "auto" | "moto")
{ "placa": "ABC-123", "tipo": "auto" }

// Respuesta 201
{ "id": 1, "placa": "ABC-123", "tipo": "Automóvil / Camioneta", "horaIngreso": "2026-10-10T00:42:39.714Z", "mensaje": "Ingreso registrado: Placa [ABC-123]" }

// Respuesta 400 (placa/tipo inválidos o placa vacía)
{ "error": "Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A)." }

// Respuesta 409 (duplicado activo)
{ "error": "El vehículo con placa ABC-123 ya registra un ingreso activo." }
```

### GET `/api/ingresos/activos`

Lista los vehículos con ingreso activo (`hora_salida` nula).

## Validaciones

- **Placa:** se normaliza a MAYÚSCULAS + guion; formato peruano (auto `ABC-123`, moto `1234-AB`).
- **Tipo:** `auto` o `moto`; debe existir una tarifa vigente para el tipo.
- **Duplicado:** no se permite una placa con ingreso activo (índice único parcial `estadia_placa_activa_key`).
- **Hora de ingreso:** automática (`DEFAULT now()`); el estado es "activo" mientras `hora_salida` sea nula.

## Estructura

| Archivo | Rol |
| --- | --- |
| `server.js` | Registra `/api/ingresos`. |
| `src/routes/ingresos.js` | Endpoints de ingreso. |
| `public/js/app.js` | El formulario llama a `POST /api/ingresos`. |

## Credenciales (seed)

| Usuario | Contraseña | Rol | Módulo |
| --- | --- | --- | --- |
| `admin` | `123456` | DUEÑO | Configurar Tarifas |
| `recepcion` | `123456` | RECEPCIONISTA | Registrar Ingreso |

> El menú principal muestra los módulos según el **rol** del usuario que inicia sesión.

## Pendiente

- **Aforo:** se controla por totales y entradas activas; registrar suma una entrada (ocupado +1, disponible −1). El bloqueo por *"aforo = 0"* requiere definir la **capacidad total**, que aún no está en el modelo.
