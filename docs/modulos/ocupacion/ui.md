# Módulo Nivel de Ocupación y Afluencia — Interfaz (UPAO-19 / UPAO-70)

> Historia: **UPAO-19 — Consultar nivel de ocupación** · Subtarea **UPAO-70 (Interfaz / Prototipado)** · Sprint 2 · Rol **DUEÑO**.

Módulo implementado en `public/` (HTML + CSS + JS vanilla), conectado a la **API real de ocupación** y siguiendo la Guía de Estilos y el análisis [`analisis.md`](analisis.md).

## Pantalla

- Tarjeta **"Nivel de Ocupación"** en el menú principal (solo rol DUEÑO) → abre la vista `#view-ocupacion`.
- **Filtros:** `Fecha Inicio` y `Fecha Fin` (inputs `type="date"`), botón **Consultar**, **📥 Exportar CSV/Excel** y **🖨️ Imprimir / PDF**.
- **Cuatro tarjetas KPI** con tipografía JetBrains Mono:
  - **Total Vehículos** ingresados en el período.
  - **Total Autos** con su porcentaje del total.
  - **Total Motos** con su porcentaje del total.
  - **Aforo Máximo** simultáneo en formato `N veh. (P%)`, con color según el nivel: verde `< 80%`, ámbar `≥ 80%` y rojo `≥ 100%` de la capacidad.
- **Gráfico de barras SVG** de afluencia por bloques horarios de 2 horas (9 bloques, de `06:00 - 08:00` a `22:00 - 06:00`), con eje Y de cantidades y etiquetas de hora en hora peruana.
- El bloque con mayor afluencia se resalta en **ámbar** y lleva la etiqueta **"Hora pico"**.
- **Tooltips** al pasar el cursor por cada barra: bloque, cantidad de vehículos y porcentaje del total.
- **Estado sin movimientos:** se oculta el gráfico y se muestra el mensaje exacto `No se registran movimientos ni ingresos para el período seleccionado`; las tarjetas quedan en `0` y la exportación se deshabilita.
- **Vista imprimible / PDF** mediante `window.print()` y reglas `@media print` (oculta cabecera, menú, filtros y botones; conserva tarjetas y gráfico).

## Comportamiento

- **Carga inicial:** últimos 7 días hasta hoy según `America/Lima` (UTC-5). En la apertura del módulo se consulta automáticamente.
- **Validación dual:** el cliente bloquea `fechaInicio > fechaFin`, fechas futuras y campos vacíos mostrando el mensaje en el filtro; el backend rechaza con `HTTP 400` los mismos casos. Los inputs limitan la fecha máxima a hoy.
- **Datos reales:** cada consulta llama a `GET /api/ocupacion` y renderiza las estadías registradas en la base de datos.
- **Exportación:** descarga `GET /api/ocupacion/exportar?formato=csv` con BOM UTF-8 y nombre `reporte_ocupacion_YYYY-MM-DD_YYYY-MM-DD.csv`. El formato `excel` devuelve el mismo CSV (compatible con Excel). Sin datos, el botón queda deshabilitado con el tooltip `"No hay datos disponibles para exportar"`.
- **Impresión:** el botón **Imprimir / PDF** abre el diálogo del navegador; el PDF se genera con el consolidado del período visible.
- **Errores de API:** se muestra el mensaje del backend en el campo de error del filtro.

## Verificación

Rango `2026-10-25` a `2026-10-31` (datos de staging):

| Indicador | Valor |
| --- | --- |
| Total vehículos | 6 |
| Total autos | 3 (50.0%) |
| Total motos | 3 (50.0%) |
| Aforo máximo simultáneo | 16 de 20 (80%) |
| Bloque pico | `14:00 - 16:00` con 3 ingresos (50%) |
| Bloques renderizados | 9 (3 con altura) |

Estado vacío `2024-01-01` a `2024-01-07`: métricas en `0`, mensaje exacto y exportación deshabilitada. Rol RECEPCIONISTA: la tarjeta del módulo no se muestra.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `public/index.html` | Tarjeta del menú + vista `#view-ocupacion` + carga del script. |
| `public/css/style.css` | Estilos del módulo, barra pico, nivel de aforo y reglas de impresión. |
| `public/js/ocupacion.js` | Filtros, consulta a la API, KPIs, gráfico SVG, tooltip, exportación e impresión. |
| `public/js/app.js` | Visibilidad de la tarjeta para el rol DUEÑO. |
| `src/routes/ocupacion.js` | Endpoints de ocupación y exportación (montados en `/api/ocupacion` y `/api/reportes/ocupacion`). |
| `server.js` | Montaje de `/api/reportes/ocupacion` y `/api/ocupacion`. |
| `docs/modulos/ocupacion/analisis.md` | Análisis y diseño (UPAO-19 / Subtarea 1). |
| `docs/modulos/ocupacion/api.md` | Contrato de la API de ocupación y exportación. |

## Evidencias

Las capturas y el PDF se encuentran en `docs/modulos/ocupacion/evidencias/`:

1. **Dashboard del módulo con datos del período:** [`evidencias/01_dashboard_nivel_ocupacion.png`](evidencias/01_dashboard_nivel_ocupacion.png)
2. **Estado sin movimientos:** [`evidencias/02_estado_sin_movimientos.png`](evidencias/02_estado_sin_movimientos.png)
3. **Vista imprimible / PDF:** [`evidencias/03_reporte_ocupacion.pdf`](evidencias/03_reporte_ocupacion.pdf)

### Evidencias de código (UPAO-71)

4. **Creación del endpoint `GET /api/reportes/ocupacion`:** [`evidencias/upao-71/01_endpoint_reporte_ocupacion.png`](evidencias/upao-71/01_endpoint_reporte_ocupacion.png)
5. **Cálculo de vehículos activos simultáneos y total de entradas:** [`evidencias/upao-71/02_calculo_aforo_y_entradas.png`](evidencias/upao-71/02_calculo_aforo_y_entradas.png)

## API

Endpoints, parámetros, respuestas y reglas de cálculo: [`api.md`](api.md).
