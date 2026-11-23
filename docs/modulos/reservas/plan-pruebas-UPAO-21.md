# Plan de Pruebas y Depuración — Realizar Reserva Web (`UPAO-21` / Subtarea `UPAO-85`)

> **Historia de Usuario:** `UPAO-21` — Realizar reserva (5 Story Points)  
> **Subtarea Jira:** `UPAO-85` — Probar y depurar registro de conductor, vehículos, reserva y pago con Culqi Perú  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)  
> **Verificación real en Culqi Integración (22/11/2026):** Suite completa `node tests/test-reservas-sprint3.js` ejecutada contra la API real de Culqi Integración (`pk_test_...` / `sk_test_...`) y PostgreSQL Neon Staging con **21/21 verificaciones aprobadas** (cargo real de prueba `chr_test_eVACWgY1YOt4kYK6` y reembolso real vía `POST /v2/refunds`).

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-21`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-21-01** | 1- Válido: Pasarela Culqi activa, autogestión `DUENO` cifrada en BD y registro `CONDUCTOR` | `UNIT-01`, `UNIT-02`, `SP3-01`, `SP3-02` y `SP3-02b` verificados: retorna `pk_test_...`, rechaza `CONDUCTOR` (`403`), rechaza `rk_` y mezcla `test`/`live` (`400`), persiste `llave_secreta_cifrada` en `configuracion_pasarela` con AES-256-GCM y restaura defaults del servidor. | ✅ Aprobado |
| **CP-21-02** | 2- Válido: Registro de vehículo SUNARP/MTC y vista previa con piso mínimo `S/ 3.00` | `UNIT-03` y `SP3-03` verificados: registra vehículos válidos, aplica piso mínimo `S/ 3.00` (`300` céntimos) a Motocicleta y devuelve `precioAdelanto` en `/api/conductor/vehiculos` y `/api/reservas/preparar-pago`. | ✅ Aprobado |
| **CP-21-03** | 3- Válido: Pago adelantado con Culqi (PEN) y reserva `VIGENTE` por 30 min | `UNIT-04`, `SP3-04` y `SP3-05` verificados contra Culqi Integración real (`chr_test_eVACWgY1YOt4kYK6`): ejecuta `POST /v2/charges` en `PEN` con `Idempotency-Key`, crea reserva `VIGENTE` (+30 min) y descuenta 1 espacio en `/api/publico/disponibilidad`. | ✅ Aprobado |
| **CP-21-04** | 4- Inválido: Placa repetitiva o formato no válido MTC (Poka-Yoke) | `SP3-03` verificado: rechaza `AAA-000` con HTTP `400 Bad Request` y mensaje de validación. | ✅ Aprobado |
| **CP-21-05** | 5- Inválido: Reserva sin iniciar sesión (sin token) | `SP3-11` verificado: `POST /api/reservas` sin cabecera `Authorization` retorna HTTP `401 Unauthorized`. | ✅ Aprobado |
| **CP-21-06** | 6- Inválido: Sin espacios disponibles para el tipo de vehículo | `SP3-12` verificado: cuando `disponibles = 0`, `POST /api/reservas/preparar-pago` rechaza con HTTP `409 Conflict`. | ✅ Aprobado |
| **CP-21-07** | 7- Inválido: Placa con reserva vigente o estadía activa previa | `SP3-14` verificado: al intentar preparar/crear una segunda reserva `VIGENTE` para la misma placa, retorna HTTP `409 Conflict`. | ✅ Aprobado |
| **CP-21-08** | 8- Inválido: Token o pago Culqi inválido o rechazado | `SP3-13` verificado: al enviar `sourceToken: 'tkn_invalido'` a `POST /api/reservas`, rechaza con HTTP `402 Payment Required`. | ✅ Aprobado |

---

## 2. Comandos de Ejecución

```bash
node tests/test-pasarela-culqi-unit.js
CULQI_MOCK=1 node tests/test-reservas-sprint3.js
npm run test:regresion
```

---

## 3. Defect Log (`UPAO-21`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-21-01** | Incompatibilidad de Stripe en producción para RUC 10 en Perú | Stripe no opera nativamente en Perú para personas naturales con negocio ni procesa Yape. | Se migró a **Culqi Perú** (Checkout v4 + REST `/v2/charges` y `/v2/refunds`) detrás de un adaptador agnóstico (`src/payments/` + `public/js/pasarela-adapter.js`). | Cerrado |
| **DEF-21-02** | Pérdida de llaves del Dueño en Render Free y almacenamiento en texto plano | Las credenciales personalizadas se guardaban en archivo JSON local (`stripe-keys.json`), efímero ante reinicios en Render. | Se creó tabla PostgreSQL `configuracion_pasarela` con cifrado **AES-256-GCM** en `src/payments/configStore.js`. | Cerrado |
| **DEF-21-03** | Tarifa de motocicleta (`S/ 2.50`) inferior al mínimo de Culqi (`S/ 3.00`) | Culqi rechaza cargos menores a `300` céntimos en `POST /v2/charges`. | Se implementó `calcularMontoAdelanto` con piso `S/ 3.00` para reservas web y activación condicional de Yape según mínimo vigente. | Cerrado |
| **DEF-21-04** | Riesgo de cobro huérfano ante colisión de último cupo | El cobro ocurría antes de adquirir `pg_advisory_xact_lock`. | Se pre-valida cupo antes del cobro, se usa `Idempotency-Key` + `@unique pasarela_pago_id` y se ejecuta reembolso compensatorio automático si falla la transacción. | Cerrado |
| **DEF-21-05** | Botones *Reservar espacio para Auto / Moto* sin respuesta en disponibilidad pública | `public/index.html` usaba IDs en singular (`btn-reservar-auto`/`moto`) y `disponibilidad.js` buscaba en plural (`-autos`/`-motos`). | Se corrigieron los selectores en `disponibilidad.js` y se conectó retorno directo tras login. | Cerrado |
| **DEF-21-06** | UX móvil sobrecargada y sin CTA directo cuando el conductor aún no registra vehículo | Cabecera cortaba `Cerrar Sesión`, navegación duplicada y mensaje textual sin botón de acción en móvil. | Se limpió el header móvil, se añadió botón `+ Registrar mi primer vehículo` y se redujeron textos redundantes en `#view-conductor-reservas` y `#view-pasarela-pagos`. | Cerrado |
| **DEF-21-07** | Pérdida de sesión / regreso forzado al Menú Principal al recargar la página | La sesión vivía en `sessionStorage` y `app.js` siempre forzaba `mostrarPantalla('dashboard')` tras recargar. | Se migró la sesión a `localStorage` y se persiste la vista activa (`cochera_vista_activa`) restaurándola tras recargar. | Cerrado |
| **DEF-21-08** | Opción Yape oculta en Checkout v4 para reservas de S/ 5.00 | El umbral preventivo `CULQI_YAPE_MINIMO_SOLES` estaba fijado en `S/ 6.00` (aplica a Órdenes QR, no a tokenización directa en Checkout v4). | Se ajustó `CULQI_YAPE_MINIMO_SOLES` por defecto a `3.00` en `src/payments/index.js` y `.env.example`, habilitando Yape y tarjetas desde `S/ 3.00`. | Cerrado |

---

## 4. Trazabilidad en GitHub

- **Migración inicial de reservas (`UPAO-79`):** [Commit `758b47e`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/758b47e7bca2628ff1b011d709923c81afc476ba)
- **Adaptador agnóstico y Culqi Perú (`src/payments/`):** `src/payments/{index,culqi,configStore}.js` · `src/routes/reservas.js` · `public/js/pasarela-adapter.js` · `public/js/reservas.js` · `tests/test-pasarela-culqi-unit.js` · `tests/test-reservas-sprint3.js`
