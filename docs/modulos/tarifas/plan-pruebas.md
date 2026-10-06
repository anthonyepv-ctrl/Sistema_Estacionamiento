# Plan de pruebas — Módulo Tarifas (UPAO-35)

## Objetivo

Verificar que el **login** y el **módulo de tarifas** (UPAO-16 / UPAO-34) cumplen los criterios de aceptación, y registrar/depurar los fallos encontrados.

## Alcance

- Login (usuario y contraseña).
- Menú principal (navegación y cierre de sesión).
- Módulo de tarifas (consulta y actualización).

**Fuera de alcance:** ingreso, salida, aforo y reportes (HUs posteriores del sprint).

## Entorno de pruebas

- `npm run dev` → `http://localhost:3000`
- BD compartida (Neon)
- Usuario de prueba: `admin` / `123456` (rol DUEÑO)

## Casos de prueba

### Login

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CP-01 | Login válido | Ingresar `admin` / `123456` → clic "Ingresar al Sistema" | Entra al menú principal; header muestra "Administrador" y rol "DUEÑO" |
| CP-02 | Contraseña incorrecta | `admin` / `clave-mala` | Toast rojo "Credenciales inválidas." y no entra |
| CP-03 | Usuario inexistente | `nadie` / `123456` | Toast rojo "Credenciales inválidas." y no entra |
| CP-04 | Campos vacíos | Dejar usuario o contraseña vacíos → enviar | Mensajes "Ingrese su usuario." / "Ingrese su contraseña." |
| CP-05 | Mostrar/ocultar contraseña | Clic en "Mostrar" | La contraseña se ve; el botón cambia a "Ocultar" y viceversa |

### Menú principal

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CP-06 | Abrir módulo de tarifas | Clic en la tarjeta "Configurar Tarifas" | Se abre el módulo y se cargan las tarifas |
| CP-07 | Cerrar sesión | Clic en "Cerrar Sesión" | Vuelve a la pantalla de login |

### Módulo de tarifas

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CP-08 | Tabla con datos de la BD | Observar "Tarifas Actuales" | 3 filas: Automóvil/Camioneta (4.50/2.50), Motocicleta (2.50/1.50), Reserva Web (5.00/3.00), estado ACTIVA |
| CP-09 | Cargar fila en el formulario | Clic en "Modificar" de una fila | El formulario muestra el tipo y sus precios; el título cambia a "Modificar Tarifa: …" |
| CP-10 | Guardar valor válido | Cambiar precio hora a `4.80` → "Guardar Tarifa" | Toast verde **"Tarifa actualizada correctamente"** y la tabla se actualiza |
| CP-11 | Límite inferior | Precio `0.01` → guardar | Se acepta y guarda |
| CP-12 | Límite superior | Precio `999.99` → guardar | Se acepta y guarda |
| CP-13 | Fuera de rango | Precio `0` o `1000` → guardar | Mensaje rojo "Ingrese un monto válido mayor a 0.00 (ej. 4.50)." |
| CP-14 | Formato inválido | Precio `4.567`, `abc` o `-5` → guardar | Mensaje rojo de validación (no guarda) |
| CP-15 | Cancelar edición | Cambiar valores → clic "Cancelar" | El formulario vuelve a los valores originales |
| CP-16 | Tecla ESC | Cambiar valores → presionar `ESC` | El formulario vuelve a los valores originales |
| CP-17 | Persistencia en BD | Guardar un precio → abrir Neon SQL Editor | `SELECT * FROM tarifa;` muestra el valor nuevo (prueba de persistencia) |

## Registro de resultados (llenar al ejecutar)

| ID | Resultado (PASA/FALLA) | Evidencia | Observaciones |
| --- | --- | --- | --- |
| CP-01 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-02 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-03 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-04 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-05 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-06 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-07 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-08 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-09 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-10 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-11 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-12 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-13 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-14 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-15 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-16 | PASA | Adjunta en Jira (UPAO-35) | |
| CP-17 | PASA | Adjunta en Jira (UPAO-35) | |

> Ejecución: **06/10/2026** — servidor local (`npm run dev`) + BD compartida (Neon). Los 17 casos pasaron.

## Registro de defectos y depuración

| ID | Caso | Pasos para reproducir | Esperado | Obtenido | Causa | Corrección (commit) | Re-probado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-01 | | | | | | | |

> Sin defectos registrados: los 17 casos de prueba pasaron en la primera ejecución.

## Evidencia

- Grabación de pantalla (Windows: `Win+G` o `Win+Alt+R`) de 1–2 min, o capturas por caso.
- Adjuntar en Jira (UPAO-35) y enlazar el PR.
- **No capturar** el archivo `.env` ni la cadena de conexión.
