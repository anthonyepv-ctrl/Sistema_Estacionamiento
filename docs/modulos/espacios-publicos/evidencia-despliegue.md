# Evidencia de Despliegue en Ambiente Blue (Staging) — Vista Pública de Disponibilidad (UPAO-20 / Sprint 2)

**Fecha de Integración y Despliegue:** 07/11/2026  
**Ambiente:** Blue (Staging / Pre-producción) en Render  
**Base de Datos en la Nube:** PostgreSQL en Neon (Rama `staging`, SSL activo)  
**Historia de Usuario Asociada:** UPAO-20 (*Ver espacios disponibles* — 1 Story Point)  
**Épica:** UPAO-28 (*Manejo de Reserva Web*)  
**Responsable:** ALBERTH JAIR FLORES LEONARDO  
**Rama Base:** `develop`

---

## 1. Enlaces Principales del Despliegue y Repositorio

| Recurso | Descripción | Enlace Directo |
|---|---|---|
| **Vista Pública en Vivo (Ambiente Blue)** | Consulta directa de cupos sin requerir inicio de sesión | [https://sistema-estacionamiento-yk2d.onrender.com/#disponibilidad](https://sistema-estacionamiento-yk2d.onrender.com/#disponibilidad) |
| **Rama Integrada (`develop`)** | Rama con todo el Sprint 2 consolidado y depurado | [anthonyepv-ctrl/Sistema_Estacionamiento (Rama develop)](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Comparativa de Cambios (`develop` vs `main`)** | Diff completo del código incorporado frente a producción | [Diff develop...main en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/compare/main...develop) |
| **Ambiente Green (Producción)** | Servicio oficial estable e intacto en rama `main` | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

---

## 2. Evidencias de Pruebas, Calidad y Depuración (UPAO-77)

El módulo fue sometido a una rigurosa auditoría de calidad, pruebas automatizadas E2E y pruebas adversariales con 100% de éxito:

| Recurso / Entregable | Tipo de Evidencia | Ubicación en Repositorio |
|---|---|---|
| **Video Demostrativo MP4** | Grabación E2E automatizada con cursor visible del flujo completo (Playwright) | [`demostracion_pruebas_disponibilidad_upao77.mp4`](evidencias/upao-77/demostracion_pruebas_disponibilidad_upao77.mp4) |
| **Plan de Pruebas y Defect Log** | Matriz de 15 casos de prueba y resolución de 9 defectos de cobro, concurrencia y aforo | [`plan-pruebas.md`](plan-pruebas.md) |
| **Suite E2E Playwright** | 27 verificaciones automáticas de interfaz, polling y responsividad | [`tests/e2e-disponibilidad.js`](../../../tests/e2e-disponibilidad.js) |
| **Prueba de Integridad de Cobro** | Verificación de idempotencia ante doble clic simultáneo en salidas | [`tests/test-integridad-cobro.js`](../../../tests/test-integridad-cobro.js) |
| **Suite de Aseguramiento de No Regresión** | 10 verificaciones de compatibilidad con todos los módulos previos del sistema | [`tests/test-no-regresion.js`](../../../tests/test-no-regresion.js) |

### 2.1. Resultados de la Suite de No Regresión (10/10 OK)

```text
> sistema-estacionamiento@1.0.0 test:regresion
> node tests/test-no-regresion.js

--- Verificando Aseguramiento de No Regresión (UPAO-73 / UPAO-77) ---
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
[REG-09] Validando endpoint público de disponibilidad...
✓ REG-09 EXITOSO: Endpoint público de disponibilidad operando al 100%.
[REG-10] Validando invariantes del aforo público...
✓ REG-10 EXITOSO: Invariantes del aforo público intactas.

======================================================
 NO SE DETECTARON REGRESIONES EN EL SISTEMA (100% OK)
======================================================
```

---

## 3. Verificación de Criterios de Aceptación en Vivo (Ambiente Blue)

Pruebas en vivo ejecutadas contra la instancia en Render (`https://sistema-estacionamiento-yk2d.onrender.com`):

1. **Acceso Público sin Autenticación (CA-01):**
   * Endpoint: `GET https://sistema-estacionamiento-yk2d.onrender.com/api/publico/disponibilidad`
   * Vista: `https://sistema-estacionamiento-yk2d.onrender.com/#disponibilidad`
   * Resultado: La vista carga de forma inmediata sin forzar login. La cabecera de usuario permanece oculta y el botón invita a *"← Iniciar Sesión / Acceso de Personal"*.
2. **Paneles Independientes de Autos y Motos (CA-02, CA-03):**
   * La interfaz muestra capacidad total, ocupación y cupos disponibles sincronizados en tiempo real con la base de datos de Neon Staging.
   * La fórmula aplicada garantiza piso en cero: `Disponibles = max(0, Capacidad − EnCochera − ReservasVigentes)`.
3. **Actualización Automática por Polling (CA-04):**
   * Cada 30 segundos se realiza una petición en segundo plano actualizando los contadores y la estampa de tiempo sin recargar la página.
4. **Estado Crítico de Aforo Lleno (CA-05):**
   * Con 0 cupos libres, la tarjeta adopta borde rojo de alerta (`rgb(239, 68, 68)`), la insignia cambia a *"Aforo lleno"* y el botón *"Reservar espacio"* se deshabilita automáticamente.
5. **Redirección Defensiva de Reserva (CA-06):**
   * Sin sesión iniciada, hacer clic en *"Reservar espacio"* redirige automáticamente a la pantalla de Login (`#view-login`).
   * Con sesión iniciada, el sistema emite un toast informativo indicando que la reserva web estará habilitada en una próxima entrega (UPAO-21).

---

## 4. Trazabilidad Completa de Subtareas de la Historia UPAO-20

| Subtarea Jira | Tipo | Descripción | Entregable / Evidencia Principal |
|---|---|---|---|
| **UPAO-74** | Análisis y Diseño | Definición de fórmula de cupos, dos paneles y navegación pública | [`docs/modulos/espacios-publicos/analisis.md`](analisis.md) |
| **UPAO-75** | Prototipado (UI) | Vista `#view-disponibilidad`, paneles autos/motos y responsive 360-414px | [`docs/modulos/espacios-publicos/ui.md`](ui.md) |
| **UPAO-76** | Codificación | Endpoint `GET /api/publico/disponibilidad` y lógica de polling | [`docs/modulos/espacios-publicos/api.md`](api.md) |
| **UPAO-77** | Test y Depuración | 27 checks E2E, video MP4, corrección de doble cobro y aforo concurrente | [`docs/modulos/espacios-publicos/plan-pruebas.md`](plan-pruebas.md) |
| **UPAO-78** | Integración y Despliegue | Suite de no regresión (10/10 OK), despliegue y validación en ambiente Blue | Este documento (`evidencia-despliegue.md`) |

---

## 5. Instrucciones para Actualización de Despliegue en Render (Ambiente Blue)

1. Ingresar a [Render Dashboard](https://dashboard.render.com).
2. Seleccionar el servicio **`Sistema_Estacionamiento`** (entorno `cochera-sp-stating`).
3. Hacer clic en el botón superior derecho **`Manual Deploy`**.
4. Seleccionar la opción **`Deploy latest commit`**.
5. Render compilará la rama `develop` y pondrá a disposición inmediata la vista pública de disponibilidad en vivo.
