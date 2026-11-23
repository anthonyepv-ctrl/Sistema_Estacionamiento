# Evidencia de Despliegue en Ambiente Blue (Staging) — Realizar Reserva Web (`UPAO-21` / Sprint 3)

**Fecha de Integración Inicial:** 16/11/2026 (`PR #25`)  
**Fecha de Migración a Culqi Perú:** 22/11/2026 (`PR #26`, merge `ceebf64`) — **validada en vivo en Blue el 23/11/2026** (pagos Tarjeta y Yape en modo integración con `pk_test_...` / `sk_test_...`, cargo verificado `chr_test_9SrLq7y5UTJDEeQZ`)  
**Ambiente:** Blue (Staging / Pre-producción) en Render (`cochera-sp-stating`)  
**Base de Datos en la Nube:** PostgreSQL en Neon (Rama `staging`, SSL activo)  
**Historia de Usuario Asociada:** `UPAO-21` (*Realizar reserva* — 5 Story Points)  
**Subtarea Jira:** `UPAO-86` — Integración y despliegue de reservas y pasarela Culqi Perú en ambiente Blue  
**Épica:** `UPAO-28` (*Manejo de Reserva Web*)  
**Responsable:** ALBERTH JAIR FLORES LEONARDO  
**Rama de Migración:** `feature/UPAO-21-pasarela-culqi` (hacia `develop`)

---

## 1. Enlaces Principales del Despliegue y Repositorio

| Recurso | Descripción | Enlace Directo |
|---|---|---|
| **Ambiente Blue en Vivo (Staging)** | Aplicación web desplegada conectada a Neon Staging | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| **PR Inicial (`#25`) y Migración Culqi (`#26`)** | Integración de reservas (`9e3aff8`) y migración completa a **Culqi Perú** (`ceebf64`) + ajustes Blue (`0421d90`, `c406747`) | [PR #26 en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/26) |
| **Rama Integrada (`develop`)** | Rama consolidada que dispara el despliegue automático en Blue | [anthonyepv-ctrl/Sistema_Estacionamiento (Rama develop)](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Ambiente Green (Producción)** | Servicio productivo estable aislado en rama `main` | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 2. Configuración de Variables de Entorno en Render Blue (`cochera-sp-stating`)

En el panel **Environment** del servicio web `cochera-sp-stating` en Render deben quedar configuradas las variables de Culqi Perú:

- `DATABASE_URL`: cadena de conexión PostgreSQL en Neon (rama `staging`, con migraciones `20261115094405_sprint3_reservas` y `20261122120000_pasarela_agnostica_culqi` aplicadas).
- `AUTH_SECRET`: secreto privado HMAC-SHA256 para firma y verificación de tokens de sesión (`Authorization: Bearer <token>`).
- `PAYMENT_GATEWAY`: `culqi`.
- `CULQI_PUBLIC_KEY`: llave pública de integración o producción (`pk_test_...` / `pk_live_...`).
- `CULQI_SECRET_KEY`: llave privada de integración o producción (`sk_test_...` / `sk_live_...`).
- `PASARELA_ENCRYPTION_KEY`: clave simétrica para cifrado AES-256-GCM en `configuracion_pasarela`.
- `CULQI_YAPE_MINIMO_SOLES`: `6` (monto mínimo exigido por Culqi Checkout v4 para mostrar la pestaña Yape; tarjetas desde `S/ 3.00`).

---

## 3. Evidencias de Pruebas y Calidad (`UPAO-85`)

| Entregable / Suite | Alcance Cubierto para `UPAO-21` | Resultado | Ubicación |
|---|---|---|---|
| **Suite Unitaria Culqi (`test-pasarela-culqi-unit.js`)** | Contrato `/v2/charges` y `/v2/refunds`, `Idempotency-Key`, cifrado AES-256-GCM en PostgreSQL y piso `S/ 3.00` en motos | 5/5 Verificaciones OK (Mock Culqi + Staging DB) | [`tests/test-pasarela-culqi-unit.js`](../../../tests/test-pasarela-culqi-unit.js) |
| **Suite Sprint 3 (`test:reservas`)** | Flujos `SP3-01` a `SP3-18` contra PostgreSQL Staging + **Culqi Integración real** (`chr_test_eVACWgY1YOt4kYK6`) | 21/21 Verificaciones OK | [`tests/test-reservas-sprint3.js`](../../../tests/test-reservas-sprint3.js) |
| **Suite de No Regresión (`test:regresion`)** | `REG-00` a `REG-10` sobre reportes, espacios, tarifas, ocupación y disponibilidad pública | 10/10 OK (100%) | [`tests/test-no-regresion.js`](../../../tests/test-no-regresion.js) |

---

## 4. Trazabilidad de Subtareas de la Historia `UPAO-21`

| Subtarea Jira | Tipo | Descripción | Entregable Principal |
|---|---|---|---|
| **UPAO-79** | Análisis y Diseño | Modelo de datos (`Usuario`, `VehiculoConductor`, `Reserva`, `ConfiguracionPasarela`), piso `S/ 3.00` y casos `CP-21-01..08` | [`docs/modulos/reservas/analisis.md`](analisis.md) |
| **UPAO-83** | Prototipado (UI) | Registro/login de conductor, vista `1. Realizar Reserva Web` + `2. Mis Vehículos`, Checkout v4 y `#view-pasarela-pagos` | [`docs/modulos/reservas/ui-UPAO-21.md`](ui-UPAO-21.md) |
| **UPAO-84** | Codificación | Adaptador `src/payments/`, `POST /api/reservas/preparar-pago`, `POST /api/reservas` con lock y reembolso compensatorio | `src/payments/` · `src/routes/reservas.js` · `public/js/pasarela-adapter.js` |
| **UPAO-85** | Test y Depuración | Ejecución de `CP-21-01..08`, Defect Log (`DEF-21-01..11`), matriz Excel y no regresión | [`plan-pruebas-UPAO-21.md`](plan-pruebas-UPAO-21.md) |
| **UPAO-86** | Configuración / Despliegue | Migración `20261122120000_pasarela_agnostica_culqi` en Neon Staging, PR `#26` integrado en `develop` y validación en vivo en Render Blue | Este documento |
