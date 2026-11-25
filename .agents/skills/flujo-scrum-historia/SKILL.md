---
name: flujo-scrum-historia
description: >-
  Ejecuta el ciclo completo de una Historia de Usuario en Scrum de punta a punta
  (verificación en Jira, Análisis y Diseño, Prototipado, Codificación, Test y
  Depuración, Configuración/Despliegue en Blue y promoción validada a Green).
  Usar esta skill al iniciar, continuar, auditar o cerrar cualquier Historia de
  Usuario o subtarea del proyecto Sistema de Cochera (UPAO).
---

# Flujo Scrum de Historia de Usuario (Planificación a Despliegue)

Procedimiento estándar paso a paso para ejecutar una Historia de Usuario (HU) manteniendo trazabilidad estricta entre **Jira (`UPAO`)**, **Git/GitHub**, **documentación en `docs/`** y **ambientes Blue/Green**.

---

## Reglas de Oro (Gates Anti-Errores)

Estas reglas bloquean fallos recurrentes detectados en sprints previos. Si alguna se incumple, **detenerse y corregir antes de avanzar**:

1. **Sin saltos en el tiempo:** En *Análisis y Diseño* nunca incluir enlaces a PRs, commits de implementación ni resultados de pruebas. Todo caso de prueba diseñado nace en estado `Pendiente`.
2. **Aislamiento estricto por Historia:** Una rama (`feature/<CLAVE>-<slug>`), un documento de análisis, un `plan-pruebas-<CLAVE>.md` y evidencias acotadas exclusivamente a **esa Historia**. No adelantar código ni evidencias de HUs futuras ni revivir HUs ya cerradas.
3. **Orden obligatorio de subtareas:** `Análisis y Diseño → Prototipado → Codificación → Test → Configuración`. No pasar a la fase siguiente sin cumplir los criterios y evidencias de la fase actual.
4. **Blue / Green estricto:** Integrar siempre mediante PR hacia `develop` (**Blue / Staging**). Nunca fusionar una rama `feature/*` directamente a `main` (**Green / Producción**).
5. **Entorno y seguridad:** `.env` local y suites de prueba apuntan siempre a PostgreSQL Neon rama `staging` (nunca producción). Todo endpoint nuevo bajo `/api/*` debe ir detrás de `autenticar` + `autorizar(...)` en `server.js` (salvo `/api/auth/*` y `/api/publico/*`).
6. **Sin commits/push/PR implícitos:** No ejecutar `git commit`, `git push` ni abrir PR sin confirmación explícita del usuario. Usar commits convencionales con clave Jira (`feat(modulo): ... (UPAO-XX)`) y sin atribución de IA.
7. **Evidencias Jira en formato limpio y sin ruido:** Toda documentación `.md` que se adjunte a Jira va en **PDF blanco y negro estilo Markdown plano** (sin inventar temas, colores ni contenido ajeno al `.md`). **No repetir metadatos de Jira** (`> Historia de Usuario / Subtarea Jira / Épica`) en el encabezado de los `.md` ni en sus PDFs porque Jira ya los muestra. En los documentos de Backend, Pruebas y Despliegue incluir siempre **enlaces absolutos clicables a GitHub** (`https://github.com/...`), nunca rutas relativas rotas (`../../../`). Las capturas de pantalla (`.png`) corresponden **únicamente a la fase de Prototipado / UI**. La matriz Excel (`Casos_de_Prueba_*.xlsx`) se mantiene actualizada **solo en el repositorio** para entrega al docente y **nunca se sube a Jira** (para evitar duplicar lo que ya contiene `plan-pruebas-*.pdf`). Al corregir o migrar una Historia, auditar y reemplazar también los adjuntos viejos en Jira y mantener **cero comentarios** en Jira salvo pedido explícito.
8. **Staging intacto y verificación empírica obligatoria:** Ningún test contra Neon `staging` puede ejecutar `deleteMany` destructivo sobre tablas de configuración compartidas (`configuracion_pasarela`, etc.): siempre respaldar el registro previo y restaurarlo en `finally`. No dar por cerrado ningún límite o integración externa (ej. mínimo de Yape en Culqi Checkout v4) sin verificarlo en vivo.

---

## Paso 0 — Verificación y Preparación (Antes de editar archivos)

1. **Auditar Jira en vivo** con `twg`:
   ```bash
   twg jira workitem query --jql "project = UPAO AND (key = <CLAVE-HU> OR parent = <CLAVE-HU>) ORDER BY key ASC" --limit 20
   ```
   Confirmar:
   - La Historia está en `En curso` (o lista para pasar a `En curso`).
   - Cuál es la **siguiente subtarea exacta** en el orden de las 5 fases y quién está asignado.
2. **Revisar contexto del proyecto:** Leer `AGENTS.md` y los documentos existentes en `docs/modulos/<modulo>/`.
3. **Preparar rama limpia desde `develop`:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<CLAVE-HU>-<descripcion-corta>
   ```
4. **Auditar estado actual en `develop`:** Ejecutar `graphify update .` (ignorado en `.gitignore`) y verificar qué archivos, rutas y tests del módulo ya existen para no duplicar ni romper funcionalidad de HUs previas.

---

## Fase 1 — Análisis y Diseño

**Objetivo:** Dejar sin ambigüedades las reglas de negocio, el modelo de datos y el diseño de casos de prueba antes de diseñar UI o programar.

1. Refinar los **Criterios de Aceptación** de la HU (verificables, sin supuestos inventados; si hay duda de negocio, preguntar al usuario).
2. Si cambia el esquema de datos, actualizar:
   - `docs/datos/Modelo_de_Datos.md`
   - `docs/datos/diagrama-er.erd`
3. Crear o actualizar `docs/modulos/<modulo>/analisis-<CLAVE-HU>.md` (o `analisis.md`) con:
   - Alcance estricto de la HU (y explícitamente qué queda fuera).
   - Reglas de negocio, validaciones peruanas (placa SUNARP/MTC, DNI/RUC, celular 9 dígitos, moneda `S/ 0.00`) y contratos de API/roles.
   - Sección **Casos de Prueba (Diseño)**: casos válidos, inválidos y límite, todos con estado inicial `Pendiente`.
4. Registrar los mismos casos en `docs/modulos/<modulo>/Casos_de_Prueba_<Scope>.xlsx` con columnas oficiales:
   `CODIGO | HISTORIA DE USUARIO | SPRINT | CASO DE PRUEBA | DATOS DE PRUEBA | RESULTADO ESPERADO | ESTADO`
   (filas de casos inválidos con fondo `#FEE2E2`, estado `Pendiente`).
5. **Gate de salida Fase 1:**
   - [ ] Cero enlaces a commits/PRs futuros o resultados de ejecución.
   - [ ] Ningún caso o requisito de otra HU mezclado.
   - [ ] Subtarea de Análisis lista para evidencia y cierre en Jira (`Listo`).

---

## Fase 2 — Prototipado (UI / UX)

**Objetivo:** Diseñar e implementar la interfaz siguiendo la guía de estilos corporativa y con jerarquía visual clara para el usuario final.

1. Revisar `docs/diseño/Guía de Estilos y Lineamientos de Interfaz.md`:
   - Tipografía: **Geist Sans** (UI) y **JetBrains Mono** (placas, montos, métricas).
   - Paleta corporativa: azul `#1E3A8A`, ámbar `#F59E0B`, verde `#10B981`, rojo `#EF4444`, fondo `#F3F4F6`.
   - Estados obligatorios en botones: `Default`, `Hover`, `Active`, `Disabled`, `Loading`; toasts de 3.5–4 s.
2. Criterios de calidad UI aprendidos:
   - La acción principal de la vista ocupa la columna protagonista; acciones secundarias a la derecha o en modal limpio.
   - **Cero jerga técnica y cero textos instructivos redundantes** en UI: evitar subtítulos, pistas repetitivas o instrucciones obvias que el personal operativo ya conoce tras el primer uso. Usar etiquetas directas, placeholders breves y evitar botones duplicados cuando un botón principal puede adaptar su estado y color.
   - **Sin vistas duplicadas:** Nunca mostrar tarjeta y tabla con los mismos registros al mismo tiempo. En listados responsivos usar tabla compacta en una sola línea horizontal en escritorio (`>= 768px`) y tarjetas en móvil (`< 768px`).
   - Verificar vista en escritorio y móvil (sin desbordes ni encabezados que tapen controles).
3. Documentar capturas y decisiones en `docs/modulos/<modulo>/ui-<CLAVE-HU>.md`.
4. **Gate de salida Fase 2:**
   - [ ] Respeta guía de estilos y responsividad.
   - [ ] Evidencia visual lista para la subtarea de Prototipado en Jira.

---

## Fase 3 — Codificación

**Objetivo:** Implementar backend, migraciones y conexión frontend estrictamente dentro del alcance de la HU.

1. Si hay cambios en base de datos: actualizar `prisma/schema.prisma`, generar migración (`npm run db:migrate` / `npm run db:generate`) y verificar `prisma/seed.js` si aplica.
2. Implementar endpoints y lógica en `src/`:
   - Proteger rutas con `autenticar` y `autorizar(...)` en `server.js`.
   - Aplicar transacciones/locks en operaciones críticas (aforo, reservas, cobros, reembolsos, anulaciones) para evitar condiciones de carrera o doble cobro.
   - Validar todos los inputs en el backend (nunca confiar solo en el frontend).
3. Conectar la interfaz en `public/js/` manejando errores HTTP (`400`, `401`, `402`, `403`, `404`, `409`) con mensajes claros en español, aplicando timeout (`AbortController`) en llamadas críticas y recuperación automática de estado ante cortes de red/proxy (evitando spinners trabados).
4. **Gate de salida Fase 3:**
   - [ ] Solo toca código requerido por esta HU.
   - [ ] Sin comentarios innecesarios en el código ni secretos hardcodeados.
   - [ ] Evidencia técnica lista para la subtarea de Codificación en Jira.

---

## Fase 4 — Test y Depuración

**Objetivo:** Verificar que cada caso diseñado en Análisis se cumpla, documentar defectos encontrados y confirmar cero regresiones.

1. Ejecutar la suite del módulo y la suite de no regresión contra `staging`:
   ```bash
   npm run test:reservas
   npm run test:regresion
   ```
   (Agregar `test:seguridad`, `test:integridad` o `test:concurrencia` según el módulo afectado.)
2. Crear o actualizar `docs/modulos/<modulo>/plan-pruebas-<CLAVE-HU>.md` con:
   - Tabla de evaluación de **cada caso diseñado en Fase 1** (`Aprobado` / `Fallido` + resultado obtenido real).
   - Comandos ejecutados.
   - **Defect Log (`DEF-<NUM>-01`, ...)** con descripción, causa raíz, solución aplicada y estado (`Cerrado`).
   - Trazabilidad real a los commits y archivos de **esta Historia** (solo commits ya existentes).
3. Actualizar la columna `ESTADO` (`Aprobado` / `Fallido`) de los casos de esta HU en `docs/modulos/<modulo>/Casos_de_Prueba_<Scope>.xlsx`.
4. **Gate de salida Fase 4:**
   - [ ] 100% de casos de prueba de la HU en `Aprobado`.
   - [ ] `npm run test:regresion` en 100% OK.
   - [ ] 0 defectos críticos o bloqueantes abiertos.

---

## Fase 5 — Configuración e Integración en Blue (Staging)

**Objetivo:** Integrar la HU en `develop`, desplegar en Render Blue y validar en vivo.

1. Actualizar documentación transversal afectada (`AGENTS.md` §9/§11, `package.json`, `docs/`).
2. Con autorización del usuario, hacer commit convencional, push de `feature/<CLAVE-HU>-<slug>` y abrir **Pull Request hacia `develop`** con al menos 1 revisor.
3. Tras el merge a `develop`, verificar el despliegue automático en Render Blue (`cochera-sp-stating`) y comprobar en vivo:
   - Variables de entorno requeridas presentes en Render.
   - Endpoints y flujo principal respondiendo `HTTP 200` contra Neon `staging`.
4. Documentar en `docs/modulos/<modulo>/evidencia-despliegue-<CLAVE-HU>.md` (o `evidencia-despliegue.md`) con URLs, enlace al PR mergeado, verificación en vivo y tabla de trazabilidad de las 5 subtareas, regenerar los PDFs planos en blanco y negro adjuntos en Jira y mantener actualizado el Excel de casos de prueba solo en el repositorio.
5. **Gate de salida Fase 5:**
   - [ ] PR aprobado y mergeado a `develop`.
   - [ ] Verificación en vivo OK en Blue.
   - [ ] Subtarea de Configuración y la Historia actualizadas a `Listo` en Jira y reflejadas en `AGENTS.md`.

---

## Fase 6 — Promoción a Green (Producción — `main`)

**Cuándo aplica:** Únicamente al validar completamente la Historia (o el cierre de Sprint según lo planificado en Jira) sin defectos abiertos en Blue.

1. Confirmar que `develop` (Blue) pasó todas las validaciones y no tiene defectos abiertos.
2. Abrir **Pull Request desde `develop` hacia `main`** (nunca desde `feature/*`), aprobar con revisor y mergear.
3. Verificar migraciones en Neon `main` (si hubo cambios de esquema) y comprobar el servicio en vivo en Render Green (`https://cochera-sp.onrender.com`).
