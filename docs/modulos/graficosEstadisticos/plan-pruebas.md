# Plan de Pruebas y Evidencia de Ejecución — Módulo Gráficos Estadísticos (UPAO-66 / UPAO-18)

> **Historia de Usuario:** UPAO-18 — Gráficos de ingresos (5 Story Points)  
> **Subtarea:** UPAO-66 — Programar API de agregaciones mensuales y generación de reportes descargables  
> **Épica:** UPAO-27 — Administración y Supervisión del Negocio  
> **Responsable:** ALBERTH JAIR FLORES LEONARDO  
> **Fecha de Ejecución:** 27/10/2026  
> **Resultado Global:** 6 verificaciones ejecutadas, 6 aprobadas, 0 fallas (100% Éxito)

---

## 1. Objetivo

Verificar el correcto funcionamiento de los endpoints de agregación mensual, validación temporal estricta y generación de reportes descargables correspondientes a la subtarea **UPAO-66**, garantizando el cumplimiento de todos los criterios de aceptación de la historia **UPAO-18**:
1. Disponibilidad del endpoint `GET /api/reportes/graficos-mes?mes=MM&anio=YYYY`.
2. Validación de períodos futuros con rechazo mandatorio `HTTP 400 Bad Request`.
3. Retorno de la serie diaria completa del mes y consolidado por método de pago (Efectivo vs. Yape).
4. Despliegue del mensaje informativo oficial ante meses sin recaudación: `"No se registran ingresos para el período seleccionado"`.
5. Descarga de archivo CSV formateado con codificación UTF-8 BOM para compatibilidad con Excel.

---

## 2. Alcance

- Endpoint `GET /api/reportes/graficos-mes`:
  - Cálculo de sumatoria por día del mes (1 al 28..31 según el mes).
  - Cálculo de totales por método de pago (`Efectivo`, `Yape`, `POS`) y porcentajes sobre el total general.
  - Concurrencia horaria de 06:00 a 23:00 en zona horaria peruana (`America/Lima`, UTC-5).
- Endpoint `GET /api/reportes/exportar`:
  - Generación de CSV con cabeceras `"Fecha","Placa","Tipo","Método","Monto"`.
  - Inclusión de filas resumen (`TOTAL RECAUDADO`, `TOTAL EFECTIVO`, `TOTAL YAPE`, `TOTAL VEHÍCULOS ATENDIDOS`).
- Suite de pruebas automatizadas: `tests/test-graficos-mes.js`.

---

## 3. Entorno de Pruebas

| Componente | Detalle del Entorno |
| --- | --- |
| **Servidor Backend** | Node.js v22 + Express 5 (`http://localhost:3456`) |
| **Base de Datos** | PostgreSQL en Neon (Rama Staging: `ep-spring-bonus-b6zxs7fw`) |
| **Ambiente Git** | Rama `feature/UPAO-66-api-agregaciones-mensuales` integrada a `develop` |
| **Harness de Pruebas** | Suite automatizada en Node.js (`tests/test-graficos-mes.js`) |

---

## 4. Matriz de Casos de Prueba Ejecutados

| ID | Caso de Prueba | Petición / Pasos | Resultado Esperado | Resultado Obtenido | Estado |
|:---:|---|---|---|---|:---:|
| **CP-01** | Consulta mensual válida con movimientos | `GET /api/reportes/graficos-mes?mes=10&anio=2026` | `HTTP 200 OK`<br>• `periodo: "mensual"`<br>• `serieDiaria`: 31 días<br>• `totales`: desglose Efectivo y Yape | `HTTP 200 OK`<br>• Total general: S/ 2,884.00<br>• 31 elementos en serie diaria<br>• Consolidado por método correcto | **PASA** |
| **CP-02** | Bloqueo estricto de mes futuro en año actual | `GET /api/reportes/graficos-mes?mes=12&anio=2026` | `HTTP 400 Bad Request`<br>• Mensaje: `"No se pueden consultar meses futuros..."` | `HTTP 400 Bad Request`<br>• Mensaje: `"No se pueden consultar meses futuros. Seleccione el mes actual o uno anterior."` | **PASA** |
| **CP-03** | Bloqueo estricto de año futuro | `GET /api/reportes/graficos-mes?mes=5&anio=2027` | `HTTP 400 Bad Request`<br>• Mensaje: `"No se pueden consultar períodos futuros..."` | `HTTP 400 Bad Request`<br>• Mensaje: `"No se pueden consultar períodos futuros. El año seleccionado es posterior al año actual."` | **PASA** |
| **CP-04** | Validación de mes fuera de rango (1..12) | `GET /api/reportes/graficos-mes?mes=15&anio=2026` | `HTTP 400 Bad Request`<br>• Mensaje: `"Mes de consulta inválido..."` | `HTTP 400 Bad Request`<br>• Mensaje: `"Mes de consulta inválido. El mes debe estar comprendido entre 1 y 12."` | **PASA** |
| **CP-05** | Período sin ingresos registrados | `GET /api/reportes/graficos-mes?mes=1&anio=2024` | `HTTP 200 OK`<br>• `tieneDatos: false`<br>• Mensaje oficial de ausencia de movimientos | `HTTP 200 OK`<br>• `tieneDatos: false`<br>• `mensaje: "No se registran ingresos para el período seleccionado"` | **PASA** |
| **CP-06** | Exportación descargable de reporte a CSV | `GET /api/reportes/exportar?periodo=mensual&anio=2026&mes=10` | `HTTP 200 OK`<br>• `Content-Type: text/csv`<br>• Cabeceras: `"Fecha","Placa","Tipo","Método","Monto"`<br>• UTF-8 BOM | `HTTP 200 OK`<br>• Descarga `reporte_ingresos_2026_10.csv`<br>• Cabeceras presentes y formateadas con comillas | **PASA** |

---

## 5. Registro de Defectos Depurados y Solucionados (Defect Log)

Durante la implementación y validación de la subtarea se detectaron y corrigieron los siguientes defectos:

| ID | Caso | Defecto Encontrado | Causa Raíz | Solución Aplicada | Commit | Estado |
|:---:|:---:|---|---|---|:---:|:---:|
| **DEF-01** | CP-01 | La llamada a `GET /api/reportes/graficos-mes` retornaba error `404 Not Found`. | En la subtarea previa solo se había declarado la ruta `/graficos`, omitiendo el nombre exacto del endpoint `/graficos-mes` especificado en Jira. | Se implementó la ruta dedicada `router.get('/graficos-mes', ...)` que reutiliza la función central `generarReporteGraficos`. | [`ba7d714`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/ba7d714) | **SUPERADO** |
| **DEF-02** | CP-05 | Al consultar meses sin movimientos, el campo `mensaje` retornaba `null`. | No se contemplaba la propiedad `mensaje` explícita cuando `tieneDatos === false` en la respuesta JSON. | Se añadió el mensaje informativo oficial `"No se registran ingresos para el período seleccionado"` en el objeto de respuesta. | [`ba7d714`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/ba7d714) | **SUPERADO** |

---

## 6. Salida de la Suite de Pruebas Automatizadas

```text
--- Iniciando Pruebas de API UPAO-66 (Agregaciones Mensuales) ---
Servidor disponible en http://localhost:3456

[TEST 1] GET /api/reportes/graficos-mes?mes=10&anio=2026 (mes válido con movimientos)
✓ TEST 1 EXITOSO: Serie diaria y consolidado por método retornados correctamente.

[TEST 2] GET /api/reportes/graficos-mes?mes=12&anio=2026 (mes futuro)
✓ TEST 2 EXITOSO: Mes futuro bloqueado con HTTP 400.

[TEST 3] GET /api/reportes/graficos-mes?mes=5&anio=2027 (año futuro)
✓ TEST 3 EXITOSO: Año futuro bloqueado con HTTP 400.

[TEST 4] GET /api/reportes/graficos-mes?mes=15&anio=2026 (mes inválido)
✓ TEST 4 EXITOSO: Mes inválido validado con HTTP 400.

[TEST 5] GET /api/reportes/graficos-mes?mes=1&anio=2024 (período sin movimientos)
✓ TEST 5 EXITOSO: Mes sin ventas retorna tieneDatos: false y mensaje informativo oficial.

[TEST 6] GET /api/reportes/exportar?periodo=mensual&anio=2026&mes=10 (exportación)
✓ TEST 6 EXITOSO: Exportación descargable generada con cabeceras requeridas.

======================================================
 TODOS LOS CASOS DE PRUEBA DE UPAO-66 PASARON CON ÉXITO
======================================================
```

---

## 7. Trazabilidad y Enlaces en GitHub

| Recurso | Descripción | Enlace en Repositorio GitHub |
| --- | --- | --- |
| **Repositorio Oficial** | Repositorio central del proyecto | [anthonyepv-ctrl/Sistema_Estacionamiento](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento) |
| **Rama `develop`** | Rama base de integración continua (Staging) | [Rama `develop`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| **Rama de la Tarea** | Rama de trabajo para UPAO-66 | [Rama `feature/UPAO-66-api-agregaciones-mensuales`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/UPAO-66-api-agregaciones-mensuales) |
| **Commit de Implementación** | Commit con la API de agregaciones mensuales | [`ba7d714`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/ba7d714) |
| **Código del Endpoint** | Controlador de rutas de reportes | [`src/routes/reportes.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/src/routes/reportes.js) |
| **Documentación de la API** | Especificación técnica de contratos y payloads | [`docs/modulos/graficosEstadisticos/api.md`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/graficosEstadisticos/api.md) |
| **Script de Pruebas** | Suite automatizada de pruebas unitarias/integración | [`tests/test-graficos-mes.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/tests/test-graficos-mes.js) |
