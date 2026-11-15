# Auditoría QA Sprint 1 + Sprint 2 — Sistema de Gestión de Cochera

> **Fecha de ejecución:** 09/11/2026
> **Repositorio:** `anthonyepv-ctrl/Sistema_Estacionamiento` · rama local `feature/UPAO-20-interfaz-vista-publica-disponibilidad` · commit `c2169ac`
> **Entorno:** Node.js + Express 5, PostgreSQL/Prisma (staging Neon), frontend vanilla, Playwright/Chromium.
> **Servidor local:** `http://localhost:3000` (API y UI) · suites en `http://localhost:3555`.
> **Alcance:** Login/autenticación, Tarifas, Ingreso, Salida, Aforo/Espacios, Reporte diario, Notas (UPAO-9), Gráficos (UPAO-18), Ocupación (UPAO-19) y Disponibilidad pública (UPAO-20).
> **Naturaleza:** auditoría destructiva de caja blanca + pruebas de ejecución real contra staging. **Correcciones aplicadas después de la auditoría:** ver [`qa-correcciones-aplicadas.md`](qa-correcciones-aplicadas.md).

---

## 1. Resumen ejecutivo

| Suite / prueba | Resultado |
| --- | --- |
| `npm run test:e2e` (ingreso) | **15 OK / 0 fallas** |
| `npm run test:disponibilidad` | **27/27 PASS** |
| `npm run test:graficos` | **20/20 PASS** |
| `npm run test:seguridad` | **15/15 PASS** |
| `npm run test:integridad` | **1/1 PASS** |
| `npm run test:concurrencia` | **1/1 PASS** |
| `npm run test:regresion` | **12/12 PASS** |
| Pruebas manuales API/DOM | **hallazgos C-01 a B-10** |

**Conteo de hallazgos:** 4 críticos, 8 altos, 10 medios y 10 bajos/de endurecimiento.

Los dos hallazgos de mayor impacto son:

1. **C-01:** si falta `AUTH_SECRET`, el servidor usa un secreto hardcodeado y cualquiera con el código puede firmar un token de DUEÑO. Se demostró con un servidor en el puerto 3556 y un token forjado: `GET /api/reportes/diario` respondió **200**.
2. **C-02:** el reporte diario del dueño muestra **datos demo** cuando la API no devuelve movimientos para hoy/ayer/anteayer. El 07/11/2026 la API devolvió `0` movimientos y la UI mostró **4 filas ficticias y S/ 59.50**.

---

## 2. REPORTE DE VULNERABILIDADES Y ERRORES

### 2.1. Críticas

#### C-01 — Token de sesión forjable si falta `AUTH_SECRET`
- **Archivo/línea:** `src/config/auth.js:6`.
- **Código:** `const SECRETO = process.env.AUTH_SECRET || 'cochera_secret_session_52a09a69...';`
- **Prueba:** servidor aislado en `:3556` con `AUTH_SECRET=''`; token firmado con el fallback para `{sub:1, rol:'DUENO'}`; `GET /api/reportes/diario?fecha=2026-10-27` → **200** con datos reales.
- **Impacto:** bypass total de autenticación y autorización si la variable no está configurada (el propio `AGENTS.md` advierte que debe existir en Render). Un atacante con el repositorio puede emitir tokens de DUEÑO.
- **Corrección:** eliminar el fallback; fallar al iniciar si `AUTH_SECRET` no existe en producción. En desarrollo, generar un secreto aleatorio por proceso y nunca uno hardcodeado.

#### C-02 — El reporte diario muestra datos ficticios (mock)
- **Archivo/línea:** `public/js/reportes.js:57-75` (`DEMO_TRANSACCIONES_FECHAS`), `183-209` (fallback cuando la API no devuelve movimientos o falla).
- **Prueba:** `GET /api/reportes/diario?fecha=2026-11-07` → `totalGeneral:0`, `movimientos:[]`; la UI mostró **4 filas** (`DEF-789`, `GHI-321`, `2345-AB`, `P1-5544`) y **S/ 59.50**, con el estado vacío oculto.
- **Impacto:** el dueño ve recaudación y transacciones que no existen; se enmascaran caídas de API y se toman decisiones financieras sobre datos falsos. Es un riesgo de auditoría y de integridad de negocio.
- **Corrección:** eliminar `DEMO_TRANSACCIONES_FECHAS` y todo fallback; ante error mostrar el estado vacío o un mensaje de error explícito, nunca datos simulados.

#### C-03 — Suplantación de usuario en el registro de ingreso
- **Archivo/línea:** `src/routes/ingresos.js:52` (lee `idUsuario` y `usuario` del body) y `108-120` (busca al usuario indicado).
- **Prueba:** con token de `recepcion`, `POST /api/ingresos` con `{placa:'ZZQ-9001', tipo:'moto', idUsuario:1, nota:'QA spoof'}` → **201**, `idUsuario:1`, `usuario:"Administrador"`.
- **Impacto:** el recepcionista puede atribuir un ingreso a otro usuario (incluido el dueño). Se rompe la trazabilidad y el criterio de UPAO-9 de registrar automáticamente el ID del recepcionista. La nota y la estadía quedan con un responsable falso.
- **Corrección:** usar siempre `req.sesion.sub` como `idUsuario`; ignorar `idUsuario`/`usuario` del body. Validar el rol si se desea restringir.

#### C-04 — El reporte diario omite pagos POS/Tarjeta
- **Archivo/línea:** `src/routes/reportes.js:90-96` (solo suma Efectivo/Yape), `116-117` (`totalGeneral` y transacciones), `144` (`estadoCuadre`); `public/js/reportes.js:236-253` (totales solo Efectivo/Yape) y `306` (todo lo que no es Efectivo se pinta como Yape).
- **Prueba API (27/10/2026):** `totalGeneral: 1569.10`, suma de `movimientos: 1570.60`; diferencia **S/ 1.50** del pago POS. La UI mostró total **S/ 1569.10** y filas por **S/ 1570.60**; la fila POS tenía clase `badge-metodo-yape` e icono de Yape.
- **Prueba dashboard (UPAO-18):** Total **S/ 2,881.50**, Efectivo **S/ 2,368.00**, Yape **S/ 512.00**; los dos cards suman S/ 2,880.00 y no explican el S/ 1.50 de POS.
- **Impacto:** recaudación subestimada, cuadre de caja incorrecto; un día con solo POS se reporta como `SIN_MOVIMIENTOS`. El test de gráficos pasa porque valida `porMetodo`, pero los cards del dueño no muestran POS.
- **Corrección:** incluir todos los métodos en los totales; agregar bucket POS/Tarjeta; corregir badges, filtros y cards; probar un día con solo POS.

### 2.2. Altas

#### A-01 — Tipos de vehículo no clasificados: inconsistentes entre disponibilidad, aforo y ocupación
- **Archivos/líneas:** `src/routes/publico.js:57-60` y `85-90`; `src/routes/espacios.js:9-21` y `28`; `src/routes/ocupacion.js:105-107` y `203-208`.
- **Prueba:** con una estadía temporal “Reserva Web” activa:
  - Público: `total.enCochera` 14→**15**, `otrosEnCochera:1`, `total.disponibles:6`, `capacidad:20` → **15+6=21 > 20**.
  - Interno `/api/espacios`: `total.ocupados` 14→**14** (ignora el tipo).
  - Ocupación: `totalAutos` 0→**1** (lo clasifica como auto).
- **Impacto:** la vista pública puede anunciar más cupos de los reales; aforo y ocupación no coinciden; los reportes atribuyen vehículos al tipo equivocado. Es el DEF-77-02 ya documentado, pero sigue abierto.
- **Corrección:** decisión de producto (descontar de autos, de motos o bucket aparte) y un clasificador compartido; nunca usar “todo lo que no es moto = auto”.

#### A-02 — Fechas de calendario inválidas aceptadas en `/api/reportes/diario`
- **Archivo/línea:** `src/routes/reportes.js:41-55` (solo valida regex `YYYY-MM-DD` y compara strings).
- **Prueba:** `2026-02-31` → **200**, `fechaFormateada:"31/02/2026"`; `2026-04-31` → **200**; `2026-13-01` → 400 solo porque el string es “futuro”, no por fecha inválida.
- **Impacto:** reportes de fechas inexistentes; JavaScript normaliza `31/02` a marzo y puede devolver datos de otro día. El `fechaFormateada` queda incoherente.
- **Corrección:** validar con round-trip `Date.UTC` como ya hace `src/routes/ocupacion.js:47-56`; rechazar 31/02, 31/04, 00/00, etc.

#### A-03 — `estadiaId` inválido en salida devuelve 500
- **Archivo/línea:** `src/routes/salidas.js:95-105` (`Number(estadiaId)` y `findFirst`).
- **Prueba:** `POST /api/salidas` con `{estadiaId:'abc', metodoPago:'Efectivo'}` → **500** `{"error":"No se pudo registrar la salida y el cobro del vehículo."}`
- **Impacto:** un error de cliente se reporta como fallo del servidor; dificulta diagnóstico y puede disparar alertas falsas.
- **Corrección:** validar `Number.isInteger(id) && id > 0`; devolver 400.

#### A-04 — La salida por placa no normaliza el formato
- **Archivo/línea:** `src/routes/salidas.js:97` (`placa: String(placa).trim().toUpperCase()`).
- **Prueba:** estadía activa `ZZQ-9003`; `POST /api/salidas` con `{placa:'ZZQ9003'}` → **404**. La misma placa con guion sí existe.
- **Impacto:** clientes que usan placa (no `estadiaId`) no pueden cerrar la estadía; inconsistencia con la normalización del ingreso.
- **Corrección:** reutilizar `normalizarPlaca` o buscar ambas variantes.

#### A-05 — Truncamiento silencioso de placas largas
- **Archivo/línea:** `src/routes/ingresos.js:40-48` (`normalizarPlaca` recorta a 6/7) y `public/js/app.js:468-476`.
- **Prueba:** `POST /api/ingresos` con `{placa:'ZZQ-90022', tipo:'moto'}` → **201** y placa almacenada **`ZZQ-9002`**.
- **Impacto:** una placa inválida se convierte en una placa válida; se registra un vehículo equivocado y se rompe la trazabilidad.
- **Corrección:** rechazar longitudes >7; no truncar silenciosamente.

#### A-06 — El preview de salida usa la tarifa actual, no la tarifa asignada a la estadía
- **Archivo/línea:** `public/js/app.js:689-695` (`tarifaDeTipo`/`montoDeCobro`) y `845-857`; `src/routes/salidas.js:53-54` ya devuelve `tarifaHora`/`tarifaFraccion`, pero el frontend las ignora.
- **Impacto:** si el dueño cambia la tarifa después del ingreso, el recepcionista ve un monto distinto al que el servidor cobrará (el servidor usa `estadia.tarifa`).
- **Corrección:** calcular el preview con `activo.tarifaHora` y `activo.tarifaFraccion`.

#### A-07 — Token de sesión aceptado por query string
- **Archivo/línea:** `src/config/auth.js:59-67` (`req.query.token`); usado por `public/js/estadisticas.js:423` y `public/js/ocupacion.js:348` para descargas.
- **Prueba:** `GET /api/reportes/diario?fecha=2026-10-27&token=<token-válido>` → **200**.
- **Impacto:** el token queda en logs de acceso, historial del navegador, proxies y cabeceras `Referer`; riesgo de secuestro de sesión. Rompe la regla de usar `Authorization: Bearer`.
- **Corrección:** descargar con `fetch` + `Blob` y cabecera `Authorization`, o emitir un token de descarga de un solo uso y corta vida.

#### A-08 — Notas guardadas en `localStorage` rompen la inmutabilidad
- **Archivo/línea:** `public/js/app.js:746-783` (`guardarNotaLocal`, `obtenerNotaLocal`, `renderNotaSalida`).
- **Impacto:** la nota puede editarse desde la consola del navegador; una nota vieja puede aparecer para una placa reutilizada; si la API no tiene nota, se muestra la copia local. El criterio de UPAO-9 exige vínculo permanente e inmutable a la estadía.
- **Corrección:** eliminar el almacenamiento local y usar solo `estadia.nota` del API.

### 2.3. Medias

#### M-01 — JSON malformado devuelve 500 en lugar de 400
- **Archivo/línea:** `server.js:17` (`express.json()`) y `32-35` (error handler que siempre responde 500).
- **Prueba:** `POST /api/auth/login` con body `{bad` y `Content-Type: application/json` → **500** `{"error":"Error interno del servidor."}`
- **Corrección:** detectar `err.type === 'entity.parse.failed'` o `err.status` y responder 400.

#### M-02 — Sin rate limiting en login ni en el endpoint público
- **Archivo/línea:** `src/routes/auth.js:9`, `src/routes/publico.js:45`, `server.js`.
- **Prueba:** 50 peticiones concurrentes a `/api/publico/disponibilidad` → **50×200** en ~2.2 s; sin 429. Login admite intentos ilimitados.
- **Impacto:** fuerza bruta de credenciales y agotamiento de recursos/DB en Render free.
- **Corrección:** rate limit por IP/usuario, backoff y bloqueo temporal.

#### M-03 — Sin cabeceras de seguridad/CSP y uso de `innerHTML` con datos de BD
- **Archivo/línea:** `server.js` (no Helmet/CSP); `public/js/reportes.js:306`, `public/js/aforo.js:98`, `public/js/app.js:721` y `816`, `public/js/estadisticas.js:405`.
- **Impacto:** riesgo de XSS almacenado si un campo de BD (método, tipo, nombre de usuario) contiene HTML; falta `X-Frame-Options`, `X-Content-Type-Options`, CSP.
- **Corrección:** Helmet/CSP y renderizar con `textContent`/`createElement` en lugar de `innerHTML`.

#### M-04 — El módulo de aforo no se actualiza en tiempo real
- **Archivo/línea:** `public/js/aforo.js:10-17` y `39`; solo carga al hacer clic en la tarjeta, sin `setInterval` ni botón de refresco.
- **Impacto:** el recepcionista ve una foto stale; contradice el texto “Monitoreo en tiempo real” del menú.
- **Corrección:** polling cada 15–30 s o refresco manual explícito.

#### M-05 — Zona horaria del navegador en ingreso/salida/aforo
- **Archivo/línea:** `public/js/app.js:666-678` (`formatearHora`), `public/js/aforo.js:84-88`.
- **Impacto:** fuera de Perú las horas de ingreso/salida se muestran en la zona local del navegador, no en `America/Lima`; los reportes y la vista pública sí usan Perú.
- **Corrección:** agregar `timeZone: 'America/Lima'` a `toLocaleTimeString`.

#### M-06 — Capacidad 0: configuración y API no coinciden
- **Archivo/línea:** `src/routes/espacios.js:110-115` rechaza `<1`; `src/config/espacios.js:12-14` acepta 0; `src/routes/publico.js` maneja 0.
- **Prueba:** `espacios.json` 0/0 → público 200 con capacidad 0 y disponibles 0; `PUT /api/espacios/capacidad {capacidadAutos:0}` → **400** “debe ser un número entero mayor a 0”.
- **Impacto:** no se puede cerrar la cochera desde la API; solo editando el JSON (que en Render es efímero, DEF-77-08).
- **Corrección:** decidir si 0 es válido y alinear validación, UI y persistencia.

#### M-07 — Sin auditoría de quién registra la salida, cambia tarifas o capacidad
- **Archivo/línea:** `src/routes/salidas.js`, `src/routes/tarifas.js`, `src/routes/espacios.js`; `prisma/schema.prisma` (`Pago` no tiene usuario).
- **Impacto:** no hay trazabilidad de operaciones sensibles (cobro, cambio de precio, capacidad); solo el ingreso guarda `idUsuario`.
- **Corrección:** agregar `idUsuarioSalida`/tabla de auditoría y registrar en cada operación.

#### M-08 — `GET /api/salidas/metodos-pago` escribe en BD
- **Archivo/línea:** `src/routes/salidas.js:67-71` (`upsert` de Efectivo/Yape/POS en un GET).
- **Impacto:** efecto secundario en una lectura; concurrencia innecesaria; semántica HTTP incorrecta.
- **Corrección:** sembrar los métodos una vez o crearlos solo en el POST de salida.

#### M-09 — El reporte diario usa la fecha local del navegador, no la de Perú
- **Archivo/línea:** `public/js/reportes.js:77-83` (`obtenerFechaHoyISO` con `getFullYear/getMonth/getDate`).
- **Impacto:** el día por defecto puede ser distinto al día peruano si el navegador está en otra zona; consulta el día equivocado.
- **Corrección:** usar `Intl.DateTimeFormat` con `timeZone:'America/Lima'`.

#### M-10 — Inconsistencias de exportación
- **Archivo/línea:** `src/routes/ocupacion.js:271-321` (`formato=excel` devuelve CSV con nombre `.csv`); `src/routes/reportes.js:456-459` (no hay total POS en el CSV).
- **Impacto:** el usuario cree descargar Excel y recibe CSV; los totales del CSV no cubren POS.
- **Corrección:** generar XLSX real o renombrar la opción a CSV; agregar total POS/Tarjeta.

### 2.4. Bajas / endurecimiento

- **B-01 —** `POST/PUT/DELETE /api/publico/disponibilidad` responden **401** en vez de **405** (`server.js:20-34`, `publico.js:45`). No hay fuga ni escritura, pero el mensaje es engañoso.
- **B-02 —** Código muerto de “Reservar” en `public/js/disponibilidad.js:22,31,162-186`; los botones fueron retirados en `index.html` para Sprint 3. Mantenibilidad y confusión en QA.
- **B-03 —** Polling con `setInterval` sin guardia de solapamiento ni timeout (`public/js/disponibilidad.js:188-193`); una petición lenta puede solaparse con la siguiente y una respuesta vieja puede sobrescribir a la nueva.
- **B-04 —** Toast repetido en cada fallo de polling (`public/js/disponibilidad.js:144-148`); durante una caída larga aparece cada 30 s.
- **B-05 —** `sinDatos` se basa en `estadias.length` y no en ingresos del rango (`src/routes/ocupacion.js:216-233`); puede mostrar 9 barras en cero sin mensaje de vacío.
- **B-06 —** `porcentajeTotal` puede superar 100 si la ocupación excede la capacidad (`src/routes/espacios.js:39-41`); no se capa.
- **B-07 —** El payload del token no se contrasta con la BD y el parser acepta puntos extra (`src/config/auth.js:37-38,54-56`); un usuario eliminado conserva sesión hasta expirar.
- **B-08 —** `/api/reportes/diario` asigna “Efectivo” a un pago sin método (`src/routes/reportes.js:87`); puede inflar el efectivo.
- **B-09 —** `Tarifa` no tiene unicidad por `idTipoVehiculo` y `Pago.estadia` es opcional (`prisma/schema.prisma`); pueden existir tarifas activas duplicadas o pagos huérfanos.
- **B-10 —** Login sin bloqueo, política de contraseñas ni comparación de tiempo uniforme (`src/routes/auth.js`); enumeración por timing y fuerza bruta.

---

## 3. MATRIZ DE CASOS DE PRUEBA

> Formato de 3 columnas para la plantilla Excel. Las filas marcadas **C-xx/A-xx/M-xx** referencian los hallazgos de la sección 2.

### 3.1. Sprint 1 — Login / Autenticación

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| `admin` / `123456` | `200`, token emitido, rol `DUENO` | `200`, token HMAC, rol `DUENO`; dashboard visible — **PASA** |
| `admin` / `incorrecta` | `401` con mensaje genérico | `401 {"error":"Credenciales inválidas."}` — **PASA** |
| `GET /api/reportes/diario` sin token | `401` | `401` — **PASA** |
| Token manipulado (firma alterada) | `401` | `401` — **PASA** |
| RECEPCIONISTA en reportes/tarifas/capacidad | `403`; operativos `200` | `403` en las tres; ingresos activos `200` — **PASA** |
| Servidor sin `AUTH_SECRET` + token firmado con el fallback | `401` | **`200` con token forjado de DUEÑO** — **FALLA C-01** |
| `POST /api/auth/login` con body `{bad` | `400` por JSON inválido | **`500 {"error":"Error interno del servidor."}`** — **FALLA M-01** |
| `GET /api/reportes/diario?fecha=2026-10-27&token=<válido>` | Rechazar token en URL | **`200`** — **FALLA A-07** |
| 10 intentos de login con contraseña incorrecta | `429`/bloqueo temporal | 10×`401`, sin límite — **FALLA M-02** |

### 3.2. Sprint 1 — Tarifas

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| `PUT /api/tarifas/:id` con `precioHora:0` | `400`, no modificar | `400 "Ingrese un monto numérico válido mayor a 0.00"` — **PASA** |
| `precioHora:-1` | `400` | `400` — **PASA** |
| `precioHora:1.999` | `400` (máx. 2 decimales) | `400` — **PASA** |
| `precioHora:999.99`, `precioFraccion:0.01` | `200`, valores persistidos | Validación de rango correcta (revisión de código; no se modificó la BD) — **PASA** |
| `PUT /api/tarifas/abc` | `400` | `400 "Identificador de tarifa inválido."` — **PASA** |
| RECEPCIONISTA intenta `PUT /api/tarifas/:id` | `403` | `403` — **PASA** |

### 3.3. Sprint 1 — Ingreso

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| Placa `ABC123`, tipo auto | Normalizar `ABC-123`, `201` | `ABC-123`, tipo Automóvil, `201` — **PASA** (E2E CP-04/CP-10) |
| Placa `AB1234` / `1234AB`, tipo moto | Normalizar `AB-1234` / `1234-AB` | Correcto — **PASA** (E2E CP-05/CP-06) |
| Placa vacía o inválida | `400` con mensaje | `400` — **PASA** (E2E CP-08/CP-09) |
| Placa activa duplicada | `409` | `409` — **PASA** (E2E CP-11) |
| Dos ingresos simultáneos con 1 cupo | `201` + `409`, sin sobrecupo | `201` + `409`, 9/9 autos — **PASA** (CONC-01) |
| Placa `<script>alert(1)</script>` | `400`, sin XSS/SQLi | `400 "Ingrese una placa válida..."` — **PASA** |
| `nota` de 251 caracteres | `400` | `400 "La nota no puede exceder los 250 caracteres."` — **PASA** |
| `nota` de 250 caracteres | `201`, nota persistida | `201`, nota de 250 caracteres — **PASA** |
| `nota` solo espacios | `201`, nota `null` | `201`, nota `null` — **PASA** |
| Token de `recepcion` + `idUsuario:1` en el body | Registrar con el ID de la sesión (8) | **`201`, `idUsuario:1` (Administrador)** — **FALLA C-03** |
| Placa `ZZQ-90022` (8 caracteres) | `400` por formato inválido | **`201`, placa truncada `ZZQ-9002`** — **FALLA A-05** |

### 3.4. Sprint 1 — Salida

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| Salida válida con `estadiaId` | `200`, un pago, estadía cerrada | `200`, pago creado, monto calculado — **PASA** |
| Doble clic simultáneo en “Registrar salida” | Un solo cobro; segunda `409` | `200` + `409`, 1 pago vinculado, 0 huérfanos — **PASA** (INT-01) |
| `estadiaId:'abc'` | `400` | **`500 "No se pudo registrar la salida..."`** — **FALLA A-03** |
| Estadía activa `ZZQ-9003` + `placa:'ZZQ9003'` | Encontrar la estadía y cobrar | **`404 "No se encontró una estadía activa..."`** — **FALLA A-04** |
| `metodoPago:'Bitcoin'` | `400` | `400 "Método de pago no válido..."` — **PASA** |
| Tarifa con monto negativo en BD | Rechazo por constraint | `pago_monto_no_negativo` en migración — **PASA** (BD) |
| Tarifa cambiada después del ingreso | Preview = cobro del servidor | Revisión de código: preview usa tarifa actual; servidor usa la tarifa de la estadía — **FALLA A-06** |

### 3.5. Sprint 1 — Aforo / Espacios

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| Capacidad 0/0 en configuración | `capacidad:0`, `disponibles:0` | `200`; autos 0/8/0, motos 0/6/0 — **PASA** |
| Capacidad 1/1 con 8 autos y 6 motos | `disponibles:0`, sin negativos | `200`; autos 1/8/0, motos 1/6/0 — **PASA** |
| “Reserva Web” activa | Coherencia entre aforo, público y ocupación | Público: enCochera 15, otros 1, disponibles 6 (15+6>20); interno: 14; ocupación: auto +1 — **FALLA A-01** |
| `PUT /api/espacios/capacidad {capacidadAutos:0}` | Si 0 es válido, `200`; si no, error coherente | `400 "debe ser un número entero mayor a 0"` — **FALLA M-06** |
| Actualización de la vista de aforo a los 30 s | Cambio automático | Revisión de código: sin polling; solo carga al abrir — **FALLA M-04** |
| Hora de ingreso en navegador fuera de Perú | Mostrar hora Perú | Revisión de código: usa zona local del navegador — **FALLA M-05** |

### 3.6. Sprint 1 — Reporte diario (UPAO-17)

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| `GET /api/reportes/diario?fecha=2026-10-27` | `200`, totales y movimientos reales | `200`; 5 movimientos; total 1569.10 — **PASA parcialmente** |
| Pago POS de S/ 1.50 en la fecha | Incluido en total y cuadre | Total 1569.10 vs suma de filas 1570.60; POS omitido — **FALLA C-04** |
| Fecha `2026-02-31` | `400` fecha inválida | **`200`, `fechaFormateada:"31/02/2026"`** — **FALLA A-02** |
| Fecha `2026-04-31` | `400` | **`200`** — **FALLA A-02** |
| Fecha `2026-13-01` | `400` fecha inválida | `400` (por comparación “futuro”, no por calendario) — **PASA por motivo incorrecto** |
| Fecha sin movimientos (07/11/2026) | Estado vacío, 0 movimientos | UI muestra **4 filas demo y S/ 59.50** — **FALLA C-02** |
| Fecha antigua sin movimientos (01/11/2026) | Estado vacío | 0 filas, S/ 0.00, mensaje visible — **PASA** |
| Pago POS en la tabla | Badge/color POS y total incluido | Badge `badge-metodo-yape` e icono Yape; total sin POS — **FALLA C-04** |

### 3.7. Sprint 2 — Notas (UPAO-9)

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| Nota de 250 caracteres | `201`, persistida | `201`, 250 caracteres — **PASA** |
| Nota de 251 caracteres | `400` | `400` — **PASA** |
| Nota vacía / solo espacios | `201`, `nota:null` | `201`, `nota:null` — **PASA** |
| Nota con `<img src=x onerror=...>` | Guardar como texto; render sin ejecutar | API la guarda; UI usa `textContent` — **PASA** (revisión de código) |
| Editar la nota desde consola (`localStorage`) | No debe afectar la nota mostrada | Revisión de código: `localStorage` puede alterar/crear una nota local — **FALLA A-08** |
| Intento de `PUT/PATCH/DELETE` de la nota | No debe existir endpoint | No existe endpoint; la nota es inmutable en API — **PASA** |

### 3.8. Sprint 2 — Gráficos estadísticos (UPAO-18)

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| Carga del mes actual | Métricas y 31 barras | Total S/ 2,881.50; 31 barras — **PASA** |
| Mes futuro (diciembre 2026) | Deshabilitado / `400` | Deshabilitado en UI — **PASA** |
| Mes sin ventas (enero 2024) | Mensaje oficial y 0 | “No se registran ingresos para el período seleccionado” — **PASA** |
| Formato monetario | `S/ 0.00` | `S/ 2,881.50` — **PASA** |
| Exportación CSV | BOM, cabeceras y totales | BOM UTF-8, cabeceras y totales — **PASA** |
| POS en cards del dashboard | Visible o sumado | Total 2,881.50; Efectivo+Yape 2,880.00; POS 1.50 no visible — **FALLA C-04** |
| RECEPCIONISTA en gráficos | Sin acceso | Tarjeta oculta; API `403` — **PASA** |

### 3.9. Sprint 2 — Ocupación (UPAO-19)

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| Rango por defecto de 7 días | Carga con últimos 7 días | Correcto — **PASA** |
| Inicio > Fin | `400` | `400 "La fecha de inicio no puede ser posterior..."` — **PASA** |
| Fechas futuras | `400` | `400 "No se pueden consultar reportes de fechas futuras"` — **PASA** |
| Rango sin movimientos | 0 y mensaje exacto | 0 y mensaje exacto — **PASA** |
| “Reserva Web” activa en el rango | No clasificarla como auto | `totalAutos` +1 — **FALLA A-01** |
| Exportación `formato=excel` | Archivo Excel real | Devuelve CSV `reporte_ocupacion_*.csv` — **FALLA M-10** |
| RECEPCIONISTA en ocupación | `403` | `403` — **PASA** |

### 3.10. Sprint 2 — Disponibilidad pública (UPAO-20)

| DATOS DE PRUEBA / INPUT | RESULTADO ESPERADO (Especificación / Criterio) | RESULTADO OBTENIDO DEL SISTEMA (Return / Comportamiento Real) |
| --- | --- | --- |
| `GET /api/publico/disponibilidad` sin token | `200`, JSON con autos/motos/total | `200`; autos 10/8/2, motos 10/6/4, total 20/14/6 — **PASA** |
| Polling cada 30 s | Hora y cupos actualizados | `17:48:46 → 17:49:17` — **PASA** |
| Aforo lleno (cupos 0) | Panel rojo, “Aforo lleno” | Clase `aforo-lleno`, borde rojo, badge — **PASA** |
| Vista sin sesión | Sin login, cabecera oculta | Correcto — **PASA** |
| “Reservar espacio” | Retirado para Sprint 3 | 0 botones en el DOM — **N/A** |
| API 500 / JSON malformado / offline | Mantener UI y avisar | UI anterior + toast; 0 page errors — **PASA** |
| 50 peticiones concurrentes | Sin 500; ideal 429 | 50×200 en 2.2 s; sin rate limit — **FALLA M-02** |
| “Reserva Web” activa | `otrosEnCochera` coherente con cupos | 15 ocupados + 6 disponibles > 20 — **FALLA A-01** |
| Capacidad 0 / sobrecupo | 0, sin negativos | 0, sin negativos — **PASA** |

---

## 4. Evidencia de ejecución

```text
npm run test:e2e          → 15 OK, 0 FALLA
npm run test:disponibilidad → 27 PASS, 0 FAIL
npm run test:graficos     → 20 PASS, 0 FAIL
npm run test:seguridad    → 15 PASS, 0 FAIL
npm run test:integridad   → 1 PASS
npm run test:concurrencia → 1 PASS
npm run test:regresion    → 12 PASS
```

Pruebas manuales destacadas:

```text
POST /api/reportes/diario (27/10/2026)
  totalGeneral: 1569.10 | suma movimientos: 1570.60 | POS omitido: 1.50

GET /api/reportes/diario?fecha=2026-11-07
  API: 0 movimientos | UI: 4 filas demo | S/ 59.50

Servidor :3556 sin AUTH_SECRET + token forjado
  GET /api/reportes/diario → 200

POST /api/ingresos (token recepcion, idUsuario:1)
  → 201, idUsuario:1, usuario:"Administrador"

POST /api/salidas {estadiaId:"abc"}
  → 500

POST /api/salidas {placa:"ZZQ9003"} con estadía ZZQ-9003
  → 404

POST /api/ingresos {placa:"ZZQ-90022"}
  → 201, placa:"ZZQ-9002"
```

---

## 5. Conclusión

El sistema tiene una base funcional sólida: las suites de ingreso, disponibilidad, gráficos, seguridad, integridad, concurrencia y regresión están en verde. Sin embargo, **no está listo para producción** mientras existan C-01, C-02, C-03 y C-04:

- C-01 permite emitir tokens de DUEÑO si falta una variable de entorno.
- C-02 muestra ingresos ficticios en el reporte diario.
- C-03 permite falsear el responsable de un ingreso.
- C-04 subestima la recaudación y oculta POS/Tarjeta.

Los hallazgos A-01 a A-08 y M-01 a M-10 deben corregirse antes de cerrar el Sprint 2, o al menos registrarse como deuda con dueño y fecha. Las bajas B-01 a B-10 son de endurecimiento y mantenibilidad.

**No se aplicó ninguna corrección de código en esta auditoría.** ¿Deseas que proceda a aplicar las correcciones directamente en el código fuente? Propongo empezar por C-01, C-02, C-03 y C-04, que son las de mayor impacto, y luego A-01/A-02/A-03/A-04.
