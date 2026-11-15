# Correcciones aplicadas — Auditoría QA Sprint 1 + Sprint 2

> **Fecha:** 09/11/2026
> **Base:** `feature/UPAO-20-interfaz-vista-publica-disponibilidad` (commit `c2169ac` + cambios locales)
> **Entorno de verificación:** local `http://localhost:3000` y staging Neon (suites en `:3555`).
> **Referencia:** [`qa-auditoria-sprint1-2.md`](qa-auditoria-sprint1-2.md) (informe pre-corrección).

---

## 1. Correcciones críticas

| ID | Corrección aplicada | Archivos | Verificación |
| --- | --- | --- | --- |
| **C-01** | Se eliminó el secreto HMAC hardcodeado. Si falta `AUTH_SECRET`, se genera un secreto temporal por proceso y se emite una advertencia. | `src/config/auth.js` | Token firmado con el secreto antiguo → **HTTP 401** en `/api/reportes/diario`. Login normal sigue funcionando. |
| **C-02** | Se eliminaron los datos demo y el fallback del reporte diario. Ahora solo se muestran datos de la API; si no hay movimientos, se muestra el estado vacío. | `public/js/reportes.js` | `2026-11-07` (API 0 movimientos): UI **0 filas, S/ 0.00, estado vacío**; ya no aparecen DEF-789/GHI-321. |
| **C-03** | El ingreso usa `req.sesion.sub`; se ignoran `idUsuario` y `usuario` del body. | `src/routes/ingresos.js` | Token de `recepcion` + `idUsuario:1` → **201**, `idUsuario:8`, `usuario:"Recepcionista"`. |
| **C-04** | Se agregó POS/Tarjeta a los totales, al cuadre, al CSV y a la UI (tarjeta, badge y filtro). `estadoCuadre` se basa en transacciones, no solo en el monto Efectivo/Yape. | `src/routes/reportes.js`, `public/js/reportes.js`, `public/index.html`, `public/css/style.css` | `2026-10-27`: total **S/ 1,570.60**, POS **S/ 1.50**, 5 transacciones; UI total S/ 1,570.60, tarjeta POS S/ 1.50, fila POS con badge `badge-metodo-pos`. Dashboard octubre: Total S/ 2,881.50, Efectivo S/ 2,368.00, Yape S/ 512.00, POS S/ 1.50. |

## 2. Correcciones altas

| ID | Corrección aplicada | Archivos | Verificación |
| --- | --- | --- | --- |
| **A-01** | “Reserva Web” y otros tipos se contabilizan como `otros`: el público y el aforo descuentan del total; la ocupación ya no los clasifica como autos. | `src/routes/publico.js`, `src/routes/espacios.js`, `src/routes/ocupacion.js` | Con una “Reserva Web” activa: público 14→15 ocupados, 6→5 disponibles, `otrosEnCochera:1`; `/api/espacios` 15/5; ocupación `totalAutos` 0, `totalOtros` 1, `aforoMaximoOtros` 1. |
| **A-02** | Validación real de calendario en `/api/reportes/diario` (round-trip `Date.UTC`). | `src/routes/reportes.js` | `2026-02-31` y `2026-04-31` → **HTTP 400** “Ingrese una fecha válida...”. |
| **A-03** | Validación de `estadiaId` entero positivo antes de Prisma. | `src/routes/salidas.js` | `{estadiaId:'abc'}` → **HTTP 400** “Identificador de estadía inválido.” |
| **A-04** | Normalización de placa en la salida usando el módulo compartido. | `src/config/placas.js`, `src/routes/salidas.js` | Estadía `ZZQ-9301`; salida con `ZZQ9301` → **HTTP 200**, placa `ZZQ-9301`. |
| **A-05** | Se eliminó el truncamiento silencioso; una placa de más de 7 caracteres se rechaza. | `src/config/placas.js`, `src/routes/ingresos.js`, `public/js/app.js` | `ZZQ-92022` → **HTTP 400** “Ingrese una placa válida...”. |
| **A-06** | El preview de salida usa `tarifaHora`/`tarifaFraccion` de la estadía, no la tarifa actual del tipo. | `public/js/app.js` | Estadía con tarifa temporal 99.99/50.00: UI mostró **S/ 99.99 /h + S/ 50.00** y **S/ 149.99**; tarifa actual del tipo: S/ 2.90. |
| **A-07** | Se eliminó el token por query string; las descargas usan `fetch` + `Authorization` + `Blob`. | `src/config/auth.js`, `public/js/estadisticas.js`, `public/js/ocupacion.js` | `?token=<válido>` → **HTTP 401**; exportación de gráficos y ocupación descarga correctamente con Bearer (suite de gráficos 20/20). |
| **A-08** | Se eliminó el almacenamiento de notas en `localStorage`; la nota se lee solo de la API. | `public/js/app.js` | Nota API “Nota API original” visible; `localStorage` con “Nota local falsa” no altera la nota mostrada. |

## 3. Correcciones medias / bajas

| ID | Corrección aplicada | Verificación |
| --- | --- | --- |
| **M-01** | El error handler responde 400 para `entity.parse.failed`. | `POST /api/auth/login` con `{bad` → **400** “El cuerpo de la petición no es un JSON válido.” |
| **M-04** | El aforo se refresca cada 30 s al abrir la vista y se detiene al salir. | Conteo de `/api/espacios`: 1 → 2 tras 31 s. |
| **M-05** | Horas de ingreso/salida/aforo formateadas con `America/Lima`. | Revisión de código y pruebas de UI. |
| **M-06** | La API de capacidad acepta 0 (si no hay ocupación) y conserva el bloqueo si la capacidad es menor a la ocupación actual. | `capacidadAutos:-1` → **400** “mayor o igual a 0”; el mensaje ya no exige “mayor a 0”. |
| **M-08** | `GET /api/salidas/metodos-pago` ya no hace `upsert`; solo lee. El POST crea el método si falta. | Revisión de código. |
| **M-09** | La fecha por defecto del reporte se calcula con `America/Lima`. | Revisión de código/UI. |
| **M-10** | El CSV de reportes incluye `TOTAL POS / TARJETA` y `TOTAL OTROS`. | CSV octubre: Total S/ 2,881.50; Efectivo S/ 2,368.00; Yape S/ 512.00; POS S/ 1.50. |
| **B-01** | Métodos no GET en `/api/publico/disponibilidad` responden **405** con `Allow: GET, HEAD`. | `POST` → **405** “Método no permitido.” |
| **B-02** | Se eliminó el código muerto de “Reservar” en la vista pública (botones retirados para Sprint 3). | Revisión de código; E2E confirma 0 botones. |
| **B-03** | Polling con `setTimeout` después de cada respuesta (sin solapamiento) y sin intervalo duplicado. | E2E de disponibilidad: 27/27. |
| **B-04** | El toast de error de polling se muestra una sola vez hasta que vuelve el éxito. | Revisión de código. |
| **B-06** | Porcentajes de aforo capados a 100%. | Revisión de código. |
| **B-08** | Un pago sin método se clasifica como “Sin método”/Otros, no como Efectivo. | Revisión de código. |

## 4. Suites después de las correcciones

```text
npm run test:e2e             → 15 OK / 0 fallas
npm run test:disponibilidad  → 27/27 PASS
npm run test:graficos        → 20/20 PASS
npm run test:seguridad       → 15/15 PASS
npm run test:integridad      → 1/1 PASS
npm run test:concurrencia    → 1/1 PASS
npm run test:regresion       → 12/12 PASS
```

## 5. Pendientes de endurecimiento (no bloquean la demo)

| ID | Pendiente | Motivo |
| --- | --- | --- |
| **M-02** | Rate limiting en login y endpoint público | Requiere definir límites por IP/entorno; no se aplicó para no romper las suites ni la demo. |
| **M-03** | CSP completa | Se agregaron `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`; falta una CSP que no rompa estilos/scripts inline. |
| **M-07** | Auditoría de salidas, tarifas y capacidad | Requiere cambio de esquema (usuario/auditoría); se deja para una historia técnica. |
| **B-07** | Validación del payload contra la BD / revocación | Requiere consulta por request o lista de revocación; no crítico para la demo. |
| **B-09** | Unicidad de tarifa activa por tipo y `Pago.estadia` obligatorio | Requiere migración y decisión de modelo. |
| **B-10** | Bloqueo por intentos fallidos / política de contraseñas | Requiere rate limiting y política de credenciales. |

## 6. Archivos modificados

- `src/config/auth.js`, `src/config/placas.js` (nuevo), `src/config/espacios.js`.
- `src/routes/ingresos.js`, `salidas.js`, `reportes.js`, `espacios.js`, `ocupacion.js`, `publico.js`.
- `server.js`.
- `public/js/app.js`, `reportes.js`, `estadisticas.js`, `ocupacion.js`, `disponibilidad.js`, `aforo.js`.
- `public/index.html`, `public/css/style.css`.
- `docs/modulos/qa-auditoria-sprint1-2.md`.
- `docs/modulos/qa-correcciones-aplicadas.md` (este archivo).

> Los cambios de esta ronda se integraron en la rama `Version-Corregida` junto con las correcciones del informe externo de auditoría.

> **Ronda 2 (14/11/2026):** las correcciones del informe externo de auditoría (D-01, D-02, D-03, D-04, A11y-01, A11y-02) se documentan en [`qa-correcciones-version-corregida.md`](qa-correcciones-version-corregida.md) y se integran en la rama `Version-Corregida`.
