# Documentación de Interfaces — Búsqueda y Confirmación de Reservas en Garita (`UPAO-8` / Subtarea `UPAO-91`)

> **Historia de Usuario:** `UPAO-8` — Buscar reservas (2 Story Points · Sprint 3)  
> **Subtarea Jira:** `UPAO-91` — Crear interfaz de búsqueda de reservas y confirmación de ingreso en garita  
> **Referencia Técnica:** `docs/modulos/reservas/analisis-UPAO-8.md` y Guía de Estilos Corporativa (`Geist Sans`, `JetBrains Mono`, `#1E3A8A`, `#10B981`, `#F59E0B`, `#EF4444`, `#F3F4F6`)

---

## 1. Descripción General
Interfaces operativas para los roles **Recepcionista** y **Dueño** orientadas a detectar reservas vigentes al recibir un vehículo en garita y buscar/confirmar reservas manualmente sin demoras ni duplicación de estadías.

---

## 2. Componentes de Interfaz Implementados

### 2.1. Alerta Automática `RESERVADO` en Registrar Ingreso (`#view-ingreso`)
- Al digitar o perder foco en `#input-placa`, el sistema consulta `GET /api/reservas/por-placa/:placa` (normalizando guiones automáticamente).
- Si existe una reserva `VIGENTE`, despliega el banner `#aviso-reserva-ingreso` (ámbar `#F59E0B` / `#FFFBEB`) con:
  - Código de reserva (`#aviso-reserva-codigo`), nombre del conductor, monto de adelanto (`S/ 0.00`) y hora límite.
  - Deshabilitación preventiva del botón normal **Registrar Ingreso** (respaldada por `HTTP 409` en backend).
  - Botón directo **Confirmar ingreso con reserva** (`#btn-confirmar-reserva-ingreso`) para admitir el vehículo en 1 clic.

### 2.2. Buscador de Reservas en Garita (`#view-garita-reservas`)
- Accesible en 1 clic desde el menú lateral izquierdo (`#app-sidebar`) y desde el Menú Principal (`#card-modulo-garita-reservas`).
- **Barra de filtros (`#form-buscar-reservas-garita`):**
  - Campo de texto `#input-buscar-reserva-garita` para **Código, Placa, DNI o Nombre del Conductor**.
  - Selector `#select-estado-reserva-garita` (`Todos los estados`, `Vigentes`, `Utilizadas`, `Vencidas`, `Anuladas`) con recarga automática al cambiar.
  - Botones **Buscar Reserva** y **Limpiar**.
- **Tabla compacta de resultados (`#tbody-garita-reservas`):**
  - Presenta Código, Placa, Tipo, Conductor (DNI), Creación, Vence, Adelanto, Estado (badges semánticos) y Acción en Garita.
  - El botón **Confirmar Ingreso** (`.btn-confirmar-reserva-garita`) se muestra **exclusivamente** en reservas `VIGENTE`; para `UTILIZADA`, `ANULADA` y `VENCIDA` muestra `—`.
  - Renderizado saneado con `escaparHtml()` para neutralizar cualquier intento de XSS reflejado/almacenado en nombres o datos.

---

## 3. Evidencias Visuales (`docs/modulos/reservas/evidencias-garita/`)

1. **`01_alerta_reservado_en_ingreso.png`**: Aviso amarillo `RESERVADO` en `#view-ingreso` al digitar una placa con reserva vigente, bloqueando el ingreso normal.
2. **`02_garita_buscar_reservas_estados.png`**: Vista `#view-garita-reservas` filtrando al conductor con los 4 estados (`VIGENTE`, `UTILIZADA`, `ANULADA`, `VENCIDA`).
3. **`03_garita_filtro_vigente.png`**: Filtro de estado aplicado (`VIGENTE`) destacando la reserva habilitada para confirmar ingreso.
4. **`04_garita_confirmacion_exitosa.png`**: Confirmación exitosa con toast informativo y transición inmediata de la reserva a `UTILIZADA`.
5. **`05_salida_estadia_con_reserva.png`**: Vista `#view-salida` mostrando la estadía activa vinculada a la reserva y su adelanto listo para descontarse al cobrar.
