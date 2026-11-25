# Plan de Pruebas y Depuración — Búsqueda y Confirmación en Garita (`UPAO-8` / Subtarea `UPAO-93`)

> **Historia de Usuario:** `UPAO-8` — Buscar reservas (2 Story Points · Sprint 3)  
> **Subtarea Jira:** `UPAO-93` — Probar y depurar búsqueda, bloqueo de reservas inválidas, descuento en salida y seguridad anti-bot  
> **Matriz complementaria (solo repositorio):** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-8`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-08-01** | 1- Válido: Búsqueda en garita por código, placa, DNI o nombre | `U08-01` y `SP3-07` verificados: `GET /api/reservas?q=...` encuentra reservas por código, placa (con o sin guion), DNI y nombre del conductor con filtro por estado. | Aprobado |
| **CP-08-02** | 2- Válido: Alerta `RESERVADO` automática al digitar placa en Ingreso | `U08-02`, `SP3-07b` y captura E2E `01` verificados: `GET /api/reservas/por-placa/:placa` detecta la reserva `VIGENTE`, muestra el banner amarillo y bloquea el ingreso normal. | Aprobado |
| **CP-08-03** | 3- Válido: Confirmar llegada en garita y abrir estadía vinculada | `U08-04` (`Promise.all` concurrente: `201` + `409`), `SP3-08` y E2E `04` verificados: marca `UTILIZADA` y crea una sola estadía vinculada por `idReserva`. | Aprobado |
| **CP-08-04** | 4- Válido: Descuento automático del adelanto en salida | `U08-05` y `SP3-09` verificados: `POST /api/salidas` retorna `montoBruto`, `adelantoReserva` (`S/ 6.00`) y cobra solo `max(0, montoBruto - adelantoReserva)`. | Aprobado |
| **CP-08-05** | 5- Inválido: Registrar ingreso normal cuando existe reserva vigente | `U08-02`, `U08-03` y `SP3-07c` verificados: `POST /api/ingresos` rechaza con `HTTP 409 Conflict` tanto placa con reserva como walk-in cuando `enCochera + reservasVigentes == capacidad`. | Aprobado |
| **CP-08-06** | 6- Inválido: Confirmar reserva vencida, anulada o ya utilizada | `U08-06` y `SP3-17` verificados: `POST /api/reservas/:id/confirmar` en `UTILIZADA` o `VENCIDA` rechaza con `HTTP 409`; `nota > 250` devuelve `400`; ID inexistente `404`. | Aprobado |
| **CP-08-07** | 7- Inválido: Búsqueda por código o placa inexistente | `U08-08` y `SP3-18` verificados: `GET /api/reservas?q=ZZZ-999-INEXISTENTE` retorna `HTTP 200` con `reservas: []`. | Aprobado |
| **CP-08-08** | 8- Inválido (Seguridad/Bot): Fuerza bruta en login y saturación pública | `BOT-02` y `BOT-03` verificados: ráfagas sobre `POST /api/auth/login` y `GET /api/publico/disponibilidad` activan `HTTP 429` con cabecera `Retry-After`. | Aprobado |
| **CP-08-09** | 9- Inválido (Seguridad/Atacante): Payload >100 KB, SQLi/XSS y acceso de rol `CONDUCTOR` | `BOT-04..08` y `U08-07` verificados: bomba JSON -> `413`; JSON roto -> `400`; SQLi/XSS neutralizados; token alterado -> `401`; `CONDUCTOR` en rutas de garita e IDOR -> `403`/`404`. | Aprobado |

---

## 2. Ejecución Automatizada en 1 Clic (`npm test`) y Suites E2E

```bash
npm test
node tests/test-upao8-garita-e2e.js
```

| Suite Ejecutada | Cobertura | Resultado |
|---|---|---|
| `tests/test-pasarela-culqi-unit.js` | Adaptador Culqi + cifrado AES-256-GCM + mínimo Yape `S/ 6.00` | 5/5 Aprobado |
| `tests/test-upao22-anulacion.js` | Anulación atómica, exclusión mutua con garita y refund Culqi | 7/7 Aprobado |
| `tests/test-upao8-garita.js` | Búsqueda, cupo walk-in, confirmación concurrente, salida y RBAC | 8/8 Aprobado |
| `tests/test-reservas-sprint3.js` | Flujo integral Sprint 3 (`SP3-01..18`, mock pasarela) | 21/21 Aprobado |
| `tests/test-ataque-bot.js` | Simulación atacante/bot (`BOT-01..08`: `429`, `413`, `400`, SQLi/XSS, IDOR) | 8/8 Aprobado |
| `tests/test-seguridad-api.js` | Control de acceso por roles en toda la API | 15/15 Aprobado |
| `tests/test-no-regresion.js` | No regresión módulos Sprints 1 y 2 (`REG-00..10`) | 10/10 Aprobado |
| `tests/test-upao8-garita-e2e.js` | E2E visual UI garita (`01`..`05`) | 5/5 Capturas OK |

---

## 3. Defect Log (`UPAO-8`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-08-01** | Ingreso normal permitía duplicar placa con reserva vigente sin descontar adelanto | `POST /api/ingresos` y `#view-ingreso` solo validaban estadías activas y no consultaban reservas `VIGENTE` de esa placa. | Se agregó `GET /api/reservas/por-placa/:placa`, aviso amarillo `RESERVADO` con bloqueo de submit en UI y validación `409 Conflict` en `src/routes/ingresos.js`. | Cerrado |
| **DEF-08-02** | Ingreso walk-in podía tomar el último cupo pagado por una reserva `VIGENTE` | `POST /api/ingresos` solo contaba `estadia.count(horaSalida: null)` sin sumar `reserva.count(estado: 'VIGENTE')`. | Se sumaron las reservas `VIGENTE` no expiradas al conteo bajo `LLAVE_LOCK_AFORO` en `src/routes/ingresos.js` (`409` al alcanzar capacidad). | Cerrado |
| **DEF-08-03** | Riesgo de XSS en tabla de garita y falta de defensa ante bots/fuerza bruta/payloads grandes | `cargarGaritaReservas()` interpolaba datos en `innerHTML` sin escapar HTML y `server.js` no limitaba tasa por IP (`429`), tamaño de JSON (`100kb`) ni cabeceras defensivas. | Se creó `escaparHtml()` en `public/js/reservas.js`, se añadió `src/middleware/seguridad.js` + límites en `server.js` y se validó con `tests/test-ataque-bot.js`. | Cerrado |

---

## 4. Trazabilidad en GitHub (`develop`)
- **Backend Garita, Ingresos, Salidas y Anti-Bot (`UPAO-92`):** `src/routes/reservas.js` · `src/routes/ingresos.js` · `src/routes/salidas.js` · `src/middleware/seguridad.js` · `server.js`
- **UI Garita (`UPAO-91`):** `public/index.html` · `public/js/reservas.js` · `public/css/style.css`
- **Pruebas 1-Clic, UPAO-8 y Seguridad/Bot (`UPAO-93`):** `scripts/run-all-tests.js` · `tests/test-upao8-garita.js` · `tests/test-ataque-bot.js` · `tests/test-upao8-garita-e2e.js`
