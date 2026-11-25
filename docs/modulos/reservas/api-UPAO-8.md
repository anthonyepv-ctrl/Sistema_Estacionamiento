# Documentación de Backend y Seguridad — Búsqueda y Confirmación de Reservas

## 1. Servicios de Búsqueda y Confirmación
- Detección por placa (GET /api/reservas/por-placa/:placa): vence reservas expiradas, normaliza la placa con o sin guion y devuelve la reserva vigente activa si existe.
- Consulta multicriterio (GET /api/reservas): busca coincidencias por código, placa normalizada, DNI o nombre del conductor y permite filtrar por estado, ordenando por fecha de creación descendente.
- Confirmación de llegada (POST /api/reservas/:id/confirmar): valida parámetros, ejecuta la operación dentro de una transacción con bloqueo concurrente para evitar doble confirmación o conflicto con anulaciones, marca la reserva como Utilizada y crea la estadía vinculada junto con la observación opcional.

## 2. Integración con Ingresos y Salidas
- Ingresos (POST /api/ingresos): rechaza con estado 409 el ingreso presencial de una placa con reserva vigente y contabiliza las reservas activas dentro del control de aforo para proteger los espacios ya pagados.
- Salidas (POST /api/salidas): recupera el adelanto asociado a la reserva vinculada, lo descuenta del monto total calculado y devuelve el desglose entre monto bruto, adelanto y saldo cobrado.

## 3. Seguridad y Control de Abuso
- Cabeceras defensivas HTTP activas y eliminación de la cabecera que expone la tecnología del servidor.
- Límite de tamaño de solicitud en 100 KB con respuestas limpias ante cargas excesivas (413) o JSON malformado (400).
- Control de frecuencia por IP con respuesta 429 y cabecera de espera en rutas de autenticación, consulta pública y API interna.
- Escape HTML en el renderizado de resultados de la tabla de recepción y unificación del envío en el formulario de ingreso.

## 4. Código Fuente en GitHub

| Archivo | Responsabilidad | Enlace |
| --- | --- | --- |
| src/routes/reservas.js | Búsqueda multicriterio, detección por placa y confirmación atómica | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reservas.js) |
| src/routes/ingresos.js | Bloqueo de ingreso duplicado y protección de cupo reservado | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/ingresos.js) |
| src/routes/salidas.js | Descuento automático del adelanto en el cobro de salida | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/salidas.js) |
| src/middleware/seguridad.js | Cabeceras defensivas, límite por IP (429) y control de errores JSON | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/middleware/seguridad.js) |
| server.js | Configuración global de seguridad, límite de carga y control de roles | [Ver en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/server.js) |
| public/js/app.js y public/js/reservas.js | Botón unificado de ingreso, filtros y saneamiento XSS en tabla | [app.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/app.js) / [reservas.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/reservas.js) |
