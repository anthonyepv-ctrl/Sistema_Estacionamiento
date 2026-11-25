# Análisis y Diseño — Búsqueda y Confirmación de Reservas

## 1. Objetivo
Permitir al recepcionista y al dueño consultar reservas por código, placa, DNI o nombre del conductor, detectar automáticamente reservas vigentes al registrar un ingreso, proteger los cupos reservados frente a ingresos presenciales y descontar el adelanto al momento de la salida.

## 2. Flujos en Recepción

### Detección automática en Registrar Ingreso
1. El recepcionista digita la placa del vehículo (con o sin guion).
2. Si no existe una reserva vigente, el botón principal permanece en verde (Registrar Ingreso) y continúa el flujo habitual, validando que los vehículos en cochera más las reservas vigentes no superen el aforo.
3. Si existe una reserva vigente, aparece un aviso amarillo informativo con el código, conductor, adelanto pagado y hora límite, y el botón principal cambia a azul (Confirmar ingreso con reserva) para confirmar la llegada junto con las observaciones opcionales del vehículo.

### Búsqueda manual en Buscar Reservas
1. Desde el menú principal o la barra lateral, el operador abre Buscar Reservas.
2. Puede buscar por código de reserva, placa, DNI o nombre del conductor, y filtrar por estado (Todos, Vigentes, Utilizadas, Vencidas o Anuladas).
3. En las reservas vigentes se habilita la acción Confirmar para registrar el ingreso directamente.

## 3. Reglas de Negocio y Seguridad
- Búsqueda multicriterio: las consultas normalizan la placa (con o sin guion) y actualizan antes las reservas cuyo plazo de 30 minutos ya venció.
- Control de acceso: la consulta y confirmación de reservas están restringidas a los roles Recepcionista y Dueño; el rol Conductor recibe rechazo de acceso (403) y las solicitudes sin sesión se rechazan (401).
- Confirmación atómica: confirmar una llegada bloquea la operación de forma concurrente, valida que la reserva siga vigente y sin estadía activa, la marca como Utilizada y crea la estadía vinculada al adelanto.
- Protección de cupo: el ingreso presencial rechaza cualquier placa que ya tenga reserva vigente (409) e impide ocupar espacios reservados por conductores web.
- Descuento en salida: al cobrar la salida de una estadía originada en reserva, el sistema descuenta automáticamente el adelanto pagado del total calculado.
- Defensa contra abuso: el servidor aplica cabeceras de seguridad HTTP, límite de tamaño en solicitudes (100 KB), control de frecuencia por IP (429) y saneamiento de texto en pantalla contra XSS.

## 4. Endpoints Planificados

| Método | Ruta | Roles permitidos | Función |
| --- | --- | --- | --- |
| GET | /api/reservas/por-placa/:placa | Recepcionista, Dueño | Verifica si una placa tiene reserva vigente. |
| GET | /api/reservas | Recepcionista, Dueño | Busca reservas por código, placa, DNI o nombre y filtra por estado. |
| POST | /api/reservas/:id/confirmar | Recepcionista, Dueño | Confirma la llegada, marca la reserva como utilizada y abre la estadía. |

## 5. Casos de Prueba (Diseño)

| Código | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| CP-08-01 | Búsqueda por código, placa, DNI o nombre | Consulta con código, placa (con o sin guion), DNI o nombre | Devuelve las reservas coincidentes con vehículo, conductor, vigencia y estado actual. | Pendiente |
| CP-08-02 | Detección de reserva y botón unificado en Ingreso | Ingreso de placa con reserva vigente en el formulario de recepción | Muestra el aviso amarillo de reserva y cambia el botón principal a azul (Confirmar ingreso con reserva). | Pendiente |
| CP-08-03 | Confirmación de llegada y apertura de estadía | Confirmación de una reserva vigente desde recepción | Cambia la reserva a Utilizada e inicia una estadía activa vinculada al adelanto. | Pendiente |
| CP-08-04 | Descuento automático del adelanto en salida | Registro de salida sobre una estadía originada en reserva | Calcula el monto bruto, descuenta el adelanto pagado y cobra solo el saldo restante. | Pendiente |
| CP-08-05 | Ingreso normal bloqueado cuando existe reserva vigente | Intento de ingreso presencial con placa reservada o sin cupo libre | El servidor rechaza la solicitud (409) para no duplicar el registro ni perder el cupo reservado. | Pendiente |
| CP-08-06 | Confirmación rechazada en reserva no vigente | Intento de confirmar una reserva vencida, anulada o ya utilizada | El servidor rechaza la operación (409) sin crear estadía. | Pendiente |
| CP-08-07 | Búsqueda sin coincidencias | Consulta por un código o placa inexistente | Devuelve una lista vacía sin errores (200). | Pendiente |
| CP-08-08 | Bloqueo de fuerza bruta y saturación por bot | Ráfaga repetida de solicitudes en login o disponibilidad pública | El servidor bloquea el abuso con respuesta 429 y tiempo de espera. | Pendiente |
| CP-08-09 | Defensa ante cargas excesivas, inyección y acceso indebido | Solicitud mayor a 100 KB, intentos de SQLi/XSS o acceso con rol Conductor | El servidor rechaza cada intento (413, 400, 401 o 403) sin afectar datos ni sesiones. | Pendiente |
