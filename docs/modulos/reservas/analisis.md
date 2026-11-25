# Análisis y Diseño — Realizar Reserva Web (`UPAO-21` / Subtarea `UPAO-79`)

> **Actualización de pasarela (22/11/2026):** Se migró de Stripe a **Culqi Perú** (tarjetas locales y Yape con **RUC 10 / RUC 20**) mediante un adaptador agnóstico (`src/payments/`), ya que Stripe no opera nativamente para comercios peruanos sin entidad extranjera.

## 1. Flujo de Reserva del Conductor

```text
[Portada Pública /api/publico/disponibilidad]
        │  Disponibles = max(0, Capacidad - EnCochera - ReservasVigentes)
        ▼
[Conductor pulsa "Reservar espacio" (Auto / Moto)]
        ├── Sin sesión ──► [Login / Registro CONDUCTOR] ──► retorno directo a Reservas (tipo preseleccionado)
        └── Con sesión ──► [Realizar Reserva / Mis Vehículos] (Placa MTC + Poka-Yoke)
                                │  Muestra adelanto (1h tarifa vigente, mínimo S/ 3.00)
                                ▼
                    [Culqi Checkout v4 (PEN · Tarjeta / Yape)]
                                │  Token único (tkn_... / ype_...)
                                ▼
                    [POST /api/reservas]
                                ├── Pre-valida cupo y placa
                                ├── Cargo idempotente POST /v2/charges en Culqi
                                ├── Transacción atómica con pg_advisory_xact_lock
                                │   (con reembolso compensatorio si falla por último cupo)
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
- `id_reserva` (PK), `codigo` (`VARCHAR(16)`, `UNIQUE`, ej. `RES-123456`).
- `id_usuario` (FK → `usuario`), `id_vehiculo` (FK → `vehiculo_conductor`), `id_tipo_vehiculo` (FK → `tipo_vehiculo`).
- `fecha_reserva` (`TIMESTAMP`, default `CURRENT_TIMESTAMP`).
- `fecha_limite` (`TIMESTAMP`, `fecha_reserva + 30 minutos`).
- `estado` (`ENUM`: `VIGENTE`, `UTILIZADA`, `ANULADA`, `VENCIDA`).
- `monto_adelanto` (`DECIMAL(10,2)` — equivalente a `max(1 hora de tarifa vigente, S/ 3.00)`).
- `pasarela_pago_id` (`VARCHAR(100)`, `UNIQUE`, `NULL` — ID del cargo en Culqi `chr_...`).
- `pasarela_proveedor` (`VARCHAR(30)`, `NOT NULL`, default `'culqi'`).
- `pasarela_reembolso_id` (`VARCHAR(100)`, `NULL`).
- `estado_pago` (`ENUM`: `PAGADO`, `REEMBOLSADO`).
- `fecha_anulacion` (`TIMESTAMP`, `NULL`).

### 2.4. `configuracion_pasarela` (nueva tabla)
- `id_configuracion` (PK), `proveedor` (`VARCHAR(30)`, `UNIQUE`), `llave_publica` (`VARCHAR(120)`), `llave_secreta_cifrada` (`TEXT`, AES-256-GCM), `actualizado_por_id` (FK → `usuario`), `actualizado_en`.

---

## 3. Reglas de Negocio, Concurrencia y Alcance Legal

1. **Vencimiento perezoso:** antes de recalcular disponibilidad o validar una nueva reserva, las reservas `VIGENTE` con `fecha_limite < NOW()` pasan automáticamente a `VENCIDA`.
2. **Concurrencia atómica e idempotencia:** `POST /api/reservas` pre-valida disponibilidad, cobra en Culqi con `Idempotency-Key`, y adquiere `pg_advisory_xact_lock` por `id_tipo_vehiculo` al insertar. Si otro conductor tomó el último espacio durante el cobro, ejecuta reembolso compensatorio automático (`POST /v2/refunds`).
3. **Monto mínimo en línea (`S/ 3.00`) y Yape (`S/ 6.00`):** Culqi exige un mínimo de `S/ 3.00` (`300` céntimos) por cargo con tarjeta; por ello `calcularMontoAdelanto` garantiza `max(precioHora, S/ 3.00)` (ej. Motocicleta pasa de `S/ 2.50` a `S/ 3.00` de adelanto, descontándose íntegro en la salida). Culqi Checkout v4 muestra la pestaña de **Yape** a partir de **`S/ 6.00`** (`600` céntimos, `CULQI_YAPE_MINIMO_SOLES=6`).
4. **Unicidad operativa de placa:** no se permite crear una reserva si la placa ya tiene una reserva `VIGENTE` o una estadía activa (`hora_salida IS NULL`).
5. **Control de acceso por rol:** `/api/conductor/vehiculos`, `/api/reservas/preparar-pago` y `/api/reservas` exigen sesión válida con rol `CONDUCTOR`.
6. **Protagonismo de reserva, modal limpio y navegación sin redundancia:** en el módulo del conductor, **Realizar Reserva Web** ocupa la columna principal (`3fr`) y **Mis Vehículos** la columna secundaria (`2fr`). El cliente visualiza el resumen en un modal limpio y tokeniza mediante **Culqi Checkout v4** sin que el servidor almacene datos sensibles de tarjeta (PCI SAQ-A).
7. **Fuera de alcance explícito — SUNAT:** la emisión de boletas/facturas electrónicas y la declaración tributaria ante SUNAT quedan **fuera del alcance del sistema**; el dueño realiza sus declaraciones manualmente desde SUNAT SOL / Nuevo RUS usando los reportes operativos del sistema.

### 3.8. Autogestión de credenciales de pasarela por el Dueño (Persistente en BD)
- La vista **Pasarela de Pagos (Culqi Perú)** (`#view-pasarela-pagos`, visible solo para rol `DUENO`) permite configurar o restaurar llaves `pk_test_`/`sk_test_` o `pk_live_`/`sk_live_` directamente desde la web, acompañada de una guía paso a paso hacia **CulqiPanel (`https://panel.culqi.com`)**.
- El backend (`src/payments/configStore.js`) usa las variables de entorno (`CULQI_PUBLIC_KEY` / `CULQI_SECRET_KEY`) como respaldo inicial y persiste los overrides del Dueño cifrados con **AES-256-GCM** en PostgreSQL (`configuracion_pasarela`), evitando pérdidas por reinicios en Render.

---

## 4. Endpoints Planificados (`UPAO-21`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/auth/registro-conductor` | Público | Crea cuenta `CONDUCTOR` y emite token HMAC. |
| `GET/POST/DELETE` | `/api/conductor/vehiculos` | `CONDUCTOR` | Gestiona vehículos del conductor con validación MTC/Poka-Yoke y `precioAdelanto` (`>= S/ 3.00`). |
| `GET` | `/api/reservas/config-pasarela` | Autenticado | Retorna `proveedor`, `publishableKey`, `toleranciaMinutos` (30), `montoMinimoSoles` (3), `modo` y `origen`. |
| `PUT` | `/api/reservas/config-pasarela` | `DUENO` | Valida, cifra con AES-256-GCM, guarda en BD o restaura las credenciales API de Culqi. |
| `POST` | `/api/reservas/preparar-pago` | `CONDUCTOR` | Pre-valida cupo/placa y calcula `montoCentimos` y habilitación de Yape antes de abrir Checkout v4. |
| `POST` | `/api/reservas` | `CONDUCTOR` | Ejecuta cargo idempotente en Culqi (`/v2/charges`) y registra reserva `VIGENTE` (+30 min) atómicamente. |

---

## 5. Casos de Prueba (Diseño — `UPAO-21`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-21-01** | 1- Válido: Pasarela Culqi activa, autogestión `DUENO` cifrada en BD y registro `CONDUCTOR` | `GET/PUT /api/reservas/config-pasarela` + `POST /api/auth/registro-conductor` (DNI 8 dígitos, celular `9XXXXXXXX`) | Retorna clave pública, permite al `DUENO` guardar llaves cifradas en `configuracion_pasarela` o restaurar (rechaza `CONDUCTOR` 403, `rk_` y mezcla `test`/`live` 400), crea `CONDUCTOR` y emite token HMAC. | Pendiente |
| **CP-21-02** | 2- Válido: Registro de vehículo SUNARP/MTC y vista previa con piso mínimo `S/ 3.00` | `POST /api/conductor/vehiculos` (`ABC-123` Auto / `1234-9M` Moto) + `GET /api/conductor/vehiculos` | Registra vehículo y devuelve `precioAdelanto = max(tarifa, S/ 3.00)`. | Pendiente |
| **CP-21-03** | 3- Válido: Pago adelantado con Culqi (PEN) y reserva `VIGENTE` por 30 min | `POST /api/reservas/preparar-pago` + token `tkn_test_...` + `POST /api/reservas` | Ejecuta `/v2/charges` con `Idempotency-Key`, crea reserva `VIGENTE` (30 min), `estadoPago: PAGADO` y descuenta 1 espacio en `/api/publico/disponibilidad`. | Pendiente |
| **CP-21-04** | 4- Inválido: Placa repetitiva o formato no válido MTC (Poka-Yoke) | `POST /api/conductor/vehiculos` con `AAA-000` o `123456` | Rechaza con HTTP `400 Bad Request` y alerta de formato inválido. | Pendiente |
| **CP-21-05** | 5- Inválido: Reserva sin iniciar sesión (sin token) | `POST /api/reservas` sin cabecera `Authorization: Bearer` | Rechaza con HTTP `401 Unauthorized` y exige autenticación `CONDUCTOR`. | Pendiente |
| **CP-21-06** | 6- Inválido: Sin espacios disponibles para el tipo de vehículo | Solicitud cuando `disponibles <= 0` en el tipo elegido | Rechaza preparación/creación (HTTP `409`) e informa falta de disponibilidad. | Pendiente |
| **CP-21-07** | 7- Inválido: Placa con reserva vigente o estadía activa previa | Conductor intenta reservar placa con reserva `VIGENTE` o estadía en curso | Bloquea preparación/creación con HTTP `409` evitando doble reserva/ingreso. | Pendiente |
| **CP-21-08** | 8- Inválido: Token/pago Culqi inválido o rechazado | `POST /api/reservas` con `sourceToken: 'tkn_invalido'` o tarjeta rechazada | Backend rechaza (HTTP `402`) y no descuenta espacio público. | Pendiente |
