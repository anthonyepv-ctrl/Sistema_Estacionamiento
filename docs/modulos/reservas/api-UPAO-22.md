# Documentación de API y Backend — Anulación de Reserva (`UPAO-22` / Subtarea `UPAO-88`)

> **Historia de Usuario:** `UPAO-22` — Anular reserva (3 Story Points · Sprint 3)  
> **Subtarea Jira:** `UPAO-88` — Programar listado de reservas del conductor y anulación con reembolso Culqi Perú  
> **Pasarela Activa:** **Culqi Perú** (`POST https://api.culqi.com/v2/refunds` mediante adaptador agnóstico `src/payments/`)

---

## 1. Endpoints Implementados (`src/routes/reservas.js`)

### 1.1. `GET /api/reservas/mias` (Rol `CONDUCTOR`)
- Ejecuta `expirarReservasVencidas()` (vencimiento perezoso de reservas `VIGENTE` con `fechaLimite < NOW()`).
- Retorna las reservas del conductor autenticado (`where: { idUsuario: req.sesion.sub }`) ordenadas por `fechaReserva DESC`, incluyendo `codigo`, `placa`, `tipo`, `estado`, `estadoPago`, `montoAdelanto`, `pasarelaProveedor`, `pasarelaPagoId`, `pasarelaReembolsoId`, `fechaReserva`, `fechaLimite` y `fechaAnulacion`.

### 1.2. `DELETE /api/reservas/:id` y `POST /api/reservas/:id/anular` (Rol `CONDUCTOR`)
Ambos endpoints invocan `anularReservaHandler`, protegido con control de acceso por rol (`autenticar` + `autorizar('CONDUCTOR')`), bloqueo rápido en memoria (`anulacionesEnCurso`) y exclusión mutua transaccional en PostgreSQL:

1. **Validación de entrada:** `id` debe ser entero positivo (`400 Bad Request` si es inválido).
2. **Bloqueo por reserva sin bloquear garita walk-in:** dentro de `prisma.$transaction(..., { maxWait: 10000, timeout: 30000 })`, adquiere `SELECT pg_advisory_xact_lock(780000::int, id::int)`. El endpoint `POST /api/reservas/:id/confirmar` adquiere el mismo lock por reserva inmediatamente después de `LLAVE_LOCK_AFORO`, garantizando una jerarquía acíclica (sin deadlocks) y exclusión mutua total entre anulación y confirmación en garita sin frenar ingresos walk-in (`POST /api/ingresos`).
3. **Validaciones bajo lock:**
   - Existencia (`404 Not Found`).
   - Propiedad (`resLock.idUsuario === req.sesion.sub`, sino `403 Forbidden`).
   - Estado `VIGENTE` (`409 Conflict` si es `UTILIZADA`, `ANULADA` o `VENCIDA`).
   - Expiración (`fechaLimite < NOW()`): persiste `estado: 'VENCIDA'` y retorna `{ expirada: true }` (evitando rollback de Prisma) para responder `409 Conflict` sin reembolsar.
   - Coincidencia de proveedor (`pasarelaProveedor === proveedorActivo`, sino `409 Conflict`).
4. **Reembolso idempotente en Culqi Perú (`src/payments/culqi.js`):**
   - Si existe `pasarelaPagoId` y no existe `pasarelaReembolsoId`, llama a `reembolsarCargo()` → `POST /v2/refunds` con `{ charge_id, amount, reason: 'solicitud_comprador' }` y cabecera `Idempotency-Key: refund-res-<id>`.
   - Valida `amount > 0`, timeout `AbortController` (`20 s`, estrictamente menor al timeout de transacción `30 s`) y presencia de `data.id` en la respuesta.
   - Si Culqi falla o rechaza (`4xx`/`5xx`), retorna HTTP `502 Bad Gateway` (`504` ante timeout/red) y la reserva permanece intacta en `VIGENTE`.
5. **Persistencia final:** actualiza `estado = 'ANULADA'`, `fechaAnulacion = NOW()`, `estadoPago = reembolso ? 'REEMBOLSADO' : resLock.estadoPago` y `pasarelaReembolsoId`.

---

## 2. Integración Frontend (`public/js/reservas.js`)
- El modal `#modal-anular` toma una instantánea de la reserva objetivo, bloquea `#btn-confirmar-anular` y `#btn-cancelar-anular` mientras corre `DELETE /api/reservas/:id` (`timeoutMs: 25000`).
- Ante timeout o caída de red en proxy, verifica automáticamente `GET /api/reservas/mias` y, si la reserva ya cambió a `ANULADA`, cierra el modal y actualiza la UI sin obligar a recargar.
- Refresca `cargarMisReservas()` y la disponibilidad pública con `window.disponibilidadModulo.recargar()`.

---

## 3. Archivos Clave
- `src/routes/reservas.js` (`anularReservaHandler`, lock `(780000::int, id::int)` en anular y confirmar)
- `src/payments/culqi.js` (`llamarCulqi` con `errorStatus4xx`, `reembolsar` con validación de `amount` y `data.id`)
- `public/js/reservas.js` (modal `#modal-anular`, recuperación de timeout y `disponibilidadModulo.recargar()`)
- `public/css/style.css` (vista adaptativa `.reservas-vista-desktop` / `.reservas-vista-movil` y tokens `--text` / `--text2`)
