# Módulo Manejo de Reserva Web — Análisis y Diseño (`UPAO-79` / Épica `UPAO-28`)

## 1. Arquitectura del Flujo de Reservas

```text
[Portada Pública /api/publico/disponibilidad]
        │  Disponibles = max(0, Capacidad - EnCochera - ReservasVigentes)
        ▼
[Conductor pulsa "Reservar espacio"]
        ├── Sin sesión ──► [Login / Registro CONDUCTOR] (DNI 8d, Celular 9d, Usuario, Clave)
        └── Con sesión ──► [Mis Vehículos] (Placa MTC + Poka-Yoke)
                                │
                                ▼
                    [Checkout Stripe Test Mode (1h tarifa)]
                                │  PaymentIntent confirmado
                                ▼
                    [Reserva VIGENTE (+30 min tolerancia)] ──► descuenta 1 espacio
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   [Anular (UPAO-22)]   [Expira > 30 min]    [Garita confirma (UPAO-8)]
   Stripe Refund        Estado: VENCIDA      Estado: UTILIZADA + crea Estadia
   Estado: ANULADA      (+1 espacio libre)   (Salidas descuenta el adelanto)
   (+1 espacio libre)
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
- `id_reserva` (`INTEGER`, `UNIQUE`, `NULL`, FK → `reserva`): vincula la estadía creada al confirmar una reserva en `UPAO-8` para descontar `monto_adelanto` en `POST /api/salidas`.

---

## 3. Reglas de Negocio y Seguridad

1. **Vencimiento perezoso (sin cronjobs):** antes de calcular disponibilidad pública, listar reservas del conductor o buscar en garita, se actualizan a `VENCIDA` todas las reservas `VIGENTE` cuyo `fecha_limite < NOW()`.
2. **Concurrencia atómica:** `POST /api/reservas` usa `pg_advisory_xact_lock` (misma llave por `id_tipo_vehiculo` que `ingresos.js`) para evitar sobreventa simultánea cuando queda 1 espacio.
3. **Unicidad operativa de placa:** una placa no puede crear una reserva si ya tiene una `Reserva` en estado `VIGENTE` o una `Estadia` activa (`hora_salida IS NULL`).
4. **Control de acceso por rol:**
   - `/api/conductor/*` y `/api/reservas/mias`, `/api/reservas/:id/anular` → `CONDUCTOR`.
   - `/api/reservas` (búsqueda) y `/api/reservas/:id/confirmar` → `RECEPCIONISTA` o `DUENO`.
   - Un `CONDUCTOR` recibe `403` si intenta acceder a rutas operativas o de otro conductor.

---

## 4. Endpoints Planificados

| Método | Ruta | Rol | Historia |
| --- | --- | --- | --- |
| `POST` | `/api/auth/registro-conductor` | Público | `UPAO-21` |
| `GET/POST/DELETE` | `/api/conductor/vehiculos` | `CONDUCTOR` | `UPAO-21` |
| `GET` | `/api/reservas/config-pasarela` | `CONDUCTOR` / `RECEPCIONISTA` / `DUENO` | `UPAO-21` |
| `POST` | `/api/reservas/intencion-pago` | `CONDUCTOR` | `UPAO-21` |
| `POST` | `/api/reservas` | `CONDUCTOR` | `UPAO-21` |
| `GET` | `/api/reservas/mias` | `CONDUCTOR` | `UPAO-22` |
| `POST` | `/api/reservas/:id/anular` | `CONDUCTOR` | `UPAO-22` |
| `GET` | `/api/reservas/por-placa/:placa` | `RECEPCIONISTA` / `DUENO` | `UPAO-8` |
| `GET` | `/api/reservas` | `RECEPCIONISTA` / `DUENO` | `UPAO-8` |
| `POST` | `/api/reservas/:id/confirmar` | `RECEPCIONISTA` / `DUENO` | `UPAO-8` |
| `GET` | `/api/conductor/historial` | `CONDUCTOR` | `UPAO-23` |

---

## 5. Navegación Lateral y Prevención Operativa en Garita

1. **Barra lateral izquierda por rol (Sidebar):** una vez iniciada la sesión (`RECEPCIONISTA`, `DUENO` o `CONDUCTOR`), permanece visible un menú lateral izquierdo con los módulos habilitados para ese rol, evitando regresar al Menú Principal en cada transición operativa (en pantallas menores a 900 px se adapta a barra superior horizontal desplazable).
2. **Previsualización inmediata de adelanto:** `GET /api/conductor/vehiculos` incluye `precioAdelanto` para mostrar el monto de 1 hora (`S/ X.XX`) apenas el conductor selecciona su vehículo, antes de abrir el formulario de tarjeta Stripe.
3. **Bloqueo de ingreso normal con reserva vigente:** al ingresar una placa en garita, `GET /api/reservas/por-placa/:placa` detecta si existe una reserva `VIGENTE`, muestra la alerta `RESERVADO` con botón directo de confirmación y deshabilita el ingreso estándar; adicionalmente, `POST /api/ingresos` rechaza (`409`) la creación de una estadía sin reserva para impedir doble ocupación y pérdida del adelanto.

---

## 6. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva` → `develop`)

- **Modelo de Datos y Migración (`UPAO-79`, `UPAO-84`):** [Commit 758b47e](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/758b47e7bca2628ff1b011d709923c81afc476ba) (`prisma/schema.prisma`, `migration.sql`, `Modelo_de_Datos.md`, `diagrama-er.erd`)
- **API Backend (`UPAO-84`, `UPAO-88`, `UPAO-92`, `UPAO-96`):** [Commit c810227](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/c810227c66c0e8914950c1c16030c533a2297e3c) (`conductor.js`, `reservas.js`, `stripe.js`, `placas.js`, `ingresos.js`, `salidas.js`, `publico.js`)
- **Interfaz Web y Sidebar por Rol (`UPAO-83`, `UPAO-87`, `UPAO-91`, `UPAO-95`):** [Commit 4c050b9](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/4c050b92566abfe059054770ee06756fd251bd8c) (`index.html`, `style.css`, `app.js`, `disponibilidad.js`, `public/js/reservas.js`)
- **Suite Automatizada Sprint 3 (`UPAO-85`, `UPAO-89`, `UPAO-93`, `UPAO-97`):** [Commit fd90e2b](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/fd90e2b216f4ca4237119c36691e5e849ec345e2) (`tests/test-reservas-sprint3.js`)
