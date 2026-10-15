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

