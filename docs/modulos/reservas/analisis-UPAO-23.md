# Análisis y Diseño — Historial de Estadías y Estados del Conductor

## 1. Objetivo
Permitir al conductor autenticado consultar en tiempo real el historial cronológico de sus vehículos, diferenciando estadías en curso (En cochera) y finalizadas, junto con la reserva asociada, el adelanto descontado y el saldo pagado en salida, garantizando aislamiento estricto por usuario.

## 2. Flujo de Consulta

1. Desde el menú principal o la barra lateral, el conductor ingresa a Mi Historial de Estadías.
2. El sistema consulta el historial asociado únicamente a las placas registradas por ese conductor, ordenado desde el ingreso más reciente hasta el más antiguo.
3. El conductor puede filtrar por estado (Todos, En cochera o Finalizadas) y actualizar la vista bajo demanda.
4. Si el conductor aún no registra estadías, la tabla muestra un estado vacío claro sin exponer datos de otros usuarios.

## 3. Reglas de Negocio y Seguridad
- Aislamiento estricto: el endpoint identifica al conductor exclusivamente a partir del token de sesión firmado y filtra por las placas de su propiedad.
- Control de acceso: solo el rol Conductor puede consultar su historial; peticiones sin sesión reciben rechazo 401 y otros roles reciben rechazo 403.
- Trazabilidad financiera: cada fila muestra fecha y hora de ingreso, fecha y hora de salida (o En cochera si sigue activa), código de reserva vinculada cuando corresponda, adelanto abonado y monto cobrado en salida.
- Saneamiento en interfaz: los campos renderizados en la tabla aplican escape HTML para evitar inyección XSS y mantienen formato compacto en una sola línea.

## 4. Endpoint Planificado

| Método | Ruta | Rol permitido | Función |
| --- | --- | --- | --- |
| GET | /api/conductor/historial | Conductor | Lista estadías activas y finalizadas de las placas del conductor autenticado, con filtro opcional por estado o placa. |

## 5. Casos de Prueba (Diseño)

| Código | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| CP-23-01 | Historial cronológico de estadías activas y finalizadas | Conductor autenticado con estadía en cochera y estadía finalizada consulta su historial | Devuelve ambas estadías ordenadas descendentemente con estado En cochera / Finalizada, reserva, adelanto y pago en salida. | Pendiente |
| CP-23-02 | Conductor recién registrado sin movimientos | Conductor nuevo sin reservas ni estadías consulta su historial | Devuelve una lista vacía y muestra estado vacío sin errores ni filtraciones. | Pendiente |
| CP-23-03 | Filtro por estado en historial del conductor | Conductor autenticado filtra por estado En cochera o Finalizada | Devuelve únicamente las estadías correspondientes al estado seleccionado. | Pendiente |
| CP-23-04 | Rechazo sin sesión o acceso de rol no autorizado | Solicitud sin token o con sesión de Recepcionista o Dueño hacia el historial | El servidor rechaza con estado 401 sin token y 403 para roles distintos de Conductor. | Pendiente |
| CP-23-05 | Aislamiento estricto entre conductores | Conductor B consulta su historial existiendo estadías registradas del Conductor A | El historial de Conductor B nunca incluye vehículos ni estadías de Conductor A. | Pendiente |
