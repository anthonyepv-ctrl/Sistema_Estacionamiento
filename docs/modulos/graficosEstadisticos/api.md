# Módulo Gráficos Estadísticos — API (UPAO-18 / Subtareas UPAO-65 y UPAO-66)

Endpoints implementados en `src/routes/reportes.js` y montados en `/api/reportes` (`server.js`).

---

## 1. GET `/api/reportes/graficos-mes` (UPAO-66)

Endpoint dedicado para la consulta y agregación estadística mensual requerida en la historia **UPAO-18 (Gráficos de ingresos)** y subtarea **UPAO-66**.

### Parámetros (query)

| Parámetro | Obligatorio | Tipo | Formato / Valores |
| --- | --- | --- | --- |
| `mes` | Sí | Entero | `1..12` (o `01..12`) |
| `anio` | Sí | Entero | `YYYY` ≥ 2024 |

### Validaciones y Códigos de Error (HTTP 400)

| Condición | Código HTTP | Mensaje de Error JSON |
| --- | :---: | --- |
| Falta año o año inválido (< 2024) | `400 Bad Request` | `{"error": "Año de consulta inválido. Ingrese un año válido a partir del 2024."}` |
| Falta mes o mes fuera de rango 1..12 | `400 Bad Request` | `{"error": "Mes de consulta inválido. El mes debe estar comprendido entre 1 y 12."}` |
| Año posterior al año corriente | `400 Bad Request` | `{"error": "No se pueden consultar períodos futuros. El año seleccionado es posterior al año actual."}` |
| Mes posterior al mes actual en el año corriente | `400 Bad Request` | `{"error": "No se pueden consultar meses futuros. Seleccione el mes actual o uno anterior."}` |

### Respuesta Exitosa (`HTTP 200 OK`)

```json
{
  "periodo": "mensual",
  "anio": 2026,
  "mes": 10,
  "etiquetaPeriodo": "Octubre 2026",
  "tieneDatos": true,
  "mensaje": null,
  "totales": {
    "totalGeneral": 2884.00,
    "totalEfectivo": 2370.50,
    "totalYape": 512.00,
    "concurrenciaTotal": 23,
    "porcentajeEfectivo": 82.19,
    "porcentajeYape": 17.75,
    "porMetodo": [
      { "nombre": "Efectivo", "monto": 2370.50, "cantidad": 16, "porcentaje": 82.19 },
      { "nombre": "Yape", "monto": 512.00, "cantidad": 6, "porcentaje": 17.75 },
      { "nombre": "POS", "monto": 1.50, "cantidad": 1, "porcentaje": 0.05 }
    ]
  },
  "serieDiaria": [
    { "dia": 1, "monto": 0.00, "efectivo": 0.00, "yape": 0.00, "vehiculos": 0 },
    { "dia": 11, "monto": 126.50, "efectivo": 2.50, "yape": 124.00, "vehiculos": 2 }
  ],
  "concurrenciaHoraria": [
    { "hora": 6, "vehiculos": 0, "monto": 0.00 },
    { "hora": 13, "vehiculos": 2, "monto": 126.50 }
  ],
  "serieMensual": []
}
```

* **Respuesta en meses sin recaudación:**
  Si el período consultado no registra cobros, retorna `tieneDatos: false` y el mensaje oficial:
  ```json
  {
    "tieneDatos": false,
    "mensaje": "No se registran ingresos para el período seleccionado"
  }
  ```

---

## 2. GET `/api/reportes/graficos` (UPAO-65)

Datos reales para el dashboard estadístico del dueño (soporta `periodo=mensual` o `periodo=anual`).

### Parámetros (query)

| Parámetro | Obligatorio | Valores |
| --- | --- | --- |
| `periodo` | No (default `mensual`) | `mensual` \| `anual` |
| `anio` | Sí | `YYYY` ≥ 2024 |
| `mes` | Sí si `periodo=mensual` | `1..12` |

---

## 3. GET `/api/reportes/exportar` (UPAO-66)

Genera el CSV descargable compatible con Excel (UTF-8 BOM) del período consultado con las cabeceras formateadas: `Fecha`, `Placa`, `Tipo`, `Método`, `Monto`.

### Cabeceras de Respuesta

```text
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="reporte_ingresos_2026_10.csv"
```

### Formato del Archivo CSV

```csv
"Fecha","Placa","Tipo","Método","Monto"
"11/10/2026 13:03","ABC-666","Automóvil / Camioneta","Efectivo","S/ 2.50"
"11/10/2026 13:13","ABC-333","Automóvil / Camioneta","Yape","S/ 124.00"
"TOTAL RECAUDADO","","","","S/ 2,884.00"
"TOTAL EFECTIVO","","","","S/ 2,370.50"
"TOTAL YAPE","","","","S/ 512.00"
"TOTAL VEHÍCULOS ATENDIDOS","","","","23"
```

---

## 4. Ejemplos de Invocación con cURL

```bash
# 1. Agregaciones mensuales por query params (UPAO-66)
curl "http://localhost:3000/api/reportes/graficos-mes?mes=10&anio=2026"

# 2. Validación de mes futuro (retorna HTTP 400)
curl -i "http://localhost:3000/api/reportes/graficos-mes?mes=12&anio=2026"

# 3. Exportación CSV con cabeceras formateadas
curl -OJ "http://localhost:3000/api/reportes/exportar?periodo=mensual&anio=2026&mes=10"
```
