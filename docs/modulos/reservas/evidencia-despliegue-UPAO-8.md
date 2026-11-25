# Evidencia de Despliegue y Ciclo DevOps CI/CD en Blue

## 1. Flujo DevOps Implementado

Se configuró e integró el ciclo automatizado completo en GitHub Actions (`.github/workflows/ci-cd.yml`) conectado a Render (**Blue / Staging** en `develop` y **Green / Producción** en `main`):

| Etapa | Disparador | Verificación / Resultado |
| --- | --- | --- |
| **1. `ci_tests` (CI Gate)** | Automático en `push` / `pull_request` y manual en **1 clic (`workflow_dispatch`)** | Levanta **PostgreSQL 16** efímero en CI (`prisma migrate deploy` + `npm run db:seed`) y ejecuta `npm test` (7/7 suites: Culqi, `UPAO-22`, `UPAO-8`, Sprint 3, Ataque/Bot, RBAC y No Regresión). Bloquea el despliegue si falla cualquier prueba. |
| **2. `deploy_blue` (Pre-producción)** | Automático tras aprobar `ci_tests` en `develop` | Ejecuta el Deploy Hook de Render Blue (`RENDER_DEPLOY_HOOK_BLUE`) y verifica healthcheck `HTTP 200` en `/api/publico/disponibilidad`. |
| **3. `deploy_green` (Producción)** | Automático tras aprobar `ci_tests` al fusionar PR `develop → main` | Job preparado y probado en el workflow para la promoción final a Producción (`main`) al cierre del Sprint 3 (`UPAO-98`). |

---

## 2. Enlaces de Respaldo en GitHub y Ambientes en Vivo

| Recurso | Enlace Directo |
| --- | --- |
| **Workflow CI/CD (`ci-cd.yml`)** | [https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/.github/workflows/ci-cd.yml](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/.github/workflows/ci-cd.yml) |
| **Ejecuciones CI/CD (GitHub Actions)** | [https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions) |
| **Runner de Pruebas 1-Clic (`npm test`)** | [https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/scripts/run-all-tests.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/scripts/run-all-tests.js) |
| **Rama Integrada (`develop` — Blue)** | [https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Ambiente Blue en Vivo (Staging)** | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| **Ambiente Green (Producción — `main`)** | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 3. Validación Final de Despliegue

- **CI Gate (`npm test`):** 7/7 suites aprobadas en local y en GitHub Actions.
- **E2E visual (`test-upao8-garita-e2e.js`):** 5/5 capturas verificadas (botón unificado en ingreso y tabla en 1 línea sin desborde).
- **Despliegue Blue (`develop`):** Healthcheck `HTTP 200 OK` verificado en Render Staging contra Neon `staging` (`configuracion_pasarela` intacta).
- **Aislamiento Green (`main`):** Rama `main` sin modificaciones directas; promoción programada en `UPAO-98`.
