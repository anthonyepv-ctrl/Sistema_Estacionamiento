# Documentación de Interfaces — Realizar Reserva Web (`UPAO-21` / Subtarea `UPAO-83`)

> **Historia de Usuario:** `UPAO-21` — Realizar reserva (5 Story Points)  
> **Subtarea Jira:** `UPAO-83` — Crear interfaz de registro/login de conductor, mis vehículos y reserva con Culqi Perú  
> **Guía Visual Aplicada:** Paleta `#1E3A8A` / `#F8FAFC` / `#F59E0B`, tipografías `Geist Sans` + `JetBrains Mono`

---

## 1. Registro y Autenticación de Conductor (`#view-login` / `#form-registro-conductor`)
- Accesible desde el botón **¿Eres conductor? Crear cuenta para reservar** dentro de la pantalla de inicio de sesión.
- Formulario con validación en cliente y servidor para:
  - **Nombre completo** (`#reg-nombre`, mínimo 3 caracteres).
  - **DNI** (`#reg-dni`, exactamente 8 dígitos).
  - **Celular** (`#reg-celular`, 9 dígitos iniciando en `9`).
  - **Usuario** (`#reg-usuario`) y **Contraseña** (`#reg-password`, mínimo 6 caracteres).
- Emite sesión inmediata con rol `CONDUCTOR` y redirige directo al portal de reservas (`#view-conductor-reservas`). Si el usuario llegó desde **Disponibilidad Pública** pulsando *Reservar espacio (Auto / Moto)*, tanto el inicio de sesión como el registro retornan automáticamente al panel de reservas con el tipo de vehículo preseleccionado.

---

## 2. Vista Principal de Reserva y Vehículos (`#view-conductor-reservas`)
- Distribución asimétrica `.tarifas-layout` (`3fr` / `2fr`) priorizando el objetivo principal del usuario:
  - **Columna principal (`1. Realizar Reserva Web`):** selector de vehículo registrado (`#reserva-vehiculo-select`), recuadro de adelanto vigente en formato `S/ 0.00` (mínimo `S/ 3.00`, `#box-resumen-adelanto`) y botón primario `#btn-preparar-pago`.
  - **Columna secundaria (`2. Mis Vehículos`):** alta de placas con formato automático SUNARP/MTC (`ABC-123` / `1234-5A`) y validación Poka-Yoke (`#form-vehiculo-conductor`), más listado con botón de eliminación controlada.

---

## 3. Modal Limpio de Pago con Culqi Perú (`#modal-pago-reserva`)
- Se despliega sobre fondo semitransparente (`.modal-backdrop`) al confirmar el resumen del vehículo a reservar.
- Presenta únicamente información comprensible para el cliente: placa y tipo seleccionado, **Total a pagar ahora (`S/ 0.00`)**, medios habilitados (tarjetas locales/internacionales y Yape desde `S/ 6.00`) y aviso transparente si aplica el mínimo en línea de `S/ 3.00`.
- Invoca **Culqi Checkout v4** mediante `public/js/pasarela-adapter.js` (`window.PasarelaPago.iniciarPago`) para tokenización PCI SAQ-A sin que el usuario pueda quedar bloqueado si cierra el modal de Culqi.

---

## 4. Panel de Pasarela de Pagos para el Dueño (`#view-pasarela-pagos`) y Navegación (`#app-sidebar`)
- **Autogestión sin intervención técnica (rol `DUENO`):**
  - **Columna 1 (`1. Credenciales API de Culqi`):** tarjeta de estado en vivo (`ACTIVA · MODO PRUEBA` / `PRODUCCIÓN` / `SIN CONFIGURAR`), origen (`Variables del servidor` o `Panel del Dueño`), llave pública y llave secreta enmascarada, más formulario para guardar llaves en PostgreSQL (`#input-pasarela-pk`, `#input-pasarela-sk`) o restaurar las del servidor (`#btn-restaurar-pasarela`).
  - **Columna 2 (`2. Guía Paso a Paso`):** 4 tarjetas numeradas escaneables con acceso directo a **CulqiPanel (`https://panel.culqi.com`)**, indicaciones para cuenta **RUC 10 / RUC 20** + habilitación de **Yape**, y bloque comparativo visual entre **Modo Integración** (`pk_test_` / `sk_test_`) y **Modo Producción** (`pk_live_` / `sk_live_`).
- **Navegación sin redundancia (`#app-sidebar`):** en `Menú Principal` la barra lateral permanece oculta; al entrar a cualquier módulo aparece al costado izquierdo como tarjetas compactas verticales (solo ícono SVG + título en MAYÚSCULAS), ordenadas según frecuencia de uso e importancia operativa por rol.
