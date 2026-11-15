# Plan de Pruebas — Módulo de Reservas Web y Portal del Conductor (Sprint 3)

**Historias cubiertas:**
- **UPAO-21:** Realizar reserva (incluye registro/autenticación de Conductor, gestión de vehículos SUNARP/MTC y cobro de 1 hora de adelanto vía Stripe Test Mode).
- **UPAO-22:** Anular reserva (reembolso automático a tarjeta en Stripe y liberación inmediata del espacio).
- **UPAO-8:** Buscar reservas en garita (búsqueda por código o placa y confirmación de ingreso).
- **UPAO-23:** Consultar historial de estados del conductor.

---

## 1. Matriz de Casos de Prueba Automatizados (`tests/test-reservas-sprint3.js`)

| ID | Caso de Prueba | Historia | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **SP3-01** | Verificar configuración de pasarela Stripe (`GET /api/reservas/config-pasarela`) | UPAO-21 | Retorna `habilitado: true`, `publishableKey` (`pk_test_...`) y `toleranciaMinutos: 30`. | ✅ Aprobado |
| **SP3-02** | Registro y autenticación de cuenta `CONDUCTOR` (`POST /api/auth/registro-conductor`) | UPAO-21 | Valida DNI de 8 dígitos y celular de 9 dígitos (`9XXXXXXXX`), crea cuenta y retorna token HMAC con rol `CONDUCTOR`. | ✅ Aprobado |
| **SP3-03** | Registro de vehículo del conductor con validación SUNARP/MTC y Poka-Yoke | UPAO-21 | Rechaza placas repetitivas (`AAA-000` → `400`) y registra placa válida (`201`). | ✅ Aprobado |
| **SP3-04** | Creación de intención de pago en Stripe (`PEN`), confirmación con tarjeta de prueba y creación de reserva | UPAO-21 | Crea `PaymentIntent` por 1 hora de tarifa vigente, verifica `succeeded` en Stripe y genera reserva `VIGENTE` por 30 minutos. | ✅ Aprobado |
| **SP3-05** | Descuento inmediato de cupo en vista pública (`GET /api/publico/disponibilidad`) | UPAO-21 / UPAO-20 | Incrementa `reservasVigentes` y descuenta 1 espacio disponible del tipo correspondiente. | ✅ Aprobado |
| **SP3-06** | Anulación de reserva vigente con reembolso en Stripe (`POST /api/reservas/:id/anular`) | UPAO-22 | Ejecuta Refund en Stripe, cambia estado a `ANULADA` (`estadoPago: REEMBOLSADO`) y libera el espacio en tiempo real. | ✅ Aprobado |
| **SP3-07** | Búsqueda de reserva en garita por código o placa (`GET /api/reservas?q=...`) | UPAO-8 | Retorna la reserva con placa, tipo, conductor, ventana de vigencia y estado actual. | ✅ Aprobado |
| **SP3-07b** | Detección de reserva vigente en ingreso y búsqueda sin guion (`GET /api/reservas/por-placa/:placa`) | UPAO-8 | Detecta reserva `VIGENTE` por placa normalizada (con o sin guion) para mostrar aviso `RESERVADO` en garita. | ✅ Aprobado |
| **SP3-07c** | Bloqueo de ingreso normal si existe reserva vigente (`POST /api/ingresos`) | UPAO-8 | Rechaza con `409 Conflict` el ingreso normal si la placa tiene una reserva vigente para obligar a confirmar reserva y descontar adelanto. | ✅ Aprobado |
| **SP3-08** | Confirmación de llegada en garita (`POST /api/reservas/:id/confirmar`) | UPAO-8 | Cambia la reserva a `UTILIZADA` y abre la `estadia` activa vinculada (`id_reserva`). | ✅ Aprobado |
| **SP3-09** | Descuento automático del adelanto de reserva al registrar la salida (`POST /api/salidas`) | UPAO-21 / UPAO-7 | Descuenta el adelanto de 1 hora del monto total calculado al salir (`saldo = max(0, total - adelanto)`). | ✅ Aprobado |
| **SP3-10** | Consulta de historial de estadías del conductor (`GET /api/conductor/historial`) | UPAO-23 | Lista las estadías de las placas del conductor ordenadas de más reciente a más antigua con estado `En cochera` / `Finalizada`. | ✅ Aprobado |

---

## 2. Ejecución de Pruebas

```bash
# Suite integral del Sprint 3 (contra Neon Staging + Stripe Test Mode)
node tests/test-reservas-sprint3.js

# Suite de no regresión del sistema
npm run test:regresion
```

---

## 3. Defect Log (Bitácora de Defectos Detectados y Corregidos)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-SP3-01** | Permiso de Reembolsos en Clave Restringida de Stripe (`rk_test_...`) | Si se usa una Restricted Key (`rk_test_...`) sin permiso de escritura en `Charges/Refunds`, el reembolso de `UPAO-22` podría ser rechazado por permisos de clave en Stripe. | `src/config/stripe.js` valida la respuesta de `/v1/refunds` y propaga el detalle exacto o permite usar `sk_test_...` / `rk_test_...` con permisos de reembolso. | Cerrado |

---

## 4. Enlaces de Trazabilidad en GitHub (GitFlow → `develop`)

- **Pull Request hacia `develop` (Blue):** [#25 — Manejo de Reserva Web y Portal del Conductor](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/25)
- **Documentación y Trazabilidad:** [Commit 8362ab8](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/8362ab8)

| Historia / Subtareas | Alcance | Enlace GitHub |
| --- | --- | --- |
| **UPAO-21** (`UPAO-79`, `UPAO-83`, `UPAO-84`, `UPAO-85`) | Modelo BD, Conductor, Vehículos, Pasarela Stripe, Sidebar | [BD `758b47e`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/758b47e7bca2628ff1b011d709923c81afc476ba) · [API `c810227`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/c810227c66c0e8914950c1c16030c533a2297e3c) · [UI `4c050b9`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/4c050b92566abfe059054770ee06756fd251bd8c) · [Tests `fd90e2b`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/fd90e2b216f4ca4237119c36691e5e849ec345e2) |
| **UPAO-22** (`UPAO-80`, `UPAO-87`, `UPAO-88`, `UPAO-89`) | Anulación de reserva, Refund Stripe y liberación de espacio | [`src/routes/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/reservas.js) · [`public/js/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/reservas.js) |
| **UPAO-8** (`UPAO-81`, `UPAO-91`, `UPAO-92`, `UPAO-93`) | Búsqueda en garita, detección en ingreso (`409`), descuento en salida | [`src/routes/ingresos.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/ingresos.js) · [`src/routes/salidas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/salidas.js) |
| **UPAO-23** (`UPAO-82`, `UPAO-95`, `UPAO-96`, `UPAO-97`) | Historial de estadías del conductor y aislamiento por placas | [`src/routes/conductor.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/conductor.js) · [`tests/test-reservas-sprint3.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/tests/test-reservas-sprint3.js) |
