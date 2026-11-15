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

### 2.4. `estadia` (extensión)
- `id_reserva` (`INTEGER`, `UNIQUE`, `NULL`, FK → `reserva`): referencia opcional para vincular la estadía con la reserva pagada y descontar `monto_adelanto` al cobrar la salida.

---

## 3. Reglas de Negocio, Concurrencia y Navegación

1. **Vencimiento perezoso:** antes de recalcular disponibilidad o validar una nueva reserva, las reservas `VIGENTE` con `fecha_limite < NOW()` pasan automáticamente a `VENCIDA`.
2. **Concurrencia atómica:** `POST /api/reservas` utiliza `pg_advisory_xact_lock` por `id_tipo_vehiculo` para evitar sobreventa simultánea cuando queda 1 espacio disponible.
3. **Unicidad operativa de placa:** no se permite crear una reserva si la placa ya tiene una reserva `VIGENTE` o una estadía activa (`hora_salida IS NULL`).
4. **Control de acceso por rol:** `/api/conductor/vehiculos`, `/api/reservas/intencion-pago` y `/api/reservas` exigen sesión válida con rol `CONDUCTOR`.
5. **Sidebar lateral y vista previa:** menú lateral izquierdo persistente por rol y campo `precioAdelanto` en `GET /api/conductor/vehiculos` para mostrar el monto exacto (1 hora de tarifa en `S/ 0.00`) antes de abrir el pago con tarjeta Stripe.

---

## 4. Endpoints Planificados (`UPAO-21`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/auth/registro-conductor` | Público | Crea cuenta `CONDUCTOR` y emite token HMAC. |
| `GET/POST/DELETE` | `/api/conductor/vehiculos` | `CONDUCTOR` | Gestiona vehículos del conductor con validación MTC/Poka-Yoke y `precioAdelanto`. |
| `GET` | `/api/reservas/config-pasarela` | Autenticado | Retorna `publishableKey` de Stripe y `toleranciaMinutos` (30). |
| `POST` | `/api/reservas/intencion-pago` | `CONDUCTOR` | Valida cupo/placa y crea `PaymentIntent` en PEN (1h de tarifa). |
| `POST` | `/api/reservas` | `CONDUCTOR` | Verifica pago `succeeded` en Stripe y registra reserva `VIGENTE` (+30 min). |

---

## 5. Casos de Prueba (Diseño — `UPAO-21`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-21-01** | 1- Válido: Pasarela Stripe activa y registro de `CONDUCTOR` | `GET /api/reservas/config-pasarela` + `POST /api/auth/registro-conductor` (DNI 8 dígitos, celular `9XXXXXXXX`) | Retorna `publishableKey` (`pk_test_...`), `toleranciaMinutos=30`, crea usuario `CONDUCTOR` y emite token HMAC. | Pendiente |
| **CP-21-02** | 2- Válido: Registro de vehículo SUNARP/MTC y vista previa de adelanto | `POST /api/conductor/vehiculos` (`ABC-123` / `T9Z-814`, Auto) + `GET /api/conductor/vehiculos` | Registra vehículo y devuelve `precioAdelanto` igual a 1 hora de tarifa vigente (`S/`). | Pendiente |
| **CP-21-03** | 3- Válido: Pago Stripe (PEN) y reserva `VIGENTE` por 30 minutos | `POST /api/reservas/intencion-pago` + tarjeta Stripe `succeeded` + `POST /api/reservas` | Crea reserva `VIGENTE` (30 min), `estadoPago: PAGADO` y descuenta 1 espacio en `/api/publico/disponibilidad`. | Pendiente |
| **CP-21-04** | 4- Válido: Descuento automático del adelanto en salida | Estadía vinculada a reserva confirmada + `POST /api/salidas` | Retorna `montoBruto`, `adelantoReserva` (1h) y cobra solo `max(0, montoBruto - adelantoReserva)`. | Pendiente |
| **CP-21-05** | 5- Inválido: Placa repetitiva o formato no válido MTC (Poka-Yoke) | `POST /api/conductor/vehiculos` con `AAA-000` o `123456` | Rechaza con HTTP `400 Bad Request` y alerta de formato inválido. | Pendiente |
| **CP-21-06** | 6- Inválido: Reserva sin iniciar sesión (sin token) | `POST /api/reservas` sin cabecera `Authorization: Bearer` | Rechaza con HTTP `401 Unauthorized` y exige autenticación `CONDUCTOR`. | Pendiente |
| **CP-21-07** | 7- Inválido: Sin espacios disponibles para el tipo de vehículo | Solicitud cuando `disponibles <= 0` en el tipo elegido | Rechaza creación (HTTP `409`) e informa falta de disponibilidad. | Pendiente |
| **CP-21-08** | 8- Inválido: Placa con reserva vigente o estadía activa previa | Conductor intenta reservar placa con reserva `VIGENTE` o estadía en curso | Bloquea creación con HTTP `409` evitando doble reserva/ingreso. | Pendiente |
| **CP-21-09** | 9- Inválido: Pago Stripe fallido o no confirmado | `POST /api/reservas` con `paymentIntentId` distinto de `succeeded` | Backend rechaza la reserva y no descuenta espacio público. | Pendiente |
