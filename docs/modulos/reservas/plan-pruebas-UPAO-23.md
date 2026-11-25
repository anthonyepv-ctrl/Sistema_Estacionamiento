# Plan de Pruebas y Depuración — Historial de Estadías del Conductor

## 1. Alineación y Evaluación de Casos de Prueba

| Código | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| CP-23-01 | Historial cronológico de estadías activas y finalizadas | El servicio devolvió ambas estadías ordenadas descendentemente, mostrando el estado En cochera con su código de reserva y adelanto, y la estadía Finalizada con su pago en salida. | Aprobado |
| CP-23-02 | Conductor recién registrado sin movimientos | El servicio devolvió una lista vacía sin errores y la tabla mostró el mensaje de estado vacío sin filtraciones. | Aprobado |
| CP-23-03 | Filtro por estado en historial del conductor | Al seleccionar En cochera o Finalizadas, la vista y el endpoint filtraron correctamente las filas mostradas. | Aprobado |
| CP-23-04 | Rechazo sin sesión o acceso de rol no autorizado | Las solicitudes sin sesión fueron rechazadas con estado 401 y los intentos con rol Recepcionista o Dueño recibieron rechazo 403. | Aprobado |
| CP-23-05 | Aislamiento estricto entre conductores | Al consultar el historial del Conductor B, no se incluyó ningún vehículo ni estadía perteneciente al Conductor A. | Aprobado |

## 2. Suites Automatizadas Ejecutadas

| Suite | Cobertura | Resultado |
| --- | --- | --- |
| Suite de historial del conductor | Historial cronológico, estado vacío, filtros, aislamiento y RBAC | 5/5 aprobado |
| Pruebas visuales E2E de historial | Tabla en una sola línea sin desborde y filtros de estado | 3/3 aprobado |
| Batería completa del sistema | Culqi unitaria, UPAO-22, UPAO-8, UPAO-23, Sprint 3, Bot/Atacante, RBAC y No Regresión | 8/8 aprobado |

## 3. Registro de Defectos

| Código | Defecto Detectado | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| DEF-23-01 | Falta de filtro de estado y escape HTML en filas del historial del conductor | La tabla renderizaba campos directos en HTML y no contaba con selector por estado | Se agregó filtro por estado en backend y frontend, formato compacto en una línea y saneamiento HTML | Cerrado |

## 4. Respaldo en GitHub

- Suite de pruebas del historial: [tests/test-upao23-historial.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-upao23-historial.js)
- Pruebas visuales E2E del historial: [tests/test-upao23-historial-e2e.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-upao23-historial-e2e.js)
- Orquestador de pruebas automatizadas: [scripts/run-all-tests.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/scripts/run-all-tests.js)
- Historial de ejecuciones automáticas (CI): [GitHub Actions](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions)
