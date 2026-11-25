# Plan de Pruebas y Depuración — Búsqueda y Confirmación de Reservas

## 1. Alineación y Evaluación de Casos de Prueba

Cada caso de prueba definido en Análisis fue verificado mediante pruebas automatizadas de API, seguridad y navegador integradas en el flujo de integración continua.

| Código | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| CP-08-01 | Búsqueda por código, placa, DNI o nombre | La búsqueda localizó correctamente reservas por código, placa (con o sin guion), DNI y nombre, respetando el filtro de estado. | Aprobado |
| CP-08-02 | Detección de reserva y botón unificado en Ingreso | Al digitar una placa reservada, el sistema mostró el aviso amarillo de reserva y cambió el botón principal a azul sin duplicar controles. | Aprobado |
| CP-08-03 | Confirmación de llegada y apertura de estadía | La confirmación concurrente registró una única estadía vinculada, cambió la reserva a Utilizada y rechazó el intento duplicado (409). | Aprobado |
| CP-08-04 | Descuento automático del adelanto en salida | Al registrar la salida, el sistema aplicó el descuento completo del adelanto pagado y calculó correctamente el saldo restante. | Aprobado |
| CP-08-05 | Ingreso normal bloqueado con reserva vigente | El servidor rechazó con 409 el ingreso presencial de una placa reservada y protegió el último cupo frente a ingresos sin reserva. | Aprobado |
| CP-08-06 | Confirmación rechazada en reserva no vigente | Las reservas utilizadas o vencidas fueron rechazadas con 409; notas excesivas devolvieron 400 y registros inexistentes 404. | Aprobado |
| CP-08-07 | Búsqueda sin coincidencias | Una consulta por placa o código inexistente respondió correctamente con lista vacía (200) y sin errores. | Aprobado |
| CP-08-08 | Bloqueo de fuerza bruta y saturación por bot | Las ráfagas repetidas en inicio de sesión y disponibilidad pública fueron bloqueadas automáticamente con respuesta 429. | Aprobado |
| CP-08-09 | Defensa ante cargas excesivas, inyección y acceso indebido | Las cargas superiores a 100 KB devolvieron 413, los intentos de SQLi y XSS fueron neutralizados y el rol Conductor fue bloqueado con 403. | Aprobado |

## 2. Suites Automatizadas Ejecutadas

Todas las suites se ejecutan automáticamente en cada integración mediante GitHub Actions y se validaron localmente sin fallos:

| Suite | Cobertura | Resultado |
| --- | --- | --- |
| Pruebas unitarias de pasarela Culqi | Contrato de cobro, reembolso y cifrado de credenciales | 5/5 aprobado |
| Suite de anulación de reservas | Anulación atómica, concurrencia y reembolso | 7/7 aprobado |
| Suite de búsqueda y confirmación | Búsqueda, cupo protegido, confirmación concurrente, salida y roles | 8/8 aprobado |
| Suite integral Sprint 3 | Flujo completo de reservas, pagos, anulación y recepción | 21/21 aprobado |
| Suite de seguridad y ataque bot | Fuerza bruta (429), sobrecarga (413), JSON inválido (400), SQLi/XSS e IDOR | 8/8 aprobado |
| Suite de seguridad de API | Exigencia de sesión y permisos por rol en toda la API | 15/15 aprobado |
| Suite de no regresión | Módulos previos de ingresos, salidas, reportes y ocupación | 10/10 aprobado |
| Pruebas visuales E2E | Botón unificado en ingreso, tabla completa en una línea y confirmación | 5/5 aprobado |

## 3. Registro de Defectos

| Código | Defecto Detectado | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| DEF-08-01 | El ingreso normal permitía duplicar una placa reservada y la pantalla mostraba dos botones de envío | Faltaba validación de reserva vigente en ingresos y el aviso agregaba un segundo botón | Se añadió el rechazo 409 en backend y se unificó el botón principal (verde a azul) | Cerrado |
| DEF-08-02 | Un ingreso presencial podía ocupar el último espacio reservado por un conductor | El control de aforo solo contaba estadías activas sin sumar reservas vigentes | Se incluyeron las reservas vigentes dentro del cálculo de aforo bajo bloqueo concurrente | Cerrado |
| DEF-08-03 | Riesgo de XSS en tabla de resultados y falta de defensa ante bots o payloads excesivos | Renderizado sin escape HTML y ausencia de límites de frecuencia y tamaño de carga | Se aplicó saneamiento HTML en interfaz y middleware de seguridad en el servidor | Cerrado |

## 4. Respaldo en GitHub

- Orquestador de pruebas automatizadas: [scripts/run-all-tests.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/scripts/run-all-tests.js)
- Pruebas de búsqueda y confirmación: [tests/test-upao8-garita.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-upao8-garita.js)
- Pruebas de seguridad y ataque bot: [tests/test-ataque-bot.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-ataque-bot.js)
- Pruebas visuales E2E: [tests/test-upao8-garita-e2e.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-upao8-garita-e2e.js)
- Historial de ejecuciones automáticas (CI): [GitHub Actions](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions)
