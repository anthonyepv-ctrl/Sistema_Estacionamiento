# Documentación de API, Backend y Seguridad — Búsqueda y Confirmación de Reservas

## 1. Endpoints de Búsqueda y Confirmación

### 1.1. `GET /api/reservas/por-placa/:placa` (`RECEPCIONISTA` | `DUENO`)
- Ejecuta `expirarReservasVencidas()`, normaliza la placa (`normalizarPlaca()` acepta con o sin guion) y retorna la reserva `VIGENTE` más reciente o `{ reserva: null }`.

### 1.2. `GET /api/reservas` (`RECEPCIONISTA` | `DUENO`)
- Ejecuta `expirarReservasVencidas()` antes de consultar.
- Filtra por `q` (coincidencia insensible a mayúsculas en `codigo`, `placa`, `placa normalizada`, `usuario.dni` y `usuario.nombre`) y por `estado` (`VIGENTE`, `UTILIZADA`, `ANULADA`, `VENCIDA`), ordenando por `fechaReserva DESC` (máximo 50 registros).

### 1.3. `POST /api/reservas/:id/confirmar` (`RECEPCIONISTA` | `DUENO`)
- Valida `id` numérico (`400`), ausencia de anulación en vuelo (`409`) y longitud de `nota <= 250` (`400`).
- Dentro de `prisma.$transaction`:
  1. Expira reservas vencidas.
  2. Adquiere `pg_advisory_xact_lock(LLAVE_LOCK_AFORO + idTipoVehiculo)` y `pg_advisory_xact_lock(780000::int, id::int)` en orden acíclico (eliminando carreras de doble clic y carreras contra anulación).
  3. Verifica `estado === 'VIGENTE'` (`409`), ausencia de estadía activa (`409`) y tarifa vigente (`500`).
  4. Actualiza `reserva.estado = 'UTILIZADA'` y crea `estadia` con `idReserva = reserva.id` y `nota`.

---

## 2. Protección de Cupo en Ingresos y Descuento en Salidas

- **`POST /api/ingresos`:**
  - Bloquea con `409 Conflict` el ingreso normal si la placa tiene una reserva `VIGENTE` activa.
  - Bajo `LLAVE_LOCK_AFORO`, verifica `estadiasActivas + reservasVigentesNoExpiradas < capacidadTipo`, impidiendo que ingresos presenciales (*walk-in*) ocupen espacios ya pagados mediante reserva web (`DEF-08-02`).
- **`POST /api/salidas`:**
  - Lee `estadia.reserva.montoAdelanto`, calcula `monto = max(0, montoBruto - adelantoReserva)` y retorna `montoBruto`, `adelantoReserva` y `monto` neto cobrado.

---

## 3. Endurecimiento de Seguridad Anti-Bot

- **Cabeceras HTTP defensivas:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictivo y eliminación de `X-Powered-By`.
- **Control de payload:** `express.json({ limit: '100kb' })` con manejador que retorna `HTTP 413` ante bombas JSON y `HTTP 400` limpio ante JSON malformado (sin fugas de stacktrace).
- **Rate limiting deslizante por IP (`HTTP 429` + `Retry-After`):**
  - `/api/auth`: `20 req/min` (`RATE_LIMIT_MAX_AUTH`) contra fuerza bruta.
  - `/api/publico`: `120 req/min` (`RATE_LIMIT_MAX_PUBLIC`) contra bots de saturación.
  - `/api`: `200 req/min` (`RATE_LIMIT_MAX_API`) sobre endpoints autenticados.
- **Sanitización en UI:** escape HTML (`escaparHtml`) en la tabla de resultados y botón de envío unificado en `#view-ingreso` conectado a `POST /api/reservas/:id/confirmar`.

---

## 4. Código Fuente en GitHub (`develop`)

| Archivo | Responsabilidad | Enlace en GitHub |
| --- | --- | --- |
| `src/routes/reservas.js` | Búsqueda multicriterio, detección por placa y confirmación atómica bajo lock | [Ver archivo](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reservas.js) |
| `src/routes/ingresos.js` | Bloqueo de duplicidad con reserva vigente y protección de cupo walk-in | [Ver archivo](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/ingresos.js) |
| `src/routes/salidas.js` | Descuento automático del adelanto de reserva al cobrar salida | [Ver archivo](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/salidas.js) |
| `src/middleware/seguridad.js` | Cabeceras defensivas, rate limiting por IP (`429`) y manejo de errores JSON (`413`/`400`) | [Ver archivo](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/middleware/seguridad.js) |
| `server.js` | Montaje de seguridad global, `trust proxy`, límite `100kb` y RBAC por ruta | [Ver archivo](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/server.js) |
| `public/js/app.js` y `public/js/reservas.js` | Botón unificado en ingreso, filtro instantáneo y escape XSS en tabla | [app.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/app.js) · [reservas.js](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/public/js/reservas.js) |
