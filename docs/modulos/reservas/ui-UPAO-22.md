# Documentación de Interfaces — Listado de Mis Reservas y Modal de Anulación (`UPAO-22` / Subtarea `UPAO-84`)

> **Historia de Usuario:** `UPAO-22` — Anular reserva (3 Story Points · Sprint 2)  
> **Subtarea Jira:** `UPAO-84` — Crear interfaz de listado de reservas del conductor y modal de anulación  
> **Referencia Técnica y de Diseño:** `ANULAR_RESERVA_ANALiSIS_DISEÑO.md` (§7 UI, §4 API REST, §8 Stripe)  
> **Guía Visual Aplicada:** Paleta Institucional `#1E3A8A` (Navy), `#F8FAFC` (Slate Canvas), `#DC2626` (Danger Red), `#16A34A` (Success Green), `#D97706` (Amber Warning).

---

## 1. Descripción General del Módulo

Esta funcionalidad implementa la gestión de reservas del lado del **Conductor autenticado** dentro del portal web. Permite visualizar el historial completo de reservas con sus estados operativos, así como solicitar la cancelación controlada e irrevocable de reservas activas, liberando el cupo reservado de manera instantánea y ejecutando el reembolso íntegro vía pasarela de pagos Stripe (modo de pruebas o producción).

---

## 2. Componentes de Interfaz Implementados

### 2.1. Listado de "Mis Reservas" — Vista Dual (Tarjetas y Tabla Adaptativa)
Ubicación en el DOM: `#contenedor-tarjetas-reservas` y `#tabla-mis-reservas` (`#tbody-mis-reservas`).

- **Atributos mostrados por reserva:**
  1. **Código de Reserva:** Identificador alfanumérico amigable (ej. `RES-1001`) y número correlativo (`#49`).
  2. **Placa del Vehículo:** Formato oficial SUNARP/MTC (ej. `ABC-123`, `XYZ-789`).
  3. **Tipo de Vehículo:** Denominación clara (`Automóvil / Camioneta`, `Motocicleta`, `Bicicleta`).
  4. **Periodo / Fecha y Hora:** Rango completo `[fechaReserva] → [fechaLimite]` formateado en hora local peruana (30 minutos de tolerancia tras la reserva).
  5. **Monto Adelanto:** Importe exacto pagado en moneda nacional (`S/ 4.50`).
  6. **Estado Operativo:** Etiqueta distintiva con clases CSS semánticas:
     - `.badge.vigente` (Azul / Cyan): Reserva activa, dentro de la ventana de tolerancia de 30 minutos.
     - `.badge.utilizada` (Verde esmeralda): Vehículo ingresó a cochera y consumió la reserva.
     - `.badge.anulada` (Gris / Pizarra neutro): Reserva cancelada voluntariamente con reembolso procesado.
     - `.badge.vencida` (Rojo suave / Ámbar): Excedió los 30 minutos sin ingreso registrado.
- **Botón de Anulación Condicional (`.btn-anular.btn.btn-danger`):**
  - Se renderiza **exclusivamente** si el estado es `VIGENTE` (`r.estado === 'VIGENTE'`).
  - Para los estados `UTILIZADA`, `ANULADA` y `VENCIDA`, no se genera botón de acción (mostrando guion explicativo `—`), evitando cualquier intento de cancelación inválida desde la vista.

### 2.2. Modal de Confirmación Explícita (`#modal-anular`)
Ubicación en el DOM: `#modal-anular` (accesible mediante rol `dialog`, con fondo oscurecido `.modal-backdrop`).

- **Estructura estricta según §7.2 de la especificación:**
  - **Encabezado / Título:** `¿Seguro que deseas anular esta reserva?` (`#modal-anular-titulo`).
  - **Mensaje de advertencia:** `El pago será reembolsado y el espacio volverá a estar disponible.`
  - **Resumen contextual dinámico:** Bloque informativo con código, placa, tipo y monto exacto a reembolsar para evitar cancelaciones erróneas.
  - **Botón Confirmar (`#btn-confirmar-anular`):**
    - Ejecuta llamada asíncrona a `DELETE /api/reservas/:id`.
    - Presenta feedback inmediato con estado deshabilitado (`disabled = true`) y texto transitorio `Anulando...` para mitigar ataques de doble clic y garantizar idempotencia.
  - **Botón Cancelar (`#btn-cancelar-anular`):**
    - Cierra el modal de forma limpia sin generar cambios ni peticiones HTTP.

### 2.3. Sistema de Notificación y Feedback (`#toast-container`)
- **Éxito (200 OK):** Muestra notificación toast con el mensaje exacto exigido:  
  `"Reserva anulada y reembolso procesado"`
- **Error (400, 403, 409, 502):** Notificación toast roja con el mensaje devuelto por la API (`"Solo reservas vigentes pueden ser anuladas"`, `"No tiene permiso para anular esta reserva"`, etc.).
- **Actualización reactiva de estado:** Al confirmar la anulación, la interfaz recarga inmediatamente `cargarMisReservas()` actualizando la tarjeta a `ANULADA` y refresca el cálculo de disponibilidad pública (`cargarDisponibilidad()`).

---

## 3. Cumplimiento de Reglas de Negocio (RN-01 a RN-07)

| Regla | Descripción | Implementación Técnica |
|---|---|---|
| **RN-01** | Propiedad de la reserva | El backend verifica que `reserva.idUsuario === req.sesion.sub`. En caso contrario rechaza con HTTP `403 Forbidden`. |
| **RN-02** | Solo reservas en estado `VIGENTE` | Validación de estado en capa de negocio; si la reserva ya está `ANULADA`, `UTILIZADA` o `VENCIDA`, responde `409 Conflict`. En UI el botón solo existe si `estado === 'VIGENTE'`. |
| **RN-03** | Confirmación explícita mediante modal | Implementado en `#modal-anular` con botones de Confirmar y Cancelar, cumpliendo accesibilidad ARIA. |
| **RN-04** | Persistencia de datos de anulación | Se registra `fechaAnulacion = NOW()`, `estado = 'ANULADA'` y `idReembolsoStripe`. |
| **RN-05** | Reembolso automático vía Stripe (Test Mode) | Se invoca `reembolsarPaymentIntent` con clave de idempotencia `anular-reserva-${id}` para evitar reembolsos duplicados. |
| **RN-06** | Liberación inmediata de cupo en disponibilidad | La anulación decrementa automáticamente `reservasVigentes`, incrementando en +1 los cupos disponibles mostrados en tiempo real en la pantalla pública (`GET /api/publico/disponibilidad`). |
| **RN-07** | Control de fallos de pasarela | Si la pasarela de pagos rechaza el reembolso, la reserva permanece en `VIGENTE` y se devuelve error HTTP `502 Bad Gateway`. |

---

## 4. Endpoints y Contrato de Servicio

### `DELETE /api/reservas/:id` (y compatibilidad `POST /api/reservas/:id/anular`)
- **Headers:** `Authorization: Bearer <jwt_conductor>`
- **Parámetro de ruta:** `id` (Entero positivo).
- **Respuesta 200 OK:**
  ```json
  {
    "mensaje": "Reserva anulada y reembolso procesado",
    "reserva": {
      "id": 49,
      "estado": "ANULADA",
      "fechaAnulacion": "2026-11-22T17:12:49.000Z",
      "idReembolsoStripe": "re_pi_test_vigente_1001"
    }
  }
  ```

---

## 5. Evidencias de Pruebas en Tiempo Real (E2E)

Las capturas generadas por la suite de automatización E2E (`tests/test-anulacion-reservas-e2e.js`) han sido consolidadas en el directorio `docs/modulos/reservas/evidencias-anulacion/`:

### Evidencia 1: Disponibilidad Previa a la Anulación
> **Archivo:** `01_disponibilidad_previa_anulacion.png`  
> Muestra el estado del tablero público donde el cupo para automóviles se encuentra retenido por las reservas vigentes activas.

### Evidencia 2: Interfaz "Mis Reservas" con los 4 Estados
> **Archivo:** `02_interfaz_mis_reservas_4_estados.png`  
> Demuestra la coexistencia de los 4 estados requeridos:
> 1. `VIGENTE`: Presenta el botón destacado **"Anular reserva"** (`.btn-anular`).
> 2. `UTILIZADA`: Solo lectura, sin acción disponible.
> 3. `ANULADA`: Historial cancelado con registro de reembolso.
> 4. `VENCIDA`: Plazo expirado sin ingreso, botón inhabilitado.

### Evidencia 3: Modal de Confirmación Explícita
> **Archivo:** `03_modal_confirmacion_anulacion.png`  
> Muestra el diálogo modal `#modal-anular` con el mensaje explícito *"¿Seguro que deseas anular esta reserva? El pago será reembolsado y el espacio volverá a estar disponible"*, junto con el desglose del vehículo y los botones **Confirmar anulación** y **Cancelar**.

### Evidencia 4: Notificación Toast de Éxito y Cambio de Estado Reactivo
> **Archivo:** `04_anulacion_exitosa_toast_y_cambio_estado.png`  
> Muestra la notificación flotante `"Reserva anulada y reembolso procesado"`, el cierre inmediato del modal y la actualización de la tarjeta de reserva a estado `ANULADA`, desapareciendo el botón de anulación.

### Evidencia 5: Disponibilidad Pública Recalculada en Tiempo Real
> **Archivo:** `05_disponibilidad_recalculada_tiempo_real.png`  
> Evidencia que al anularse la reserva, la vista pública de disponibilidad recalcula y libera automáticamente el espacio libre (+1 cupo disponible), reflejando la consistencia total del sistema.
