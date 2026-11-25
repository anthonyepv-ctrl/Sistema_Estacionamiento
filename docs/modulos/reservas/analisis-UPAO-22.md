# Análisis y Diseño — Anulación de Reserva (`UPAO-22` / Subtarea `UPAO-80`)

> **Historia de Usuario:** `UPAO-22` — Anular reserva (3 Story Points · Sprint 3)  
> **Subtarea Jira:** `UPAO-80` — Análisis y diseño de anulación de reserva, reembolso Culqi Perú y liberación de espacio  
> **Épica:** `UPAO-28` (*Manejo de Reserva Web*)

---

## 1. Objetivo
Permitir al conductor autenticado anular una reserva propia en estado `VIGENTE` antes de su ingreso en garita o vencimiento (30 minutos), ejecutando el **reembolso íntegro automático vía Culqi Perú (`POST /v2/refunds`)** cuando exista cargo de pasarela y liberando de inmediato el espacio en la disponibilidad pública.

---

## 2. Alcance y Exclusiones
- **En alcance:** listado de reservas propias del conductor (`GET /api/reservas/mias`), modal de confirmación explícita (`#modal-anular`), anulación atómica (`DELETE /api/reservas/:id` y alias `POST /api/reservas/:id/anular`), reembolso en Culqi Perú (`/v2/refunds`) con `Idempotency-Key`, liberación inmediata de aforo en `GET /api/publico/disponibilidad` y persistencia de `fecha_anulacion` / `pasarela_reembolso_id`.
- **Fuera de alcance:** búsqueda y confirmación en garita (`UPAO-8`), historial de estadías (`UPAO-23`), emisión de notas de crédito electrónicas SUNAT y promoción a ambiente Green (`main`).

---

## 3. Flujo de Anulación y Reembolso (Sin Carrera con Garita)

```text
[Conductor en "3. Mis Reservas" (GET /api/reservas/mias)]
        │  Pulsa "Anular" en una reserva en estado VIGENTE
        ▼
[Modal de Confirmación Explícita (#modal-anular)]
        │  Muestra código (RES-XXXXXXXX), placa, tipo, monto (S/) y aviso de reembolso
        ▼
[DELETE /api/reservas/:id] (o POST /api/reservas/:id/anular — Rol: CONDUCTOR)
        ├── Validación de ID numérico (400) y bloqueo en vuelo contra doble clic (409)
        ├── Transacción PostgreSQL (timeout 30s > HTTP Culqi 20s):
        │     1. Adquiere lock por reserva: pg_advisory_xact_lock(780000::int, id::int)
        │        (no bloquea ingresos walk-in ni reservas de otros vehículos)
        │     2. Valida existencia (404), propiedad (403) y estado VIGENTE (409)
        │     3. Verifica fechaLimite < NOW(): si venció, persiste VENCIDA y rechaza (409) sin reembolsar
        │     4. Si tiene pasarelaPagoId sin reembolso previo, invoca POST /v2/refunds en Culqi
        │        (charge_id, amount en céntimos, reason: 'solicitud_comprador', Idempotency-Key: refund-res-<id>)
        │     5. Actualiza estado = 'ANULADA', estadoPago = 'REEMBOLSADO' (solo si hubo refund),
        │        pasarelaReembolsoId = ref_..., fechaAnulacion = NOW()
        ▼
[Disponibilidad Pública (GET /api/publico/disponibilidad)]
        └── Deja de contarla en reservasVigentes (+1 espacio libre inmediato)
```

---

## 4. Reglas de Negocio y Seguridad

1. **Propiedad estricta y rol (`RN-01`):** solo el conductor dueño de la reserva (`reserva.idUsuario === req.sesion.sub`, rol `CONDUCTOR`) puede anularla; cualquier otro usuario o rol recibe HTTP `403`.
2. **Solo reservas vigentes (`RN-02`):** si la reserva está en `VENCIDA`, `UTILIZADA` o `ANULADA`, el backend responde `409 Conflict` sin invocar reembolso.
3. **Exclusión mutua con ingreso en garita (`RN-03`):** tanto la anulación como la confirmación en garita (`POST /api/reservas/:id/confirmar`) adquieren `pg_advisory_xact_lock(780000::int, id::int)` en orden acíclico, garantizando que nunca ocurra un ingreso confirmado junto con un reembolso ejecutado.
4. **Integridad financiera e idempotencia (`RN-04`):** `POST /v2/refunds` utiliza `Idempotency-Key: refund-res-<id>`, valida monto > 0 y `data.id` de respuesta; si Culqi rechaza o falla, se retorna HTTP `502`/`504` y la reserva permanece intacta en `VIGENTE`. Si la reserva no tuvo cargo en pasarela (`pasarelaPagoId IS NULL`), pasa a `ANULADA` sin marcar `REEMBOLSADO` falso.
5. **Confirmación explícita y resiliencia en UI (`RN-05`):** `#modal-anular` exige confirmación explícita, bloquea cierre/doble clic durante la petición, aplica timeout (`AbortController`) con verificación automática contra `/api/reservas/mias` y refresca la disponibilidad pública en tiempo real.

---

## 5. Endpoints Planificados (`UPAO-22`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/reservas/mias` | `CONDUCTOR` | Lista las reservas del conductor aplicando vencimiento perezoso (> 30 min). |
| `DELETE` | `/api/reservas/:id` | `CONDUCTOR` | Endpoint principal de anulación atómica, reembolso Culqi (`/v2/refunds`) y liberación inmediata de espacio. |
| `POST` | `/api/reservas/:id/anular` | `CONDUCTOR` | Alias compatible que delega al mismo controlador atómico. |

---

## 6. Casos de Prueba (Diseño — `UPAO-22`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-22-01** | 1- Válido: Anulación de reserva vigente con reembolso automático Culqi | Conductor dueño confirma anulación en reserva `VIGENTE` (`DELETE /api/reservas/:id` o `POST /api/reservas/:id/anular`) | Ejecuta `POST /v2/refunds` en Culqi (`solicitud_comprador`), guarda `pasarelaReembolsoId`, reserva pasa a `ANULADA` (`REEMBOLSADO`) y libera +1 espacio de inmediato. | Pendiente |
| **CP-22-02** | 2- Inválido: Anular reserva de otro conductor | Conductor B envía `DELETE /api/reservas/:id` sobre reserva de Conductor A | Backend rechaza con HTTP `403 Forbidden` sin alterar la reserva ni reembolsar. | Pendiente |
| **CP-22-03** | 3- Inválido: Anular reserva ya utilizada o ya anulada | `DELETE /api/reservas/:id` sobre reserva `UTILIZADA` o `ANULADA` | Bloquea la acción (HTTP `409 Conflict`) y no ejecuta doble reembolso. | Pendiente |
| **CP-22-04** | 4- Inválido: Anular reserva con tolerancia (30 min) vencida | Reserva con `fechaLimite` anterior a la hora actual al intentar anular | Persiste estado `VENCIDA` en BD y rechaza la anulación (HTTP `409 Conflict`) sin ejecutar reembolso. | Pendiente |
