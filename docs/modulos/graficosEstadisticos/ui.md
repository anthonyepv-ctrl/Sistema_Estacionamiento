# Módulo Gráficos Estadísticos — Interfaz (UPAO-18 / UPAO-65)

> Historia: **UPAO-18 — Gráficos de ingresos** · Subtarea **UPAO-65 (Interfaz / Prototipado)** · Sprint 2 · Rol **DUEÑO**.

Dashboard interactivo implementado en `public/` (HTML + CSS + JS vanilla), conectado a la **API real de reportes** y siguiendo la Guía de Estilos y el análisis [`analisis.md`](analisis.md).

## Pantalla

- Tarjeta **"Gráficos Estadísticos"** en el menú principal (solo rol DUEÑO) → abre la vista `#view-estadisticas`.
- **Barra de filtros:** Vista (`Mensual` / `Anual`), Año, Mes, botón **Consultar** y botón **📥 Exportar CSV**.
- **Cuatro tarjetas de métricas:** Recaudación Total, Total Efectivo, Total Yape y Total Vehículos.
- **Gráfico 1:** barras de ingresos diarios (Eje X: días del mes; Eje Y: recaudación en `S/`). En vista anual muestra los 12 meses.
- **Gráfico 2:** dona de proporción por método de pago (Efectivo / Yape), con montos y porcentajes.
- **Gráfico 3:** barras de concurrencia vehicular por hora (06:00 a 23:00).
- **Tooltips** con formato de moneda peruana `S/ 0.00`.
- **Estado sin movimientos:** contenedor neutro con el mensaje exacto `"No se registran ingresos para el período seleccionado"`; métricas en cero y exportación deshabilitada.

## Comportamiento

- **Carga inicial:** año y mes actuales según `America/Lima` (UTC-5).
- **Bloqueo de períodos futuros:** no se listan años posteriores al actual y se deshabilitan dinámicamente los meses futuros del año corriente; además, el backend rechaza con `HTTP 400` cualquier consulta futura (validación dual).
- **Datos reales:** cada consulta llama a `GET /api/reportes/graficos` y renderiza los pagos registrados en `pago`, agrupados por día/hora en zona peruana.
- **Interacción:** cambiar Vista, Año o Mes reconsulta automáticamente; `Consultar` vuelve a ejecutar la consulta.
- **Exportación CSV:** descarga `GET /api/reportes/exportar` con **BOM UTF-8**, columnas `Fecha`, `Placa`, `Tipo`, `Método`, `Monto` y filas de totales (recaudado, efectivo, Yape y vehículos). Nombre: `reporte_ingresos_YYYY_MM.csv` (mensual) o `reporte_ingresos_YYYY.csv` (anual).
- **Estado vacío:** la API responde `tieneDatos: false`; se ocultan los gráficos, las métricas quedan en cero y el botón de exportación se deshabilita con el tooltip `"No hay datos disponibles para exportar"`.
- **Errores de API:** se muestra el mensaje del backend en el campo de error del filtro.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `public/index.html` | Tarjeta del menú + vista `#view-estadisticas` + carga del script. |
| `public/css/style.css` | Estilos del dashboard, tarjetas, gráficos SVG, tooltip y estado vacío. |
| `public/js/estadisticas.js` | Selectores, consulta a la API, gráficos, tooltips y exportación. |
| `public/js/app.js` | Visibilidad de la tarjeta para el rol DUEÑO. |
| `src/routes/reportes.js` | Endpoints `/api/reportes/graficos` y `/api/reportes/exportar`. |
| `docs/modulos/graficosEstadisticos/analisis.md` | Análisis y diseño (UPAO-18 / Subtarea 2.1). |
| `docs/modulos/graficosEstadisticos/api.md` | Contrato de la API de gráficos y exportación. |

## API

Endpoints, parámetros y validaciones: [`api.md`](api.md).
