# Evidencia de pruebas — UPAO-34 (login y tarifas conectados a la BD)

Fecha: 2026-10-05
Entorno: Node v22.17.1 · Express 5 · Prisma 6.19.3 · PostgreSQL Neon (sa-east-1) · Windows

## Pruebas de API (ejecutadas con el servidor en `http://localhost:3000`)

| # | Prueba | Comando / acción | Resultado esperado | Resultado obtenido |
| --- | --- | --- | --- | --- |
| 1 | Login válido | `POST /api/auth/login` con `admin` / `123456` | 200 con usuario, nombre y rol | `{"usuario":"admin","nombre":"Administrador","rol":"DUENO"}` |
| 2 | Login inválido | `POST /api/auth/login` con contraseña incorrecta | 401 | `{"error":"Credenciales inválidas."}` |
| 3 | Listar tarifas | `GET /api/tarifas` | 3 tarifas desde la BD | Automóvil/Camioneta 4.50/2.50 · Motocicleta 2.50/1.50 · Reserva Web 5.00/3.00 |
| 4 | Actualizar tarifa | `PUT /api/tarifas/1` con `4.50` / `2.50` | 200 con mensaje | `{"id":1,...,"mensaje":"Tarifa actualizada correctamente"}` |
| 5 | Monto inválido | `PUT /api/tarifas/1` con `-5` / `abc` | 400 con mensaje de validación | `{"error":"Ingrese un monto numérico válido mayor a 0.00 (ej. 4.50)."}` |

## Verificación en la base de datos (Neon)

```sql
SELECT id_usuario, usuario, nombre, rol FROM usuario ORDER BY id_usuario;
-- 1 | admin     | Administrador | DUEÑO
-- 3 | recepcion | Recepcionista | RECEPCIONISTA

SELECT id_tarifa, precio_hora, precio_fraccion, estado FROM tarifa ORDER BY id_tarifa;
```

## Capturas sugeridas (adjuntar al ticket/PR)

1. Login exitoso → dashboard con `Administrador · DUEÑO` en el header.
2. Login con contraseña incorrecta → toast rojo "Credenciales inválidas."
3. Módulo Tarifas → tabla con las 3 tarifas traídas de la BD.
4. Cambio de precio → toast verde "Tarifa actualizada correctamente".
5. Monto inválido (`-5` o `abc`) → mensaje rojo bajo el campo.
6. Neon SQL Editor → `SELECT * FROM tarifa;` con el precio ya cambiado (prueba de persistencia).

> No capturar el archivo `.env` ni la cadena de conexión (contienen la contraseña).

## Criterios de aceptación cubiertos (UPAO-16 / UPAO-34)

- [x] El sistema permite consultar todas las tarifas registradas.
- [x] El dueño puede modificar los valores según tipo de vehículo/servicio.
- [x] El sistema valida que la nueva tarifa sea un valor numérico (0.01–999.99).
- [x] Al guardar, la tarifa queda registrada en la BD y se usa para los nuevos cobros.
- [x] Al registrar la tarifa se muestra "Tarifa actualizada correctamente".
