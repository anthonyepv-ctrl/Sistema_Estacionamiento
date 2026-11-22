# Análisis y Diseño — Anulación de Reserva (`UPAO-22` / Subtarea `UPAO-80`)

## 1. Objetivo
Permitir al conductor autenticado anular una reserva propia en estado `VIGENTE` antes de su ingreso o vencimiento, ejecutando el **reembolso íntegro automático vía Culqi Perú (`POST /v2/refunds`)** y liberando inmediatamente el espacio en la disponibilidad pública.

---

## 2. Flujo de Anulación y Reembolso

```text
[Conductor en "Mis Reservas" (/api/reservas/mias)]
        │  Pulsa "Anular Reserva" en una reserva VIGENTE
        ▼
[Modal de Confirmación Explícita (#modal-anular-reserva)]
        │  Muestra código (RES-xxxxxx), placa, monto (S/) y plazo bancario transparente
        ▼
[POST /api/reservas/:id/anular] (Rol: CONDUCTOR)
        ├── Bloqueo en vuelo contra doble clic y verificación de propiedad (reserva.idUsuario === req.sesion.sub)
        ├── Ejecuta vencimiento perezoso y valida estado === 'VIGENTE'
        ├── Invoca POST /v2/refunds en Culqi (charge_id, amount, reason: 'solicitud_comprador', Idempotency-Key)
        ▼
[Actualización Atómica en PostgreSQL (pg_advisory_xact_lock)]
        │  estado = 'ANULADA', estadoPago = 'REEMBOLSADO', pasarelaReembolsoId = ref_..., fechaAnulacion = NOW()
        ▼
[Disponibilidad Pública (/api/publico/disponibilidad)]
        └── Deja de contarla en reservasVigentes (+1 espacio libre inmediato)
```

---

## 3. Reglas de Negocio y Seguridad

1. **Propiedad estricta:** solo el conductor dueño de la reserva puede anularla; otro usuario recibe HTTP `403`.
2. **Solo reservas vigentes:** si la reserva ya pasó a `VENCIDA`, `UTILIZADA` o `ANULADA`, devuelve `409 Conflict` y no ejecuta reembolso.
3. **Integridad financiera e idempotencia:** el reembolso en Culqi (`POST /v2/refunds`, `reason: 'solicitud_comprador'`, `Idempotency-Key: refund-res-<id>`) se ejecuta antes de marcar la reserva como `ANULADA` / `REEMBOLSADO` bajo `pg_advisory_xact_lock` (evitando carrera entre anular y confirmar ingreso en garita).
4. **Transparencia en plazos de devolución:** como las reservas vencen en 30 minutos, las anulaciones ocurren el mismo día y Culqi procesa la reversión inmediatamente; el reflejo en la cuenta o app del banco del cliente puede tomar entre **24 horas y 3 días hábiles** según su entidad financiera.
5. **Confirmación explícita en UI:** el modal `#modal-anular-reserva` exige confirmación del usuario y maneja estado `loading` para evitar doble clic.

---

## 4. Endpoints Planificados (`UPAO-22`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/reservas/mias` | `CONDUCTOR` | Lista las reservas del conductor aplicando vencimiento perezoso (> 30 min). |
| `POST` | `/api/reservas/:id/anular` | `CONDUCTOR` | Valida propiedad/vigencia, ejecuta refund en Culqi, anula la reserva y libera el espacio. |

---

## 5. Casos de Prueba (Diseño — `UPAO-22`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-22-01** | 1- Válido: Anulación de reserva vigente con reembolso Culqi | Conductor dueño confirma anulación en reserva `VIGENTE` (`POST /api/reservas/:id/anular`) | Ejecuta `POST /v2/refunds` en Culqi, guarda `pasarelaReembolsoId`, reserva pasa a `ANULADA` (`REEMBOLSADO`) y libera el espacio de inmediato. | Pendiente |
| **CP-22-02** | 2- Inválido: Anular reserva de otro conductor | Conductor A envía `POST /api/reservas/:id/anular` sobre reserva de Conductor B | Backend rechaza con HTTP `403 Forbidden` sin alterar la reserva ni reembolsar. | Pendiente |
| **CP-22-03** | 3- Inválido: Anular reserva ya utilizada o ya anulada | `POST /api/reservas/:id/anular` sobre reserva `UTILIZADA` o `ANULADA` | Bloquea la acción (HTTP `409 Conflict`) y no ejecuta doble reembolso. | Pendiente |
| **CP-22-04** | 4- Inválido: Anular reserva con tolerancia (30 min) vencida | Reserva con `fechaLimite` anterior a la hora actual al intentar anular | Transiciona a `VENCIDA` y rechaza anulación con reembolso por plazo expirado. | Pendiente |
