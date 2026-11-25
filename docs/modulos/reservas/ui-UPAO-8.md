# Documentación de Interfaces — Búsqueda y Confirmación de Reservas

## 1. Descripción General
Interfaces operativas para los roles **Recepcionista** y **Dueño** enfocadas en velocidad de atención en recepción: detección directa de reservas en el formulario de ingreso sin controles duplicados ni textos redundantes, y módulo dedicado **Buscar Reservas** para consultas y filtrado por estado.

---

## 2. Componentes de Interfaz Implementados

### 2.1. Detección `RESERVADO` con botón unificado en Registrar Ingreso (`#view-ingreso`)
- Interfaz limpia sin textos instructivos redundantes (etiquetas directas, placeholder conciso y contador `0/250`).
- Al digitar o perder foco en `#input-placa`, consulta `GET /api/reservas/por-placa/:placa` (normalizando guiones).
- Si existe una reserva `VIGENTE`:
  - Muestra el aviso informativo `#aviso-reserva-ingreso` (ámbar `#F59E0B` / `#FEF3C7`) con el código de reserva, conductor, adelanto pagado (`S/ 0.00`) y hora límite.
  - **Botón principal unificado (`#btn-registrar-ingreso`):** en lugar de duplicar botones, el botón principal cambia automáticamente de verde (`Registrar Ingreso`) a azul corporativo (`#1E3A8A`, `Confirmar ingreso con reserva`) y envía la confirmación a `POST /api/reservas/:id/confirmar` incluyendo la observación opcional del vehículo.
  - Al limpiar el formulario o ingresar una placa sin reserva, el botón vuelve a verde (`Registrar Ingreso`).

### 2.2. Módulo Buscar Reservas (`#view-garita-reservas`)
- Accesible en 1 clic desde el menú lateral (`#app-sidebar`) y desde el Menú Principal (`#card-modulo-garita-reservas`).
- **Barra de filtros (`#form-buscar-reservas-garita`):**
  - Campo `#input-buscar-reserva-garita` para buscar por **Código, Placa, DNI o Nombre**.
  - Selector `#select-estado-reserva-garita` (`Todos`, `Vigentes`, `Utilizadas`, `Vencidas`, `Anuladas`) con filtrado instantáneo al cambiar.
  - Botones **Buscar** y **Limpiar**.
- **Tabla compacta de una sola línea (`#tbody-garita-reservas`):**
  - Columnas: `Código`, `Placa`, `Tipo`, `Conductor / DNI`, `Creación`, `Vence`, `Adelanto`, `Estado` y `Acción`, ajustadas para visualizarse completas en una línea horizontal sin desborde (`1280px`).
  - El botón **Confirmar** (`.btn-confirmar-reserva-garita`) se muestra exclusivamente en reservas `VIGENTE`; para los demás estados muestra `—`.
  - Renderizado saneado con `escaparHtml()` para evitar XSS en celdas.

---

## 3. Evidencias Visuales (`docs/modulos/reservas/evidencias-garita/`)

1. **`01_alerta_reservado_en_ingreso.png`**: Formulario `#view-ingreso` limpio con el aviso informativo `RESERVADO` y el botón principal único en azul (`Confirmar ingreso con reserva`).
2. **`02_garita_buscar_reservas_estados.png`**: Vista `#view-garita-reservas` mostrando filas completas en una línea horizontal con los 4 estados (`VIGENTE`, `UTILIZADA`, `ANULADA`, `VENCIDA`).
3. **`03_garita_filtro_vigente.png`**: Filtro de estado aplicado (`VIGENTE`) destacando la reserva lista para confirmar.
4. **`04_garita_confirmacion_exitosa.png`**: Confirmación exitosa con toast y cambio inmediato de estado a `UTILIZADA`.
5. **`05_salida_estadia_con_reserva.png`**: Vista `#view-salida` mostrando la estadía activa vinculada a la reserva y lista para descontar el adelanto al cobrar.
