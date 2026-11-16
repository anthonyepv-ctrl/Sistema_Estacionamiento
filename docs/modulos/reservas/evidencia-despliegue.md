# Evidencia de Despliegue en Ambiente Blue (Staging) — Realizar Reserva Web (`UPAO-21` / Sprint 3)

**Fecha de Integración y Despliegue:** 16/11/2026  
**Ambiente:** Blue (Staging / Pre-producción) en Render (`cochera-sp-stating`)  
**Base de Datos en la Nube:** PostgreSQL en Neon (Rama `staging`, SSL activo)  
**Historia de Usuario Asociada:** `UPAO-21` (*Realizar reserva* — 5 Story Points)  
**Subtarea Jira:** `UPAO-86` — Integración y despliegue de reservas y pasarela Stripe en ambiente Blue  
**Épica:** `UPAO-28` (*Manejo de Reserva Web*)  
**Responsable:** ALBERTH JAIR FLORES LEONARDO  
**Rama Base:** `develop`

---

## 1. Enlaces Principales del Despliegue y Repositorio

| Recurso | Descripción | Enlace Directo |
|---|---|---|
| **Ambiente Blue en Vivo (Staging)** | Aplicación web desplegada conectada a Neon Staging y Stripe Test Mode | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| **Pull Request Integrado (`#25`)** | Integración de `feature/UPAO-21-realizar-reserva` hacia `develop` (merge commit `9e3aff8`) | [PR #25 en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/25) |
| **Rama Integrada (`develop`)** | Rama consolidada que dispara el despliegue automático en Blue | [anthonyepv-ctrl/Sistema_Estacionamiento (Rama develop)](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Ambiente Green (Producción)** | Servicio productivo estable aislado en rama `main` | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 2. Configuración de Variables de Entorno en Render Blue (`cochera-sp-stating`)

En el panel **Environment** del servicio web `cochera-sp-stating` en Render quedaron configuradas y desplegadas las variables requeridas:

- `DATABASE_URL`: cadena de conexión PostgreSQL en Neon (rama `staging`, con migración `20261115094405_sprint3_reservas` aplicada).
- `AUTH_SECRET`: secreto privado HMAC-SHA256 para firma y verificación de tokens de sesión (`Authorization: Bearer <token>`).
- `STRIPE_PUBLISHABLE_KEY`: clave pública de pasarela en Test Mode (`pk_test_...`).
- `STRIPE_SECRET_KEY`: clave privada de pasarela en Test Mode (`rk_test_...` / `sk_test_...`) para creación y verificación de `PaymentIntent` en soles (`PEN`).

---

## 3. Evidencias de Pruebas y Calidad (`UPAO-85`)

Las verificaciones automatizadas se ejecutaron antes de la integración a `develop` con 100% de éxito sobre `tests/test-reservas-sprint3.js` y `tests/test-no-regresion.js`:

| Entregable / Suite | Alcance Cubierto para `UPAO-21` | Resultado | Ubicación |
|---|---|---|---|
| **Casos de Prueba `UPAO-21`** | `CP-21-01` a `CP-21-08` (pasarela, autogestión API keys `DUENO`, registro `CONDUCTOR`, vehículos MTC/SUNARP, reserva atómica `VIGENTE` por 30 min y rechazos `400/401/402/403/409`) | 8/8 Aprobados | [`plan-pruebas-UPAO-21.md`](plan-pruebas-UPAO-21.md) |
| **Suite Sprint 3 (`test:reservas`)** | Flujos `SP3-01` a `SP3-05` (incluyendo `SP3-02b`) y `SP3-11` a `SP3-14` contra PostgreSQL Staging + Stripe Test | 21/21 Verificaciones OK | [`tests/test-reservas-sprint3.js`](../../../tests/test-reservas-sprint3.js) |
| **Suite de No Regresión (`test:regresion`)** | `REG-00` a `REG-10` sobre reportes, espacios, tarifas, ocupación y disponibilidad pública | 10/10 OK (100%) | [`tests/test-no-regresion.js`](../../../tests/test-no-regresion.js) |

---

## 4. Verificación en Vivo en Ambiente Blue

Comprobación ejecutada directamente sobre [`https://sistema-estacionamiento-yk2d.onrender.com`](https://sistema-estacionamiento-yk2d.onrender.com) tras el guardado de variables y redeploy en Render:

1. **Disponibilidad Pública (`GET /api/publico/disponibilidad`):** responde `HTTP 200 OK` mostrando cupos y contadores de `reservasVigentes` sincronizados en tiempo real.
2. **Pasarela de Pagos Activa (`GET /api/reservas/config-pasarela`):** responde `HTTP 200 OK` con `{"habilitado": true, "publishableKey": "pk_test_51Uc51KBX...", "toleranciaMinutos": 30, "modo": "PRUEBA", "origen": "servidor_env"}`.
3. **Autogestión de API Keys desde el Panel del `DUEÑO` (`#view-pasarela-stripe` / `PUT /api/reservas/config-pasarela`):** permite al Product Owner / Dueño visualizar el estado actual, cargar su propio par de claves (`pk_test_`/`pk_live_` y `sk_test_`/`sk_live_`) guiado paso a paso desde la web, o restaurar las claves del servidor sin intervención técnica ni acceso a Render.
4. **Portal y Flujo de Conductor (`#login` / `#form-registro-conductor`):** acceso visible desde disponibilidad pública hacia el registro de conductor (Nombre, DNI de 8 dígitos, Celular de 9 dígitos, usuario y contraseña), gestión de vehículos SUNARP/MTC y modalidad de adelanto de 1 hora mediante tarjeta en el modal `#modal-pago-reserva`.

---

## 5. Trazabilidad Completa de Subtareas de la Historia `UPAO-21`

| Subtarea Jira | Tipo | Descripción | Entregable Principal |
|---|---|---|---|
| **UPAO-79** | Análisis y Diseño | Modelo de datos (`Usuario`, `VehiculoConductor`, `Reserva`), criterios y diseño de casos `CP-21-01..08` | [`docs/modulos/reservas/analisis.md`](analisis.md) (`analisis-UPAO-21.pdf`) |
| **UPAO-83** | Prototipado (UI) | Registro/login de conductor, vista `1. Realizar Reserva Web` + `2. Mis Vehículos` y modal `#modal-pago-reserva` | Capturas UI en Jira |
| **UPAO-84** | Codificación | `POST /api/auth/registro-conductor`, CRUD `/api/conductor/vehiculos`, pasarela Stripe y `POST /api/reservas` con lock transaccional | Capturas código + `api-UPAO-21.pdf` |
| **UPAO-85** | Test y Depuración | Ejecución de casos `CP-21-01..08`, Defect Log (`DEF-21-01`, `DEF-21-02`) y no regresión | [`plan-pruebas-UPAO-21.md`](plan-pruebas-UPAO-21.md) (`plan-pruebas-UPAO-21.pdf`) |
| **UPAO-86** | Configuración / Despliegue | Integración PR `#25` hacia `develop`, variables de entorno en Render y validación en vivo en Blue | Este documento (`evidencia-despliegue-UPAO-21.pdf`) |
