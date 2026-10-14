# Módulo Salida — Interfaz (UPAO-44)

Pantalla de registro de salida y cobro para el recepcionista, implementada en `public/` (HTML + CSS + JS vanilla), siguiendo la Guía de Estilos.

## Pantalla

- Tarjeta **"Registrar Salida"** en el menú principal (visible para el rol recepcionista) → abre la vista `#view-salida`.
- Panel **"Vehículos en Cochera"**: búsqueda por placa (con autofocus) + tabla de estadías activas (placa, tipo, hora de ingreso y botón "Seleccionar").
- Panel **"Resumen de Salida"**: placa, tipo, hora de entrada, **tiempo transcurrido**, tarifa aplicada, **monto total a pagar**, **selector de método de pago** (Efectivo / Yape / POS) y botones "Registrar Salida" (rojo de peligro, guía §3) / "Cancelar".

## Comportamiento

- Al abrir el módulo carga los vehículos activos desde `GET /api/ingresos/activos` y las tarifas desde `GET /api/tarifas`.
- **Búsqueda:** filtra en vivo por placa (ignora el guion); muestra "Sin resultados para esa placa." o "No hay vehículos en cochera." cuando corresponde.
- **Selección:** al elegir un vehículo se calcula automáticamente el tiempo transcurrido (hora actual − hora de ingreso) y el monto con la regla de la fracción **(A)** del análisis: `monto = horas × precio_hora + precio_fraccion (si hay fracción iniciada)`.
- **Teclado:** `ENTER` selecciona el primer resultado; `ESC` limpia búsqueda y selección (lineamiento First-Keypad).
- **Estados del botón:** `Loading` + `Disabled` con anti-debounce al confirmar.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `public/index.html` | Tarjeta del menú + vista `#view-salida`. |
| `public/css/style.css` | Estilos `.salida-layout`, `.btn-danger`, filas de activos y `.monto-total`. |
| `public/js/app.js` | Navegación, búsqueda de activos, cálculo del cobro y resumen. |

## Pendiente (API)

- El registro real de la salida (completar `hora_salida`, crear el `pago` y vincular `estadia.id_pago`) se implementa en la subtarea de API del módulo. Por ahora, al confirmar se muestra el toast `"Salida registrada: Placa [ABC-123] · S/ 0.00 · Efectivo"` como **prototipo**.
- `metodo_pago` aún no tiene datos en la BD; el selector usa las opciones del modelo (Efectivo, Yape, POS) hasta que se pueble el catálogo.
