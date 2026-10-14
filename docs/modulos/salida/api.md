# Módulo Salida — Especificación de API (UPAO-7)

Endpoints para el registro de salida y cobro de vehículos en cochera.

---

## 1. `POST /api/salidas`

Registra la salida del vehículo, calcula la permanencia y el cobro según la tarifa del ingreso, genera el registro de pago y desocupa la estadía.

### Request

- **Headers:** `Content-Type: application/json`
- **Body:**

```json
{
  "estadiaId": 1,
  "metodoPago": "Efectivo"
}
```

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `estadiaId` | Int | Sí (o `placa`) | ID de la estadía activa a finalizar. |
| `placa` | String | Opcional | Placa del vehículo si no se envía `estadiaId`. |
| `metodoPago` | String | Opcional (def: `Efectivo`) | Uno de: `Efectivo`, `Yape`, `POS`. |

### Response exitosa (`200 OK`)

```json
{
  "mensaje": "Salida registrada: Placa [ABC-123] · S/ 7.00 · Efectivo",
  "salida": {
    "idEstadia": 1,
    "placa": "ABC-123",
    "tipo": "Automóvil / Camioneta",
    "horaIngreso": "2026-10-11T16:00:00.000Z",
    "horaSalida": "2026-10-11T17:15:00.000Z",
    "tiempo": "1 h 15 min",
    "monto": 7.00,
    "metodoPago": "Efectivo",
    "idPago": 4
  }
}
```

### Respuestas de error

- `400 Bad Request`: Parámetros incompletos o método de pago inválido.
- `404 Not Found`: No se encontró estadía activa para ese vehículo.
- `500 Internal Server Error`: Tarifa no configurada o error en base de datos.

---

## 2. `GET /api/salidas/metodos-pago`

Obtiene la lista de métodos de pago disponibles en el sistema.

### Response exitosa (`200 OK`)

```json
[
  { "id": 1, "nombre": "Efectivo" },
  { "id": 2, "nombre": "Yape" },
  { "id": 3, "nombre": "POS" }
]
```
