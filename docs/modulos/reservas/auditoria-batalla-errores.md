# Auditoría Integral de Seguridad, Zonas Horarias y Estabilidad (Batalla de Errores)

Este documento registra los hallazgos, correcciones y casos de prueba ejecutados durante la auditoría intensiva de código sobre el Sistema de Gestión de Cochera, cubriendo backend, base de datos, frontend y pruebas automatizadas de extremo a extremo.

## 1. Registro de Defectos Detectados y Corregidos

| Código | Severidad | Módulo / Archivo | Descripción del defecto y causa raíz | Solución aplicada | Estado |
| --- | --- | --- | --- | --- | --- |
| DEF-AUD-01 | Crítica | Frontend (Aforo, Caja Diaria, Ocupación, Estadísticas) | Los cuatro módulos leían el token desde sessionStorage mientras el inicio de sesión lo guardaba en localStorage, provocando fallos 401 o pantallas vacías. | Se centralizó la lectura mediante window.obtenerTokenSesion en [app.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/app.js) y se conectaron los cuatro módulos. | Cerrado |
| DEF-AUD-02 | Crítica | Caja Diaria ([reportes.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/reportes.js)) | Ante ausencia de movimientos o fallo 401, el módulo mostraba placas y montos ficticios pregrabados en lugar de los datos reales. | Se eliminó por completo el arreglo de datos demostrativos; ahora muestra movimientos reales, estado vacío real o notificación de error. | Cerrado |
| DEF-AUD-03 | Alta | Zonas Horarias (Frontend y Backend) | Múltiples formateadores de fecha y hora omitían la zona America/Lima, el ciclo estricto de 24 horas h23 o usaban la zona local del servidor/navegador. | Se crearon utilidades unificadas en hora peruana (America/Lima, h23) en [app.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/app.js) y se corrigió el cálculo UTC en [reportes.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reportes.js). | Cerrado |
| DEF-AUD-04 | Crítica | Seguridad / RBAC ([server.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/server.js)) | Las rutas de tarifas, ingresos, salidas y espacios solo exigían sesión válida, permitiendo que un conductor invocara endpoints operativos internos. | Se restringió el acceso con autorizar para RECEPCIONISTA y DUENO en las cuatro rutas de [server.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/server.js). | Cerrado |
| DEF-AUD-05 | Alta | Contabilidad POS ([reportes.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reportes.js)) | Los cobros registrados con método POS aparecían en la tabla pero quedaban excluidos de totalGeneral, totalTransacciones y la barra digital. | Se sumó POS dentro de totalPos, dineroDigital y totalGeneral tanto en API como en la vista y filtros de Caja Diaria. | Cerrado |
| DEF-AUD-06 | Alta | Salida con Reserva ([app.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/app.js)) | La vista previa de Registrar Salida ignoraba el adelanto de reserva y calculaba con la tarifa actual en lugar de la tarifa fijada al ingreso. | Se aplicó la tarifa guardada en la estadía y se descontó adelantoReserva mostrando la fila de adelanto antes de confirmar. | Cerrado |
| DEF-AUD-07 | Alta | Validación de Placas ([reservas.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/reservas.js) y [placas.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/utils/placas.js)) | El campo de placa del conductor truncaba a 6 caracteres y cortaba en el índice 3, impidiendo placas de moto 1234-AB o ABC-1234; además el backend truncaba excesos en lugar de rechazar. | Se unificó la normalización MTC en cliente y se rechazaron longitudes menores a 6 o mayores a 7 caracteres antes de normalizar. | Cerrado |
| DEF-AUD-08 | Alta | Seguridad XSS (Frontend) | Interpolaciones dinámicas sin escapar en innerHTML para placas, tipos, nombres, códigos y mensajes de error. | Se centralizó window.escaparHtml y se aplicó en cada renderizado HTML dinámico de las vistas operativas y del conductor. | Cerrado |
| DEF-AUD-09 | Alta | Integridad de IDs y Fechas | Identificadores no numéricos, desbordes de entero de 32 bits y fechas inexistentes como 2026-02-30 provocaban errores HTTP 500 en Prisma/PostgreSQL. | Se creó [validaciones.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/utils/validaciones.js) con parsearIdEntero, parsearEnteroRango y esFechaValida para responder HTTP 400 limpio. | Cerrado |
| DEF-AUD-10 | Media | Auditoría de Ingresos ([ingresos.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/ingresos.js)) | El endpoint aceptaba idUsuario o usuario desde el cuerpo de la petición, permitiendo suplantación o fallo 500 con texto no numérico. | Se resolvió el operador exclusivamente desde el token autenticado req.sesion.sub. | Cerrado |
| DEF-AUD-11 | Media | Aforo e Inventario ([espacios.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/espacios.js)) | El aforo interno no descontaba reservas vigentes y PUT capacidad aceptaba booleanos, valores ilimitados o menores al aforo comprometido. | Se integraron las reservas vigentes y se validaron enteros entre 1 y 5000 mayores o iguales a ocupados más reservas. | Cerrado |
| DEF-AUD-12 | Media | Vehículos del Conductor ([conductor.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/conductor.js)) | Se permitía eliminar un vehículo mientras tenía una estadía activa en cochera, ocultándolo de su historial activo. | Se bloqueó la eliminación con HTTP 409 cuando existe una estadía con hora de salida nula para esa placa. | Cerrado |
| DEF-AUD-13 | Media | Autenticación y Tokens ([auth.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/config/auth.js) y [auth.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/auth.js)) | verificarToken ignoraba un tercer segmento en el token, el login hacía trim de la contraseña y se aceptaban claves mayores a 72 caracteres o símbolos HTML en el nombre. | Se exigió exactamente 2 segmentos en el token, límite de 72 caracteres, rechazo de ángulos en nombre y preservación exacta de la contraseña. | Cerrado |
| DEF-AUD-14 | Media | Limitador de Tasa ([seguridad.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/middleware/seguridad.js)) | El mapa en memoria de IPs no tenía tope máximo, exponiendo riesgo de agotamiento de memoria ante inundación de cabeceras. | Se incorporó tope máximo de 10000 entradas con limpieza automática de registros expirados y más antiguos. | Cerrado |
| DEF-AUD-15 | Media | Reservas y Confirmación ([reservas.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reservas.js)) | La confirmación en recepción convertía objetos nota a texto y no revalidaba fechaLimite bajo bloqueo; la creación recalculaba el adelanto dentro de la transacción. | Se rechazó nota no textual con HTTP 400, se validó expiración bajo advisory lock y se persistió el monto exacto cobrado en Culqi. | Cerrado |
| DEF-AUD-16 | Baja | Navegación y Sidebar ([app.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/app.js)) | Al abrir Aforo, Caja Diaria, Estadísticas u Ocupación, la barra lateral quedaba oculta y no se sincronizaba el estado de vista activa. | Se incorporaron las cuatro vistas dentro de mostrarPantalla y se enlazaron sus tarjetas y botones de retorno. | Cerrado |

## 2. Casos de Prueba de Auditoría Ejecutados

Suite automatizada: [test-auditoria-batalla.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-auditoria-batalla.js) (ejecutada con npm run test:auditoria y dentro de npm test).

| Código | Caso de prueba | Tipo | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| CP-AUD-01 | Bloqueo RBAC de rol CONDUCTOR en rutas operativas internas | Inválido / Seguridad | HTTP 403 en tarifas, ingresos, salidas y espacios | Aprobado |
| CP-AUD-02 | Token con 3 segmentos, contraseña mayor a 72 caracteres y HTML en nombre | Inválido / Seguridad | HTTP 401 para token alterado y HTTP 400 para credenciales y nombre malformados | Aprobado |
| CP-AUD-03 | Identificadores no numéricos o con desborde INT4 en salidas, tarifas, vehículos y reservas | Inválido / Estabilidad | HTTP 400 controlado sin errores HTTP 500 | Aprobado |
| CP-AUD-04 | Consulta de Caja Diaria con fecha inexistente 2026-02-30 | Inválido / Validación | HTTP 400 indicando formato o fecha inválida | Aprobado |
| CP-AUD-05 | Validación de placas AAA-000 y exceso de dígitos en ingresos; soporte de placas de moto | Límite / Validación | HTTP 400 en ingresos inválidos; normalización correcta de 1234-AB y ABC-1234 | Aprobado |
| CP-AUD-06 | Intento de suplantación de operador mediante idUsuario y usuario en POST ingresos | Inválido / Seguridad | El ingreso se registra con el usuario autenticado de la sesión | Aprobado |
| CP-AUD-07 | Cobro mediante POS y salida por placa sin guion reflejados en Caja Diaria | Válido / Contabilidad | Salida normalizada, movimiento POS visible y suma exacta en totalGeneral | Aprobado |
| CP-AUD-08 | Intento de eliminar vehículo del conductor con estadía activa en cochera | Inválido / Integridad | HTTP 409 bloqueando la eliminación hasta cerrar la estadía | Aprobado |
| CP-AUD-09 | Aforo interno con reservas vigentes y validación de límites de capacidad entre 1 y 5000 | Válido y Límite | Descuento de reservas vigentes y rechazo HTTP 400 ante booleanos o exceso | Aprobado |
| CP-AUD-10 | Confirmación de reserva rechazando nota tipo objeto y vinculando adelanto en estadía | Inválido y Válido | HTTP 400 ante nota objeto; HTTP 201 y vínculo de adelanto ante nota válida | Aprobado |
| CP-AUD-11 | Flujo E2E en navegador UTC: Aforo, Caja Diaria sin mock, Estadísticas, Ocupación, Salida con adelanto y placa moto de 7 caracteres | Válido / E2E | Cargas reales sin errores JS, horas en America/Lima h23, saldo S/ 0.00 en primera hora y placa ABC-1234 aceptada | Aprobado |

## 3. Evidencia de Ejecución Integral

Ejecución local completa mediante npm test (9 de 9 suites aprobadas en 387.3s):
1. Culqi Unitaria y Cifrado AES-256-GCM: Aprobado (5/5)
2. UPAO-22 Anulación, Concurrencia y Reembolso: Aprobado (7/7)
3. UPAO-8 Búsqueda en Recepción, Confirmación y Descuento: Aprobado (8/8)
4. UPAO-23 Historial de Estadías del Conductor: Aprobado (5/5)
5. Sprint 3 Integral: Aprobado (21/21)
6. Seguridad / Ataque Bot: Aprobado (8/8)
7. Seguridad de API: Aprobado (15/15)
8. No Regresión Sprints 1 y 2: Aprobado (11/11)
9. Auditoría Batalla de Errores (Backend y E2E Playwright): Aprobado (11/11)
