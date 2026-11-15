# Plan de Pruebas y Depuración — Anulación de Reserva (`UPAO-22` / Subtarea `UPAO-89`)

> **Historia de Usuario:** `UPAO-22` — Anular reserva (3 Story Points)  
> **Subtarea Jira:** `UPAO-89` — Probar y depurar anulación de reserva, liberación de cupos y permisos  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-22`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-22-01** | 1- Válido: Anulación de reserva vigente con reembolso Stripe | `SP3-06` verificado en `test-reservas-sprint3.js`: ejecuta `POST /v1/refunds` en Stripe, cambia la reserva a `ANULADA` (`REEMBOLSADO`) y libera el espacio en `/api/publico/disponibilidad`. | ✅ Aprobado |
| **CP-22-02** | 2- Inválido: Anular reserva de otro conductor | Caso negativo de aislamiento (`403 Forbidden` al intentar anular reserva ajena) pendiente de ejecución automatizada aislada. | ⏳ Pendiente |
| **CP-22-03** | 3- Inválido: Anular reserva ya utilizada o ya anulada | Caso negativo (`409 Conflict` / prevención de doble reembolso) pendiente de ejecución automatizada aislada. | ⏳ Pendiente |
| **CP-22-04** | 4- Inválido: Anular reserva con tolerancia (30 min) vencida | Caso límite con `fechaLimite` expirada pendiente de ejecución automatizada aislada. | ⏳ Pendiente |

---

## 2. Comandos de Ejecución

```bash
node tests/test-reservas-sprint3.js
```

---

## 3. Defect Log (`UPAO-22`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-22-01** | Permiso de Reembolsos en Clave Restringida de Stripe (`rk_test_...`) | Una Restricted Key sin permiso de escritura en `Charges/Refunds` impedía completar el reembolso en `POST /api/reservas/:id/anular`. | `src/config/stripe.js` valida explícitamente la respuesta de `/v1/refunds` y propaga el detalle de error sin alterar el estado local en PostgreSQL. | Cerrado |

---

## 4. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva` → `develop`)

- **Pull Request hacia `develop` (Blue):** [#25 — Manejo de Reserva Web y Portal del Conductor](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/25)
- **Backend Anulación y Stripe Refund (`UPAO-88`):** [`src/routes/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/reservas.js) · [`src/config/stripe.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/config/stripe.js)
- **Interfaz Mis Reservas y Modal (`UPAO-87`):** [`public/js/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/reservas.js)
- **Caso automatizado `SP3-06` (`UPAO-89`):** [`tests/test-reservas-sprint3.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/tests/test-reservas-sprint3.js)
