# Documentación de Interfaces — Historial de Estadías del Conductor

## 1. Descripción General
Pantalla exclusiva para el rol Conductor que presenta el historial cronológico de sus vehículos, diferenciando estadías activas (En cochera) y finalizadas, junto con la trazabilidad de reservas y cobros.

## 2. Componentes Implementados
- Acceso directo desde la barra lateral izquierda y desde el menú principal del conductor.
- Filtro de estado (Todos los estados, En cochera, Finalizadas) con actualización automática y botón de refresco manual.
- Tabla compacta en una sola línea horizontal (Placa, Tipo, Ingreso, Salida, Reserva, Adelanto, Pago en Salida y Estado) sin desborde horizontal en escritorio.
- Renderizado saneado con escape HTML y mensaje claro cuando el conductor aún no registra movimientos.

## 3. Evidencias Visuales

Las capturas de verificación se encuentran en docs/modulos/reservas/evidencias-historial/:

1. 01_historial_completo.png — Vista completa con estadía en cochera vinculada a reserva y estadía finalizada en una sola línea.
2. 02_historial_filtro_en_cochera.png — Filtrado aplicado mostrando únicamente vehículos actualmente en cochera.
3. 03_historial_filtro_finalizadas.png — Filtrado aplicado mostrando únicamente estadías finalizadas con pago registrado.
