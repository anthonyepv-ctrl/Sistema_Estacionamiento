# Módulo Reporte de Ingresos — Interfaz y Prototipado (UPAO-53)

Pantalla de consulta de recaudación diaria y desglose de cobros físicos y digitales exclusiva para el rol de **DUEÑO**, implementada en `public/` (HTML + CSS + JS vanilla), siguiendo la Guía de Estilos oficial del proyecto.

> **Historia de Usuario:** UPAO-17 (Consultar ingresos recaudados)  
> **Subtarea:** UPAO-53 (Crear interfaz de reporte de ingresos diarios - Prototipado)

---

## 1. Pantalla y Navegación

- **Acceso exclusivo por rol:** Tarjeta **"Reporte de Ingresos"** en el Menú Principal visible únicamente si el usuario autenticado tiene el rol `DUEÑO`. Para el rol `RECEPCIONISTA` permanece oculta.
- **Acceso directo:** Abre la vista `#view-reportes`.
- **Botón de retorno:** `[← Volver al Menú Principal]` (`#btn-back-to-menu-reportes`) retorna limpiamente al dashboard.

---

## 2. Comportamiento y Componentes Interactivos

### A. Selector y Validación de Fecha
- Inicia automáticamente cargando la fecha actual.
- Atributo `max` dinámico que bloquea la selección de fechas futuras.
- La fecha consultada se muestra en formato peruano oficial: `dd/mm/aaaa`.
- Permite consultar días anteriores (ej. ayer o anteayer) y actualiza instantáneamente métricas y tabla sin recargar la página.

### B. Desglose de Dinero Físico y Digital
- **Tarjeta Efectivo:** Etiquetada como **Dinero Físico** (💵), muestra el total acumulado en soles (`S/ 0.00`) y la cantidad de cobros en efectivo.
- **Tarjeta Yape:** Etiquetada como **Dinero Digital** (📱), muestra el total acumulado en soles (`S/ 0.00`) y la cantidad de cobros con Yape.
- **Barra de Progreso Proporcional:** Representación gráfica porcentual inmediata (ej. `34% Físico · 66% Digital`).
- **Monto Total General:** Bloque destacado en azul corporativo (`#1E3A8A`) con tipografía prominente (`JetBrains Mono`) con la suma consolidada.

### C. Componentes de Filtrado Interactivo
- **Pills de filtrado rápido:** `[ Todos ]`, `[ 💵 Efectivo ]`, `[ 📱 Yape ]` que filtran la tabla en tiempo real.
- **Interacción por tarjeta:** Al hacer clic sobre la tarjeta de Efectivo o Yape, se activa el filtro correspondiente con realce visual (`active-filter`).

### D. Tabla de Detalle y Estado Vacío
- Detalla cada cobro: **Placa** (con guion `ABC-123`), **Tipo de vehículo**, **Hora de salida** (`HH:mm`), **Método de pago** (Badge verde para Efectivo / morado para Yape) y **Monto cobrado** (`S/ 0.00` alineado a la derecha).
- **Estado sin movimientos:** Si la fecha no registra cobros, se oculta la tabla y se despliega el mensaje informativo exacto:
  > *No se registran movimientos ni recaudación para la fecha seleccionada*

---

## 3. Archivos Involucrados

| Archivo | Rol en el Prototipo |
|---|---|
| `public/index.html` | Estructura de la tarjeta `#card-modulo-reportes` y de la vista `#view-reportes`. |
| `public/css/style.css` | Estilos de tarjetas de métodos, barra de progreso proporcional, pills de filtro y empty state. |
| `public/js/app.js` | Control de navegación `mostrarPantalla('reportes')` y visibilidad condicional según rol `DUEÑO`. |
| `public/js/reportes.js` | Lógica interactiva del prototipo: selectores, filtros en vivo, cálculo de porcentajes y renderizado. |
| `src/routes/reportes.js` | Endpoint de respaldo `GET /api/reportes/diario` para consulta de pagos reales en BD. |
| `server.js` | Montaje de la ruta `/api/reportes`. |

---

## 4. Evidencias del Prototipado

Las evidencias generadas se encuentran almacenadas en el directorio `docs/modulos/ingresosRecaudados/evidencias/`:

1. **Dashboard con acceso exclusivo para Dueño:** [`evidencias/01_dashboard_dueno_modulo_reportes.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/01_dashboard_dueno_modulo_reportes.png)
2. **Vista principal con recaudación del día actual y desglose:** [`evidencias/02_vista_ingresos_diarios_hoy.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/02_vista_ingresos_diarios_hoy.png)
3. **Consulta de fechas anteriores (Ayer):** [`evidencias/03_recaudacion_fecha_anterior_ayer.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/03_recaudacion_fecha_anterior_ayer.png)
4. **Componente interactivo para filtrar por método (Yape):** [`evidencias/04_filtro_interactivo_yape.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/04_filtro_interactivo_yape.png)
5. **Estado sin movimientos para fechas sin recaudación:** [`evidencias/05_estado_sin_movimientos.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/05_estado_sin_movimientos.png)
6. **Restricción de rol (Oculto para Recepcionista):** [`evidencias/06_dashboard_recepcionista_sin_reportes.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/06_dashboard_recepcionista_sin_reportes.png)
7. **Video demostración de interacción del prototipo (MP4):** [`evidencias/demostracion_prototipo_reporte_ingresos_upao53.mp4`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/demostracion_prototipo_reporte_ingresos_upao53.mp4)
