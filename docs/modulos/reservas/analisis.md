# Análisis y Diseño — Realizar Reserva Web (`UPAO-21` / Subtarea `UPAO-79`)

## 1. Flujo de Reserva del Conductor

```text
[Portada Pública /api/publico/disponibilidad]
        │  Disponibles = max(0, Capacidad - EnCochera - ReservasVigentes)
        ▼
[Conductor pulsa "Reservar espacio"]
        ├── Sin sesión ──► [Login / Registro CONDUCTOR] (DNI 8d, Celular 9d, Usuario, Clave)
        └── Con sesión ──► [Mis Vehículos] (Placa MTC + Poka-Yoke)
                                │  Muestra adelanto (1 hora de tarifa vigente)
                                ▼
                    [Checkout Stripe Test Mode (PEN)]
                                │  PaymentIntent confirmado (succeeded)
                                ▼
                    [Reserva VIGENTE (+30 min tolerancia)] ──► descuenta 1 espacio
```

---

## 2. Modelo de Datos (Extensiones en PostgreSQL / Prisma)

### 2.1. `usuario` (extensión)
- Se agrega `CONDUCTOR` al enum `rol_usuario`.
- Campos opcionales (obligatorios al registrar un `CONDUCTOR`):
  - `dni` (`VARCHAR(8)`, `UNIQUE`, `NULL`) — exactamente 8 dígitos (`^\d{8}$`).
  - `celular` (`VARCHAR(9)`, `NULL`) — exactamente 9 dígitos iniciando en 9 (`^9\d{8}$`).

### 2.2. `vehiculo_conductor` (nueva tabla)
- `id_vehiculo` (PK), `id_usuario` (FK → `usuario`), `placa` (`VARCHAR(10)`), `id_tipo_vehiculo` (FK → `tipo_vehiculo`), `creado_en`.
- Restricción `UNIQUE (id_usuario, placa)`.

### 2.3. `reserva` (nueva tabla)
- `id_reserva` (PK), `codigo` (`VARCHAR(12)`, `UNIQUE`, ej. `RES-00001`).
- `id_usuario` (FK → `usuario`), `id_vehiculo` (FK → `vehiculo_conductor`), `id_tipo_vehiculo` (FK → `tipo_vehiculo`).
- `fecha_reserva` (`TIMESTAMP`, default `CURRENT_TIMESTAMP`).
- `fecha_limite` (`TIMESTAMP`, `fecha_reserva + 30 minutos`).
- `estado` (`ENUM`: `VIGENTE`, `UTILIZADA`, `ANULADA`, `VENCIDA`).
- `monto_adelanto` (`DECIMAL(10,2)` — equivalente a 1 hora de tarifa vigente).
- `stripe_payment_intent_id` (`VARCHAR(100)`, `NULL`).
- `estado_pago` (`ENUM`: `PAGADO`, `REEMBOLSADO`).
- `fecha_anulacion` (`TIMESTAMP`, `NULL`).

---

## 3. Reglas de Negocio, Concurrencia y UX de Reserva

1. **Vencimiento perezoso:** antes de recalcular disponibilidad o validar una nueva reserva, las reservas `VIGENTE` con `fecha_limite < NOW()` pasan automáticamente a `VENCIDA`.
2. **Concurrencia atómica:** `POST /api/reservas` utiliza `pg_advisory_xact_lock` por `id_tipo_vehiculo` para evitar sobreventa simultánea cuando queda 1 espacio disponible.
3. **Unicidad operativa de placa:** no se permite crear una reserva si la placa ya tiene una reserva `VIGENTE` o una estadía activa (`hora_salida IS NULL`).
4. **Control de acceso por rol:** `/api/conductor/vehiculos`, `/api/reservas/intencion-pago` y `/api/reservas` exigen sesión válida con rol `CONDUCTOR`.
5. **Protagonismo de reserva, modal limpio y navegación sin redundancia:** en el módulo del conductor, **Realizar Reserva Web** ocupa la columna principal (`3fr`) y **Mis Vehículos** la columna secundaria (`2fr`). El cliente visualiza el adelanto (`S/ 0.00`) y completa el cobro en un modal limpio de tarjeta sin tecnicismos internos del proveedor. Además, la vista inicial de `Menú Principal` oculta la barra lateral para evitar redundancias y, una vez dentro de cualquier módulo, `#app-sidebar` muestra tarjetas compactas verticales (ícono + título en mayúsculas) ordenadas según frecuencia de uso e importancia operativa por rol.

### 3.6. Autogestión de credenciales de pasarela por el Dueño (Sin intervención técnica)
- Para que el Product Owner o Dueño pueda operar la cochera desde cero sin acceder al panel de infraestructura ni editar variables de entorno, el módulo incorpora la vista **Pasarela de Pagos (Stripe)** (`#view-pasarela-stripe`, visible solo para rol `DUENO`), acompañada de una guía visual de 4 pasos en bloques comparativos (**Modo Prueba** vs **Modo Producción**) con acceso directo al panel de claves de Stripe.
- El sistema utiliza las variables del servidor (`STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY`) como respaldo inicial y permite al `DUENO` ingresar, validar (`pk_test_`/`pk_live_` + `sk_test_`/`sk_live_` del mismo entorno) o restaurar sus propias claves API directamente desde la aplicación (`src/config/stripe.js`, persistencia local excluida de Git en `src/config/stripe-keys.json`).

---

## 4. Endpoints Planificados (`UPAO-21`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/auth/registro-conductor` | Público | Crea cuenta `CONDUCTOR` y emite token HMAC. |
| `GET/POST/DELETE` | `/api/conductor/vehiculos` | `CONDUCTOR` | Gestiona vehículos del conductor con validación MTC/Poka-Yoke y `precioAdelanto`. |
| `GET` | `/api/reservas/config-pasarela` | Autenticado | Retorna `publishableKey`, `toleranciaMinutos` (30), `modo` y `origen`. |
| `PUT` | `/api/reservas/config-pasarela` | `DUENO` | Valida, guarda o restaura las credenciales API de Stripe ingresadas por el Dueño. |
| `POST` | `/api/reservas/intencion-pago` | `CONDUCTOR` | Valida cupo/placa y crea intención de pago en PEN (1h de tarifa). |
| `POST` | `/api/reservas` | `CONDUCTOR` | Verifica pago aprobado y registra reserva `VIGENTE` (+30 min). |

---

## 5. Casos de Prueba (Diseño — `UPAO-21`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-21-01** | 1- Válido: Pasarela de pago activa, autogestión `DUENO` y registro `CONDUCTOR` | `GET/PUT /api/reservas/config-pasarela` + `POST /api/auth/registro-conductor` (DNI 8 dígitos, celular `9XXXXXXXX`) | Retorna clave pública, permite al `DUENO` actualizar/restaurar API keys (rechaza `CONDUCTOR` 403 y llaves inválidas 400), crea `CONDUCTOR` y emite token HMAC. | Pendiente |
| **CP-21-02** | 2- Válido: Registro de vehículo SUNARP/MTC y vista previa de adelanto | `POST /api/conductor/vehiculos` (`ABC-123` / `T9Z-814`, Auto) + `GET /api/conductor/vehiculos` | Registra vehículo y devuelve `precioAdelanto` igual a 1 hora de tarifa vigente (`S/`). | Pendiente |
| **CP-21-03** | 3- Válido: Pago adelantado con tarjeta (PEN) y reserva `VIGENTE` por 30 min | `POST /api/reservas/intencion-pago` + tarjeta de prueba aprobada + `POST /api/reservas` | Crea reserva `VIGENTE` (30 min), `estadoPago: PAGADO` y descuenta 1 espacio en `/api/publico/disponibilidad`. | Pendiente |
| **CP-21-04** | 4- Inválido: Placa repetitiva o formato no válido MTC (Poka-Yoke) | `POST /api/conductor/vehiculos` con `AAA-000` o `123456` | Rechaza con HTTP `400 Bad Request` y alerta de formato inválido. | Pendiente |
| **CP-21-05** | 5- Inválido: Reserva sin iniciar sesión (sin token) | `POST /api/reservas` sin cabecera `Authorization: Bearer` | Rechaza con HTTP `401 Unauthorized` y exige autenticación `CONDUCTOR`. | Pendiente |
| **CP-21-06** | 6- Inválido: Sin espacios disponibles para el tipo de vehículo | Solicitud cuando `disponibles <= 0` en el tipo elegido | Rechaza creación (HTTP `409`) e informa falta de disponibilidad. | Pendiente |
| **CP-21-07** | 7- Inválido: Placa con reserva vigente o estadía activa previa | Conductor intenta reservar placa con reserva `VIGENTE` o estadía en curso | Bloquea creación con HTTP `409` evitando doble reserva/ingreso. | Pendiente |
| **CP-21-08** | 8- Inválido: Pago con tarjeta fallido o no confirmado | `POST /api/reservas` con `paymentIntentId` distinto de `succeeded` | Backend rechaza (HTTP `402`) y no descuenta espacio público. | Pendiente |
