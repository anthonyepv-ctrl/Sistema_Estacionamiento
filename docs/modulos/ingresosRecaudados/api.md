# Módulo Reporte de Ingresos — Especificación de API (UPAO-54 / UPAO-17)

Endpoints backend para la consulta, agregación y cuadre de caja de la recaudación diaria por método de pago.

---

## 1. `GET /api/reportes/diario`

Consulta los cobros registrados en la base de datos dentro del rango de una fecha específica (calculada en zona horaria peruana `America/Lima`, UTC-5). Suma los montos cobrados en la tabla de salidas y los agrupa por método de pago para el cuadre entre dinero físico y digital.

### Request

- **Headers:** `Accept: application/json`
- **Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `fecha` | String | Opcional | Fecha de consulta en formato `YYYY-MM-DD`. Si se omite, toma la fecha actual en Perú. |

#### Ejemplo de llamada:
```http
GET /api/reportes/diario?fecha=2026-10-14 HTTP/1.1
Host: localhost:3000
Accept: application/json
```

---

### Response Exitosa (`200 OK`)

```json
{
  "fecha": "2026-10-14",
  "fechaFormateada": "14/10/2026",
  "cuadre": {
    "dineroFisico": {
      "metodo": "Efectivo",
      "descripcion": "Efectivo en caja física para arqueo",
      "total": 542.40,
      "cantidadCobros": 5,
      "porcentaje": 100.0
    },
    "dineroDigital": {
      "metodo": "Yape",
      "descripcion": "Cobros digitales para contrastar en app Yape / banco",
      "total": 0.00,
      "cantidadCobros": 0,
      "porcentaje": 0.0
    },
    "totalGeneral": 542.40,
    "totalTransacciones": 5,
    "estadoCuadre": "CON_MOVIMIENTOS"
  },
  "totalEfectivo": 542.40,
  "totalYape": 0.00,
  "totalGeneral": 542.40,
  "movimientos": [
    {
      "id": 10,
      "placa": "WAS-A12",
      "tipoVehiculo": "Motocicleta",
      "horaSalida": "07:33",
      "metodoPago": "Efectivo",
      "monto": 16.50
    },
    {
      "id": 9,
      "placa": "TRA-GA6",
      "tipoVehiculo": "Motocicleta",
      "horaSalida": "07:33",
      "metodoPago": "Efectivo",
      "monto": 16.50
    },
    {
      "id": 8,
      "placa": "G7Y-UAW",
      "tipoVehiculo": "Automóvil / Camioneta",
      "horaSalida": "07:29",
      "metodoPago": "Efectivo",
      "monto": 505.40
    }
  ]
}
```

---

### Caso sin Movimientos (`200 OK`)

Cuando no existan cobros registrados en la fecha consultada:

```json
{
  "fecha": "2026-10-01",
  "fechaFormateada": "01/10/2026",
  "cuadre": {
    "dineroFisico": {
      "metodo": "Efectivo",
      "descripcion": "Efectivo en caja física para arqueo",
      "total": 0.00,
      "cantidadCobros": 0,
      "porcentaje": 0.0
    },
    "dineroDigital": {
      "metodo": "Yape",
      "descripcion": "Cobros digitales para contrastar en app Yape / banco",
      "total": 0.00,
      "cantidadCobros": 0,
      "porcentaje": 0.0
    },
    "totalGeneral": 0.00,
    "totalTransacciones": 0,
    "estadoCuadre": "SIN_MOVIMIENTOS"
  },
  "totalEfectivo": 0.00,
  "totalYape": 0.00,
  "totalGeneral": 0.00,
  "movimientos": []
}
```

---

### Respuestas de Error

#### 1. Formato de fecha inválido (`400 Bad Request`)
```json
{
  "error": "Formato de fecha inválido. Utilice el formato YYYY-MM-DD."
}
```

#### 2. Fecha futura bloqueada (`400 Bad Request`)
```json
{
  "error": "Seleccione una fecha válida que no sea futura."
}
```

#### 3. Error interno del servidor (`500 Internal Server Error`)
```json
{
  "error": "No se pudo cargar la recaudación. Intente nuevamente."
}
```

---

## 2. Reglas de Negocio y Lógica de Cuadre

1. **Zona Horaria:** Todas las consultas se restringen entre `T00:00:00-05:00` y `T23:59:59.999-05:00` para garantizar que la agrupación pertenezca al día calendario de Perú sin desfases UTC.
2. **Desglose Físico vs. Digital:**  
   - `Efectivo`: Se destina al **arqueo físico** de la caja registradora.
   - `Yape`: Se destina a la conciliación con la cuenta bancaria / aplicativo digital.
3. **Monto Total General:** Representa la suma exacta de todos los cobros (`totalEfectivo + totalYape`), expresada en soles peruanos con dos decimales (`Decimal(10,2)`).
4. **Ordenamiento:** Las transacciones se devuelven ordenadas cronológicamente de forma descendente (del cobro más reciente al más antiguo).
