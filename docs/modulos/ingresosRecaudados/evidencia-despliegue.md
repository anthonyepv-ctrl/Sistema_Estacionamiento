# Evidencia de Despliegue en Producción — Módulo Reporte de Ingresos (UPAO-56 / Sprint 2)

**Fecha:** 15/10/2026  
**Entorno de Producción:** Render Web Service (Node.js 22, Express 5)  
**Base de Datos en la Nube:** PostgreSQL en Neon (sa-east-1, SSL)  
**Rama de Despliegue:** `main`

---

## 1. Enlaces Principales del Despliegue

| Recurso | Descripción | Enlace en GitHub / Producción |
|---|---|---|
| **Aplicación Desplegada** | Sistema en vivo y accesible al público | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |
| **Commit de Release en `main`** | Fusión final del Sprint 2 y HU Ingresos | [`3d0db0c`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/3d0db0c) |
| **Commit de Arquitectura** | Documentación de cierre de arquitectura | [`7178f63`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/7178f63) |
| **Rama `main` (Producción)** | Código fuente productivo desplegado | [Rama `main`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/main) |
| **Rama `develop`** | Rama de desarrollo integrada y sincronizada | [Rama `develop`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |

---

## 2. Evidencias de Pruebas y Depuración

| Recurso | Tipo de Evidencia | Enlace en Repositorio |
|---|---|---|
| **Video Demostrativo MP4** | Video E2E con cursor de pruebas y depuración (UPAO-55) | [`demostracion_pruebas_depuracion_upao55.mp4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/ingresosRecaudados/evidencias/demostracion_pruebas_depuracion_upao55.mp4) |
| **Video del Prototipo MP4** | Demostración de interfaz interactiva (UPAO-53) | [`demostracion_prototipo_reporte_ingresos_upao53.mp4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/ingresosRecaudados/evidencias/demostracion_prototipo_reporte_ingresos_upao53.mp4) |
| **Plan de Pruebas y Defect Log** | Registro de casos de prueba y defectos corregidos | [`plan-pruebas.md`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/ingresosRecaudados/plan-pruebas.md) |
| **Documentación de API** | Especificación técnica de endpoints y payloads | [`api.md`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/ingresosRecaudados/api.md) |
| **Especificación de UI** | Criterios de diseño y prototipado visual | [`ingresosDiarios.md`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/ingresosRecaudados/ingresosDiarios.md) |

---

## 3. Verificación de Autenticación y Base de Datos (Neon)

Pruebas de conectividad y credenciales ejecutadas contra el servicio en la nube:

1. **Login como Administrador (Rol DUEÑO):**
   * Endpoint: `POST https://cochera-sp.onrender.com/api/auth/login`
   * Credenciales: `admin` / `123456`
   * Respuesta: `200 OK` → `{"usuario":"admin","nombre":"Administrador","rol":"DUENO"}`
2. **Login como Recepcionista (Rol RECEPCIONISTA):**
   * Endpoint: `POST https://cochera-sp.onrender.com/api/auth/login`
   * Credenciales: `recepcion` / `123456`
   * Respuesta: `200 OK` → `{"usuario":"recepcion","nombre":"Recepcionista","rol":"RECEPCIONISTA"}`
3. **Seguridad:** Cero credenciales hardcodeadas. La variable `DATABASE_URL` se encuentra cifrada y configurada exclusivamente en el panel de Render mediante Blueprint (`render.yaml`).

---

## 4. Trazabilidad de Subtareas del Módulo (UPAO-17)

- **UPAO-52 (Análisis y Diseño):** Commit [`7cdddc2`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/7cdddc2)
- **UPAO-53 (Interfaz y Prototipo):** Commit [`819b842`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/819b842) | Merge [`2ba4628`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/2ba4628)
- **UPAO-54 (Backend y Lógica de Cuadre de Caja):** Commit [`f93a720`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/f93a720) | Merge [`d99ac5c`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/d99ac5c)
- **UPAO-55 (Pruebas y Depuración de Defectos):** Commit [`65a3380`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/65a3380) | Merge [`42a5c13`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/42a5c13)
- **DEF-03 (Poka-Yoke Placas MTC):** Commit [`af688f4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/af688f4) | Merge [`fbd04f9`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/fbd04f9)
- **UPAO-56 (Despliegue y Release en Render):** Release Commit [`3d0db0c`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/3d0db0c)
