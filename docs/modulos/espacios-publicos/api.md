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
    "disponibles": 8
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
| `total` | Consolidado de ambos tipos. |
| `ultimaActualizacion` | Momento del cálculo en servidor, en formato ISO 8601 UTC. |

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

2. **Capacidad:** se obtiene con `obtenerCapacidad()` desde `src/config/espacios.js`, que lee `src/config/espacios.json` (por defecto 10 autos + 10 motos = 20).

3. **Estadías activas:** se cuentan las filas de `estadia` con `horaSalida IS NULL`, agrupadas por `Automóvil / Camioneta` y `Motocicleta`.

4. **Reservas vigentes:** el término existe en la fórmula para no refactorizar cuando se implemente UPAO-21. Durante Sprint 2 se envía `0`.

5. **Datos expuestos:** solo capacidad, ocupación y disponibilidad. No se devuelven placas, usuarios, tarifas ni información sensible.

6. **Actualización:** el endpoint no usa caché; el frontend lo consulta al abrir la vista y cada 30 segundos mediante polling.

7. **Acceso público:** la ruta se monta en `server.js` como `app.use('/api/publico', publicoRoutes)` antes del handler 404 y sin middleware de autenticación.

---

## 3. Integración

| Punto | Referencia |
| --- | --- |
| Montaje de la ruta | `server.js` |
| Implementación | `src/routes/publico.js` |
| Capacidad configurada | `src/config/espacios.js` + `src/config/espacios.json` |
| Consumo desde la vista | `public/js/disponibilidad.js` → `GET /api/publico/disponibilidad` |
| Vista pública | `public/index.html` → `#view-disponibilidad` |
