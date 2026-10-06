# Módulo Tarifas — API y conexión (UPAO-16 / UPAO-34)

Backend Express + Prisma que da funcionalidad a las pantallas existentes: **login**, **menú** y **módulo de tarifas**.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run db:seed` | Carga datos iniciales (tipos, tarifas, métodos de pago, usuario). |
| `npm run dev` | Levanta el servidor en `http://localhost:3000`. |

## Endpoints

### POST `/api/auth/login`

Da funcionalidad al botón "Ingresar al Sistema".

```json
// Petición
{ "usuario": "admin", "contrasena": "123456" }

// Respuesta 200
{ "usuario": "admin", "nombre": "Administrador", "rol": "DUENO" }

// Respuesta 401
{ "error": "Credenciales inválidas." }
```

### GET `/api/tarifas`

Llena la tabla "Tarifas Actuales" del módulo.

```json
[
  { "id": 1, "tipo": "Automóvil / Camioneta", "precioHora": 4.5, "precioFraccion": 2.5, "estado": true },
  { "id": 2, "tipo": "Motocicleta", "precioHora": 2.5, "precioFraccion": 1.5, "estado": true },
  { "id": 3, "tipo": "Reserva Web", "precioHora": 5.0, "precioFraccion": 3.0, "estado": true }
]
```

### PUT `/api/tarifas/:id`

Da funcionalidad al botón "Guardar Tarifa".

- Valida monto con la RegEx de la guía de estilos: `^\d+(\.\d{1,2})?$`, rango `0.01` a `999.99`.
- Respuesta 200: incluye `"mensaje": "Tarifa actualizada correctamente"` (criterio de aceptación UPAO-16).

```json
// Petición
{ "precioHora": "5.50", "precioFraccion": "3.00" }

// Respuesta 400 (monto inválido)
{ "error": "Ingrese un monto numérico válido mayor a 0.00 (ej. 4.50)." }
```

## Credenciales de desarrollo (seed)

| Usuario | Nombre | Contraseña | Rol |
| --- | --- | --- | --- |
| `admin` | Administrador | `123456` | DUEÑO |
| `recepcion` | Recepcionista | `123456` | RECEPCIONISTA |

> Cambiar antes de cualquier despliegue real. La contraseña se guarda hasheada con bcrypt.

## Estructura

| Archivo | Rol |
| --- | --- |
| `server.js` | Servidor Express (estáticos + API). |
| `src/config/prisma.js` | Cliente Prisma compartido. |
| `src/routes/auth.js` | Login contra la tabla `usuario`. |
| `src/routes/tarifas.js` | Consulta y actualización de tarifas. |
| `prisma/seed.js` | Datos iniciales. |
| `public/js/app.js` | Interfaz conectada a la API (`fetch`). |
