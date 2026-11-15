# Plan de Pruebas y Depuración — Realizar Reserva Web (`UPAO-21` / Subtarea `UPAO-85`)

> **Historia de Usuario:** `UPAO-21` — Realizar reserva (5 Story Points)  
> **Subtarea Jira:** `UPAO-85` — Probar y depurar registro de conductor, vehículos, reserva y pago Stripe  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-21`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-21-01** | 1- Válido: Pasarela Stripe activa y registro de `CONDUCTOR` | `SP3-01` y `SP3-02` verificados en `test-reservas-sprint3.js`: retorna `publishableKey` (`pk_test_...`), `toleranciaMinutos: 30`, crea usuario `CONDUCTOR` y emite token HMAC. | ✅ Aprobado |
| **CP-21-02** | 2- Válido: Registro de vehículo SUNARP/MTC y vista previa de adelanto | `SP3-03` y UI (`capturar_ui.js`) verificados: registra vehículo válido y `GET /api/conductor/vehiculos` devuelve `precioAdelanto` de 1h antes del checkout. | ✅ Aprobado |
| **CP-21-03** | 3- Válido: Pago Stripe (PEN) y reserva `VIGENTE` por 30 minutos | `SP3-04` y `SP3-05` verificados contra Stripe Test Mode: crea `PaymentIntent` `succeeded`, reserva `VIGENTE` (+30 min) y descuenta 1 espacio en `/api/publico/disponibilidad`. | ✅ Aprobado |
| **CP-21-04** | 4- Válido: Descuento automático del adelanto en salida | `SP3-09` verificado en `test-reservas-sprint3.js`: `POST /api/salidas` retorna `montoBruto`, `adelantoReserva` y cobra `saldo = max(0, montoBruto - adelantoReserva)`. | ✅ Aprobado |
| **CP-21-05** | 5- Inválido: Placa repetitiva o formato no válido MTC (Poka-Yoke) | `SP3-03` verificado: rechaza `AAA-000` con HTTP `400 Bad Request` y mensaje de validación. | ✅ Aprobado |
| **CP-21-06** | 6- Inválido: Reserva sin iniciar sesión (sin token) | Caso negativo pendiente de prueba negativa dedicada contra `POST /api/reservas` sin header `Authorization`. | ⏳ Pendiente |
| **CP-21-07** | 7- Inválido: Sin espacios disponibles para el tipo de vehículo | Caso de aforo lleno en reservas pendiente de prueba con cupos = 0. | ⏳ Pendiente |
| **CP-21-08** | 8- Inválido: Placa con reserva vigente o estadía activa previa | Caso de bloqueo por doble reserva/estadía pendiente de prueba negativa dedicada. | ⏳ Pendiente |
| **CP-21-09** | 9- Inválido: Pago Stripe fallido o no confirmado | Caso con `PaymentIntent` en estado distinto de `succeeded` pendiente de prueba negativa dedicada. | ⏳ Pendiente |

---

## 2. Comandos de Ejecución

```bash
node tests/test-reservas-sprint3.js
npm run test:regresion
```

---

## 3. Defect Log (`UPAO-21`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-21-01** | Permiso de redirecciones en Stripe `PaymentIntent` (`PEN`) | El método `automatic_payment_methods` sin restringir redirecciones requería `return_url` al confirmar pagos con tarjeta por API/Elements. | Se configuró `'automatic_payment_methods[allow_redirects]': 'never'` en `src/config/stripe.js`. | Cerrado |

---

## 4. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva` → `develop`)

- **Pull Request hacia `develop` (Blue):** [#25 — Manejo de Reserva Web y Portal del Conductor](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/25)
- **BD y Migración (`UPAO-79`):** [Commit `758b47e`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/758b47e7bca2628ff1b011d709923c81afc476ba)
- **API Backend (`UPAO-84`):** [Commit `c810227`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/c810227c66c0e8914950c1c16030c533a2297e3c)
- **UI y Sidebar (`UPAO-83`):** [Commit `4c050b9`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/4c050b92566abfe059054770ee06756fd251bd8c)
- **Suite Sprint 3 (`UPAO-85`):** [Commit `fd90e2b`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/fd90e2b216f4ca4237119c36691e5e849ec345e2)
