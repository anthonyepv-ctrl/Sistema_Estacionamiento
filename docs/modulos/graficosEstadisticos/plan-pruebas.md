# Plan de Pruebas y Registro de Depuración — Módulo Gráficos Estadísticos (UPAO-67 / UPAO-18)

> **Historia de Usuario:** UPAO-18 — Gráficos de ingresos (5 Story Points)  
> **Subtarea:** UPAO-67 — Probar y depurar gráficos estadísticos, selector de fecha y exportación (6h)  
> **Épica:** UPAO-27 — Administración y Supervisión del Negocio  
> **Responsable:** ALBERTH JAIR FLORES LEONARDO  
> **Fecha de Ejecución:** 29/10/2026  
> **Resultado Global:** 20 verificaciones ejecutadas, 20 aprobadas, 0 fallas (100% Éxito)

---

## 1. Objetivo

Verificar integralmente mediante pruebas automatizadas y de extremo a extremo (E2E) el correcto funcionamiento del módulo de **Gráficos Estadísticos y Exportación Financiera** (UPAO-18 / UPAO-67):
1. **Carga automática del mes en curso:** Verificación del selector predeterminado y consistencia matemática de la sumatoria diaria respecto al total mensual.
2. **Restricción de meses y períodos futuros:** Bloqueo en interfaz y rechazo a nivel de API (`HTTP 400`).
3. **Manejo de meses sin recaudación:** Confirmar que la interfaz no se rompa y despliegue el mensaje oficial: `"No se registran ingresos para el período seleccionado"`.
4. **Formato monetario estricto:** Garantizar el prefijo `S/ 0.00` en tarjetas métricas, ejes de gráficos y leyendas informativas.
5. **Generación y descarga de archivo CSV:** Comprobación de cabeceras oficiales (`Fecha`, `Placa`, `Tipo`, `Método`, `Monto`), totales de resumen y codificación UTF-8 con BOM.
6. **Seguridad y permisos de rol:** Restricción de acceso visual y funcional exclusivo para el rol **DUEÑO** (oculto para **RECEPCIONISTA**).

---

## 2. Alcance y Entorno de Pruebas

### 2.1. Alcance
- **Vistas evaluadas:** `#view-dashboard`, `#view-estadisticas`, modal de exportación y componentes SVG.
- **Roles validados:**
  - `admin` (DUEÑO): Acceso completo a gráficos y exportación.
  - `recepcion` (RECEPCIONISTA): Módulo restringido y oculto.
- **Endpoints validados:**
  - `GET /api/reportes/graficos`
  - `GET /api/reportes/graficos-mes`
  - `GET /api/reportes/exportar`

### 2.2. Entorno de Pruebas
| Componente | Detalle del Entorno |
| --- | --- |
| **Servidor de Aplicación** | Node.js v22 + Express 5 (`http://localhost:3000`) |
| **Base de Datos** | PostgreSQL en Neon (Rama Staging: `ep-spring-bonus-b6zxs7fw`) |
| **Navegador y Automatización** | Chromium headless vía Playwright con grabación de video |
| **Herramientas de Soporte** | FFmpeg 8.1.1 para transcodificación de evidencia en MP4 |
| **Comando de Ejecución** | `npm run test:graficos` (`node tests/e2e-graficos-estadisticos.js`) |

---

## 3. Matriz de Casos de Prueba Ejecutados

| ID | Criterio de Jira / Caso | Pasos de Ejecución | Resultado Esperado | Resultado Obtenido | Estado |
|:---:|---|---|---|---|:---:|
| **CP-01** | Carga automática del mes en curso y cálculo de sumatoria | Iniciar sesión como Dueño y abrir el módulo de Estadísticas | Carga por defecto año `2026` y mes `10` (Octubre). Suma de barras diarias igual a `metrica-total`. | Año `2026` y Mes `10` preseleccionados. Sumatoria diaria coincide exactamente con S/ 2,884.00. | **PASA** |
| **CP-02** | Bloqueo de selección de meses posteriores a fecha actual | Inspeccionar opciones del selector `#select-mes-estadisticas` | Meses futuros (Noviembre y Diciembre en 2026) inhabilitados (`disabled`). | Opciones Noviembre y Diciembre deshabilitadas en DOM; rechazo con HTTP 400 si se invoca por API. | **PASA** |
| **CP-03** | Consulta de meses sin cobros (Enero 2024) y mensaje oficial | Seleccionar año `2024`, mes `1` y dar clic en "Consultar" | Oculta cuadrícula de gráficos, no rompe la UI y muestra el mensaje oficial en pantalla. | Gráficos con `display: none`; estado vacío visible con `"No se registran ingresos para el período seleccionado"`. | **PASA** |
| **CP-04** | Verificación del formato monetario 'S/ 0.00' | Evaluar tarjetas de métricas `#metrica-total`, `#metrica-efectivo`, `#metrica-yape` | Formato estrictamente en soles con símbolo y dos decimales (`/^S\/\s[\d,]+\.\d{2}$/`). | Total: `S/ 2,884.00`, Efectivo: `S/ 2,370.50`, Yape: `S/ 512.00`. Expresiones regulares validadas. | **PASA** |
| **CP-05** | Comprobación de descarga y contenido del archivo CSV | Dar clic en `#btn-exportar-estadisticas` en mes con datos | Descarga automática de `reporte_ingresos_2026_10.csv` con cabeceras formateadas y UTF-8 BOM. | Archivo capturado con éxito; contiene `\uFEFF`, cabeceras `"Fecha","Placa","Tipo","Método","Monto"` y 4 filas de totales. | **PASA** |
| **CP-06** | Restricción de acceso para rol Recepcionista | Cerrar sesión e ingresar con usuario `recepcion` | La tarjeta de Gráficos Estadísticos no debe aparecer en el menú del recepcionista. | Tarjeta `#card-modulo-estadisticas` con `display: none` garantizado por `aplicarMenuPorRol`. | **PASA** |

---

## 4. Registro de Defectos Depurados y Superados (Defect Log)

Durante el ciclo de pruebas y verificación de la subtarea UPAO-67 se identificaron y solventaron los siguientes defectos:

| ID | Caso | Defecto Detectado | Causa Raíz | Corrección Aplicada | Commit | Estado |
|:---:|:---:|---|---|---|:---:|:---:|
| **DEF-01** | CP-01 | Desfase al llamar al endpoint de agregaciones mensuales desde scripts externos. | El backend exponía `/graficos` pero no el endpoint exacto `/graficos-mes?mes=MM&anio=YYYY` solicitado en Jira. | Se implementó el endpoint específico `GET /api/reportes/graficos-mes` reutilizando el motor central de agregaciones. | [`ba7d714`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/ba7d714) | **SUPERADO** |
| **DEF-02** | CP-03 | En períodos con cero ventas, la respuesta JSON retornaba `mensaje: null`. | La propiedad `mensaje` solo existía como fallback y no se asignaba ante `tieneDatos: false`. | Se añadió el mensaje estándar `"No se registran ingresos para el período seleccionado"` tanto en la API como en el contenedor HTML. | [`ba7d714`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/ba7d714) | **SUPERADO** |
| **DEF-03** | CP-05 | Caracteres con tilde se abrían corruptos en Microsoft Excel tras la descarga del reporte. | Falta de la marca de orden de bytes (BOM) en el payload del stream CSV. | Se antepuso el carácter Unicode `\uFEFF` al contenido CSV asegurando compatibilidad nativa con Excel en Windows. | [`ba7d714`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/ba7d714) | **SUPERADO** |

---

## 5. Salida Oficial de la Suite de Pruebas E2E (Playwright)

```text
================================================================
 INICIANDO SUITE E2E - MÓDULO GRÁFICOS ESTADÍSTICOS (UPAO-67)
================================================================

  -> Iniciando servidor local en http://localhost:3000
Servidor disponible en http://localhost:3000
[FASE 1] Autenticación y acceso como rol DUEÑO...
  [PASS] Tarjeta "Gráficos Estadísticos" visible en menú del Dueño

[CP-01] Validando carga automática del período y sumatoria...
  [PASS] Año inicial seleccionado correctamente (2026)
  [PASS] Mes inicial seleccionado correctamente (Octubre: 10)
         Métricas leídas: Total: S/ 2,884.00 | Efectivo: S/ 2,370.50 | Yape: S/ 512.00
  [PASS] Suma de métodos consistente con Total General
  [PASS] Gráfico de barras SVG renderizado (31 barras encontradas)

[CP-02] Validando restricción de meses futuros...
  [PASS] Meses futuros del año actual deshabilitados en selector (Noviembre, Diciembre)

[CP-03] Consultando período sin movimientos (Enero 2024)...
  [PASS] Contenedor de gráficos oculto correctamente en período sin ventas
  [PASS] Contenedor de estado vacío visible
  [PASS] Mensaje oficial desplegado: "No se registran ingresos para el período seleccionado"
  [PASS] Total en período sin ventas muestra S/ 0.00

[CP-04] Verificando formato de moneda estricto S/ 0.00...
  [PASS] Formato Total cumple 'S/ 0.00': S/ 2,884.00
  [PASS] Formato Efectivo cumple 'S/ 0.00': S/ 2,370.50
  [PASS] Formato Yape cumple 'S/ 0.00': S/ 512.00

[CP-05] Comprobando exportación y contenido del archivo CSV...
  [PASS] Nombre de archivo descargado correcto: reporte_ingresos_2026_10.csv
  [PASS] Archivo incluye marca de orden de bytes UTF-8 BOM
  [PASS] Cabeceras CSV requeridas presentes
  [PASS] Fila resumen "TOTAL RECAUDADO" presente
  [PASS] Fila resumen "TOTAL EFECTIVO" presente
  [PASS] Fila resumen "TOTAL YAPE" presente
         Primeras 2 líneas del CSV:
         "Fecha","Placa","Tipo","Método","Monto"
         "11/10/2026 13:03","ABC-666","Automóvil / Camioneta","Efectivo","S/ 2.50"

[CP-06] Validando restricción de acceso para rol RECEPCIONISTA...
  [PASS] Módulo de Gráficos Estadísticos no visible para Recepcionista

  -> Video capturado por Playwright en: evidencias/demostracion_pruebas_graficos_upao67.mp4

================================================================
 RESUMEN: 20 CASOS APROBADOS, 0 FALLAS
================================================================
```

---

## 6. Evidencias y Trazabilidad en GitHub

| Entregable / Recurso | Descripción | Enlace en Repositorio GitHub |
| --- | --- | --- |
| **Video Demostrativo MP4** | Grabación E2E con cursor visual de todas las pruebas funcionales | [`demostracion_pruebas_graficos_upao67.mp4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/graficosEstadisticos/evidencias/demostracion_pruebas_graficos_upao67.mp4) |
| **Suite de Pruebas E2E** | Script automatizado en Playwright | [`tests/e2e-graficos-estadisticos.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/e2e-graficos-estadisticos.js) |
| **Suite de Pruebas de API** | Script de validación unitaria de endpoints | [`tests/test-graficos-mes.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-graficos-mes.js) |
| **Plan de Pruebas (.md)** | Documento formal con matriz y Defect Log | [`docs/modulos/graficosEstadisticos/plan-pruebas.md`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/graficosEstadisticos/plan-pruebas.md) |
| **Rama de la Subtarea** | Rama de trabajo para UPAO-67 | [Rama `feature/UPAO-67-pruebas-depuracion-graficos`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/UPAO-67-pruebas-depuracion-graficos) |
| **Rama `develop`** | Rama integrada y desplegada en Staging | [Rama `develop`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
