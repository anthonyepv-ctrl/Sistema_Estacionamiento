# Módulo Gráficos Estadísticos — Interfaz (UPAO-18 / UPAO-65)

> Historia: **UPAO-18 — Gráficos de ingresos** · Subtarea **UPAO-65 (Interfaz / Prototipado)** · Sprint 2 · Rol **DUEÑO**.

Dashboard interactivo implementado en `public/` (HTML + CSS + JS vanilla), siguiendo la Guía de Estilos y el análisis [`analisis.md`](analisis.md).

## Pantalla

- Tarjeta **"Gráficos Estadísticos"** en el menú principal (solo rol DUEÑO) → abre la vista `#view-estadisticas`.
- **Barra de filtros:** Vista (`Mensual` / `Anual`), Año, Mes, botón **Consultar** y botón **📥 Exportar CSV**.
- **Cuatro tarjetas de métricas:** Recaudación Total, Total Efectivo, Total Yape y Total Vehículos.
- **Gráfico 1:** barras de ingresos diarios (Eje X: días del mes; Eje Y: recaudación en `S/`). En vista anual muestra los 12 meses.
- **Gráfico 2:** dona de proporción Efectivo vs. Yape con montos y porcentajes.
- **Gráfico 3:** barras de concurrencia vehicular por hora (06:00 a 23:00).
- **Tooltips** con formato de moneda peruana `S/ 0.00`.
- **Estado sin movimientos:** contenedor neutro con el mensaje exacto `"No se registran ingresos para el período seleccionado"`; métricas en cero y exportación deshabilitada.

## Comportamiento

- **Carga inicial:** año y mes actuales según `America/Lima` (UTC-5).
- **Bloqueo de períodos futuros:** no se listan años posteriores al actual y se deshabilitan dinámicamente los meses futuros del año corriente; el botón Consultar vuelve a validar antes de renderizar.
- **Interacción:** cambiar Vista, Año o Mes reconsulta automáticamente; `Consultar` vuelve a ejecutar la consulta.
- **Exportación CSV:** genera un archivo con **BOM UTF-8** y las columnas `Fecha`, `Placa`, `Tipo`, `Método`, `Monto`, más las filas de totales (recaudado, efectivo, Yape y vehículos). Nombre: `reporte_ingresos_YYYY_MM.csv` (mensual) o `reporte_ingresos_YYYY.csv` (anual).
- **Estado vacío:** se ocultan los gráficos, se mantienen las métricas en cero y el botón de exportación queda deshabilitado con el tooltip `"No hay datos disponibles para exportar"`.

## Datos del prototipo

- Mientras no exista `GET /api/reportes/graficos` (subtarea de codificación), la vista usa un **generador determinístico de datos demo** por período (a partir de 2026 y hasta el día actual), con transacciones de Efectivo y Yape.
- Los años 2024 y 2025 se muestran **sin datos** para demostrar el estado vacío.
- La exportación CSV se genera en el cliente a partir del mismo dataset demo; al integrar la API se reemplazará por `GET /api/reportes/exportar`.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `public/index.html` | Tarjeta del menú + vista `#view-estadisticas` + carga del script. |
| `public/css/style.css` | Estilos del dashboard, tarjetas, gráficos SVG, tooltip y estado vacío. |
| `public/js/estadisticas.js` | Selectores, bloqueo de períodos, agregaciones, gráficos, tooltips y CSV. |
| `public/js/app.js` | Visibilidad de la tarjeta para el rol DUEÑO. |
| `docs/modulos/graficosEstadisticos/analisis.md` | Análisis y diseño (UPAO-18 / Subtarea 2.1). |

## Pendiente (API)

- `GET /api/reportes/graficos` y `GET /api/reportes/exportar` (subtarea de codificación), con validación de períodos futuros en backend.
- Al integrarlos: reemplazar los datos demo y la exportación en cliente por las respuestas del servidor.
