# Análisis y Diseño — Búsqueda y Confirmación de Reservas en Garita (`UPAO-8` / Subtarea `UPAO-81`)

## 1. Objetivo
Permitir al Recepcionista y al Dueño consultar reservas por código (`RES-xxxxxx`), placa (con o sin guion), DNI o nombre del conductor, detectar automáticamente placas con reserva vigente dentro del flujo normal de ingreso y confirmar la llegada vinculando la estadía con el adelanto pagado.

---

## 2. Flujos en Garita

### 2.1. Detección automática al digitar la placa en Ingreso
```text
[Recepcionista escribe placa en Garita (#view-ingreso)]
        │  GET /api/reservas/por-placa/:placa (normalizada, con o sin guion)
        ├── Sin reserva VIGENTE ──► Continúa "Registrar Ingreso" normal
        └── Con reserva VIGENTE ──► Muestra aviso RESERVADO (código, conductor, adelanto, límite)
                                    Deshabilita "Registrar Ingreso" normal (y backend retorna 409)
                                    Pulsa "Confirmar ingreso con reserva" ──► Estadia + Reserva UTILIZADA
```

### 2.2. Búsqueda manual por código, placa o DNI
```text
[Sidebar / Dashboard -> "Buscar Reservas" (#view-garita-reservas)]
        │  GET /api/reservas?q=...&estado=...
        ▼
[Listado con código, placa, conductor/DNI, ventana 30 min, adelanto y estado]
        └── Si estado === VIGENTE ──► Botón "Confirmar Ingreso" (POST /api/reservas/:id/confirmar)
```

---

## 3. Reglas de Negocio y Modelo (`UPAO-8`)

1. **Navegación lateral directa:** el menú lateral izquierdo permite pasar de *Registrar Ingreso* a *Buscar Reservas* en 1 clic sin regresar al Menú Principal.
2. **Transacción atómica y vínculo `estadia.id_reserva`:** `POST /api/reservas/:id/confirmar` bloquea por `id_tipo_vehiculo`, aplica vencimiento perezoso, exige estado `VIGENTE`, marca la reserva `UTILIZADA` y crea la `estadia` activa vinculada mediante `id_reserva` (`INTEGER`, `UNIQUE`, `NULL`, FK → `reserva`).
3. **Bloqueo de ingreso duplicado:** `POST /api/ingresos` rechaza con `409 Conflict` el ingreso normal de una placa que posee reserva `VIGENTE`, evitando perder el adelanto pagado.
4. **Descuento en Salida:** `POST /api/salidas` lee `estadia.reserva.montoAdelanto`, lo resta del importe total calculado (`saldo = max(0, montoBruto - adelantoReserva)`) y devuelve ambos campos en la respuesta.

---

## 4. Endpoints Planificados (`UPAO-8`)

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/reservas/por-placa/:placa` | `RECEPCIONISTA` / `DUENO` | Detecta si una placa (con o sin guion) tiene reserva `VIGENTE`. |
| `GET` | `/api/reservas` | `RECEPCIONISTA` / `DUENO` | Busca reservas por código, placa normalizada, DNI o nombre y filtra por estado. |
| `POST` | `/api/reservas/:id/confirmar` | `RECEPCIONISTA` / `DUENO` | Confirma llegada, marca `UTILIZADA` y crea la estadía activa vinculada. |

---

## 5. Casos de Prueba (Diseño — `UPAO-8`)

> Matriz complementaria en Excel: `docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx` (estado inicial: `Pendiente`; se evalúa en la subtarea *Test*).

| ID | Caso de Prueba | Datos de Prueba | Resultado Esperado | Estado |
| --- | --- | --- | --- | --- |
| **CP-08-01** | 1- Válido: Búsqueda en garita por código o placa | Recepcionista consulta `GET /api/reservas?q=<codigo\|placa>` (con o sin guion) | Retorna la reserva coincidente con placa, tipo, conductor, vigencia y estado actual. | Pendiente |
| **CP-08-02** | 2- Válido: Alerta `RESERVADO` automática al digitar placa en Ingreso | Recepcionista digita placa con reserva `VIGENTE` en `#view-ingreso` (`GET /api/reservas/por-placa/:placa`) | Muestra aviso amarillo `RESERVADO`, deshabilita ingreso normal y ofrece enlace directo a Reservas. | Pendiente |
| **CP-08-03** | 3- Válido: Confirmar llegada en garita y abrir estadía vinculada | `POST /api/reservas/:id/confirmar` sobre reserva `VIGENTE` | Cambia reserva a `UTILIZADA` e inicia estadía activa vinculada (`id_reserva`). | Pendiente |
| **CP-08-04** | 4- Válido: Descuento automático del adelanto en salida | Estadía originada en reserva confirmada + `POST /api/salidas` | Devuelve `montoBruto`, `adelantoReserva` (1h) y cobra solo `max(0, montoBruto - adelantoReserva)`. | Pendiente |
| **CP-08-05** | 5- Inválido: Registrar ingreso normal cuando existe reserva vigente | `POST /api/ingresos` con placa que tiene reserva `VIGENTE` sin confirmar llegada | Backend rechaza con HTTP `409 Conflict` para evitar perder el adelanto. | Pendiente |
| **CP-08-06** | 6- Inválido: Confirmar reserva vencida, anulada o ya utilizada | `POST /api/reservas/:id/confirmar` cuando el estado es `VENCIDA`, `ANULADA` o `UTILIZADA` | Rechaza confirmación en garita (HTTP `409`) y no crea estadía vinculada. | Pendiente |
| **CP-08-07** | 7- Inválido: Búsqueda por código o placa inexistente | `GET /api/reservas?q=ZZZ-999` desde módulo de garita | Retorna lista vacía (`[]`) y estado vacío informativo sin errores. | Pendiente |
