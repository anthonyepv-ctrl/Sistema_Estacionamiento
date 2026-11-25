# Documentación de Interfaces — Búsqueda y Confirmación de Reservas

## 1. Descripción General
Interfaces operativas para los roles Recepcionista y Dueño diseñadas para atención rápida en recepción, sin textos instructivos redundantes ni controles duplicados.

## 2. Pantallas y Componentes

### Detección de reserva en Registrar Ingreso
- Formulario limpio con etiquetas directas, placeholder breve y contador de caracteres para observaciones opcionales.
- Al digitar una placa con reserva vigente, se muestra un aviso amarillo informativo con el código de reserva, nombre del conductor, adelanto pagado y hora límite.
- El botón principal de envío se adapta automáticamente: pasa de verde (Registrar Ingreso) a azul corporativo (Confirmar ingreso con reserva) y confirma la llegada incluyendo las notas del vehículo. Al limpiar o cambiar a una placa sin reserva, vuelve al estado normal en verde.

### Módulo Buscar Reservas
- Accesible desde la barra lateral izquierda y desde el menú principal.
- Incluye filtro por texto libre (código, placa, DNI o nombre) y selector de estado con actualización automática al cambiar.
- Muestra los resultados en una tabla compacta de una sola línea horizontal en escritorio, con todas las columnas visibles sin recortes (Código, Placa, Tipo, Conductor y DNI, Creación, Vence, Adelanto, Estado y Acción).
- El botón Confirmar aparece únicamente en reservas vigentes; los demás estados muestran un guion. Los textos renderizados se sanean para evitar inyección HTML.

## 3. Evidencias Visuales

Las capturas de verificación visual se guardan en docs/modulos/reservas/evidencias-garita/:

1. 01_alerta_reservado_en_ingreso.png — Aviso amarillo de reserva y botón principal unificado en azul en Registrar Ingreso.
2. 02_garita_buscar_reservas_estados.png — Tabla de resultados en una sola línea mostrando los cuatro estados de reserva.
3. 03_garita_filtro_vigente.png — Listado filtrado por estado Vigente con la acción Confirmar habilitada.
4. 04_garita_confirmacion_exitosa.png — Confirmación exitosa con notificación en pantalla y cambio inmediato a Utilizada.
5. 05_salida_estadia_con_reserva.png — Vista de Salida mostrando la estadía activa vinculada al adelanto de la reserva.
