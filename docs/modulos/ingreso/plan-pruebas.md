# Plan de pruebas — Módulo Ingreso (UPAO-41)

## Objetivo

Verificar el registro de ingreso (UPAO-6 / UPAO-37..40): login por rol, detección y validación de placa, registro con hora automática y control de duplicados; registrar y depurar los fallos encontrados.

## Alcance

- Login y menú **por rol**.
- Módulo de ingreso: placa (detección/validación), registro, duplicado y hora automática.

**Fuera de alcance:** salida y cobro (UPAO-7), estado de espacios (UPAO-11) y el **bloqueo por aforo** (la capacidad total no está definida).

## Entorno de pruebas

- `npm run dev` → `http://localhost:3000`
- BD compartida (Neon)
- Usuarios: `recepcion` / `123456` (RECEPCIONISTA) · `admin` / `123456` (DUEÑO)
- Test **automatizado E2E con Playwright**: `tests/e2e-ingreso.js` → `npm run test:e2e` (opciones: `HEADED=1` navegador visible · `VIDEO=1` graba en `./evidencia`).

## Casos de prueba

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CP-01 | Login recepcionista | `recepcion` / `123456` | Entra; ve solo "Registrar Ingreso" |
| CP-02 | Login dueño | `admin` / `123456` | Entra; ve solo "Configurar Tarifas" |
| CP-03 | Abrir módulo de ingreso | Clic en "Registrar Ingreso" | Se abre el formulario |
| CP-04 | Detección Auto | Escribir `ABC123` | Se formatea `ABC-123` y preselecciona Automóvil |
| CP-05 | Detección Moto (`AB-1234`) | Escribir `AB1234` | `AB-1234` y preselecciona Motocicleta |
| CP-06 | Detección Moto (`1234-AB`) | Escribir `1234AB` | `1234-AB` |
| CP-07 | Bloqueo de espacios | Escribir un espacio | No se permite escribir espacio |
| CP-08 | Placa vacía | Enviar sin placa | Mensaje "Ingrese la placa del vehículo." |
| CP-09 | Placa inválida | `AB1` → enviar | Mensaje de formato peruano |
| CP-10 | Registrar ingreso | Placa válida → "Registrar Ingreso" | Toast verde + hora automática |
| CP-11 | Duplicado | Registrar la misma placa activa | Toast rojo "ya registra un ingreso activo" |
| CP-12 | Coherencia Placa ↔ Tipo (Poka-Yoke) | Placa de Auto (`ABC-123`) con tipo Moto o viceversa | Bloqueo inmediato con mensaje de incoherencia según norma MTC |

## Registro de resultados (ejecutado con Playwright)

| ID | Resultado | Evidencia |
| --- | --- | --- |
| CP-01 | PASA | E2E + video |
| CP-02 | PASA | E2E |
| CP-03 | PASA | E2E |
| CP-04 | PASA | E2E |
| CP-05 | PASA | E2E |
| CP-06 | PASA | E2E |
| CP-07 | PASA | E2E |
| CP-08 | PASA | E2E |
| CP-09 | PASA | E2E |
| CP-10 | PASA | E2E + video |
| CP-11 | PASA | E2E + video |
| CP-12 | PASA | Pruebas de integración + API |

> Ejecución: **16 verificaciones, 0 fallas** (12 casos). Fecha: 15/10/2026.

## Registro de defectos y depuración

| ID | Caso | Esperado | Obtenido | Causa | Corrección | Re-probado |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-01 | CP-02 | El dueño ve "Configurar Tarifas" | En la 1.ª corrida no lo veía | **Timing del test** (se evaluaba antes de activarse el dashboard), **no** bug de la app | Esperas robustas (`waitForFunction` al dashboard) | PASA |
| DEF-02 | CP-10 | Registra el ingreso | Devolvía "ya registra un ingreso activo" | La placa de prueba (`ABC-123`) quedaba de corridas anteriores | Limpiar registros de prueba antes/después | PASA |
| DEF-03 | CP-12 | Coherencia estricta: Placa de Auto solo puede registrarse como Auto; Placa de Moto solo como Moto | El recepcionista podía forzar manualmente una moto como auto o viceversa, falseando cobros y aforo | Falta de validación cruzada entre el patrón oficial MTC (`analizarPlaca`) y el tipo de vehículo | Validación preventiva en frontend (`validarPlaca`) y rechazo con HTTP 400 en backend (`src/routes/ingresos.js`) | PASA |

> **Integración frontend ↔ backend:** verificada (el formulario llama a `POST /api/ingresos` y muestra las respuestas 201 / 400 / 409). **Defectos depurados y resueltos.**

## Evidencias y Trazabilidad en GitHub

- **Video** (Playwright, local): `evidencia-UPAO-41-ingreso.webm` (cubre los casos de prueba).
- **Capturas**: login/menú, detección de placa, registro y duplicado.
- **Commits y Merges en GitHub:**
  - Commit de corrección Poka-Yoke (DEF-03): [`af688f4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/af688f4)
  - Merge Commit a `develop`: [`fbd04f9`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/fbd04f9)
  - Rama de depuración: [`feature/depuracion-validacion-placa-tipo`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/depuracion-validacion-placa-tipo)

---

# Plan de Pruebas y Registro de Depuración — Notas vehiculares (UPAO-9 / UPAO-58)

> **Ejecución:** 26/10/2026 · Entorno local `http://localhost:3000` · **BD de staging** (Neon, branch `staging`, migraciones al día) · Usuario `recepcion` / `123456`.

## 1. Objetivo y alcance

Verificar el registro, la persistencia, el límite de **250 caracteres**, la visualización en el módulo de salida y la **inmutabilidad** de la nota vehicular (`estadia.nota`) incorporada en la historia UPAO-9 (análisis UPAO-58).

**Fuera de alcance:** edición/borrado de la nota (prohibidos por diseño), reportes y reservas.

## 2. Entorno de pruebas

- Servidor local: `npm run dev` → `http://localhost:3000` (código de `develop`).
- Base de datos: PostgreSQL Neon — branch **staging** (3 migraciones aplicadas, incluida `20261026014805_add_campo_nota_estadia`).
- Datos al momento de la prueba: 13 estadías activas (capacidad: 10 autos / 10 motos).
- Usuario: `recepcion` / `123456` (RECEPCIONISTA).
- Evidencia visual: capturas del ejecutor (ver §5).

## 3. Matriz de casos de prueba

| ID | Caso de prueba | Pasos a ejecutar | Resultado esperado | Resultado |
|:---:|---|---|---|:---:|
| CP-N01 | Ingreso con nota válida (≤ 250) y persistencia | Registrar placa `TST-901` (Auto) con nota de 61 caracteres → consultar `estadia.nota` en BD | HTTP 201 y `estadia.nota` igual a la nota enviada | **PASA** (id 47, verificado en BD y limpiado) |
| CP-N02 | Nota vacía o solo espacios | Registrar placa `TST-902` (Auto) con nota `"     "` | HTTP 201 y `estadia.nota = NULL` (sin errores) | **PASA** (id 48, verificado en BD y limpiado) |
| CP-N03 | Superar 250 caracteres | Pegar 251 caracteres en el textarea y enviar; luego `POST /api/ingresos` con 251 caracteres | Bloqueo visual en la interfaz (maxlength/contador) **y** rechazo HTTP 400 en backend | **PASA**: 260 tecleados se cortan en 250; contador `250/250` en ámbar; backend 400 ✓ |
| CP-N04 | Nota visible en el módulo de salida | Abrir "Registrar Salida" → seleccionar `HHH-333` (nota `"eaaaa"`) | Tarjeta ámbar "Observación registrada al ingreso:" con la nota íntegra | **PASA** (callout renderizado con la nota) |
| CP-N05 | Inmutabilidad de la nota | `PUT` / `PATCH` / `DELETE` a `/api/ingresos/46`; revisar botones en la pantalla de salida | HTTP 404 (sin endpoints) y ausencia de controles de edición; `POST /api/salidas` ignora `nota` | **PASA** (404/404/404; sin botones de edición) |

> **Nota de ejecución (CP-N02):** el primer intento devolvió `Aforo completo` porque el registro de CP-N01 seguía activo (10/10 autos). Tras eliminar el registro de prueba, el caso pasó. Es comportamiento esperado del control de aforo, **no** un defecto.

## 4. Registro de Defectos Depurados (Defect Log)

| ID | Caso | Falla encontrada | Causa raíz | Corrección aplicada | Commit Fix | Estado |
|:---:|:---:|---|---|---|:---:|:---:|
| DEF-N01 | CP-N03 | El textarea `#input-nota-ingreso` no tenía `maxlength` ni contador `0/250`; aceptaba 251+ caracteres y solo el backend rechazaba | La implementación de interfaz (UPAO-9) no incluyó lo especificado en `analisis-notas.md` §7 (maxlength + contador dinámico) | Se agregó `maxlength="250"`, contador dinámico `#contador-nota` (`0/250`, ámbar al llegar a 250) y estilos `.nota-footer`/`.contador-nota` | — (pendiente de commit) | **SUPERADO** (re-probado 26/10/2026) |

## 5. Evidencias y Trazabilidad en GitHub

### 5.1. Ubicación exacta de las capturas (código)

| # | Captura | Archivo / líneas exactas | Qué debe verse |
|:---:|---|---|---|
| C1 | Esquema Prisma | `prisma/schema.prisma` → **L52-L61** | Modelo `Estadia` con `nota String? @db.VarChar(250)` (L61) |
| C2 | Migración | `prisma/migrations/20261026014805_add_campo_nota_estadia/migration.sql` → **L1-L2** | `ALTER TABLE "estadia" ADD COLUMN "nota" VARCHAR(250);` |
| C3 | Sanitización y límite | `src/routes/ingresos.js` → **L69-L80** | `nota.trim()`, rechazo `> 250` (HTTP 400) y `null` si queda vacía |
| C4 | Usuario + creación | `src/routes/ingresos.js` → **L116-L142** | Resolución del recepcionista (`idUsuario`/`usuario` → fallback RECEPCIONISTA) y `nota: notaFinal` en `prisma.estadia.create` |
| C5 | GET salida + nota | `src/routes/salidas.js` → **L47-L57** | `nota: estadia.nota ?? null` (L55) en la respuesta de `/api/salidas/activos` |
| C6 | Inmutabilidad (rutas) | `src/routes/ingresos.js` → **L40 y L164**; `src/routes/salidas.js` → **L79-L80 y L140-L145** | Solo `POST`/`GET`; el `POST /api/salidas` solo acepta `estadiaId`, `placa`, `metodoPago` (ignora `nota`) y actualiza solo `horaSalida`/`idPago` |
| C7 | Registro de rutas | `server.js` → **L19-L24** | Montaje de `/api/ingresos` y `/api/salidas` (sin rutas de actualización de nota) |
| C8 | UI — campo de nota | `public/index.html` → **L384-L400** | `<textarea id="input-nota-ingreso" maxlength="250">` + contador `0/250` |
| C9 | UI — envío de nota | `public/js/app.js` → **L522-L527** | Construcción del payload `{ placa, tipo, nota }` |
| C10 | UI — nota en salida | `public/index.html` → **L521-L522** y `public/js/app.js` → **L691-L732** | Contenedor `#salida-nota-container` y función `renderNotaSalida` |
| C11 | Estilos del callout | `public/css/style.css` → **L1086-L1160** | `.textarea-nota`, `.callout-nota-alerta`, `.callout-nota-texto` |
| C12 | Límite visual (fix DEF-N01) | `public/index.html` **L390-L400** · `public/js/app.js` **L348-L359** · `public/css/style.css` **L1107-L1124** | `maxlength="250"`, contador `0/250` y ámbar al llegar a 250 |

### 5.2. Evidencia funcional (capturas sugeridas)

| Captura | Qué debe verse |
|---|---|
| E1 | Formulario de ingreso con el campo de notas visible |
| E2 | Registro con nota válida → toast verde + fila en Prisma Studio con `nota` |
| E3 | Registro con nota vacía/espacios → fila en Prisma Studio con `nota = NULL` |
| E4 | 260 caracteres tecleados → se cortan en 250; contador `250/250` en ámbar + respuesta HTTP 400 del backend |
| E5 | Módulo de salida con la tarjeta ámbar "Observación registrada al ingreso: eaaaa" (`HHH-333`) |
| E6 | Pantalla de salida sin botón de edición + `PUT`/`PATCH`/`DELETE` → HTTP 404 |

### 5.3. Trazabilidad

- **Video MP4:** pendiente de adjuntar por el ejecutor.
- **Commits:** [`67bb010`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/67bb010) (interfaz), [`4a6a9c4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/4a6a9c4) (backend + migración), [`7e28297`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/7e28297) (modelo ER).
- **Pull Request:** [#18](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/18) → merge [`519418d`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/519418d).
- **Migración:** `prisma/migrations/20261026014805_add_campo_nota_estadia/migration.sql`.
- **Rama:** `feature/UPAO-9-logica-notas-backend-66`.

