# Análisis y Diseño — Anulación de Reserva (`UPAO-22` / Subtarea `UPAO-80`)

## 1. Objetivo
Permitir al conductor autenticado anular una reserva propia en estado `VIGENTE` antes de su ingreso o vencimiento, ejecutando el **reembolso íntegro automático vía Stripe** y liberando inmediatamente el espacio en la disponibilidad pública.

---

## 2. Flujo de Anulación y Reembolso

```text
[Conductor en "Mis Reservas" (/api/reservas/mias)]
        │  Pulsa "Anular Reserva" en una reserva VIGENTE
        ▼
[Modal de Confirmación Explícita (#modal-anular-reserva)]
        │  Muestra código (RES-xxxxxx), placa y monto a reembolsar (S/)
        ▼
[POST /api/reservas/:id/anular] (Rol: CONDUCTOR)
        ├── Verifica existencia y propiedad (reserva.idUsuario === req.sesion.sub)
        ├── Ejecuta vencimiento perezoso y valida estado === 'VIGENTE'
        ├── Invoca POST /v1/refunds en Stripe (stripePaymentIntentId)
        ▼
[Actualización en PostgreSQL]
        │  estado = 'ANULADA', estadoPago = 'REEMBOLSADO', fechaAnulacion = NOW()
        ▼
[Disponibilidad Pública (/api/publico/disponibilidad)]
        └── Deja de contarla en reservasVigentes (+1 espacio libre inmediato)
```

---

## 3. Reglas de Negocio y Seguridad

1. **Propiedad estricta:** solo el conductor dueño de la reserva puede anularla; otro usuario recibe HTTP `403`.
2. **Solo reservas vigentes:** si la reserva ya pasó a `VENCIDA`, `UTILIZADA` o `ANULADA`, devuelve `409 Conflict` y no ejecuta reembolso.
3. **Integridad financiera:** el reembolso en Stripe (`POST /v1/refunds`) se ejecuta antes de marcar la reserva como `ANULADA` / `REEMBOLSADO`; si Stripe rechaza la operación, el estado local no cambia.
4. **Confirmación explícita en UI:** el modal `#modal-anular-reserva` exige confirmación del usuario y maneja estado `loading` para evitar doble clic.

---

## 4. Endpoints Planificados (`UPAO-22`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/reservas/mias` | `CONDUCTOR` | Lista las reservas del conductor aplicando vencimiento perezoso (> 30 min). |
| `POST` | `/api/reservas/:id/anular` | `CONDUCTOR` | Valida propiedad/vigencia, ejecuta refund en Stripe, anula la reserva y libera el espacio. |

---

## 5. Casos de Prueba (Diseño — `UPAO-22`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-22-01** | 1- Válido: Anulación de reserva vigente con reembolso Stripe | Conductor dueño confirma anulación en reserva `VIGENTE` (`POST /api/reservas/:id/anular`) | Ejecuta refund en Stripe, reserva pasa a `ANULADA` (`REEMBOLSADO`) y libera el espacio de inmediato. | Pendiente |
| **CP-22-02** | 2- Inválido: Anular reserva de otro conductor | Conductor A envía `POST /api/reservas/:id/anular` sobre reserva de Conductor B | Backend rechaza con HTTP `403 Forbidden` sin alterar la reserva ni reembolsar. | Pendiente |
| **CP-22-03** | 3- Inválido: Anular reserva ya utilizada o ya anulada | `POST /api/reservas/:id/anular` sobre reserva `UTILIZADA` o `ANULADA` | Bloquea la acción (HTTP `409 Conflict`) y no ejecuta doble reembolso. | Pendiente |
| **CP-22-04** | 4- Inválido: Anular reserva con tolerancia (30 min) vencida | Reserva con `fechaLimite` anterior a la hora actual al intentar anular | Transiciona a `VENCIDA` y rechaza anulación con reembolso por plazo expirado. | Pendiente |
