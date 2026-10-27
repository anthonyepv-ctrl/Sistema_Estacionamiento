# Módulo Gráficos Estadísticos — API (UPAO-18 / UPAO-65)

Endpoints implementados en `src/routes/reportes.js` y montados en `/api/reportes` (`server.js`).

## GET `/api/reportes/graficos`

Datos reales del dashboard estadístico del dueño.

### Parámetros (query)

| Parámetro | Obligatorio | Valores |
| --- | --- | --- |
| `periodo` | No (default `mensual`) | `mensual` \| `anual` |
| `anio` | Sí | `YYYY` ≥ 2024 |
| `mes` | Sí si `periodo=mensual` | `1..12` |

### Validaciones (HTTP 400)

| Regla | Mensaje |
| --- | --- |
| Tipo de reporte inválido | `Tipo de reporte no soportado. Valores permitidos: 'mensual' o 'anual'.` |
| Año inválido | `Año de consulta inválido. Ingrese un año válido a partir del 2024.` |
| Mes inválido | `Mes de consulta inválido. El mes debe estar comprendido entre 1 y 12.` |
| Año futuro | `No se pueden consultar períodos futuros. El año seleccionado es posterior al año actual.` |
| Mes futuro | `No se pueden consultar meses futuros. Seleccione el mes actual o uno anterior.` |

### Respuesta `200 OK`

```json
{
  "periodo": "mensual",
  "anio": 2026,
  "mes": 10,
  "etiquetaPeriodo": "Octubre 2026",
  "tieneDatos": true,
  "totales": {
    "totalGeneral": 1313.40,
    "totalEfectivo": 801.40,
    "totalYape": 512.00,
    "concurrenciaTotal": 18,
    "porcentajeEfectivo": 61.02,
    "porcentajeYape": 38.98,
    "porMetodo": [
      { "nombre": "Efectivo", "monto": 801.40, "cantidad": 12, "porcentaje": 61.02 },
      { "nombre": "Yape", "monto": 512.00, "cantidad": 6, "porcentaje": 38.98 }
    ]
  },
  "serieDiaria": [
    { "dia": 1, "monto": 0, "efectivo": 0, "yape": 0, "vehiculos": 0 },
    { "dia": 11, "monto": 126.50, "efectivo": 2.50, "yape": 124.00, "vehiculos": 2 }
  ],
  "concurrenciaHoraria": [
    { "hora": 6, "vehiculos": 0, "monto": 0 },
    { "hora": 13, "vehiculos": 2, "monto": 126.50 }
  ],
  "serieMensual": []
}
```

Notas:

- `serieDiaria` incluye **todos** los días del mes (1..28/29/30/31); en vista anual viene vacía.
- `serieMensual` incluye los 12 meses; solo en vista anual.
- `concurrenciaHoraria` incluye las horas 06:00 a 23:00.
- La agrupación usa la zona horaria `America/Lima` (UTC-5).
- `porMetodo` permite renderizar la dona con todos los métodos presentes (Efectivo/Yape/POS).

## GET `/api/reportes/exportar`

Genera el CSV compatible con Excel (UTF-8 BOM) del período.

### Parámetros

Los mismos que `/graficos`.

### Respuesta `200 OK`

Cabeceras:

```text
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="reporte_ingresos_2026_10.csv"
```

Contenido:

```csv
"Fecha","Placa","Tipo","Método","Monto"
"11/10/2026 13:03","ABC-666","Automóvil / Camioneta","Efectivo","S/ 2.50"
"11/10/2026 13:13","ABC-333","Automóvil / Camioneta","Yape","S/ 124.00"
"TOTAL RECAUDADO","","","","S/ 1,313.40"
"TOTAL EFECTIVO","","","","S/ 801.40"
"TOTAL YAPE","","","","S/ 512.00"
"TOTAL VEHÍCULOS ATENDIDOS","","","","18"
```

- Archivo con BOM UTF-8 (`EF BB BF`).
- Fechas en hora local de Perú (`DD/MM/YYYY HH:mm`).
- Montos con formato `S/ 0.00`.

## Ejemplos

```bash
# Dashboard mensual (Octubre 2026)
curl "http://localhost:3000/api/reportes/graficos?periodo=mensual&anio=2026&mes=10"

# Dashboard anual (2026)
curl "http://localhost:3000/api/reportes/graficos?periodo=anual&anio=2026"

# Exportación CSV mensual
curl -OJ "http://localhost:3000/api/reportes/exportar?periodo=mensual&anio=2026&mes=10"
```
