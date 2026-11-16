# Plan de Pruebas y Depuración — Realizar Reserva Web (`UPAO-21` / Subtarea `UPAO-85`)

> **Historia de Usuario:** `UPAO-21` — Realizar reserva (5 Story Points)  
> **Subtarea Jira:** `UPAO-85` — Probar y depurar registro de conductor, vehículos, reserva y pago con tarjeta  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-21`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-21-01** | 1- Válido: Pasarela de pago activa, autogestión `DUENO` y registro `CONDUCTOR` | `SP3-01`, `SP3-02` y `SP3-02b` verificados en `test-reservas-sprint3.js`: retorna clave pública (`pk_test_...`), valida `PUT /config-pasarela` (`403` a conductor, `400` a llaves inválidas/mixtas, `200` guardar/restaurar como `DUENO`), crea usuario `CONDUCTOR` y emite token HMAC. | ✅ Aprobado |
| **CP-21-02** | 2- Válido: Registro de vehículo SUNARP/MTC y vista previa de adelanto | `SP3-03` y UI (`capturar_ui.js`) verificados: registra vehículo válido y `GET /api/conductor/vehiculos` devuelve `precioAdelanto` de 1h antes de abrir el modal de pago. | ✅ Aprobado |
| **CP-21-03** | 3- Válido: Pago adelantado con tarjeta (PEN) y reserva `VIGENTE` por 30 min | `SP3-04` y `SP3-05` verificados: crea intención de pago aprobada, registra reserva `VIGENTE` (+30 min) y descuenta 1 espacio en `/api/publico/disponibilidad`. | ✅ Aprobado |
| **CP-21-04** | 4- Inválido: Placa repetitiva o formato no válido MTC (Poka-Yoke) | `SP3-03` verificado: rechaza `AAA-000` con HTTP `400 Bad Request` y mensaje de validación. | ✅ Aprobado |
| **CP-21-05** | 5- Inválido: Reserva sin iniciar sesión (sin token) | `SP3-11` verificado: `POST /api/reservas` sin cabecera `Authorization` retorna HTTP `401 Unauthorized`. | ✅ Aprobado |
| **CP-21-06** | 6- Inválido: Sin espacios disponibles para el tipo de vehículo | `SP3-12` verificado: cuando `disponibles = 0`, `POST /api/reservas/intencion-pago` rechaza con HTTP `409 Conflict`. | ✅ Aprobado |
| **CP-21-07** | 7- Inválido: Placa con reserva vigente o estadía activa previa | `SP3-14` verificado: al intentar crear una segunda reserva `VIGENTE` para la misma placa, retorna HTTP `409 Conflict`. | ✅ Aprobado |
| **CP-21-08** | 8- Inválido: Pago con tarjeta fallido o no confirmado | `SP3-13` verificado: al enviar un `paymentIntentId` no aprobado a `POST /api/reservas`, rechaza con HTTP `402 Payment Required`. | ✅ Aprobado |

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
| **DEF-21-01** | Redirección en confirmación de pago con tarjeta (`PEN`) | La configuración por defecto exigía `return_url` para métodos con redirección al confirmar por API/Elements. | Se configuró `'automatic_payment_methods[allow_redirects]': 'never'` en `src/config/stripe.js`. | Cerrado |
| **DEF-21-02** | Jerarquía visual y jerga técnica en `#view-conductor-reservas` | *Mis Vehículos* ocupaba la columna principal (`3fr`) desplazando *Realizar Reserva*, y el formulario exponía texto interno (`Stripe Test Mode`) al cliente final. | Se colocó **1. Realizar Reserva Web** en la columna protagonista (`3fr`), **2. Mis Vehículos** a la derecha (`2fr`) y el cobro con tarjeta en el modal limpio `#modal-pago-reserva`. | Cerrado |

---

## 4. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva`)

- **BD y Migración (`UPAO-79`):** [Commit `758b47e`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/758b47e7bca2628ff1b011d709923c81afc476ba)
- **API Backend (`UPAO-84`):** [Commit `c810227`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/c810227c66c0e8914950c1c16030c533a2297e3c) · [`src/config/stripe.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/config/stripe.js) · [`src/routes/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reservas.js)
- **UI, Modal de Pago y Panel Pasarela (`UPAO-83`):** [`public/index.html`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/index.html) · [`public/js/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/reservas.js)
- **Suite Sprint 3 (`UPAO-85`):** [`tests/test-reservas-sprint3.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-reservas-sprint3.js)
