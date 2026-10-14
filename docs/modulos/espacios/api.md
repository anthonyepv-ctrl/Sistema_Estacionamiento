# Módulo Espacios — Especificación de API (UPAO-11 / UPAO-49)

Endpoints para la consulta del estado de espacios, aforo y configuración de capacidad de la cochera.

---

## 1. `GET /api/espacios`

Consulta el estado actualizado del aforo y de los espacios en tiempo real. La disponibilidad es calculada dinámicamente restando las estadías activas (`hora_salida IS NULL`) de la capacidad total configurada para cada categoría (Autos y Motos).

### Request

- **Método:** `GET`
- **Headers:** `Content-Type: application/json`

### Response exitosa (`200 OK`)

```json
{
  "autos": {
    "capacidad": 10,
    "ocupados": 4,
    "disponibles": 6,
    "porcentaje": 40
  },
  "motos": {
    "capacidad": 10,
    "ocupados": 0,
    "disponibles": 10,
    "porcentaje": 0
  },
  "total": {
    "capacidad": 20,
    "ocupados": 4,
    "disponibles": 16,
    "porcentaje": 20
  },
  "nivelAforo": "DISPONIBLE"
}
```

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `autos.capacidad` | Int | Cupos totales para automóviles y camionetas. |
| `autos.ocupados` | Int | Vehículos actualmente en cochera (`hora_salida IS NULL`). |
| `autos.disponibles` | Int | Cupos libres (`capacidad - ocupados`). |
| `autos.porcentaje` | Int | Porcentaje de ocupación del sector autos. |
| `motos.*` | Int | Mismos campos para el sector de motocicletas. |
| `total.*` | Int | Resumen general consolidado de toda la cochera. |
| `nivelAforo` | String | Indicador de semáforo: `DISPONIBLE` (<80%), `MEDIO` (>=80%) o `LLENO` (100% o sin cupos). |

---

## 2. `PUT /api/espacios/capacidad`

Permite al dueño configurar la capacidad máxima de vehículos (autos y motos) para la cochera.

### Request

- **Método:** `PUT`
- **Headers:** `Content-Type: application/json`
- **Body:**

```json
{
  "capacidadAutos": 15,
  "capacidadMotos": 12
}
```

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `capacidadAutos` | Int | Opcional | Nueva capacidad máxima de autos (entero > 0). |
| `capacidadMotos` | Int | Opcional | Nueva capacidad máxima de motos (entero > 0). |

*Al menos uno de los campos debe enviarse en la solicitud.*

### Response exitosa (`200 OK`)

```json
{
  "mensaje": "Capacidad de espacios actualizada correctamente.",
  "capacidad": {
    "capacidadAutos": 15,
    "capacidadMotos": 12
  },
  "estado": {
    "autos": { "capacidad": 15, "ocupados": 4, "disponibles": 11, "porcentaje": 27 },
    "motos": { "capacidad": 12, "ocupados": 0, "disponibles": 12, "porcentaje": 0 },
    "total": { "capacidad": 27, "ocupados": 4, "disponibles": 23, "porcentaje": 15 },
    "nivelAforo": "DISPONIBLE"
  }
}
```

### Respuestas de error

- `400 Bad Request`: Parámetros inválidos (no enteros, <= 0) o intento de fijar una capacidad inferior a la cantidad de vehículos actualmente dentro de la cochera.
- `500 Internal Server Error`: Error al persistir la configuración.

---

## 3. Reglas de negocio e integración automática

1. **Sin asignación individual de plazas:** El conductor ingresa y estaciona libremente en cualquier espacio disponible.
2. **Control en Ingreso (`POST /api/ingresos`):** Al registrar una entrada (HU-01), el sistema valida si `disponibles > 0` para el tipo de vehículo. Si el sector está lleno (`disponibles === 0`), bloquea con HTTP `409 Conflict` (*"No hay espacios disponibles para [tipo]. Aforo completo."*).
3. **Liberación en Salida (`POST /api/salidas`):** Al registrar la salida (HU-02), la estadía se finaliza con `hora_salida`, desocupando el espacio inmediatamente y aumentando la disponibilidad en tiempo real.
