# Documentación de Interfaces — Listado de Mis Reservas y Modal de Anulación (`UPAO-22` / Subtarea `UPAO-87`)

> **Historia de Usuario:** `UPAO-22` — Anular reserva (3 Story Points · Sprint 3)  
> **Subtarea Jira:** `UPAO-87` — Crear interfaz de listado de reservas del conductor y modal de anulación  
> **Referencia Técnica:** `docs/modulos/reservas/analisis-UPAO-22.md` y Guía de Estilos Corporativa (`Geist Sans`, `JetBrains Mono`, `#1E3A8A`, `#10B981`, `#F59E0B`, `#EF4444`, `#F3F4F6`)

---

## 1. Descripción General
Interfaz del módulo **3. Mis Reservas** (dentro de `#view-conductor-reservas`) y el modal de confirmación explícita `#modal-anular` para que el **Conductor autenticado** revise el estado de sus reservas y anule reservas `VIGENTE` con reembolso automático en **Culqi Perú** y liberación inmediata del espacio público.

---

## 2. Componentes de Interfaz Implementados

### 2.1. Listado de "3. Mis Reservas" — Vista Adaptativa Única (Sin Duplicación)
Para evitar vistas duplicadas y mantener lectura limpia en cualquier dispositivo:
- **Escritorio (`>= 768px`, `.reservas-vista-desktop`):** tabla compacta de una sola línea horizontal (`#tbody-mis-reservas`) con 8 columnas (`Código`, `Placa`, `Tipo`, `Creación`, `Límite (30 min)`, `Monto`, `Estado`, `Acción`), formato de fecha `24h` (`DD/MM/YYYY HH:mm`) y botón compacto `Anular` sin saltos de línea ni scroll horizontal.
- **Móvil (`< 768px`, `.reservas-vista-movil`):** cuadrícula de tarjetas individuales (`#contenedor-tarjetas-reservas`, `.card.reserva-card`) con botón `Anular reserva` de ancho completo.
- **Badges de estado semánticos (`public/css/style.css`):**
  - `VIGENTE` (`.badge.vigente`): verde suave (`#DEF7EC` / `#03543F`) — único estado que renderiza el botón de anulación.
  - `UTILIZADA` (`.badge.utilizada`): azul (`#E1EFFE` / `#1E429F`) — solo lectura (`—`).
  - `ANULADA` (`.badge.anulada`): rojo suave (`#FDE8E8` / `#9B1C1C`) — solo lectura (`—`).
  - `VENCIDA` (`.badge.vencida`): ámbar (`#FEF08A` / `#713F12`) — solo lectura (`—`).

### 2.2. Modal de Confirmación Explícita (`#modal-anular`)
- **Título (`#modal-anular-titulo`):** `¿Seguro que deseas anular esta reserva?`
- **Mensaje de advertencia:** informa que el pago será reembolsado al mismo medio de pago y el espacio volverá a estar disponible inmediatamente.
- **Resumen contextual dinámico:** código (`#modal-anular-codigo`), placa (`#modal-anular-placa`), tipo (`#modal-anular-tipo`) y monto (`#modal-anular-monto`).
- **Controles con protección de concurrencia:**
  - `#btn-confirmar-anular`: dispara `DELETE /api/reservas/:id` con timeout (`25 s`), activa estado `.loading` y deshabilita tanto el botón de confirmación como `#btn-cancelar-anular` mientras dura la petición.
  - Si se corta la respuesta HTTP tras procesarse el reembolso en Render, consulta automáticamente `GET /api/reservas/mias`, cierra el modal, muestra el toast de confirmación y actualiza la tabla y la disponibilidad pública (`window.disponibilidadModulo.recargar()`).

### 2.3. Feedback y Sincronización (`#toast-container`)
- **Éxito (`200 OK`):** toast `"Reserva anulada y reembolso procesado"` (o `"Reserva anulada correctamente"` si la reserva no tuvo cargo en pasarela), cierre inmediato del modal, recarga de `cargarMisReservas()` y refresco de disponibilidad pública.
- **Error (`400`, `403`, `409`, `502`, `504`):** toast de error en español manteniendo la reserva sin alteraciones.

---

## 3. Evidencias Visuales de Interfaz (`docs/modulos/reservas/evidencias-anulacion/`)

1. **`01_disponibilidad_previa_anulacion.png`**: Tablero público mostrando los cupos disponibles con la reserva `VIGENTE` descontando 1 espacio.
2. **`02_interfaz_mis_reservas_4_estados.png`**: Vista de escritorio (tabla compacta en una sola línea horizontal, sin tarjetas duplicadas) mostrando los 4 estados (`VIGENTE`, `UTILIZADA`, `ANULADA`, `VENCIDA`) y el botón `Anular` únicamente en `VIGENTE`.
3. **`03_modal_confirmacion_anulacion.png`**: Modal `#modal-anular` abierto con código, placa, tipo, monto y botones de confirmación/cancelación.
4. **`04_anulacion_exitosa_toast_y_cambio_estado.png`**: Toast de confirmación tras anular, cierre automático del modal y fila actualizada a `ANULADA` sin botón de acción.
5. **`05_disponibilidad_recalculada_tiempo_real.png`**: Tablero público recalculado inmediatamente con `+1` espacio disponible.
6. **`06_interfaz_mis_reservas_movil.png`**: Vista responsiva móvil (`390px`) mostrando únicamente las tarjetas `.reserva-card` sin tabla duplicada.
