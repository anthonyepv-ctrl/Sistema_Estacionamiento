# Interfaz — Reporte de ingresos diarios

## Propósito

El módulo **Ingresos** permite al dueño o administrador consultar la recaudación de un día y contrastar los cobros físicos y digitales registrados por recepción.

## Acceso y vista inicial

- El módulo se muestra en el menú principal únicamente para el rol **DUEÑO**.
- Al ingresar, carga automáticamente el consolidado correspondiente a la fecha actual.
- La fecha visible debe expresarse en formato peruano: `dd/mm/aaaa`.
- Todos los importes se presentan en soles con el formato `S/ 0.00`.

## Estructura de la pantalla

```text
Ingresos diarios                                      [← Volver al menú]
Consulta la recaudación registrada por fecha y método de pago.

Fecha de consulta [ 14/10/2026                    ] [Consultar]

Recaudación por método de pago
[ Efectivo       ] [ Yape           ] 
  S/ 0.00            S/ 0.00                      

Monto total general
S/ 0.00

Detalle de transacciones                         0 movimientos
┌───────────┬──────────────────────┬───────────────┬────────────────┬───────────┐
│ Placa     │ Tipo de vehículo     │ Hora de salida│ Método de pago │ Monto     │
├───────────┼──────────────────────┼───────────────┼────────────────┼───────────┤
│ ABC-123   │ Automóvil / Camioneta│ 09:45         │ Efectivo       │ S/ 7.00   │
└───────────┴──────────────────────┴───────────────┴────────────────┴───────────┘
```

## Campos y controles

| Elemento | Tipo | Comportamiento |
| --- | --- | --- |
| Fecha de consulta | Selector de fecha | Obligatorio. Inicia con el día actual y permite consultar un día específico. No admite fechas futuras. |
| Botón `Consultar` | Botón primario | Actualiza las métricas y la tabla con la fecha elegida. Durante la carga muestra el estado `Consultando...` y queda deshabilitado. |
| Botón `Volver al menú` | Botón secundario | Regresa al menú principal sin modificar la fecha consultada. |
| Tarjetas por método | Métricas de solo lectura | Muestran el total diario de Efectivo, Yape. Si un método no tiene pagos, muestra `S/ 0.00`. |
| Monto total general | Métrica destacada | Muestra la suma exacta de todas las tarjetas por método. |
| Tabla de transacciones | Tabla de solo lectura | Detalla cada salida cobrada en la fecha seleccionada. |

## Métricas del consolidado

La cabecera presenta cuatro tarjetas de resumen, una por cada método de pago:

| Tarjeta | Etiqueta visible | Valor mostrado |
| --- | --- | --- |
| Efectivo | `Total Efectivo` | Suma de los pagos en efectivo del día. |
| Yape | `Total Yape` | Suma de los pagos con Yape del día. |

Debajo de estas tarjetas se muestra, con mayor jerarquía visual, el bloque **Monto Total General**. Su valor debe ser la suma de los cuatro totales anteriores, incluidos los que sean `S/ 0.00`.

## Tabla de detalle

La tabla debe mostrar una fila por cada cobro registrado en la fecha consultada y debe contener, como mínimo, las siguientes columnas:

| Columna | Formato de presentación |
| --- | --- |
| Placa | Mayúsculas y guion: `ABC-123`. |
| Tipo de vehículo | Nombre completo, por ejemplo `Automóvil / Camioneta` o `Motocicleta`. |
| Hora de salida | Hora local en formato de 24 horas: `HH:mm`. |
| Método de pago | `Efectivo`, `Yape`. |
| Monto cobrado | Moneda peruana: `S/ 0.00`. |

Las filas se ordenan por hora de salida, de la más reciente a la más antigua. El encabezado debe permanecer claramente diferenciado del contenido y los montos deben alinearse a la derecha para facilitar el cuadre.

## Estado sin movimientos

Cuando no existan salidas o pagos para la fecha seleccionada:

- Las dos tarjetas por método muestran `S/ 0.00`.
- El **Monto Total General** muestra `S/ 0.00`.
- La tabla no presenta filas.
- En el área de detalle se muestra el mensaje informativo:

> No se registran movimientos ni recaudación para la fecha seleccionada

El mensaje se presenta en un estilo informativo, sin color de error, porque la ausencia de movimientos es un resultado válido de la consulta.

## Estados de interfaz

| Estado | Presentación esperada |
| --- | --- |
| Carga inicial o nueva consulta | Las métricas muestran un indicador de carga y el botón indica `Consultando...`. |
| Consulta exitosa con movimientos | Se muestran métricas, monto general y filas de detalle. |
| Consulta exitosa sin movimientos | Se muestran montos en cero y el mensaje informativo definido. |
| Fecha inválida o futura | Se informa bajo el selector: `Seleccione una fecha válida que no sea futura.` |
| Error al consultar | Se conserva la última información válida y se muestra un toast rojo: `No se pudo cargar la recaudación. Intente nuevamente.` |

## Consideraciones visuales

- Seguir la guía de estilos del proyecto: fondo `#F3F4F6`, azul corporativo `#1E3A8A`, verde `#10B981`, rojo `#EF4444` y ámbar `#F59E0B`.
- Usar **Geist Sans** para etiquetas, títulos y textos; usar **JetBrains Mono** para placas y montos.
- El total general debe usar el color azul corporativo y una tipografía más prominente que las tarjetas individuales.
- Las tarjetas de métodos pueden diferenciarse mediante un icono o color de acento, sin reemplazar el texto del método.
- La tabla debe adaptarse a pantallas pequeñas mediante desplazamiento horizontal, conservando visibles sus encabezados.

## Nota de catálogo de métodos

La interfaz considera los métodos solicitados por la historia: **Efectivo, Yape**. La implementación actual del sistema registra `Efectivo`, `Yape`.

---

## Evidencias del Prototipado (UPAO-53)

Se generaron capturas de pantalla que verifican el cumplimiento de todos los criterios de aceptación del prototipo:

1. **Dashboard con acceso exclusivo para Dueño:** [`evidencias/01_dashboard_dueno_modulo_reportes.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/01_dashboard_dueno_modulo_reportes.png)
2. **Vista principal con recaudación del día actual y desglose:** [`evidencias/02_vista_ingresos_diarios_hoy.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/02_vista_ingresos_diarios_hoy.png)
3. **Consulta de fechas anteriores (Ayer):** [`evidencias/03_recaudacion_fecha_anterior_ayer.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/03_recaudacion_fecha_anterior_ayer.png)
4. **Componente interactivo para filtrar por método (Yape):** [`evidencias/04_filtro_interactivo_yape.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/04_filtro_interactivo_yape.png)
5. **Estado sin movimientos para fechas sin recaudación:** [`evidencias/05_estado_sin_movimientos.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/05_estado_sin_movimientos.png)
6. **Restricción de rol (Oculto para Recepcionista):** [`evidencias/06_dashboard_recepcionista_sin_reportes.png`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/06_dashboard_recepcionista_sin_reportes.png)
7. **Video demostración de interacción del prototipo (MP4):** [`evidencias/demostracion_prototipo_reporte_ingresos_upao53.mp4`](file:///E:/ALBERTH%20ALM/DOCUMENTOS/PROYECTOS/AGILE_DEVELOPMENT/Sistema_Estacionamiento/docs/modulos/ingresosRecaudados/evidencias/demostracion_prototipo_reporte_ingresos_upao53.mp4)
