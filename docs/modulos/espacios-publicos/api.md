# Módulo Vista Pública de Disponibilidad — Especificación de API (UPAO-20)

Endpoint público para que cualquier conductor consulte, sin autenticarse, los cupos disponibles de autos y motos.

---

## 1. `GET /api/publico/disponibilidad`

Consulta la capacidad configurada, las estadías activas y las reservas vigentes para calcular los espacios disponibles de cada tipo de vehículo.

### Request

- **Headers:** `Accept: application/json`
- **Autenticación:** ninguna. No requiere token ni cookie de sesión.
- **Query Parameters:** ninguno.

#### Ejemplo de llamada:

```http
GET /api/publico/disponibilidad HTTP/1.1
Host: localhost:3000
Accept: application/json
```

---

### Response Exitosa (`200 OK`)

Ejemplo verificado con datos de staging (05/11/2026):

```json
{
  "autos": {
    "capacidad": 10,
    "enCochera": 7,
    "reservasVigentes": 0,
    "disponibles": 3
  },
  "motos": {
    "capacidad": 10,
    "enCochera": 5,
    "reservasVigentes": 0,
    "disponibles": 5
  },
  "total": {
    "capacidad": 20,
    "enCochera": 12,
    "reservasVigentes": 0,
    "disponibles": 8,
    "otrosEnCochera": 0
  },
  "ultimaActualizacion": "2026-11-05T16:14:06.601Z"
}
```

| Campo | Descripción |
| --- | --- |
| `autos` / `motos` | Objetos independientes por tipo de vehículo. |
| `capacidad` | Plazas configuradas para el tipo en `src/config/espacios.json`. |
| `enCochera` | Estadías activas (`horaSalida IS NULL`) del tipo. |
| `reservasVigentes` | Reservas confirmadas no vencidas. En Sprint 2 siempre es `0` porque la tabla `reserva` pertenece a UPAO-21. |
| `disponibles` | `Math.max(0, capacidad - enCochera - reservasVigentes)`. |
| `total.enCochera` | Todas las estadías activas, incluidos los tipos fuera de `autos` y `motos`. |
| `total.otrosEnCochera` | Estadías activas de tipos distintos de "Automóvil / Camioneta" y "Motocicleta" (p. ej. "Reserva Web"). Si es mayor que `0` el servidor emite una advertencia en el log: es un dato de observabilidad para detectar que el aforo por tipo no las está descontando (ver DEF-77-02 en `plan-pruebas.md`). |
| `ultimaActualizacion` | Momento del cálculo en servidor, en formato ISO 8601 UTC. |

### Cabeceras de la respuesta

| Cabecera | Valor | Motivo |
| --- | --- | --- |
| `Content-Type` | `application/json; charset=utf-8` | Estándar. |
| `Cache-Control` | `no-store, max-age=0` | Los cupos cambian en segundos; ninguna caché intermedia (navegador, proxy o CDN) debe servirlos desactualizados. Antes de la depuración de UPAO-77 esta cabecera no se enviaba (DEF-77-03). |

---

### Response de Error (`500 Internal Server Error`)

```json
{
  "error": "No se pudo consultar la disponibilidad de espacios."
}
```

---

## 2. Reglas de Negocio y Cálculo

1. **Fórmula con piso matemático:**

   ```text
   Disponibles_tipo = max(0, Capacidad_tipo - EnCochera_tipo - ReservasVigentes_tipo)
   ```

   El piso evita valores negativos ante un exceso temporal de ocupación.

2. **Capacidad:** se obtiene con `obtenerCapacidad()` desde `src/config/espacios.js`, que lee `src/config/espacios.json` (por defecto 10 autos + 10 motos = 20). El valor `0` es válido (cochera cerrada).

3. **Estadías activas:** se agrupan con `groupBy(idTipoVehiculo)` todas las filas de `estadia` con `horaSalida IS NULL`. Los tipos "Automóvil / Camioneta" y "Motocicleta" alimentan `autos` y `motos`; cualquier otro tipo se refleja en `total.otrosEnCochera` (antes se descartaba en silencio, DEF-77-02).

4. **Reservas vigentes:** el término existe en la fórmula para no refactorizar cuando se implemente UPAO-21. Durante Sprint 2 se envía `0`.

5. **Datos expuestos:** solo capacidad, ocupación y disponibilidad. No se devuelven placas, usuarios, tarifas ni información sensible.

6. **Actualización:** el endpoint envía `Cache-Control: no-store`; el frontend lo consulta al abrir la vista y cada 30 segundos mediante polling.

7. **Acceso público:** la ruta se monta en `server.js` como `app.use('/api/publico', publicoRoutes)` **antes** de `app.use('/api', autenticar)`, por lo que es la única ruta de datos que no exige sesión. El resto de la API sí la exige (ver §4).

---

## 4. Autenticación de la API

Desde UPAO-77 (DEF-77-07) ninguna ruta interna responde sin sesión.

| Ruta | Método | Acceso |
| --- | --- | --- |
| `/api/auth/login` | POST | Público. Devuelve `usuario`, `nombre`, `rol`, `token` y `expiraEnHoras`. |
| `/api/auth/sesion` | GET | Requiere token. Devuelve la sesión asociada (útil para restaurar el estado tras recargar). |
| `/api/publico/*` | GET | Público por diseño. |
| `/api/ingresos/*`, `/api/salidas/*`, `/api/espacios` (GET), `/api/tarifas` (GET) | — | Requiere token de cualquier rol. |
| `PUT /api/tarifas/:id`, `PUT /api/espacios/capacidad` | PUT | Solo rol `DUENO`. |
| `/api/reportes/*`, `/api/ocupacion/*` | GET | Solo rol `DUENO`. |

- **Cabecera:** `Authorization: Bearer <token>`.
- **Token:** cadena `payload.firma` firmada con HMAC-SHA256 por `src/config/auth.js`. La firma se compara en tiempo constante y la vigencia (por defecto 8 h, `AUTH_TTL_HORAS`) se valida en cada petición.
- **Secreto:** variable de entorno `AUTH_SECRET`. Si no está definida se genera uno aleatorio por proceso y las sesiones caen al reiniciar; debe configurarse en Render.
- **Errores:** `401` sin token, token manipulado o expirado; `403` con token válido pero rol sin permiso.

```http
GET /api/espacios HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJzdWIiOjEsInVzdcGF5bG9hZC5maXJtYQ
```

---

## 3. Integración

| Punto | Referencia |
| --- | --- |
| Montaje de la ruta | `server.js` |
| Implementación | `src/routes/publico.js` |
| Capacidad configurada | `src/config/espacios.js` + `src/config/espacios.json` |
| Consumo desde la vista | `public/js/disponibilidad.js` → `GET /api/publico/disponibilidad` |
| Vista pública | `public/index.html` → `#view-disponibilidad` |
