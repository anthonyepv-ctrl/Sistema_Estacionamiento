# Plan de Pruebas y Depuración — Historial de Estadías del Conductor (`UPAO-23` / Subtarea `UPAO-97`)

> **Historia de Usuario:** `UPAO-23` — Consultar historial de estados (2 Story Points)  
> **Subtarea Jira:** `UPAO-97` — Probar y depurar historial de estadías y aislamiento entre conductores  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-23`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-23-01** | 1- Válido: Historial cronológico de reservas y estadías del conductor | `SP3-10` y UI (`capturar_ui.js`) verificados: `GET /api/conductor/historial` devuelve las estadías de las placas del conductor con estado `Finalizada` / `En cochera` ordenadas descendentemente. | ✅ Aprobado |
| **CP-23-02** | 2- Válido: Conductor recién registrado sin movimientos | `SP3-15` verificado: un segundo conductor recién registrado recibe `estadias: []` y `reservas: []` sin filtraciones ni errores. | ✅ Aprobado |
| **CP-23-03** | 3- Inválido: Consulta sin sesión o intento de ver historial ajeno | `SP3-11` y `SP3-15` verificados: sin token retorna HTTP `401 Unauthorized` y el conductor B no visualiza movimientos del conductor A. | ✅ Aprobado |

---

## 2. Comandos de Ejecución

```bash
node tests/test-reservas-sprint3.js
```

---

## 3. Defect Log (`UPAO-23`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| *(Sin defectos abiertos)* | No se registraron defectos; el aislamiento estricto por `req.sesion.sub` y rechazo `401` pasaron todas las verificaciones. | — | — | Cerrado |

---

## 4. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva`)

- **Backend Historial Seguro (`UPAO-96`):** [`src/routes/conductor.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/conductor.js)
- **UI Portal Historial y Sidebar (`UPAO-95`):** [`public/js/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/reservas.js) · [`public/js/app.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/app.js)
- **Casos automatizados `SP3-10/11/15` (`UPAO-97`):** [`tests/test-reservas-sprint3.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/tests/test-reservas-sprint3.js)
