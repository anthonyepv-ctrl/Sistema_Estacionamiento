# Plan de Pruebas y Depuración — Historial de Estadías del Conductor (`UPAO-23` / Subtarea `UPAO-97`)

> **Historia de Usuario:** `UPAO-23` — Consultar historial de estados (2 Story Points)  
> **Subtarea Jira:** `UPAO-97` — Probar y depurar historial de estadías y aislamiento entre conductores  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-23`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-23-01** | 1- Válido: Historial cronológico de reservas y estadías del conductor | `SP3-10` y UI (`capturar_ui.js`) verificados: `GET /api/conductor/historial` devuelve las estadías de las placas del conductor con estado `Finalizada` / `En cochera` ordenadas descendentemente. | ✅ Aprobado |
| **CP-23-02** | 2- Válido: Conductor recién registrado sin movimientos | Caso de estado vacío sin reservas ni estadías previas pendiente de verificación aislada en UI. | ⏳ Pendiente |
| **CP-23-03** | 3- Inválido: Consulta sin sesión o intento de ver historial ajeno | Caso negativo de aislamiento entre conductores y rechazo `401` sin token pendiente de prueba automatizada dedicada. | ⏳ Pendiente |

---

## 2. Comandos de Ejecución

```bash
node tests/test-reservas-sprint3.js
```

---

## 3. Defect Log (`UPAO-23`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| *(Sin defectos abiertos)* | No se registraron defectos en el flujo principal de historial (`SP3-10`). | — | — | Cerrado |

---

## 4. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva` → `develop`)

- **Pull Request hacia `develop` (Blue):** [#25 — Manejo de Reserva Web y Portal del Conductor](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/25)
- **Backend Historial Seguro (`UPAO-96`):** [`src/routes/conductor.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/conductor.js)
- **UI Portal Historial y Sidebar (`UPAO-95`):** [`public/js/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/reservas.js) · [`public/js/app.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/app.js)
- **Caso automatizado `SP3-10` (`UPAO-97`):** [`tests/test-reservas-sprint3.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/tests/test-reservas-sprint3.js)
