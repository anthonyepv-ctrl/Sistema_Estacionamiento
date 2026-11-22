# Análisis y Diseño – Historia de Usuario **Anular Reserva** (UPAO‑22)

> **Épica:** UPAO‑28 (Manejo de Reserva Web)  
> **Rol:** Conductor (usuario autenticado)  
> **Story Points:** 3 SP · Sprint 2

---

## 1. Objetivo y Alcance

- Permitir que un conductor cancele una reserva **únicamente cuando** la reserva está en estado **`VIGENTE`** y el conductor está autenticado.
- La cancelación debe ser **explícita** (modal de confirmación) y generar una **transición de estado** a `ANULADA`.
- Si la reserva ya había generado un pago mediante **Stripe (modo test)**, se debe **reembolsar** la cantidad completa.
- Tras la anulación, el **espacio se libera inmediatamente** y la disponibilidad pública debe reflejar el nuevo cupo.

---

## 2. Reglas de Negocio

| Regla | Descripción |
|-------|-------------|
| **RN‑01** | Sólo el **propietario** de la reserva (campo `idUsuario`) puede anularla. |
| **RN‑02** | La reserva debe estar en **estado `VIGENTE`**. Reservas en `ANULADA`, `FINALIZADA` o `EXPIRADA` no pueden ser anuladas. |
| **RN‑03** | La anulación se confirma mediante **modal** con dos botones (`Confirmar` / `Cancelar`). |
| **RN‑04** | Al confirmar, el sistema **cambia el estado** a `ANULADA`, registra `fechaAnulacion` y guarda `idReembolsoStripe` (si procede). |
| **RN‑05** | Si la reserva tiene `idPagoStripe` (pago completado), se invoca la **API de reembolso** de Stripe (test mode). El reembolso debe ser **idempotente**. |
| **RN‑06** | Después de la anulación, el contador de **`reservasVigentes`** disminuye en 1 y la disponibilidad pública (`GET /api/publico/disponibilidad`) se recalcula instantáneamente. |
| **RN‑07** | En caso de error de Stripe, la reserva **permanece en `VIGENTE`** y se devuelve un mensaje de error al usuario. |

---

## 3. Modelo de Datos (Prisma)

```prisma
model Reserva {
  id                Int       @id @default(autoincrement())
  placa             String    @db.VarChar(10)
  tipoVehiculoId    Int
  fechaInicio       DateTime
  fechaFin          DateTime
  estado            EstadoReserva @default(VIGENTE)
  idUsuario         Int
  idPagoStripe      String?   // Identificador del cargo en Stripe (opcional)
  idReembolsoStripe String?   // Identificador del reembolso (opcional)
  fechaAnulacion    DateTime? // Se llena al pasar a ANULADA

  // Relaciones
  usuario           Usuario   @relation(fields: [idUsuario], references: [id])
  tipoVehiculo      TipoVehiculo @relation(fields: [tipoVehiculoId], references: [id])
}

enum EstadoReserva {
  VIGENTE
  ANULADA
  FINALIZADA
  EXPIRADA
}
```

- **`fechaAnulacion`** y **`idReembolsoStripe`** son `null` mientras la reserva esté `VIGENTE`.
- Cuando se anula, se actualizan ambos campos.

---

## 4. Diseño de la API (REST)

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| `DELETE` | `/api/reservas/:id` | **Bearer token** (con rol `CONDUCTOR`) | Anula la reserva especificada. |

### 4.1. Request

- **Headers:** `Authorization: Bearer <jwt>`
- **Path param:** `id` → ID de la reserva a anular.

### 4.2. Response (éxitos)

- **200 OK**
```json
{
  "mensaje": "Reserva anulada y reembolso procesado",
  "reserva": {
    "id": 42,
    "estado": "ANULADA",
    "fechaAnulacion": "2026-11-21T20:55:10.000Z",
    "idReembolsoStripe": "re_1J2b5XYZ..."
  }
}
```

### 4.3. Response (errores típicos)

- **401 Unauthorized** – token ausente o inválido.
- **403 Forbidden** – el usuario no es el propietario de la reserva.
- **404 Not Found** – reserva inexistente.
- **409 Conflict** – reserva no está en estado `VIGENTE`.
- **502 Bad Gateway** – fallo al contactar Stripe (reembolso no completado).
- **500 Internal Server Error** – error inesperado.

---

## 5. Flujo de Anulación (Mermaid)

```mermaid
flowchart TD
    A[Usuario pulsa "Anular" en la tarjeta de reserva] --> B{¿Reserva en estado VIGENTE?}
    B -- No --> C[Mostrar mensaje "No se puede anular"]
    B -- Sí --> D[Abrir modal de confirmación]
    D --> E{¿Usuario confirma?}
    E -- No --> F[Cerrar modal]
    E -- Sí --> G[Validar token y propiedad]
    G --> H{¿Hay idPagoStripe?}
    H -- No --> I[Actualizar estado a ANULADA]
    H -- Sí --> J[Invocar Stripe API: POST /v1/refunds]
    J --> K{¿Reembolso OK?}
    K -- Sí --> L[Persistir idReembolsoStripe y fechaAnulacion]
    K -- No --> M[Rollback, devolver 502]
    L --> I
    I --> N[Decrementar reservasVigentes en espacio]
    N --> O[Responder 200 con reserva actualizada]
```

---

## 6. Detalle de la Lógica de Negocio (pseudocódigo)

```js
async function anularReserva(req, res) {
  const reservaId = Number(req.params.id);
  const usuarioId = req.user.id; // proviene del middleware auth

  // 1. Cargar reserva
  const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  // 2. Verificar propietario
  if (reserva.idUsuario !== usuarioId) {
    return res.status(403).json({ error: 'No tiene permiso para anular esta reserva' });
  }

  // 3. Verificar estado
  if (reserva.estado !== 'VIGENTE') {
    return res.status(409).json({ error: 'Solo reservas vigentes pueden ser anuladas' });
  }

  // 4. Si tiene pago en Stripe → intentar reembolso
  let idReembolso = null;
  if (reserva.idPagoStripe) {
    try {
      const refund = await stripe.refunds.create({
        charge: reserva.idPagoStripe,
        // opcional: metadata { reservaId: reserva.id }
      });
      idReembolso = refund.id;
    } catch (err) {
      console.error('Error Stripe refund', err);
      return res.status(502).json({ error: 'No se pudo procesar el reembolso' });
    }
  }

  // 5. Cambiar estado y persistir datos de anulación
  const now = new Date();
  const reservaActualizada = await prisma.reserva.update({
    where: { id: reservaId },
    data: {
      estado: 'ANULADA',
      fechaAnulacion: now,
      idReembolsoStripe: idReembolso,
    },
  });

  // 6. Liberar espacio (decrementar reservas vigentes)
  await actualizarDisponibilidad(reserva.tipoVehiculoId);

  return res.json({
    mensaje: 'Reserva anulada y reembolso procesado',
    reserva: reservaActualizada,
  });
}
```

> `actualizarDisponibilidad` recalcula `reservasVigentes` y actualiza la caché (si se usa). El cálculo se hace vía la fórmula descrita en la historia de disponibilidad.

---

## 7. Diseño de la Interfaz de Usuario

### 7.1. Tarjeta de Reserva (lista)
```html
<div class="card reserva-card" data-id="{{reserva.id}}">
  <h4>Reserva #{{reserva.id}}</h4>
  <p>Placa: {{reserva.placa}}</p>
  <p>Tipo: {{reserva.tipoVehiculo.nombre}}</p>
  <p>Periodo: {{reserva.fechaInicio}} → {{reserva.fechaFin}}</p>
  <p>Estado: <span class="badge {{reserva.estado | lower}}">{{reserva.estado}}</span></p>
  {{#if (eq reserva.estado "VIGENTE")}}
    <button class="btn-anular btn btn-danger" data-id="{{reserva.id}}">Anular</button>
  {{/if}}
</div>
```

- Botón `Anular` solo aparece cuando el estado es **VIGENTE**.
- Se utiliza la clase `btn-danger` (rojo) para indicar acción destructiva.

### 7.2. Modal de Confirmación
```html
<div id="modal-anular" class="modal" role="dialog" aria-hidden="true">
  <div class="modal-content">
    <h3>¿Seguro que deseas anular esta reserva?</h3>
    <p>El pago será reembolsado y el espacio volverá a estar disponible.</p>
    <button id="btn-confirmar-anular" class="btn btn-primary">Confirmar</button>
    <button id="btn-cancelar-anular" class="btn btn-secondary">Cancelar</button>
  </div>
</div>
```
- El modal se abre al hacer click en `btn-anular`.
- `Confirmar` dispara la llamada `DELETE /api/reservas/:id`.
- `Cancelar` cierra el modal sin acción.

### 7.3. Feedback al usuario
- **Éxito:** Toast verde → *"Reserva anulada y reembolso procesado"*.
- **Error:** Toast rojo con el mensaje devuelto por la API (p. ej., *"No tiene permiso"*, *"Fallo al reembolsar"*).
- Deshabilitar temporalmente el botón mientras la petición está en curso (`disabled` + spinner).

---

## 8. Integración con Stripe (Modo Test)

1. **Credenciales:** Usar la clave `sk_test_...` almacenada en variable de entorno `STRIPE_SECRET_KEY`.
2. **Librería:** `npm i stripe` y crear instancia `const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);`.
3. **Crear reembolso:** `stripe.refunds.create({ charge: <idPagoStripe> })`.
4. **Idempotencia:** Pasar el campo `idempotency_key: 'anular-reserva-' + reservaId` para evitar reembolsos duplicados si el cliente reintenta.
5. **Manejo de errores:** Capturar `StripeCardError`, `RateLimitError`, `APIConnectionError`, `InvalidRequestError` y devolver 502 con mensaje amigable.
6. **Test Mode:** Los pagos y reembolsos se generan en la red de pruebas; los fondos no se mueven realmente.

---

## 9. Seguridad y Auditoría

- **Autorización:** Middleware `auth` verifica JWT y coloca `req.user` (id, rol). Sólo usuarios con rol `CONDUCTOR` pueden acceder al endpoint.
- **Propiedad:** Se compara `reserva.idUsuario` con `req.user.id`.
- **Registro de eventos:** Cada anulación crea una entrada en tabla `log_eventos` (timestamp, usuario, acción, reservaId, idReembolso). Esto ayuda en auditorías y en caso de disputas de Stripe.
- **Rate limiting:** Limitar a 5 anulaciones por minuto por usuario (para evitar abusos).
- **Validación de entrada:** `id` debe ser entero positivo (`Number.isInteger`).

---

## 10. Pruebas (Casos de prueba principales)

| Caso | Input | Resultado esperado |
|------|-------|--------------------|
| **CT‑01** | Usuario propietario, reserva VIGENTE, pago Stripe presente | 200 OK, estado → ANULADA, `idReembolsoStripe` no nulo, disponibilidad incrementada. |
| **CT‑02** | Usuario no propietario | 403 Forbidden, mensaje *"No tiene permiso"*. |
| **CT‑03** | Reserva en estado `FINALIZADA` | 409 Conflict, *"Solo reservas vigentes pueden ser anuladas"*. |
| **CT‑04** | Reserva VIGENTE sin pago Stripe | 200 OK, solo cambio de estado, sin intento de reembolso. |
| **CT‑05** | Stripe devuelve error (p. ej. network) | 502 Bad Gateway, reserva **no** cambia de estado, mensaje *"No se pudo procesar el reembolso"*. |
| **CT‑06** | Token expirado / ausente | 401 Unauthorized. |
| **CT‑07** | Id de reserva no numérico (`"abc"`) | 400 Bad Request, *"ID de reserva debe ser numérico"*. |
| **CT‑08** | Doble click rápido en "Confirmar" | Solo se envía una petición (botón disabled) → idempotencia garantizada por Stripe. |

---

## 11. Impacto en Otros Módulos

- **Disponibilidad pública** (`GET /api/publico/disponibilidad`): al decrementar `reservasVigentes` se vuelve a calcular `disponibles`. El frontend que hace polling cada 30 s mostrará el nuevo cupo.
- **Dashboard del dueño**: la tabla de reservas mostrará el nuevo estado `ANULADA` y el ID de reembolso.
- **Reporte de ingresos**: los reembolsos aparecen como **devoluciones** y deben restarse al total recaudado.

---

## 12. Checklist de Implementación

- [ ] Añadir campo `estado` y enum `EstadoReserva` en `schema.prisma`.
- [ ] Ejecutar `prisma migrate dev` y generar cliente.
- [ ] Implementar endpoint `DELETE /api/reservas/:id` con la lógica mostrada.
- [ ] Añadir middleware de autenticación y autorización.
- [ ] Integrar SDK de Stripe (test mode) y manejar idempotencia.
- [ ] Crear componentes UI (botón, modal, toast) en `public/js/reservas.js`.
- [ ] Actualizar `public/css/style.css` con estilos para `modal-anular` y `btn-anular`. 
- [ ] Escribir pruebas unitarias (Jest) y E2E (Playwright) para los casos de la tabla de pruebas.
- [ ] Documentar en `docs/modulos/reservas/analisis.md` (este archivo) y en `plan-pruebas.md`.
- [ ] Realizar PR a `develop`, revisión de código y despliegue en ambiente **Blue**.

---

> **Con este análisis y diseño** el equipo tiene todo lo necesario para codificar, probar y desplegar la funcionalidad de **Anular Reserva** de forma segura y conforme a los requisitos del negocio.
