# Análisis y Diseño — Historial de Estadías del Conductor (`UPAO-23` / Subtarea `UPAO-82`)

## 1. Objetivo
Permitir al conductor autenticado consultar el historial cronológico completo de estadías de sus vehículos registrados, mostrando fechas y horas de ingreso/salida, código de reserva asociada (si aplica), adelanto pagado, cobro en garita y estado (`En cochera` o `Finalizada`).

---

## 2. Flujo y Aislamiento de Datos

```text
[Conductor -> Sidebar "Mi Historial de Estadías" (#view-conductor-historial)]
        │  GET /api/conductor/historial (Token CONDUCTOR)
        ▼
[Backend src/routes/conductor.js]
        ├── Obtiene placas de vehiculo_conductor donde id_usuario === req.sesion.sub
        ├── Consulta estadia donde placa IN (placas del conductor)
        ├── Incluye tipoVehiculo, pago (y metodoPago) y reserva (codigo, montoAdelanto)
        └── Ordena por horaIngreso DESC
```

---

## 3. Reglas de Negocio y Seguridad (`UPAO-23`)

1. **Aislamiento estricto entre conductores:** la consulta se deriva exclusivamente del `id_usuario` extraído del token HMAC (`req.sesion.sub`), nunca de parámetros modificables en la URL o body.
2. **Control de acceso por rol:** si un usuario no autenticado intenta consultar recibe `401 Unauthorized`; si un rol operativo (`RECEPCIONISTA` o `DUENO`) accede a rutas exclusivas de conductor recibe `403 Forbidden`.
3. **Acceso directo desde Sidebar:** visible en el menú lateral izquierdo tanto para *Mis Reservas y Vehículos* como para *Mi Historial de Estadías*.

---

## 4. Endpoints Planificados (`UPAO-23`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/conductor/historial` | `CONDUCTOR` | Retorna las estadías (activas y finalizadas) de las placas registradas por el conductor autenticado, ordenadas de más reciente a más antigua. |

---

## 5. Casos de Prueba (Diseño — `UPAO-23`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-23-01** | 1- Válido: Historial cronológico de reservas y estadías del conductor | Conductor autenticado consulta `GET /api/reservas/mias` y `GET /api/conductor/historial` | Lista reservas (`VIGENTE`/`UTILIZADA`/`ANULADA`/`VENCIDA`) y estadías (`En cochera`/`Finalizada`) de sus placas. | Pendiente |
| **CP-23-02** | 2- Válido: Conductor recién registrado sin movimientos | Conductor sin reservas ni estadías previas abre *Mis Reservas* y *Mi Historial* | Renderiza estado vacío amigable indicando que aún no registra movimientos. | Pendiente |
| **CP-23-03** | 3- Inválido: Consulta sin sesión o intento de ver historial ajeno | Petición sin token a `/api/conductor/historial` o intento de consultar placa de tercero | Rechaza con HTTP `401` sin token y aísla registros estrictamente por `id_usuario` del token HMAC. | Pendiente |
