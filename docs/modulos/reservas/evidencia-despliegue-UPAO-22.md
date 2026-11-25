# Evidencia de Despliegue en Ambiente Blue (Staging) — Anulación de Reserva (`UPAO-22` / Sprint 3)

**Fecha de Integración y Validación en Blue:** 23/11/2026  
**Ambiente:** Blue (Staging / Pre-producción) en Render (`cochera-sp-stating`)  
**Base de Datos en la Nube:** PostgreSQL en Neon (Rama `staging`, SSL activo)  
**Historia de Usuario Asociada:** `UPAO-22` (*Anular reserva* — 3 Story Points)  
**Subtarea Jira:** `UPAO-90` — Integración y despliegue de anulación de reservas en ambiente Blue  
**Épica:** `UPAO-28` (*Manejo de Reserva Web*)  
**Rama Integrada:** `develop` (despliegue automático a Render Blue; `main` / Green aislado sin cambios)

---

## 1. Enlaces del Despliegue y Repositorio

| Recurso | Descripción | Enlace Directo |
|---|---|---|
| **Ambiente Blue en Vivo (Staging)** | Aplicación web desplegada conectada a Neon Staging | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| **Rama Integrada (`develop`)** | Rama Blue con anulación atómica, reembolso Culqi Perú y UI adaptativa | [anthonyepv-ctrl/Sistema_Estacionamiento (Rama develop)](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Ambiente Green (Producción)** | Servicio productivo estable aislado en rama `main` | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 2. Verificación Técnica y Operativa en Blue

- **Control de concurrencia y reembolso:** `DELETE /api/reservas/:id` y `POST /api/reservas/:id/anular` operan con lock transaccional por reserva `pg_advisory_xact_lock(780000::int, id::int)` (exclusión mutua con `POST /api/reservas/:id/confirmar` sin bloquear ingresos walk-in), `Idempotency-Key: refund-res-<id>` contra Culqi `/v2/refunds` y validación `502`/`504` sin corrupción de estado.
- **Interfaz adaptativa y resiliencia:** vista única sin duplicación (tabla compacta en una línea en escritorio `>= 768px` y tarjetas en móvil `< 768px`), modal `#modal-anular` con recuperación automática ante timeout de proxy y refresco inmediato de disponibilidad pública (`window.disponibilidadModulo.recargar()`).
- **Prueba real ejecutada en Staging Blue:** anulación en vivo de reserva `RES-3411D560` (placa `CBA-321`, `S/ 6.00`, cargo Culqi `chr_test_9SrLq7y5UTJDEeQZ`) con cambio inmediato a estado `ANULADA` y liberación de espacio.

---

## 3. Evidencias de Pruebas y Calidad (`UPAO-89`)

| Suite | Alcance | Resultado | Archivo |
|---|---|---|---|
| **Suite Dedicada `UPAO-22`** | `DELETE /:id`, `400`/`403`/`404`/`409`, expiración, carrera Anular vs Garita, doble clic, error Culqi `502` y reserva sin `pasarelaPagoId` | 7/7 Verificaciones OK | [`tests/test-upao22-anulacion.js`](../../../tests/test-upao22-anulacion.js) |
| **E2E Interfaz Anulación (`UPAO-87`)** | 4 estados, vista desktop 1 línea, vista móvil tarjetas, modal `#modal-anular`, toast y recálculo de disponibilidad | 6/6 Capturas y Validaciones OK | [`tests/test-anulacion-reservas-e2e.js`](../../../tests/test-anulacion-reservas-e2e.js) |
| **Suite Unitaria Culqi** | Contrato `/v2/charges` y `/v2/refunds`, AES-256-GCM y mínimo Yape `S/ 6.00` | 5/5 Verificaciones OK | [`tests/test-pasarela-culqi-unit.js`](../../../tests/test-pasarela-culqi-unit.js) |
| **Suite Integral Sprint 3** | Flujos `SP3-01` a `SP3-18` (incluye `SP3-06`, `SP3-16`, `SP3-17`) | 21/21 Verificaciones OK | [`tests/test-reservas-sprint3.js`](../../../tests/test-reservas-sprint3.js) |
| **Suite No Regresión** | `REG-00` a `REG-10` sobre módulos de Sprints 1 y 2 | 10/10 Verificaciones OK | [`tests/test-no-regresion.js`](../../../tests/test-no-regresion.js) |

---

## 4. Trazabilidad de Subtareas de la Historia `UPAO-22`

| Subtarea Jira | Tipo | Descripción | Entregable Principal |
|---|---|---|---|
| **UPAO-80** | Análisis y Diseño | Reglas `RN-01..RN-05`, flujo sin carrera con garita y diseño `CP-22-01..04` | [`docs/modulos/reservas/analisis-UPAO-22.md`](analisis-UPAO-22.md) |
| **UPAO-87** | Prototipado (UI) | Listado adaptativo *3. Mis Reservas*, modal `#modal-anular` y 6 capturas E2E | [`docs/modulos/reservas/ui-UPAO-22.md`](ui-UPAO-22.md) |
| **UPAO-88** | Codificación | `DELETE /api/reservas/:id`, lock `(780000, id)`, refund Culqi `/v2/refunds` y resiliencia modal | [`docs/modulos/reservas/api-UPAO-22.md`](api-UPAO-22.md) |
| **UPAO-89** | Test y Depuración | Evaluación `CP-22-01..04`, suite `U22-01..07`, Defect Log `DEF-22-01..05` y Excel | [`plan-pruebas-UPAO-22.md`](plan-pruebas-UPAO-22.md) |
| **UPAO-90** | Configuración / Despliegue | Integración en `develop`, despliegue en Render Blue y verificación en vivo | Este documento |
