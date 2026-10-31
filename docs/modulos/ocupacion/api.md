# Módulo Nivel de Ocupación y Afluencia — Especificación de API (UPAO-19 / UPAO-70)

Endpoints backend para consultar el aforo máximo simultáneo, la afluencia por bloques horarios y exportar la bitácora de estadías del período.

> **Compatibilidad UPAO-71:** el endpoint también está disponible como `GET /api/reportes/ocupacion?inicio=YYYY-MM-DD&fin=YYYY-MM-DD`, donde `inicio` y `fin` son alias de `fechaInicio` y `fechaFin`. La exportación responde igualmente en `GET /api/reportes/ocupacion/exportar`.

---

## 1. `GET /api/ocupacion`

Consulta las estadías que intersectan el rango de fechas y calcula el resumen de ocupación y la distribución de ingresos por bloques de 2 horas en zona horaria peruana (`America/Lima`, UTC-5).

### Request

- **Headers:** `Accept: application/json`
- **Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `fechaInicio` | String | Sí | Fecha inicial en formato `YYYY-MM-DD`. |
| `fechaFin` | String | Sí | Fecha final en formato `YYYY-MM-DD`. |

#### Ejemplo de llamada:

```http
GET /api/ocupacion?fechaInicio=2026-10-25&fechaFin=2026-10-31 HTTP/1.1
Host: localhost:3000
Accept: application/json
```

---

### Response Exitosa (`200 OK`)

Ejemplo verificado con datos de staging (25–31 de octubre de 2026):

```json
{
  "rango": {
    "fechaInicio": "2026-10-25",
    "fechaFin": "2026-10-31"
  },
  "resumen": {
    "totalVehiculos": 6,
    "totalAutos": 3,
    "totalMotos": 3,
    "aforoMaximoSimultaneo": 16,
    "aforoMaximoAutos": 10,
    "aforoMaximoMotos": 6,
    "capacidadTotalCochera": 20
  },
  "bloquesHorarios": [
    { "bloque": "06:00 - 08:00", "cantidad": 0, "porcentaje": 0 },
    { "bloque": "08:00 - 10:00", "cantidad": 0, "porcentaje": 0 },
    { "bloque": "10:00 - 12:00", "cantidad": 2, "porcentaje": 33.33 },
    { "bloque": "12:00 - 14:00", "cantidad": 0, "porcentaje": 0 },
    { "bloque": "14:00 - 16:00", "cantidad": 3, "porcentaje": 50, "esPico": true },
    { "bloque": "16:00 - 18:00", "cantidad": 0, "porcentaje": 0 },
    { "bloque": "18:00 - 20:00", "cantidad": 0, "porcentaje": 0 },
    { "bloque": "20:00 - 22:00", "cantidad": 0, "porcentaje": 0 },
    { "bloque": "22:00 - 06:00", "cantidad": 1, "porcentaje": 16.67 }
  ],
  "sinDatos": false
}
```

| Campo | Descripción |
| --- | --- |
| `resumen.totalVehiculos` | Ingresos con `horaIngreso` dentro del rango consultado. |
| `resumen.totalAutos` / `totalMotos` | Desglose de esos ingresos por tipo de vehículo. |
| `resumen.aforoMaximoSimultaneo` | Pico de vehículos presentes al mismo tiempo dentro del rango. |
| `resumen.aforoMaximoAutos` / `aforoMaximoMotos` | Pico simultáneo por categoría. |
| `resumen.capacidadTotalCochera` | Capacidad configurada (autos + motos) en `src/config/espacios.js`. |
| `bloquesHorarios[].cantidad` | Ingresos cuya hora local cae en el bloque. |
| `bloquesHorarios[].porcentaje` | Porcentaje respecto del total de ingresos, redondeado a 2 decimales. |
| `bloquesHorarios[].esPico` | `true` en el/los bloques con mayor cantidad (solo si hay ingresos). |

---

### Alias UPAO-71

El mismo contrato está disponible en `GET /api/reportes/ocupacion?inicio=YYYY-MM-DD&fin=YYYY-MM-DD`. Los parámetros `inicio` y `fin` se aceptan como alias de `fechaInicio` y `fechaFin`, y la exportación responde en `GET /api/reportes/ocupacion/exportar`. La respuesta conserva la estructura descrita arriba.

---

### Caso sin Movimientos (`200 OK`)

Cuando no existen estadías que intersecten el rango:

```json
{
  "rango": {
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-07"
  },
  "resumen": {
    "totalVehiculos": 0,
    "totalAutos": 0,
    "totalMotos": 0,
    "aforoMaximoSimultaneo": 0,
    "aforoMaximoAutos": 0,
    "aforoMaximoMotos": 0,
    "capacidadTotalCochera": 20
  },
  "bloquesHorarios": [],
  "sinDatos": true,
  "mensaje": "No se registran movimientos ni ingresos para el período seleccionado"
}
```

---

### Respuestas de Error

#### 1. Parámetros faltantes (`400 Bad Request`)

```json
{
  "error": "Debe ingresar la fecha de inicio y la fecha de fin."
}
```

#### 2. Formato de fecha inválido (`400 Bad Request`)

```json
{
  "error": "Formato de fecha inválido. Utilice YYYY-MM-DD."
}
```

#### 3. Rango invertido (`400 Bad Request`)

```json
{
  "error": "La fecha de inicio no puede ser posterior a la fecha de fin"
}
```

#### 4. Fechas futuras (`400 Bad Request`)

```json
{
  "error": "No se pueden consultar reportes de fechas futuras"
}
```

#### 5. Error interno del servidor (`500 Internal Server Error`)

```json
{
  "error": "No se pudo consultar el nivel de ocupación."
}
```

---

## 2. `GET /api/ocupacion/exportar`

Exporta la bitácora de estadías que intersectan el rango consultado.

### Request

- **Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `fechaInicio` | String | Sí | Fecha inicial en formato `YYYY-MM-DD`. |
| `fechaFin` | String | Sí | Fecha final en formato `YYYY-MM-DD`. |
| `formato` | String | No | `csv` (por defecto) o `excel`. Ambos devuelven CSV compatible con Excel. |

#### Ejemplo de llamada:

```http
GET /api/ocupacion/exportar?fechaInicio=2026-10-25&fechaFin=2026-10-31&formato=csv HTTP/1.1
Host: localhost:3000
```

---

### Response Exitosa (`200 OK`)

- **Headers:**
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="reporte_ocupacion_2026-10-25_2026-10-31.csv"`
- **Codificación:** UTF-8 con BOM (`EF BB BF`) para conservar tildes y eñes en Excel.
- **Columnas:** `ID_Estadia, Placa, Tipo_Vehiculo, Fecha_Ingreso, Hora_Ingreso, Fecha_Salida, Hora_Salida, Tiempo_Horas, Estado`.
- **Filas:** todas las estadías que intersectan el rango (incluye las que ingresaron antes del período y siguen activas). `Tiempo_Horas` se calcula hasta `horaSalida` o hasta el momento de la exportación si la estadía está activa. `Estado` es `FINALIZADA` o `ACTIVA`.

Ejemplo de contenido:

```csv
"ID_Estadia","Placa","Tipo_Vehiculo","Fecha_Ingreso","Hora_Ingreso","Fecha_Salida","Hora_Salida","Tiempo_Horas","Estado"
"21","12ES-EP","Motocicleta","14/10/2026","00:34","","","415.91","ACTIVA"
"25","552M-PE","Motocicleta","14/10/2026","00:42","","","415.79","ACTIVA"
"30","GH-4WAS","Motocicleta","14/10/2026","00:42","","","415.78","ACTIVA"
```

### Respuestas de Error

#### 1. Formato de exportación no soportado (`400 Bad Request`)

```json
{
  "error": "Formato de exportación no soportado. Valores permitidos: 'csv' o 'excel'."
}
```

#### 2. Errores de validación del rango

Los mismos mensajes y códigos `400` del endpoint de consulta.

#### 3. Error interno del servidor (`500 Internal Server Error`)

```json
{
  "error": "No se pudo exportar el reporte de ocupación."
}
```

---

## 3. Reglas de Negocio y Lógica de Cálculo

1. **Zona horaria:** el rango se interpreta como `T00:00:00.000-05:00` a `T23:59:59.999-05:00`; las horas de ingreso se convierten a `America/Lima` antes de asignarlas a un bloque.
2. **Estadías consideradas:** las que cumplen `horaIngreso <= fin` y (`horaSalida IS NULL` o `horaSalida >= inicio`), es decir, todas las que intersectan el período.
3. **Aforo máximo (sweep-line):** por cada estadía se generan eventos `+1` en el ingreso y `-1` en la salida (o en `min(ahora, fin)` si sigue activa). Los eventos se ordenan por fecha y, ante empate, el ingreso se procesa primero. Se acumula la concurrencia y se guarda el máximo global y por categoría.
4. **Bloques horarios:** nueve franjas fijas de 2 horas (`06:00 - 08:00` … `20:00 - 22:00`, más `22:00 - 06:00`). El bloque pico es el de mayor cantidad; si hay empate, todos se marcan con `esPico: true`.
5. **Capacidad:** se obtiene de `src/config/espacios.js` (por defecto 10 autos + 10 motos = 20). El porcentaje de aforo mostrado en la interfaz es `aforoMaximoSimultaneo / capacidadTotalCochera`.
6. **Diferencia entre KPI y exportación:** `totalVehiculos` cuenta solo los ingresos ocurridos dentro del rango, mientras que el CSV incluye todas las estadías que lo intersectan (incluidas las previas aún activas).
7. **Control de acceso:** el análisis define el endpoint como exclusivo del rol `DUENO`; la sesión actual del frontend no envía token, por lo que el rol se controla ocultando el módulo en la interfaz. La API no aplica autenticación server-side.
