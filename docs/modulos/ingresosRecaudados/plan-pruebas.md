# Plan de Pruebas y Registro de Depuración — Módulo Reporte de Ingresos (UPAO-55 / UPAO-17)

## 1. Objetivo

Verificar el correcto funcionamiento del módulo de **Reporte de Ingresos Diarios y Cuadre de Caja** (UPAO-17 / UPAO-55): consulta de cobros en tiempo real, agregación y sumatoria por método de pago (`Efectivo` y `Yape`), desglose de dinero físico y digital, componentes interactivos de filtrado, restricción de roles y registro de los defectos detectados y superados durante la fase de depuración.

---

## 2. Alcance

- Acceso exclusivo al módulo desde el Menú Principal únicamente para el rol **DUEÑO** (oculto para **RECEPCIONISTA**).
- Carga automática del consolidado del día actual en hora peruana (`America/Lima`, UTC-5).
- Validación de fechas: formato oficial peruano (`dd/mm/aaaa`), bloqueo de fechas futuras y consulta de fechas pasadas.
- Cálculo de cuadre de caja: dinero físico (efectivo en caja), dinero digital (Yape / banco) y monto total general.
- Componentes interactivos de filtrado por método de pago (pills y tarjetas interactivas).
- Presentación de la tabla de transacciones ordenada cronológicamente de forma descendente.
- Despliegue del estado sin movimientos ante fechas sin cobros registrados.

---

## 3. Entorno de Pruebas

- **Servidor:** Node.js con Express (`http://localhost:3000`)
- **Base de Datos:** PostgreSQL en Neon (compartida)
- **Cuentas de prueba:**
  - `admin` / `123456` (Rol: DUEÑO)
  - `recepcion` / `123456` (Rol: RECEPCIONISTA)
- **Automatización y Video:** Playwright Chromium con cursor visual y captura en formato estándar MP4.

---

## 4. Casos de Prueba Ejecutados

| ID | Caso de Prueba | Pasos a Ejecutar | Resultado Esperado | Resultado |
|---|---|---|---|:---:|
| **CP-01** | Acceso exclusivo para DUEÑO | Iniciar sesión como `admin` | Se visualiza la tarjeta "Reporte de Ingresos" en el menú | **PASA** |
| **CP-02** | Carga inicial y formato peruano | Ingresar al módulo de reportes | Carga la fecha actual por defecto en formato `dd/mm/aaaa` | **PASA** |
| **CP-03** | Cuadre de caja y desglose | Observar tarjetas de Efectivo, Yape y Total General | Suma exacta de cobros físicos y digitales con barra porcentual | **PASA** |
| **CP-04** | Filtro interactivo por método (Yape) | Dar clic en el pill o card de Yape | Filtra la tabla mostrando exclusivamente pagos digitales | **PASA** |
| **CP-05** | Filtro interactivo por método (Efectivo) | Dar clic en el pill o card de Efectivo | Filtra la tabla mostrando exclusivamente pagos en efectivo | **PASA** |
| **CP-06** | Consulta de fechas anteriores | Seleccionar fecha de ayer y dar clic en "Consultar" | Actualiza totales y tabla con los movimientos del día elegido | **PASA** |
| **CP-07** | Bloqueo de fecha futura | Intentar seleccionar una fecha posterior a hoy | Muestra error `Seleccione una fecha válida que no sea futura.` | **PASA** |
| **CP-08** | Estado sin movimientos | Consultar una fecha sin cobros registrados | Muestra montos en S/ 0.00 y el mensaje informativo oficial | **PASA** |
| **CP-09** | Restricción de acceso para Recepción | Iniciar sesión como `recepcion` | La tarjeta de Reporte de Ingresos no aparece en el menú | **PASA** |

---

## 5. Registro de Defectos Depurados y Superados (Defect Log)

Durante la fase de integración y pruebas se detectaron y corrigieron los siguientes defectos:

| ID | Caso | Falla Encontrada | Causa Raíz | Corrección Aplicada | Commit | Estado |
|---|---|---|---|---|---|:---:|
| **DEF-01** | CP-03 / CP-06 | Desfase en los cobros nocturnos al consultar por fecha en BD. | El rango del día se construía en UTC (`Z`), provocando que cobros entre 7:00 PM y 11:59 PM hora de Perú cayeran en el día siguiente. | Se implementó la función `obtenerRangoFechaPeru` con offset estricto `-05:00` (`T00:00:00-05:00` a `T23:59:59.999-05:00`). | [`f93a720`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/f93a720) | **SUPERADO** |
| **DEF-02** | CP-08 | En días sin cobros, la barra de desglose mostraba `NaN%`. | División entre cero al calcular `(totalEfectivo / totalGeneral) * 100` cuando `totalGeneral === 0`. | Se agregaron validaciones de guarda en backend y frontend para asignar `0%` de manera segura. | [`f93a720`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/f93a720) | **SUPERADO** |
| **DEF-03** | CP-07 | El usuario podía escribir manualmente fechas futuras en el selector. | El input no tenía límite superior y el backend no validaba la fecha contra el día presente. | Se añadió atributo `max` dinámico en frontend y validación HTTP 400 en el backend con mensaje informativo. | [`f93a720`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/f93a720) | **SUPERADO** |

---

## 6. Evidencias y Trazabilidad en GitHub

- **Video Demostrativo MP4 (Pruebas E2E y Depuración):**
  - Archivo en repositorio: [`demostracion_pruebas_depuracion_upao55.mp4`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/ingresosRecaudados/evidencias/demostracion_pruebas_depuracion_upao55.mp4)
- **Commits y Merges de la Tarea en GitHub (UPAO-55):**
  - Commit de Documentación de Pruebas y Video: [`65a3380`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/65a3380)
  - Merge Commit a `develop`: [`42a5c13`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/42a5c13)
  - Rama de la Tarea: [`feature/UPAO-55-pruebas-depuracion-reportes`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/UPAO-55-pruebas-depuracion-reportes)
- **Trazabilidad con Tareas Previas del Módulo:**
  - **UPAO-54 (Backend y Lógica de Cuadre de Caja):**
    - Commit de Implementación: [`f93a720`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/f93a720)
    - Merge Commit a `develop`: [`d99ac5c`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/d99ac5c)
    - Rama: [`feature/UPAO-54-logica-reporte-ingresos`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/UPAO-54-logica-reporte-ingresos)
  - **UPAO-53 (Prototipo e Interfaz de Reportes):**
    - Commit de Interfaz: [`819b842`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/819b842)
    - Commit de Documentación: [`b71515b`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/b71515b)
    - Merge Commit a `develop`: [`2ba4628`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/2ba4628)
    - Rama: [`feature/UPAO-53-interfaz-reporte-ingresos`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/UPAO-53-interfaz-reporte-ingresos)


