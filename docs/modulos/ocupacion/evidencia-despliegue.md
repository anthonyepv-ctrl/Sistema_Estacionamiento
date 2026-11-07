# Evidencia de Despliegue en Ambiente Blue (Staging) — Módulo Nivel de Ocupación y Afluencia (UPAO-73 / Historia UPAO-19 / Sprint 2)

**Fecha de Integración y Despliegue:** 03/11/2026  
**Ambiente:** Blue (Staging / Pre-producción) en Render  
**Base de Datos en la Nube:** PostgreSQL en Neon (Rama `staging`, SSL activo)  
**Historia de Usuario Asociada:** UPAO-19 (*Consultar nivel de ocupación* — 2 Story Points)  
**Épica:** UPAO-27 (*Administración y Supervisión del Negocio*)  
**Responsable Asignado en Jira:** ALBERTH JAIR FLORES LEONARDO  
**Subtarea Activa:** UPAO-73 (*Integración y despliegue del módulo de ocupación en ambiente Blue*)

---

## 1. Enlaces Principales del Despliegue y Repositorio

| Recurso | Descripción | Enlace Directo |
|---|---|---|
| **Ambiente Blue en Vivo (Staging)** | Web Service en Render conectado a base de datos Neon Staging | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| **Rama Integrada (`develop`)** | Rama con todos los cambios consolidados del Sprint 2 | [anthonyepv-ctrl/Sistema_Estacionamiento (Rama develop)](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Rama de la Subtarea UPAO-73** | Rama de trabajo para integración y despliegue en Blue | [feature/UPAO-73-integracion-despliegue-ocupacion-blue](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/UPAO-73-integracion-despliegue-ocupacion-blue) |
| **Comparativa de Cambios (`develop` vs `main`)** | Diff consolidado frente a la rama de producción | [Diff develop...main en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/compare/main...develop) |
| **Ambiente Green (Producción)** | Totalmente aislado e intacto en rama `main` | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 2. Aseguramiento de Calidad y No Regresión (100% OK)

Antes de autorizar la integración hacia el ambiente Blue, se ejecutó la suite completa de pruebas de no regresión en [`tests/test-no-regresion.js`](../../../tests/test-no-regresion.js) mediante el comando `npm run test:regresion`. Se validaron 8 puntos críticos del sistema sin detectar fallos ni regresiones:

```text
> sistema-estacionamiento@1.0.0 test:regresion
> node tests/test-no-regresion.js

◇ injected env (1) from .env
--- Verificando Aseguramiento de No Regresión (UPAO-73) ---
Servidor disponible en http://localhost:3555
[REG-01] Validando endpoint histórico de Reporte Diario...
✓ REG-01 EXITOSO: Reporte diario funciona sin regresión.
[REG-02] Validando reporte diario sin parámetros (fecha de hoy)...
✓ REG-02 EXITOSO: Consulta del día actual intacta.
[REG-03] Validando módulo de espacios y aforo...
✓ REG-03 EXITOSO: Módulo de espacios intacto.
[REG-04] Validando métodos de pago en salidas...
✓ REG-04 EXITOSO: Catálogo de pagos intacto.
[REG-05] Validando nuevos endpoints de Gráficos Estadísticos...
✓ REG-05 EXITOSO: Endpoints estadísticos operando al 100%.
[REG-06] Validando endpoint de Nivel de Ocupación...
✓ REG-06 EXITOSO: Endpoint de ocupación operando al 100%.
[REG-07] Validando rechazo defensivo en fechas futuras y rangos invertidos...
✓ REG-07 EXITOSO: Validaciones defensivas de ocupación intactas.
[REG-08] Validando exportación de ocupación en formato CSV...
✓ REG-08 EXITOSO: Exportación de ocupación operando al 100%.

======================================================
 NO SE DETECTARON REGRESIONES EN EL SISTEMA (100% OK)
======================================================
```

---

## 3. Evidencias del Módulo en el Repositorio

| Recurso / Evidencia | Tipo de Evidencia | Ubicación en Repositorio |
|---|---|---|
| **Dashboard Nivel de Ocupación** | Captura visual del módulo en frontend con gráficos de bloques y tarjetas KPI | [`evidencias/01_dashboard_nivel_ocupacion.png`](evidencias/01_dashboard_nivel_ocupacion.png) |
| **Manejo de Estado Sin Movimientos** | Captura del mensaje amigable y valores en cero para períodos vacíos | [`evidencias/02_estado_sin_movimientos.png`](evidencias/02_estado_sin_movimientos.png) |
| **Reporte de Ocupación Exportado** | Documento exportado demostrativo | [`evidencias/03_reporte_ocupacion.pdf`](evidencias/03_reporte_ocupacion.pdf) |
| **Pruebas de Backend de la API** | Capturas de ejecución de la API de ocupación | [`evidencias/upao-71/01_endpoint_reporte_ocupacion.png`](evidencias/upao-71/01_endpoint_reporte_ocupacion.png) |
| **Cálculo de Aforo y Entradas** | Validación de cálculo de aforo concurrente | [`evidencias/upao-71/02_calculo_aforo_y_entradas.png`](evidencias/upao-71/02_calculo_aforo_y_entradas.png) |
| **Especificación de API** | Documentación de endpoints y payloads | [`api.md`](api.md) |
| **Especificación de UI** | Documentación de componentes visuales | [`ui.md`](ui.md) |
| **Documento de Análisis y Diseño** | Algoritmo Sweep-Line y reglas temporales | [`analisis.md`](analisis.md) |

---

## 4. Verificación de Funcionamiento en Vivo en Ambiente Blue

Pruebas en vivo ejecutadas contra la instancia en Render (`https://sistema-estacionamiento-yk2d.onrender.com`):

1. **Autenticación con Rol DUEÑO (Control de Acceso):**
   * Endpoint: `POST https://sistema-estacionamiento-yk2d.onrender.com/api/auth/login`
   * Credenciales: `admin` / `123456`
   * Resultado: `200 OK` → Acceso concedido al módulo *"Nivel de Ocupación"* en el menú principal.
2. **Consulta Analítica de Ocupación por Rango de Fechas (CA-01, CA-02, CA-03):**
   * Endpoint: `GET https://sistema-estacionamiento-yk2d.onrender.com/api/ocupacion?fechaInicio=2026-10-20&fechaFin=2026-10-30`
   * Resultado: `200 OK` → Retorna tarjetas de resumen (`totalVehiculos`, `totalAutos`, `totalMotos`, `aforoMaximoSimultaneo`), capacidad total de la cochera y matriz de `bloquesHorarios` con identificación de la hora pico (`esPico: true`).
3. **Validación Defensiva de Fechas Futuras y Rango Invertido (CA-01):**
   * Solicitud fecha futura: `GET /api/ocupacion?fechaInicio=2027-01-01&fechaFin=2027-01-05` → `400 Bad Request` (`"No se pueden consultar reportes de fechas futuras"`).
   * Solicitud rango invertido: `GET /api/ocupacion?fechaInicio=2026-10-30&fechaFin=2026-10-20` → `400 Bad Request` (`"La fecha de inicio no puede ser posterior a la fecha de fin"`).
4. **Estado Amigable sin Movimientos (CA-04):**
   * Solicitud para período sin actividad: `GET /api/ocupacion?fechaInicio=2026-09-01&fechaFin=2026-09-05`
   * Resultado: `200 OK` con `sinDatos: true`, tarjetas en 0 y mensaje: `"No se registran movimientos ni ingresos para el período seleccionado"`.
5. **Exportación de Bitácora a CSV/Excel (CA-05):**
   * Endpoint: `GET https://sistema-estacionamiento-yk2d.onrender.com/api/ocupacion/exportar?fechaInicio=2026-10-20&fechaFin=2026-10-30&formato=csv`
   * Resultado: `200 OK` con cabecera `Content-Type: text/csv; charset=utf-8` y archivo descargable con BOM UTF-8 y columnas de auditoría.

---

## 5. Trazabilidad Completa de Subtareas de la Historia UPAO-19

La Historia de Usuario **UPAO-19: Consultar nivel de ocupación** (2 SP) ha completado su ciclo de vida de desarrollo de software:

| Subtarea Jira | Tipo | Descripción | Commit / Evidencia Principal |
|---|---|---|---|
| **UPAO-69** | Análisis y Diseño | Algoritmo Sweep-Line, franjas horarias y diseño defensivo | Commit [`182eb3e`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/182eb3e) / [`analisis.md`](analisis.md) |
| **UPAO-70** | Prototipado (UI) | Interfaz gráfica `view-ocupacion`, gráficos de barras y filtros de fecha | Commit [`61e55c7`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/61e55c7) / [`ui.md`](ui.md) |
| **UPAO-71** | Codificación | Endpoint `/api/ocupacion`, cálculo de aforo concurrente y exportación CSV | Commit [`278382a`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/278382a) / [`api.md`](api.md) |
| **UPAO-72** | Test y Depuración | Casos de prueba y validación de endpoints y cálculos | Carpeta [`evidencias/`](evidencias/) |
| **UPAO-73** | Integración y Despliegue | Suite de no regresión, despliegue y validación en ambiente Blue (Staging) | Este documento (`evidencia-despliegue.md`) |

---

## 6. Procedimiento para Despliegue en Render (Ambiente Blue)

1. Ingresar a [Render Dashboard](https://dashboard.render.com).
2. Seleccionar el servicio **`Sistema_Estacionamiento`** (entorno `cochera-sp-stating`).
3. Hacer clic en el botón superior derecho **`Manual Deploy`**.
4. Seleccionar la opción **`Deploy latest commit`**.
5. Render compilará la rama `develop` y dejará disponible el módulo de Nivel de Ocupación en vivo sin alterar el ambiente Green (Producción).
