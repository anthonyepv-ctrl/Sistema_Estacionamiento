# Evidencia de Despliegue y Ciclo DevOps CI/CD en Blue — Buscar Reservas (`UPAO-8` / Sprint 3)

**Fecha de Integración y Validación en Blue:** 25/11/2026  
**Ambiente:** Blue (Staging / Pre-producción) en Render (`cochera-sp-stating`)  
**Base de Datos en la Nube:** PostgreSQL en Neon (Rama `staging`, SSL activo)  
**Historia de Usuario Asociada:** `UPAO-8` (*Buscar reservas* — 2 Story Points)  
**Subtarea Jira:** `UPAO-94` — Integración y despliegue de búsqueda de reservas y ciclo DevOps CI/CD en ambiente Blue  
**Épica:** `UPAO-28` (*Manejo de Reserva Web*)  
**Rama Integrada:** `develop` (despliegue automático tras aprobar CI gate `npm test`; `main` / Green aislado sin cambios)

---

## 1. Ciclo DevOps CI/CD Automatizado (`.github/workflows/ci-cd.yml`)

| Etapa | Disparador / Acción | Responsabilidad |
|---|---|---|
| **1. `ci_tests` (CI Gate)** | `push` / `pull_request` a `develop` o `main`, o ejecución manual en **1 clic (`workflow_dispatch`)** | Levanta un contenedor efímero **PostgreSQL 16** en CI (`prisma migrate deploy` + `npm run db:seed`) sin tocar la BD viva de Staging, y ejecuta `npm test` (7 suites automatizadas: Culqi, `UPAO-22`, `UPAO-8`, Sprint 3, Ataque/Bot, RBAC y No Regresión). Si falla una prueba, **bloquea el despliegue**. |
| **2. `deploy_blue` (Pre-producción)** | Automático al aprobar `ci_tests` en `develop` (o manual `blue-staging`) | Dispara el Deploy Hook de Render Blue (`RENDER_DEPLOY_HOOK_BLUE`) y ejecuta healthcheck HTTP `200` sobre `/api/publico/disponibilidad`. |
| **3. `deploy_green` (Producción)** | Automático al aprobar `ci_tests` tras PR `develop → main` (o manual `green-produccion`) | Promoción controlada hacia Render Green (`https://cochera-sp.onrender.com`) prevista al cierre del Sprint 3 (`UPAO-98`). |

---

## 2. Enlaces del Despliegue y Repositorio

| Recurso | Descripción | Enlace Directo |
|---|---|---|
| **Ambiente Blue en Vivo (Staging)** | Aplicación web conectada a Neon Staging con defensa anti-bot y módulo de garita | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| **Pipeline CI/CD (`ci-cd.yml`)** | Workflow único con botón 1-clic y despliegue automático Blue/Green | [`.github/workflows/ci-cd.yml`](../../../.github/workflows/ci-cd.yml) |
| **Runner de Pruebas 1-Clic (`npm test`)** | Orquestador de las 7 suites de calidad y seguridad | [`scripts/run-all-tests.js`](../../../scripts/run-all-tests.js) |
| **Ambiente Green (Producción)** | Servicio productivo estable aislado en rama `main` | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 3. Resumen de Pruebas Verificadas antes del Despliegue

- `npm test` (1 clic local y en GitHub Actions): **7/7 suites aprobadas** (`5/5` Culqi Unitaria + `7/7` UPAO-22 + `8/8` UPAO-8 + `21/21` Sprint 3 + `8/8` Ataque/Bot + `15/15` RBAC + `10/10` No Regresión).
- `node tests/test-upao8-garita-e2e.js`: **5/5 capturas UI verificadas** en Playwright (alerta `RESERVADO`, buscador garita, filtro `VIGENTE`, confirmación `UTILIZADA` y descuento en salida).
- `configuracion_pasarela` en Neon `staging`: **intacta** (`1` fila `pk_test_kvCDYJ6xmPyrGhc6`).

---

## 4. Trazabilidad de Subtareas de la Historia `UPAO-8`

| Subtarea Jira | Tipo | Descripción | Entregable Principal |
|---|---|---|---|
| **UPAO-81** | Análisis y Diseño | Búsqueda multicriterio, protección walk-in, lock en confirmación y casos `CP-08-01..09` | [`docs/modulos/reservas/analisis-UPAO-8.md`](analisis-UPAO-8.md) |
| **UPAO-91** | Prototipado (UI) | Banner `RESERVADO`, filtro instantáneo en garita, tabla 1 línea saneada y 5 PNGs E2E | [`docs/modulos/reservas/ui-UPAO-8.md`](ui-UPAO-8.md) |
| **UPAO-92** | Codificación | Endpoints garita, bloqueo walk-in en ingresos, descuento en salidas y middleware anti-bot | [`docs/modulos/reservas/api-UPAO-8.md`](api-UPAO-8.md) |
| **UPAO-93** | Test y Depuración | Suites `U08-01..08`, `BOT-01..08`, `npm test` 1-clic, Defect Log `DEF-08-01..03` y Excel | [`plan-pruebas-UPAO-8.md`](plan-pruebas-UPAO-8.md) |
| **UPAO-94** | Configuración / Despliegue | Pipeline `.github/workflows/ci-cd.yml` con CI gate y despliegue automático en Blue | Este documento |
