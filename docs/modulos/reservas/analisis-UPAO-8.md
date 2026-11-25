# Análisis y Diseño — Búsqueda y Confirmación de Reservas

## 1. Objetivo
Permitir al Recepcionista y al Dueño consultar reservas por código (`RES-xxxxxxxx`), placa (con o sin guion), DNI o nombre del conductor, detectar automáticamente placas con reserva `VIGENTE` dentro del flujo normal de ingreso, proteger los cupos reservados ante ingresos presenciales (*walk-in*) y confirmar la llegada vinculando la estadía con el adelanto pagado para descontarlo al registrar la salida.

---

## 2. Flujos en Recepción

### 2.1. Detección automática al digitar la placa en Registrar Ingreso
```text
[Recepcionista escribe placa en #view-ingreso]
        │  GET /api/reservas/por-placa/:placa (normalizada, con o sin guion)
        ├── Sin reserva VIGENTE ──► Botón principal verde "Registrar Ingreso"
        │                           (POST /api/ingresos; valida aforo con reservas vigentes)
        └── Con reserva VIGENTE ──► Muestra aviso informativo RESERVADO (código, conductor, adelanto, límite)
                                    Botón principal cambia a azul "Confirmar ingreso con reserva"
                                    (POST /api/reservas/:id/confirmar con nota opcional -> Estadía + UTILIZADA)
```

### 2.2. Búsqueda manual por código, placa, DNI o nombre
```text
[Sidebar / Menú Principal -> "Buscar Reservas" (#view-garita-reservas)]
        │  GET /api/reservas?q=...&estado=...
        ▼
[Listado en tabla de una línea (código, placa, conductor/DNI, vigencia, adelanto y estado)]
        └── Si estado === VIGENTE ──► Botón "Confirmar" (POST /api/reservas/:id/confirmar)
```

---

## 3. Reglas de Negocio, Seguridad y Concurrencia

1. **Búsqueda multicriterio (`RN-01`):** `GET /api/reservas` busca por código de reserva, placa normalizada (con o sin guion), DNI o nombre del conductor y filtra por estado (`VIGENTE`, `UTILIZADA`, `VENCIDA`, `ANULADA`), ejecutando vencimiento perezoso (`> 30 min`) antes de devolver resultados.
2. **Control de acceso estricto (`RN-02`):** `GET /api/reservas`, `GET /api/reservas/por-placa/:placa` y `POST /api/reservas/:id/confirmar` están restringidos exclusivamente a roles `RECEPCIONISTA` y `DUENO`; un `CONDUCTOR` recibe HTTP `403` y peticiones sin token reciben `401`.
3. **Transacción atómica y vínculo `estadia.id_reserva` (`RN-03`):** `POST /api/reservas/:id/confirmar` adquiere `pg_advisory_xact_lock` por `id_tipo_vehiculo` y por reserva `(780000, id)`, aplica vencimiento perezoso, exige estado `VIGENTE` y ausencia de estadía activa, marca la reserva `UTILIZADA` y crea la `estadia` vinculada mediante `id_reserva` (`INTEGER`, `UNIQUE`, `NULL`, FK → `reserva`).
4. **Protección de cupo y bloqueo de ingreso duplicado (`RN-04`):** `POST /api/ingresos` rechaza con HTTP `409` tanto el ingreso normal de una placa con reserva `VIGENTE` como ingresos presenciales cuando `estadiasActivas + reservasVigentes >= capacidad`.
5. **Descuento automático en Salida (`RN-05`):** `POST /api/salidas` lee `estadia.reserva.montoAdelanto`, lo descuenta del total calculado (`saldo = max(0, montoBruto - adelantoReserva)`) y retorna ambos importes.
6. **Endurecimiento anti-bot e integridad (`RN-06`):** el servidor aplica cabeceras defensivas HTTP, límite de payload JSON (`100 KB`), limitación de tasa por IP (`HTTP 429` + `Retry-After`) y escape HTML en el renderizado de resultados.

---

## 4. Endpoints Planificados

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/reservas/por-placa/:placa` | `RECEPCIONISTA` / `DUENO` | Detecta si una placa (con o sin guion) tiene reserva `VIGENTE`. |
| `GET` | `/api/reservas` | `RECEPCIONISTA` / `DUENO` | Busca reservas por código, placa normalizada, DNI o nombre y filtra por estado. |
| `POST` | `/api/reservas/:id/confirmar` | `RECEPCIONISTA` / `DUENO` | Confirma llegada bajo lock, marca `UTILIZADA` y crea la estadía activa vinculada. |

---

## 5. Casos de Prueba (Diseño)

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-08-01** | 1- Válido: Búsqueda por código, placa, DNI o nombre | Recepcionista consulta `GET /api/reservas?q=<criterio>` (con o sin guion) | Retorna la reserva coincidente con placa, tipo, conductor, vigencia y estado actual. | Pendiente |
| **CP-08-02** | 2- Válido: Detección `RESERVADO` y botón unificado en Ingreso | Recepcionista digita placa con reserva `VIGENTE` en `#view-ingreso` (`GET /api/reservas/por-placa/:placa`) | Muestra aviso amarillo `RESERVADO` y cambia el botón principal a azul `Confirmar ingreso con reserva`. | Pendiente |
| **CP-08-03** | 3- Válido: Confirmar llegada en recepción y abrir estadía vinculada | `POST /api/reservas/:id/confirmar` sobre reserva `VIGENTE` | Cambia reserva a `UTILIZADA` e inicia estadía activa vinculada (`id_reserva`). | Pendiente |
| **CP-08-04** | 4- Válido: Descuento automático del adelanto en salida | Estadía originada en reserva confirmada + `POST /api/salidas` | Devuelve `montoBruto`, `adelantoReserva` (1h) y cobra solo `max(0, montoBruto - adelantoReserva)`. | Pendiente |
| **CP-08-05** | 5- Inválido: Registrar ingreso normal cuando existe reserva vigente | `POST /api/ingresos` con placa que tiene reserva `VIGENTE` sin confirmar llegada | Backend rechaza con HTTP `409 Conflict` para evitar perder el adelanto. | Pendiente |
| **CP-08-06** | 6- Inválido: Confirmar reserva vencida, anulada o ya utilizada | `POST /api/reservas/:id/confirmar` cuando el estado es `VENCIDA`, `ANULADA` o `UTILIZADA` | Rechaza confirmación (HTTP `409`) y no crea estadía vinculada. | Pendiente |
| **CP-08-07** | 7- Inválido: Búsqueda por código o placa inexistente | `GET /api/reservas?q=ZZZ-999` desde Buscar Reservas | Retorna lista vacía (`[]`) con HTTP `200 OK` sin errores. | Pendiente |
| **CP-08-08** | 8- Inválido (Seguridad/Bot): Fuerza bruta en login y saturación pública | Ráfaga repetida a `POST /api/auth/login` o `GET /api/publico/disponibilidad` desde misma IP | Middleware anti-bot responde `HTTP 429` con cabecera `Retry-After` y bloquea abuso. | Pendiente |
| **CP-08-09** | 9- Inválido (Seguridad/Atacante): Payload >100 KB, SQLi/XSS y acceso de rol `CONDUCTOR` | Body >100 KB, payloads SQLi/XSS o token `CONDUCTOR` hacia rutas operativas | Rechaza con `413` / `400` / `401` / `403`, sin ejecutar SQL ni XSS ni escalar privilegios. | Pendiente |
