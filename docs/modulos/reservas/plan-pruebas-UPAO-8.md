# Plan de Pruebas y Depuración — Búsqueda y Confirmación de Reservas

## 1. Evaluación de Casos de Prueba Diseñados en Análisis

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-08-01** | 1- Válido: Búsqueda por código, placa, DNI o nombre | `U08-01` y `SP3-07` verificados: `GET /api/reservas?q=...` encuentra reservas por código, placa (con o sin guion), DNI y nombre del conductor con filtro por estado. | Aprobado |
| **CP-08-02** | 2- Válido: Detección `RESERVADO` y botón unificado en Ingreso | `U08-02`, `SP3-07b` y E2E `01` verificados: `GET /api/reservas/por-placa/:placa` muestra el aviso amarillo `RESERVADO`, elimina botón duplicado y cambia `#btn-registrar-ingreso` a azul (`Confirmar ingreso con reserva`). | Aprobado |
| **CP-08-03** | 3- Válido: Confirmar llegada en recepción y abrir estadía vinculada | `U08-04` (`Promise.all` concurrente: `201` + `409`), `SP3-08` y E2E `04` verificados: marca `UTILIZADA` y crea una sola estadía vinculada por `idReserva`. | Aprobado |
| **CP-08-04** | 4- Válido: Descuento automático del adelanto en salida | `U08-05` y `SP3-09` verificados: `POST /api/salidas` retorna `montoBruto`, `adelantoReserva` (`S/ 6.00`) y cobra solo `max(0, montoBruto - adelantoReserva)`. | Aprobado |
| **CP-08-05** | 5- Inválido: Registrar ingreso normal cuando existe reserva vigente | `U08-02`, `U08-03` y `SP3-07c` verificados: `POST /api/ingresos` rechaza con `HTTP 409 Conflict` tanto placa con reserva como walk-in cuando `enCochera + reservasVigentes == capacidad`. | Aprobado |
| **CP-08-06** | 6- Inválido: Confirmar reserva vencida, anulada o ya utilizada | `U08-06` y `SP3-17` verificados: `POST /api/reservas/:id/confirmar` en `UTILIZADA` o `VENCIDA` rechaza con `HTTP 409`; `nota > 250` devuelve `400`; ID inexistente `404`. | Aprobado |
| **CP-08-07** | 7- Inválido: Búsqueda por código o placa inexistente | `U08-08` y `SP3-18` verificados: `GET /api/reservas?q=ZZZ-999-INEXISTENTE` retorna `HTTP 200` con `reservas: []`. | Aprobado |
| **CP-08-08** | 8- Inválido (Seguridad/Bot): Fuerza bruta en login y saturación pública | `BOT-02` y `BOT-03` verificados: ráfagas sobre `POST /api/auth/login` y `GET /api/publico/disponibilidad` activan `HTTP 429` con cabecera `Retry-After`. | Aprobado |
| **CP-08-09** | 9- Inválido (Seguridad/Atacante): Payload >100 KB, SQLi/XSS y acceso de rol `CONDUCTOR` | `BOT-04..08` y `U08-07` verificados: bomba JSON -> `413`; JSON roto -> `400`; SQLi/XSS neutralizados; token alterado -> `401`; `CONDUCTOR` en rutas operativas e IDOR -> `403`/`404`. | Aprobado |

---

## 2. Ejecución Automatizada en 1 Clic (`npm test`) y Suites E2E

```bash
npm test
node tests/test-upao8-garita-e2e.js
```

| Suite Ejecutada | Cobertura | Resultado |
| --- | --- | --- |
| `tests/test-pasarela-culqi-unit.js` | Adaptador Culqi + cifrado AES-256-GCM + mínimo Yape `S/ 6.00` | 5/5 Aprobado |
| `tests/test-upao22-anulacion.js` | Anulación atómica, exclusión mutua con confirmación y refund Culqi | 7/7 Aprobado |
| `tests/test-upao8-garita.js` | Búsqueda, cupo walk-in, confirmación concurrente, salida y RBAC | 8/8 Aprobado |
| `tests/test-reservas-sprint3.js` | Flujo integral Sprint 3 (`SP3-01..18`, mock pasarela) | 21/21 Aprobado |
| `tests/test-ataque-bot.js` | Simulación atacante/bot (`BOT-01..08`: `429`, `413`, `400`, SQLi/XSS, IDOR) | 8/8 Aprobado |
| `tests/test-seguridad-api.js` | Control de acceso por roles en toda la API | 15/15 Aprobado |
| `tests/test-no-regresion.js` | No regresión módulos Sprints 1 y 2 (`REG-00..10`) | 10/10 Aprobado |
| `tests/test-upao8-garita-e2e.js` | E2E visual UI recepción (`01`..`05`), botón unificado y tabla 1 línea sin desborde | 5/5 Capturas OK |

---

## 3. Defect Log

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-08-01** | Ingreso normal permitía duplicar placa con reserva vigente y duplicaba botón en UI | `POST /api/ingresos` no validaba reservas `VIGENTE` y la vista mostraba dos botones de envío simultáneos. | Se añadió validación `409 Conflict` en `src/routes/ingresos.js` y se unificó el botón `#btn-registrar-ingreso` (verde -> azul al detectar reserva). | Cerrado |
| **DEF-08-02** | Ingreso walk-in podía tomar el último cupo pagado por una reserva `VIGENTE` | `POST /api/ingresos` solo contaba `estadia.count(horaSalida: null)` sin sumar `reserva.count(estado: 'VIGENTE')`. | Se sumaron las reservas `VIGENTE` no expiradas bajo `LLAVE_LOCK_AFORO` en `src/routes/ingresos.js` (`409` al alcanzar capacidad). | Cerrado |
| **DEF-08-03** | Riesgo de XSS en tabla de resultados y falta de defensa ante bots/payloads grandes | `cargarGaritaReservas()` interpolaba datos en `innerHTML` sin escapar y `server.js` no limitaba tasa por IP (`429`) ni tamaño de JSON (`100kb`). | Se agregó `escaparHtml()` en `public/js/reservas.js`, middleware `src/middleware/seguridad.js` + límites en `server.js` y suite `tests/test-ataque-bot.js`. | Cerrado |

---

## 4. Evidencia y Scripts en GitHub (`develop`)

- **Runner 1-Clic (`npm test`):** [`scripts/run-all-tests.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/scripts/run-all-tests.js)
- **Suite funcional y concurrencia (`UPAO-8`):** [`tests/test-upao8-garita.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-upao8-garita.js)
- **Suite atacante / bot (`429`, `413`, SQLi/XSS, IDOR):** [`tests/test-ataque-bot.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-ataque-bot.js)
- **Suite E2E visual Playwright:** [`tests/test-upao8-garita-e2e.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-upao8-garita-e2e.js)
- **Ejecuciones automáticas en CI (GitHub Actions):** [Ver historial de runs](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions)
