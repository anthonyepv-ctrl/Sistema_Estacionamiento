# Plan de Pruebas y Depuración — Búsqueda y Confirmación en Garita (`UPAO-8` / Subtarea `UPAO-93`)

> **Historia de Usuario:** `UPAO-8` — Buscar reservas (2 Story Points)  
> **Subtarea Jira:** `UPAO-93` — Probar y depurar búsqueda, bloqueo de reservas inválidas y descuento en salida  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-8`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-08-01** | 1- Válido: Búsqueda en garita por código o placa | `SP3-07` y UI (`capturar_ui.js`) verificados: `GET /api/reservas?q=...` retorna la reserva con placa (con/sin guion), tipo, conductor, vigencia y estado. | ✅ Aprobado |
| **CP-08-02** | 2- Válido: Alerta `RESERVADO` automática al digitar placa en Ingreso | `SP3-07b` y captura UI verificados: `GET /api/reservas/por-placa/:placa` detecta reserva `VIGENTE`, muestra banner `RESERVADO` y deshabilita ingreso normal. | ✅ Aprobado |
| **CP-08-03** | 3- Válido: Confirmar llegada en garita y abrir estadía vinculada | `SP3-08` verificado: `POST /api/reservas/:id/confirmar` marca la reserva `UTILIZADA` y crea estadía activa vinculada con `id_reserva`. | ✅ Aprobado |
| **CP-08-04** | 4- Válido: Descuento automático del adelanto en salida | `SP3-09` verificado: `POST /api/salidas` retorna `montoBruto`, `adelantoReserva` (1h) y cobra únicamente `saldo = max(0, montoBruto - adelantoReserva)`. | ✅ Aprobado |
| **CP-08-05** | 5- Inválido: Registrar ingreso normal cuando existe reserva vigente | `SP3-07c` verificado: `POST /api/ingresos` rechaza con HTTP `409 Conflict` cuando la placa tiene una reserva `VIGENTE` activa. | ✅ Aprobado |
| **CP-08-06** | 6- Inválido: Confirmar reserva vencida, anulada o ya utilizada | `SP3-17` verificado: `POST /api/reservas/:id/confirmar` sobre una reserva vencida rechaza con HTTP `409 Conflict` sin crear estadía. | ✅ Aprobado |
| **CP-08-07** | 7- Inválido: Búsqueda por código o placa inexistente | `SP3-18` verificado: `GET /api/reservas?q=ZZZ-999` retorna lista vacía `reservas: []` con HTTP `200 OK`. | ✅ Aprobado |

---

## 2. Comandos de Ejecución

```bash
node tests/test-reservas-sprint3.js
npm run test:regresion
```

---

## 3. Defect Log (`UPAO-8`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-08-01** | Ingreso normal permitía duplicar placa con reserva vigente sin descontar adelanto | `POST /api/ingresos` y `#view-ingreso` solo validaban estadías activas y no consultaban reservas `VIGENTE` de esa placa. | Se agregó `GET /api/reservas/por-placa/:placa`, aviso amarillo `RESERVADO` con bloqueo de submit en UI y validación `409 Conflict` en `src/routes/ingresos.js`. | Cerrado |

---

## 4. Trazabilidad en GitHub (Rama `feature/UPAO-21-realizar-reserva` → `develop`)

- **Pull Request hacia `develop` (Blue):** [#25 — Manejo de Reserva Web y Portal del Conductor](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/pull/25)
- **Backend Garita, Bloqueo en Ingreso y Salida (`UPAO-92`):** [`src/routes/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/reservas.js) · [`src/routes/ingresos.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/ingresos.js) · [`src/routes/salidas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/src/routes/salidas.js)
- **UI Garita + Sidebar (`UPAO-91`):** [`public/index.html`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/index.html) · [`public/js/reservas.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/public/js/reservas.js)
- **Casos automatizados `SP3-07/07b/07c/08/09/17/18` (`UPAO-93`):** [`tests/test-reservas-sprint3.js`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/feature/UPAO-21-realizar-reserva/tests/test-reservas-sprint3.js)
