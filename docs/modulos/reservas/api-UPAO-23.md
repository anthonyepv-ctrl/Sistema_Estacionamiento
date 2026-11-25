# Documentación de Backend y Seguridad — Historial de Estadías del Conductor

## 1. Endpoint Implementado
- GET /api/conductor/historial (rol exclusivo Conductor):
  - Obtiene el identificador del usuario directamente desde el token de sesión HMAC-SHA256.
  - Consulta únicamente las placas registradas a nombre de ese conductor en vehiculo_conductor.
  - Acepta filtros opcionales por estado (EN_COCHERA o FINALIZADA) y por placa dentro de sus propias placas.
  - Devuelve las estadías ordenadas descendentemente por hora de ingreso incluyendo tipo de vehículo, código de reserva vinculada, adelanto descontado, monto pagado y método de pago.

## 2. Controles de Seguridad
- La ruta está protegida mediante autenticación Bearer y autorización estricta para el rol Conductor en server.js.
- Peticiones sin sesión devuelven estado 401; otros roles devuelven estado 403.
- Aislamiento estricto por propietario: un conductor no puede consultar estadías de placas que no le pertenecen.
- En interfaz, los campos de tabla se sanean con escape HTML antes de insertarse en el DOM.

## 3. Código Fuente en GitHub

| Archivo | Responsabilidad | Enlace |
| --- | --- | --- |
| src/routes/conductor.js | Consulta de historial con aislamiento por usuario y filtro por estado | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/conductor.js) |
| server.js | Protección de /api/conductor para rol Conductor | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/server.js) |
| public/index.html | Vista de historial y selector de estado | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/index.html) |
| public/js/reservas.js | Carga, filtrado por estado y saneamiento XSS | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/reservas.js) |
