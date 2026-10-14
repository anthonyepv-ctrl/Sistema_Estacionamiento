# Plan de Pruebas y Depuración — Módulo Espacios y Aforo (UPAO-11)

## 1. Objetivo

Verificar el funcionamiento del módulo de **Visualización de Aforo y Estado de Espacios** (UPAO-11): consulta en tiempo real, cálculo de disponibilidad por totales, control preventivo de ingreso, liberación en salida, reconocimiento de formatos de placas oficiales según norma MTC y registro/depuración de los defectos encontrados.

---

## 2. Alcance

- Acceso al módulo desde el menú principal según roles (`DUEÑO` y `RECEPCIONISTA`).
- Consistencia del control de vistas (sin superposiciones en login).
- Contadores y barras de disponibilidad para autos y motos.
- Validación y detección automática de placas según norma MTC (autos de 6 caracteres, motos de transición de 6 caracteres y motos definitivas con RFID de 7 caracteres).
- Listado de vehículos activos dentro de la cochera (placas reales).
- Bloqueo preventivo en ingreso cuando el aforo está completo.

---

## 3. Entorno de Pruebas

- **Servidor:** `npm run dev` → `http://localhost:3000`
- **Base de datos:** PostgreSQL en Neon (compartida)
- **Usuarios de prueba:**
  - `recepcion` / `123456` (RECEPCIONISTA)
  - `admin` / `123456` (DUEÑO)
- **Grabación de evidencia:** Grabación de pantalla con herramienta de Windows (`Win + Alt + R` o Herramienta Recortes).

---

## 4. Casos de Prueba

| ID | Caso de Prueba | Pasos a Ejecutar | Resultado Esperado | Resultado |
|---|---|---|---|:---:|
| **CP-01** | Acceso a Visualizar Aforo | Iniciar sesión como `recepcion` o `admin` y dar clic en "Visualizar Aforo" | Abre la pantalla de aforo de manera exclusiva y limpia | **PASA** |
| **CP-02** | Contadores y disponibilidad | Observar tarjetas de Sector Autos y Sector Motos | Muestra cupos disponibles y ocupados calculados desde la BD | **PASA** |
| **CP-03** | Reconocimiento Auto (6 car. termina en 3 núm.) | En Ingreso escribir `ABC123` o `D4F567` | Formatea a `ABC-123` / `D4F-567` y selecciona Automóvil | **PASA** |
| **CP-04** | Reconocimiento Moto Transición (6 car. termina en 4 núm.) | En Ingreso escribir `AB1234`, `A12345` o `1234AB` | Formatea con guion y selecciona Motocicleta | **PASA** |
| **CP-05** | Reconocimiento Moto Definitiva RFID (7 caracteres) | En Ingreso escribir `ACB0000` (3 letras + 4 números) | Formatea a `ACB-0000` y selecciona Motocicleta | **PASA** |
| **CP-06** | Lista de Vehículos en Cochera | Abrir Visualizar Aforo | Muestra las placas reales de los vehículos que están dentro | **PASA** |
| **CP-07** | Bloqueo por aforo lleno | Intentar registrar ingreso cuando disponibles = 0 | Muestra error 409 "Aforo completo" y no permite registrar | **PASA** |
| **CP-08** | Liberación en salida | Registrar salida de un vehículo en cochera | Al volver a Aforo, el contador de ocupados baja en 1 y disponibles sube en 1 | **PASA** |
| **CP-09** | Cierre de sesión limpio | Estando en Aforo, dar clic en "Cerrar Sesión" | Vuelve a la pantalla de login sin superposiciones | **PASA** |

---

## 5. Registro de Defectos y Depuración (Defect Log)

Durante la fase de pruebas se detectaron y depuraron los siguientes defectos:

| ID | Caso Asociado | Comportamiento Esperado | Comportamiento Obtenido (Falla) | Causa Raíz | Corrección Aplicada | Commit de Corrección | Re-probado |
|---|---|---|---|---|---|---|:---:|
| **DEF-01** | CP-01 / CP-09 | Al cerrar sesión, debe verse únicamente el formulario de login. | La pantalla de Aforo se mostraba superpuesta debajo del login. | La función `mostrarPantalla()` en `app.js` no apagaba la clase `.active` de la nueva vista `view-aforo`. | Se actualizó `mostrarPantalla()` para remover `.active` de todas las vistas con `querySelectorAll('.view-section')`. | `4c0cdd6` | **PASA** |
| **DEF-02** | CP-04 / CP-05 | Reconocer motos de 7 caracteres (`ACB0000`) y de 6 caracteres que terminan en 4 números (`A12345`). | Las placas de 7 caracteres se truncaban y no se reconocían como motos. | `maxlength="7"` impedía escribir el guion con 7 caracteres, y `analizarPlaca` solo contemplaba motos clásicas de 6 dígitos. | Se ajustó `PLACA_REGEX`, `analizarPlaca`, `normalizarPlaca` y `maxlength="8"` según la norma oficial MTC. | `8a3ec3e` | **PASA** |
| **DEF-03** | CP-06 | Listar los vehículos y placas reales que están dentro de la cochera. | Se mostraba una lista con plazas ficticias quemadas (`A-01`, `A-02`...). | El archivo `aforo.js` de prototipo usaba un arreglo estático de plazas simuladas. | Se conectó `aforo.js` al endpoint `GET /api/espacios` para renderizar las placas reales de la BD. | `45625d2` | **PASA** |

---

## 6. Evidencia para Jira

1. **Capturas de defectos:**
   - Captura del defecto `DEF-01` (pantalla de login superpuesta con aforo antes de la corrección).
   - Captura de la tabla de patrones de placa MTC (`DEF-02`).
2. **Video de prueba (Grabación manual):**
   - Video recorriendo los casos CP-01 a CP-09 demostrando que todos los defectos fueron depurados con éxito.
