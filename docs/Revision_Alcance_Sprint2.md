# Revisión de alcance — Sprint 2 (¿se cumplió al pie de la letra?)

**Fecha:** 08/11/2026 · **Sprint:** 26 oct – 9 nov · **Rama revisada:** `develop` + `fix/UPAO-77-seguridad-api`

## 0. Objetivo y método

Verificar que lo entregado coincide **exactamente** con lo planificado: ni menos (subtareas o criterios sin cumplir) ni más (trabajo fuera de alcance).

**Fuentes normativas usadas:**

| Fuente | Qué aporta |
| --- | --- |
| `subtareas-sprint2.txt` | Descomposición aprobada del sprint: 4 historias, 21 subtareas, con la descripción de lo que debe entregar cada una. |
| Criterios de aceptación de cada historia (en el mismo archivo) | 23 criterios verificables. |
| `AGENTS.md` §8 | Regla de alcance: solo lo planificado, prohibido adelantar o revivir alcance. |
| `AGENTS.md` §11 y §13 | Reglas de documentación obligatoria por subtarea. |

**Evidencia usada:** código en `src/` y `public/`, historial de Git, `docs/modulos/*/`, y las suites automatizadas (`npm run test:*`).

**Límite explícito:** no hay acceso a la API de Jira. Los estados del tablero provienen de la captura del 07/11 y del propio repositorio; si Jira dice algo distinto de lo que el repo demuestra, manda el repo.

**Criterio de veredicto:**

- **CUMPLE** — el entregable existe, corresponde a lo descrito y es verificable.
- **PARCIAL** — existe pero no cubre todo lo que la subtarea o el criterio pide.
- **FALTA** — no existe el entregable.
- **DE MÁS** — trabajo entregado que no estaba planificado.

---

## 1. Subtareas: plan vs. realidad

### Historia 1 — UPAO-9 Adjuntar notas (2 SP)

| Subtarea | Entregable que exige el plan | Evidencia encontrada | Veredicto |
| --- | --- | --- | --- |
| 1.1 Configuración de entornos y reglas | `Estrategia_Ambientes_Blue_Green_y_Pruebas.md`, AGENTS con prohibición de merge directo, plantilla `plan-pruebas.md` | Documento existe; AGENTS §7 y §13 recogen la regla y la plantilla obligatoria | **CUMPLE** |
| 1.2 Análisis y diseño | Campo `notas` VARCHAR(250) opcional, inmutabilidad, auditoría automática, flujo de visualización en Salidas | `docs/modulos/ingreso/analisis-notas.md` + ERD y modelo de datos actualizados (commit `7e28297`) | **CUMPLE** |
| 1.3 Prototipado | Campo con contador 0/250, envío con vacío permitido, tarjeta destacada en Salida | Implementado en `index.html` (`maxlength="250"`, `#contador-nota`) y `style.css`; especificado en `analisis-notas.md` §7. **Pero `docs/modulos/ingreso/ui.md` no menciona el contador ni el campo de notas**: el artefacto de prototipado no lo documenta | **PARCIAL** |
| 1.4 Codificación | Migración, `POST /api/ingresos` con nota, `GET /api/salidas/activos` con nota, sin PUT/PATCH/DELETE | Migración `20261026014805_add_campo_nota_estadia`; `ingresos.js` L69-80 y L116-142; `salidas.js` L47-57; no existen rutas de edición | **CUMPLE** |
| 1.5 Pruebas y depuración | Casos funcionales + `plan-pruebas.md` con Defect Log + **video MP4** | `ingreso/plan-pruebas.md` con CP-N01…N05 y Defect Log (DEF-N01). **No hay video**: `docs/modulos/ingreso/` no tiene carpeta `evidencias/` ni archivo `.mp4` | **PARCIAL** |
| 1.6 Integración y despliegue | PR a `develop`, verificación de build, despliegue y validación en Blue | No existe `docs/modulos/ingreso/evidencia-despliegue.md`. Los módulos de Gráficos, Ocupación y Espacios Públicos sí lo tienen; Ingreso no | **FALTA** |

### Historia 2 — UPAO-18 Gráficos de ingresos (5 SP)

| Subtarea | Entregable | Evidencia | Veredicto |
| --- | --- | --- | --- |
| 2.1 Análisis y diseño | Query por día y método, validaciones, formato de exportación, estado sin datos | `graficosEstadisticos/analisis.md` (20 KB) | **CUMPLE** |
| 2.2 Prototipado (UPAO-65) | Selector mes/año con bloqueo, barras, dona, formato `S/ 0.00`, botón exportar | `ui.md` + commits `0555f11`, `31e87d8` | **CUMPLE** |
| 2.3 Codificación (UPAO-66) | `GET /api/reportes/graficos-mes`, agregaciones, gráficos, exportación, mensaje de cero | `api.md` + `ba7d714` | **CUMPLE** |
| 2.4 Pruebas (UPAO-67) | Matriz + Defect Log + video MP4 | `plan-pruebas.md` (20 verificaciones) + `demostracion_pruebas_graficos_upao67.mp4` | **CUMPLE** |
| 2.5 Integración y despliegue (UPAO-68) | PR, no regresión, despliegue y verificación en Blue | `evidencia-despliegue.md` + `despliegue_render_blue_upao68.png` | **CUMPLE** |

### Historia 3 — UPAO-19 Consultar nivel de ocupación (2 SP)

| Subtarea | Entregable | Evidencia | Veredicto |
| --- | --- | --- | --- |
| 3.1 Análisis y diseño (UPAO-69) | Algoritmo de concurrencia máxima, bloques horarios, validaciones de rango, estructura de exportación | `ocupacion/analisis.md` + `182eb3e` | **CUMPLE** |
| 3.2 Prototipado (UPAO-70) | Formulario de rango, tarjetas, gráfico de barras, estado sin movimientos | `ui.md` + `61e55c7` | **CUMPLE** |
| 3.3 Codificación (UPAO-71) | `GET /api/ocupacion`, validaciones, aforo concurrente, bloques, exportación | `api.md` + `278382a` | **CUMPLE** |
| 3.4 Pruebas y depuración (UPAO-72) | Casos de validación de fechas, aforo concurrente, bloques, rango sin movimientos + `plan-pruebas.md` con Defect Log y video MP4 | **No existe `docs/modulos/ocupacion/plan-pruebas.md`** ni video. Solo hay capturas en `evidencias/` y la suite `test-no-regresion.js` (REG-06 a REG-08). La propia `evidencia-despliegue.md` marca UPAO-72 como completada apuntando únicamente a la carpeta de capturas | **FALTA** |
| 3.5 Integración y despliegue (UPAO-73) | PR, no regresión, despliegue y verificación en Blue | `evidencia-despliegue.md` + `907a450` | **CUMPLE** |

### Historia 4 — UPAO-20 Ver espacios disponibles (1 SP)

| Subtarea | Entregable | Evidencia | Veredicto |
| --- | --- | --- | --- |
| 4.1 Análisis y diseño | Fórmula con piso en 0, acceso público, redirección a Login, regla de aforo cero | `espacios-publicos/analisis.md` + `3186090` | **CUMPLE** |
| 4.2 Prototipado | Vista responsiva, dos paneles, estado crítico, botón Reservar | `ui.md` + `8570eaf` | **CUMPLE** |
| 4.3 Codificación | `GET /api/publico/disponibilidad`, refresco, redirección, bloqueo de botones | `publico.js`, `disponibilidad.js` + `8570eaf` | **CUMPLE** |
| 4.4 Pruebas (UPAO-77) | Matriz, Defect Log, video MP4 | `plan-pruebas.md` (17 casos, 11 defectos) + `demostracion_pruebas_disponibilidad_upao77.mp4` | **CUMPLE** |
| 4.5 Integración y despliegue (UPAO-78) | PR, validación en Blue, compatibilidad | `evidencia-despliegue.md` + `f4f1fb6` | **CUMPLE** |

### Resumen de subtareas

| Veredicto | Cantidad | Detalle |
| --- | --- | --- |
| CUMPLE | 17 de 21 | — |
| PARCIAL | 2 de 21 | **1.3** (prototipado no documentado en `ui.md`) · **1.5** (sin video de pruebas) |
| FALTA | 2 de 21 | **1.6** (sin evidencia de despliegue) · **3.4** (sin `plan-pruebas.md` ni video) |

---

## 2. Criterios de aceptación: 23 criterios

| Historia | Criterio | Implementación | Veredicto |
| --- | --- | --- | --- |
| **UPAO-9** | Campo opcional en Ingresos | `#input-nota-ingreso` | CUMPLE |
| | Hasta 250 caracteres | `maxlength` + validación backend | CUMPLE |
| | Permite vacío o solo espacios | `trim()` → `null`, sin error | CUMPLE |
| | Vinculación permanente e inmutable | Sin rutas PUT/PATCH/DELETE; `POST /api/salidas` ignora `nota` | CUMPLE |
| | ID recepcionista y timestamp automáticos | `idUsuario` + `horaIngreso` por defecto | CUMPLE |
| | Muestra destacada en Salidas antes del cobro | Callout ámbar `#salida-nota-container` | CUMPLE |
| **UPAO-18** | Selector mes/año, mes actual, bloqueo de futuros | `#select-mes-estadisticas` + 400 en API | CUMPLE |
| | Gráfico diario | SVG, 31 barras | CUMPLE |
| | Gráfico por método de pago | Dona | CUMPLE |
| | Formato `S/ 0.00` | Verificado con regex en 20 casos | CUMPLE |
| | Mensaje oficial en meses sin ventas | Texto exacto | CUMPLE |
| | Exportación CSV/Excel | CSV con BOM (abre en Excel) | CUMPLE |
| **UPAO-19** | Selector de rango con validaciones | `/api/ocupacion` valida futuras e invertidas | CUMPLE |
| | Tarjetas de resumen (autos/motos, aforo máximo) | `resumen` del endpoint | CUMPLE |
| | Gráfico por bloques horarios | `bloquesHorarios` + `esPico` | CUMPLE |
| | Rango sin movimientos (ceros y mensaje) | `sinDatos: true` + mensaje | CUMPLE |
| | **Exportación a Excel o PDF** | `formato=excel` es aceptado pero devuelve **el mismo CSV** con extensión `.csv` y `Content-Type: text/csv`. Existe un PDF suelto en `evidencias/03_reporte_ocupacion.pdf` obtenido fuera de la aplicación | **PARCIAL** |
| **UPAO-20** | Consulta previa sin reservar | Vista pública | CUMPLE |
| | Dos paneles con capacidad y cupos | Verificado UI = API | CUMPLE |
| | Fórmula `Capacidad − EnCochera − Reservas`, mínimo 0 | Implementada; `reservasVigentes` siempre 0 porque las reservas son UPAO-21 | CUMPLE con salvedad |
| | **Actualización en tiempo real** | Refresco por *polling* cada 30 s, no tiempo real | **PARCIAL** |
| | Indicador rojo "Aforo lleno" y botones bloqueados | Verificado en E2E | CUMPLE |
| | Vista pública + redirección a Login | Verificado en E2E | CUMPLE |

**Resumen de criterios:** 20 de 23 CUMPLE, 3 PARCIAL, 0 FALTA.

Las tres parcialidades son **decisiones técnicas defendibles**, no negligencias: Excel se resuelve con CSV porque no hay librería `.xlsx`; "tiempo real" se resolvió con polling de 30 s por la misma razón; y las reservas no se pueden descontar porque la entidad no existe (UPAO-21 está en backlog). Pero conviene que en Jira queden escritas como cumplimiento parcial y no como cumplimiento total.

---

## 3. Lo que se hizo DE MÁS (fuera de la planificación)

Aquí está la desviación más importante de todo el sprint:

| Trabajo no planificado | Alcance | Por qué es una desviación |
| --- | --- | --- |
| **Módulo completo de autenticación** (`src/config/auth.js`, emisión de token en `auth.js`, `autenticar`/`autorizar` en `server.js`, gating de tarifas y capacidad, manejo de sesión en `app.js`, `AUTH_SECRET`, endpoint `/api/auth/sesion`, persistencia en `sessionStorage`) | ~150 líneas en 6 archivos + 2 suites nuevas | **Ninguna de las 21 subtareas lo contempla.** Se hizo por pedido directo del usuario a mitad de la revisión de UPAO-77, no por una subtarea de Jira. |
| Campo `total.otrosEnCochera` en la API pública | 1 campo | Extiende el contrato que define `api.md`. Justificado como observabilidad de un defecto, pero no estaba pedido. |
| Suites `test-seguridad-api.js` y `test-concurrencia-aforo.js` | 2 archivos | La subtarea 4.4 pide `plan-pruebas.md` + video, no suites nuevas. Aportan valor, pero son entregables adicionales. |
| Limpieza de `.gitignore` y borrado del `.webm` | 2 líneas + 1 archivo | Housekeeping no planificado. |

**Lo que NO es desviación:** actualizar `AGENTS.md`, `Arquitectura.md`, `api.md` y `plan-pruebas.md`. §11 de `AGENTS.md` obliga a documentar en la misma rama; sin eso las tareas no estarían terminadas.

**Consecuencia formal:** el trabajo de autenticación, al no tener subtarea, **no puede marcarse como nada en Jira**. Tiene dos salidas honestas: (a) registrarlo como Historia técnica del Sprint 3 y moverlo a una rama propia, o (b) considerarlo un ajuste de alcance aprobado por el dueño del producto —lo que §8 exige documentar antes de programar, y aquí se aprobó después—.

---

## 4. Deuda de orden que no es de alcance pero conviene limpiar

- `docs/modulos/aforo/` contiene tres archivos vacíos o casi vacíos (`aforo.md` 0 bytes, `analisis.md` 179 bytes, `api.md` 355 bytes), residuo de la rama `feature/aforo` que fue revertida. Confunde junto al módulo `espacios/` que sí es válido.
- `docs/modulos/espacios-publicos/evidencias/` mezcla capturas del prototipado (UPAO-76) con las de pruebas (UPAO-77), en subcarpetas distintas pero con numeración repetida.

---

## 5. Qué falta para poder decir "el Sprint 2 se cumplió al pie de la letra"

Cuatro acciones, en orden de costo:

1. **`docs/modulos/ocupacion/plan-pruebas.md`** (subtarea 3.4). Es el hueco más visible: UPAO-72 figura como terminada pero su entregable obligatorio no existe. Los casos ya se ejecutaron (`REG-06` a `REG-08` y las capturas `evidencias/upao-71/`), así que es principalmente redactar la matriz y el Defect Log, más un video.
2. **`docs/modulos/ingreso/evidencia-despliegue.md`** (subtarea 1.6). Mismo patrón que los otros tres módulos; se resuelve documentando el PR #18/#19 y la validación en Blue.
3. **Video MP4 de las pruebas de notas** (subtarea 1.5) y una sección del campo de notas en `ingreso/ui.md` (subtarea 1.3). Ambas son de redacción/grabación, no de código.
4. **Resolver la situación en Jira del módulo de autenticación**: Historia técnica en el Sprint 3 o aprobación de alcance registrada.

Ninguna de las cuatro toca código en producción ni bloquea la demo.
