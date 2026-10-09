# Módulo Ingreso — Interfaz (UPAO-39)

Pantalla de registro rápido de vehículos para el recepcionista, implementada en `public/` (HTML + CSS + JS vanilla), siguiendo la Guía de Estilos.

## Pantalla

- Tarjeta **"Registrar Ingreso"** en el menú principal → abre la vista `#view-ingreso`.
- Formulario: **Placa** (con autofocus) + **Tipo de vehículo** (selector) + botones "Registrar Ingreso" (verde de éxito, guía §3) / "Limpiar".
- **Vista previa**: placa normalizada, tipo de vehículo y estado ("OCUPADO").

## Comportamiento

- **Placa:** se convierte a MAYÚSCULAS y el guion se inserta automáticamente (`ABC-123` o `1234-AB`); el usuario no escribe el guion.
- **Inferencia de tipo:** si la placa inicia con letras → Automóvil/Camioneta; si inicia con dígitos → Motocicleta. El selector queda visible y editable.
- **Validación en tiempo real:** bloquea campos vacíos y formatos inválidos antes de enviar, con el mensaje de la guía: "Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A)."
- **Bloqueo de espacios:** la tecla `Espacio` no se registra en el campo de placa.
- **Teclado:** `ENTER` envía el formulario; `ESC` limpia el formulario (lineamiento First-Keypad).
- **Estados del botón:** al enviar se muestra `Loading` y se inhabilita (`Disabled`) hasta terminar (anti-debounce, guía §4.C).

## Archivos

| Archivo | Cambio |
| --- | --- |
| `public/index.html` | Tarjeta del menú + vista `#view-ingreso`. |
| `public/css/style.css` | Estilos `.ingreso-layout`, `.input-placa`, `.preview-row`, `.btn-success` y estados de botón (active/disabled). |
| `public/js/app.js` | Navegación, normalización/validación de placa, inferencia de tipo y vista previa. |

## Pendiente (UPAO-40)

- La conexión real con la API (`POST /api/ingresos`, validación de duplicado activo y aforo) se implementa en **UPAO-40**. Por ahora, al enviar un formulario válido se muestra el toast de confirmación ("Ingreso registrado: Placa [ABC-123]") como **prototipo**.
