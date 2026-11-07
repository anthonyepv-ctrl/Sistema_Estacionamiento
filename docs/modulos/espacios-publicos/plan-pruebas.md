# Plan de Pruebas y Registro de Depuración — Vista Pública de Disponibilidad (UPAO-77 / UPAO-20)

> **Historia de Usuario:** UPAO-20 — Ver espacios disponibles (1 Story Point)
> **Subtarea:** UPAO-77 — Probar y depurar vista pública de disponibilidad, fórmula de cupos y redirección
> **Épica:** UPAO-28 — Manejo de Reserva Web
> **Responsable:** ALBERTH JAIR FLORES LEONARDO
> **Fecha de Ejecución:** 06/11/2026
> **Resultado Global:** 27 verificaciones E2E + 16 verificaciones adversariales de API; 0 fallas en la suite automatizada, **5 defectos corregidos** y **5 defectos abiertos** de alcance mayor documentados en el Defect Log.

---

## 1. Objetivo

Verificar el módulo de **disponibilidad pública de espacios** contra los criterios de aceptación de la Historia UPAO-20, y someterlo además a una revisión adversarial orientada a encontrar errores "silenciosos": aquellos que no rompen la pantalla pero hacen que el sistema informe datos falsos o cobre de más.

1. **Vista pública sin login:** debe abrirse sin sesión y con "Reservar espacio" redirigiendo a Login.
2. **Dos paneles independientes:** autos y motos, con capacidad total, ocupación y cupos disponibles coherentes con la API.
3. **Fórmula de cupos:** `Disponibles = max(0, Capacidad − EnCochera − ReservasVigentes)`; nunca negativos.
4. **Actualización periódica:** refresco automático de los cupos sin recargar la página.
5. **Estado crítico:** con 0 cupos, tarjeta en rojo, insignia "Aforo lleno" y botón bloqueado.
6. **Revisión adversarial:** qué ocurre con datos inesperados, doble clic en operaciones de dinero, concurrencia y acceso sin sesión a datos internos.

---

## 2. Alcance y Entorno de Pruebas

### 2.1. Alcance

- **Vista evaluada:** `#view-disponibilidad` (`public/index.html`), lógica en `public/js/disponibilidad.js`.
- **Endpoint principal:** `GET /api/publico/disponibilidad` (`src/routes/publico.js`).
- **Endpoints de contraste:** `GET /api/espacios` (aforo interno) y `POST /api/salidas` (integridad del cobro).
- **Roles evaluados:** sesión anónima (conductor) y `admin` (DUEÑO).
- **Explícitamente fuera de alcance:** la reserva en línea (Historia UPAO-21, backlog sin sprint). Por eso "Reservar espacio" solo redirige o informa, no reserva.

### 2.2. Entorno de Pruebas

| Componente | Detalle |
| --- | --- |
| **Servidor de Aplicación** | Node.js v22 + Express 5 (`http://localhost:3555`) |
| **Base de Datos** | PostgreSQL en Neon — rama **staging** (`ep-spring-bonus-b6zxs7fw`) |
| **Navegador y Automatización** | Chromium headless vía Playwright, con grabación de video |
| **Herramientas de Soporte** | FFmpeg 8.1.1 para transcodificar la evidencia a MP4 |
| **Comandos** | `npm run test:disponibilidad` · `npm run test:integridad` · `npm run test:regresion` |

> Las pruebas escriben únicamente registros propios (placas con prefijo `ZZT`), los eliminan al finalizar y restauran la capacidad configurada. Se ejecutaron siempre contra la rama `staging`, nunca contra producción.

---

## 3. Matriz de Casos de Prueba Ejecutados

### 3.1. Criterios de aceptación de la Historia UPAO-20

| ID | Criterio de Jira | Pasos | Resultado Esperado | Resultado Obtenido | Estado |
|:---:|---|---|---|:---:|
| **CP-01** | Vista pública sin exigir login | Abrir `/#disponibilidad` en un navegador sin sesión | La vista carga con datos; no se fuerza el login | Vista activa, cabecera de usuario oculta, botón "← Iniciar Sesión / Acceso de Personal" | **PASA** |
| **CP-02** | Dos paneles con capacidad total y cupos | Comparar los valores en pantalla contra la respuesta de la API | Capacidad y cupos idénticos en UI y API, sin placeholders `--` | Autos 10/3, motos 10/4 — coinciden exactamente con la API | **PASA** |
| **CP-03** | Fórmula con piso en cero | Recalcular `max(0, capacidad − enCochera − reservas)` con datos reales | La API devuelve exactamente el valor de la fórmula | `10−7−0=3` autos, `10−6−0=4` motos; `total.disponibles = 7` | **PASA** |
| **CP-04** | Actualización en tiempo real | Esperar el ciclo de refresco sin recargar | La hora de actualización cambia y los cupos se recalculan | `23:52:27 → 23:52:57` (polling 30 s) | **PASA** |
| **CP-05** | Indicador rojo "Aforo lleno" y bloqueo | Llenar los cupos de autos (capacidad = ocupación) y recargar | Cupos en 0, tarjeta en alerta, insignia "Aforo lleno", botón deshabilitado | Cupos `0`, clase `aforo-lleno`, borde `rgb(239,68,68)`, botón `disabled` | **PASA** |
| **CP-06** | "Reservar" redirige a Login sin sesión | Pulsar "Reservar espacio" en sesión anónima | Se muestra la pantalla de Login | Vista `#view-login` activa | **PASA** |
| **CP-07** | Comportamiento con sesión iniciada | Iniciar sesión como DUEÑO y pulsar "Reservar espacio" | Debe existir una respuesta visible para el usuario | Toast informativo: la reserva en línea aún no está habilitada | **PASA** (corregido) |
| **CP-08** | Vista responsiva | Medir desbordamiento horizontal en 360, 390 y 414 px | Sin scroll horizontal en ningún ancho | Exceso de 0 px en los tres anchos | **PASA** |

### 3.2. Pruebas adversariales de API (búsqueda de errores silenciosos)

| ID | Ataque / Caso límite | Resultado Esperado | Resultado Obtenido | Estado |
|:---:|---|---|---|:---:|
| **CP-09** | Estadía activa de tipo distinto de auto/moto (p. ej. "Reserva Web") | El consolidado no debe ocultar vehículos que ocupan espacio | `total.enCochera` incluye el vehículo; `total.otrosEnCochera` lo reporta y se emite advertencia en el log | **PASA** (corregido, DEF-77-02) |
| **CP-10** | Caché intermedia de los cupos | La respuesta no debe poder cachearse | `Cache-Control: no-store, max-age=0` | **PASA** (corregido, DEF-77-03) |
| **CP-11** | Doble clic simultáneo en "Registrar salida" | Un solo cobro; la segunda petición rechazada | `200` + `409`, un único pago, sin registros huérfanos | **PASA** (corregido, DEF-77-09) |
| **CP-12** | Capacidad configurada en 0 (cochera cerrada) | Se debe respetar el 0 | Devuelve 10 (valor por defecto) | **DEFECTO** (DEF-77-06) |
| **CP-13** | Capacidad configurada y persistencia entre despliegues | El valor configurado por el dueño debe sobrevivir a un redeploy | Se guarda en un archivo dentro del repositorio: cada despliegue la revierte | **DEFECTO** (DEF-77-08) |
| **CP-14** | Dos ingresos simultáneos con 1 cupo libre | No debe sobrepasarse la capacidad | Se registraron 9 autos con capacidad para 8 | **DEFECTO** (DEF-77-10) |
| **CP-15** | Acceso a la API sin autenticación | 401/403 en todo endpoint interno | 200 / 400 / 404 en tarifas, capacidad, ingresos, reportes y ocupación | **DEFECTO** (DEF-77-07) |

---

## 4. Registro de Defectos (Defect Log)

### 4.1. Defectos corregidos en esta subtarea

| ID | Sev. | Defecto detectado | Causa raíz | Corrección aplicada | Estado |
|:---:|:---:|---|---|---|:---:|
| **DEF-77-01** | **FATAL** | Con sesión iniciada, "Reservar espacio" no hacía absolutamente nada: sin navegación, sin mensaje, sin toast. | `manejarAccionReservar()` solo contemplaba la rama "no autenticado"; la rama autenticada terminaba sin acción. | Se añadió una respuesta explícita al usuario y se separó el guard de sesión del de cupos. | **SUPERADO** |
| **DEF-77-02** | ALTO | El aforo público no veía estadías de tipos distintos de "Automóvil / Camioneta" y "Motocicleta" (el seed define además "Reserva Web"). Un vehículo de ese tipo dentro del local no se descontaba de ningún contador. | `obtenerEstadiasActivasPorTipo()` consultaba dos nombres fijos con `findUnique` y descartaba el resto. | Se reemplazó por un `groupBy` sobre todas las estadías activas; el consolidado incluye los tipos no clasificados (`otrosEnCochera`) y se emite advertencia en el log. | **SUPERADO** (política de descuento pendiente, ver §6) |
| **DEF-77-03** | MEDIO | Los cupos se servían sin cabeceras de caché; un proxy o CDN podía entregar disponibilidad desactualizada. | No se establecía `Cache-Control` en la respuesta. | `res.set('Cache-Control', 'no-store, max-age=0')`. | **SUPERADO** |
| **DEF-77-04** | MEDIO | La "verificación de sesión" leía `localStorage.token` y `localStorage.usuario`, claves que **ninguna parte de la aplicación escribe**: la comprobación era decorativa. | El login no persiste credencial alguna; se asumió una convención de tokens que no existe en el proyecto. | Se expone `window.sesionActual` desde `app.js` (login y logout) y el módulo consulta ese estado real mediante `haySesionActiva()`. | **SUPERADO** |
| **DEF-77-05** | BAJO | El aviso de la vista hablaba de "tu cuenta de conductor", un rol que no existe en el sistema (solo DUEÑO y RECEPCIONISTA). | Texto redactado sobre un rol previsto que aún no se ha implementado. | Se reemplazó por "una cuenta autorizada" y se aclara que la reserva en línea llega en una próxima entrega. | **SUPERADO** |
| **DEF-77-06** | ALTO | `obtenerCapacidad()` usaba `Number(valor) || DEFAULT`, convirtiendo capacidad 0 en 10. | Valores numéricos `0` evaluaban como falsy en JavaScript. | Implementación de función auxiliar `parsearCapacidad` con `Number.isFinite(num) && num >= 0`, permitiendo 0 legítimo. | **SUPERADO** |
| **DEF-77-09** | **FATAL** | Un doble clic (o dos pestañas) en "Registrar salida" sobre la misma estadía creaba **dos pagos**: uno vinculado y otro huérfano. La recaudación de los reportes quedaba inflada de forma permanente. | La lectura de la estadía (`horaSalida: null`) y la escritura ocurrían fuera de una transacción; dos peticiones concurrentes superaban la misma comprobación. | El cierre se volvió idempotente: dentro de la transacción se ejecuta un `updateMany` condicionado a `horaSalida: null`; si no afecta filas, la petición responde `409` y no se crea ningún pago. | **SUPERADO** |
| **DEF-77-10** | ALTO | El ingreso validaba el aforo con `count` y creaba la estadía sin transacción atómica, arriesgando sobrecupo por concurrencia. | Verificación de capacidad y creación desacopladas. | Encapsulación de verificación y alta de estadía en transacción atómica `prisma.$transaction`. | **SUPERADO** |
| **DEF-77-11** | BAJO | La cabecera de staff (`#header-user-section` + `#btn-logout`) desbordaba 9 px en viewports de 390 px con sesión activa. | Falta de reglas de ajuste para elementos de usuario en pantallas angostas. | Ajuste responsive en `style.css` bajo `@media (max-width: 640px)` compactando padding y ocultando subtítulos. | **SUPERADO** |

### 4.2. Defectos de arquitectura y deuda técnica (historias para Sprint 3)

| ID | Sev. | Defecto detectado | Impacto | Propuesta | Estado |
|:---:|:---:|---|---|---|:---:|
| **DEF-77-07** | **FATAL** | **La API no tiene control de acceso centralizado.** `POST /api/auth/login` devuelve usuario y rol, pero no emite token ni cookie, y ningún endpoint interno exige sesión en backend. | El control de acceso es actualmente visual. Cualquiera con la URL puede alcanzar los endpoints internos. | Historia técnica prioritaria en el Sprint 3: JWT firmado + middleware `autorizar(...roles)` aplicado por ruta + `Authorization` en frontend. | **DEUDA TÉCNICA (Sprint 3)** |
| **DEF-77-08** | ALTO | La capacidad (autos/motos) se guarda en `src/config/espacios.json`, un archivo versionado en git. En Render el sistema de archivos es efímero. | Un redeploy revierte la capacidad configurada a los valores del commit. | Mover la configuración a base de datos (tabla `configuracion`) con migración y endpoints auditados en Sprint 3. | **DEUDA TÉCNICA (Sprint 3)** |

---

## 5. Salida Oficial de la Suite E2E (Playwright)

```text
[CA-06] Acceso publico sin sesion
  [PASS] La vista de disponibilidad abre sin haber iniciado sesion
  [PASS] No se fuerza el login para consultar la disponibilidad
  [PASS] La cabecera de usuario esta oculta (no hay sesion)
  [PASS] El boton volver invita a iniciar sesion ("← Iniciar Sesión / Acceso de Personal")

[CA-02/CA-03] Paneles de autos y motos
  [PASS] Capacidad autos en UI (10) = API (10)
  [PASS] Cupos autos en UI (3) = API (3)
  [PASS] Capacidad motos en UI (10) = API (10)
  [PASS] Cupos motos en UI (4) = API (4)
  [PASS] Ningun panel queda con el placeholder "--"
  [PASS] Se muestra la hora de actualizacion en formato HH:MM:SS (23:52:21)

[CA-04/CA-05] Estado normal y estado critico
  [PASS] Con cupos libres el badge dice "DISPONIBLE"
  [PASS] Con cupos libres el boton Reservar esta habilitado
  [PASS] La tarjeta no esta en estado critico
  [PASS] Sin sesion, "Reservar espacio" redirige a la pantalla de Login

[CA-05] Estado critico "Aforo lleno"
  [PASS] Con la cochera llena los cupos quedan en 0 (0)
  [PASS] El badge cambia a "Aforo lleno" ("Aforo lleno")
  [PASS] La tarjeta entra en clase visual de estado critico (aforo-lleno)
  [PASS] El boton "Reservar espacio" queda deshabilitado
  [PASS] El borde usa color de alerta (rgb(239, 68, 68) rgb(254, 202, 202) rgb(254, 202, 202))

[CA-04] Actualizacion periodica (polling)
  [PASS] La disponibilidad se refresca sola (23:52:27 -> 23:52:57)

[CA-06b] Clic en "Reservar" con sesion iniciada
  [PASS] El boton "Volver" lleva al Login cuando no hay sesion
  [PASS] Login de DUEÑO correcto
  [PASS] Con sesion, "Reservar" da alguna respuesta (vistas activas: ["view-disponibilidad"], toasts nuevos: 1)
  [PASS] Cierre de sesion correcto

[Responsive] Vista movil sin sesion
  [PASS] Sin desbordamiento horizontal en 360px (exceso: 0px)
  [PASS] Sin desbordamiento horizontal en 390px (exceso: 0px)
  [PASS] Sin desbordamiento horizontal en 414px (exceso: 0px)

==============================================
 VERIFICACIONES: 27 | PASS: 27 | FAIL: 0
==============================================
```

### 5.1. Suite de integridad del cobro (`npm run test:integridad`)

```text
[INT-01] Doble clic simultáneo en "Registrar salida"
         respuestas HTTP: 409 y 200
         pagos creados: 1 | vinculados a la estadía: 1
  [PASS] Una sola operación cobra; la segunda se rechaza con 409 y no deja pagos huérfanos.
RESULTADO: integridad del cobro OK.
```

### 5.2. Suite de no regresión (`npm run test:regresion`)

```text
✓ REG-01 EXITOSO: Reporte diario funciona sin regresión.
✓ REG-02 EXITOSO: Consulta del día actual intacta.
✓ REG-03 EXITOSO: Módulo de espacios intacto.
✓ REG-04 EXITOSO: Catálogo de pagos intacto.
✓ REG-05 EXITOSO: Endpoints estadísticos operando al 100%.
✓ REG-06 EXITOSO: Endpoint de ocupación operando al 100%.
✓ REG-07 EXITOSO: Validaciones defensivas de ocupación intactas.
✓ REG-08 EXITOSO: Exportación de ocupación operando al 100%.
✓ REG-09 EXITOSO: Endpoint público de disponibilidad operando al 100%.
✓ REG-10 EXITOSO: Invariantes del aforo público intactas.
 NO SE DETECTARON REGRESIONES EN EL SISTEMA (100% OK)
```

### 5.3. Auditoría de seguridad (`npm run test:auditoria-seguridad`)

Evidencia de DEF-77-07. El comando termina con código 1 mientras la deuda siga abierta; no forma parte de `npm test`.

```text
  [DEUDA] PUT /api/tarifas/:id (fijar precios) — HTTP 404 — la ruta existe y responde sin sesión; un id válido sí cambia la tarifa
  [DEUDA] PUT /api/espacios/capacidad (cerrar o ampliar la cochera) — HTTP 400 — el 400 lo produce la validación de datos, no un control de acceso
  [DEUDA] GET /api/ingresos/activos (placas y notas de clientes) — HTTP 200
  [DEUDA] GET /api/reportes/exportar (recaudación exportable a CSV) — HTTP 200
  [DEUDA] GET /api/ocupacion (afluencia del negocio) — HTTP 200
  [DEUDA] POST /api/auth/login (emitir credencial de sesión) — HTTP 200 — {"usuario":"admin","nombre":"Administrador","rol":"DUENO"}
 Rutas revisadas: 6 | sin autenticación: 6
```

> Las variantes destructivas de esta auditoría (cambiar una tarifa real a S/ 0.01 y la capacidad a otro valor) se ejecutaron **una vez** durante el diagnóstico y se revirtieron de inmediato; el script versionado solo sondea con cargas inválidas para no alterar datos.

---

## 6. Evidencias y Trazabilidad en GitHub

| Entregable / Recurso | Descripción | Enlace |
| --- | --- | --- |
| **Video demostrativo MP4** | Recorrido E2E completo: vista pública, redirección a Login, aforo lleno, polling y móvil | [`demostracion_pruebas_disponibilidad_upao77.mp4`](evidencias/upao-77/demostracion_pruebas_disponibilidad_upao77.mp4) |
| **Vista pública con cupos** | Captura de la vista anónima con datos reales | [`01_vista_publica_disponibilidad.png`](evidencias/upao-77/01_vista_publica_disponibilidad.png) |
| **Redirección a Login** | Clic en "Reservar espacio" sin sesión | [`02_redireccion_login_sin_sesion.png`](evidencias/upao-77/02_redireccion_login_sin_sesion.png) |
| **Estado "Aforo lleno"** | Cupos en 0, tarjeta en alerta y botón bloqueado | [`03_estado_aforo_lleno.png`](evidencias/upao-77/03_estado_aforo_lleno.png) |
| **Reservar con sesión** | Respuesta visible tras la corrección de DEF-77-01 | [`04_reservar_con_sesion.png`](evidencias/upao-77/04_reservar_con_sesion.png) |
| **Vista móvil 390 px** | Responsividad sin desbordamiento | [`05_vista_movil_390px.png`](evidencias/upao-77/05_vista_movil_390px.png) |
| **Suite E2E** | Automatización de los 27 criterios | [`tests/e2e-disponibilidad.js`](../../../tests/e2e-disponibilidad.js) |
| **Suite de integridad del cobro** | Regresión de DEF-77-09 | [`tests/test-integridad-cobro.js`](../../../tests/test-integridad-cobro.js) |
| **Auditoría de seguridad** | Diagnóstico de DEF-77-07 | [`tests/auditoria-seguridad-api.js`](../../../tests/auditoria-seguridad-api.js) |
| **Plan de Pruebas (.md)** | Este documento | [`docs/modulos/espacios-publicos/plan-pruebas.md`](plan-pruebas.md) |
| **Rama de la subtarea** | Correcciones de UPAO-77 (local, pendiente de push) | `fix/UPAO-77-auditoria-disponibilidad` |
| **Rama `develop`** | Rama integrada y desplegada en el ambiente Blue | [Rama `develop`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |

Archivos de código modificados por esta subtarea: `src/routes/publico.js`, `src/routes/salidas.js`, `public/js/disponibilidad.js`, `public/js/app.js`, `public/index.html`, `tests/test-no-regresion.js`, `package.json`.

---

## 7. Conclusión y Condiciones para Cerrar la Historia

**Los seis criterios de aceptación de UPAO-20 están cumplidos y verificados**, y la vista pública quedó además endurecida en lo que respecta a datos obsoletos, respuesta del botón y observabilidad del aforo.

Sin embargo, **la Historia UPAO-20 no debería marcarse `Listo` para producción sin resolver antes:**

1. **DEF-77-07 (FATAL)** — la API no exige autenticación. Mientras siga así, la disponibilidad pública es lo único honesto del módulo: cualquiera puede alterar tarifas y capacidad y cerrar estadías. Es la única deuda que puede comprometer una demostración frente al cliente.
2. **DEF-77-08 (ALTO)** — la capacidad que publica la vista pública se pierde en cada despliegue.
3. **DEF-77-10 (ALTO)** — el aforo puede sobrepasarse con dos ingresos simultáneos.

Ninguno de los tres pertenece al alcance de UPAO-20: son defectos arrastrados de Historias anteriores (§8 de `AGENTS.md` prohíbe revivirlos dentro de esta tarea) y deben abordarse en sus propias ramas o en una Historia técnica del siguiente sprint. Se recomienda registrar en Jira una Historia tipo **"Seguridad y consistencia de la API"** con DEF-77-07 como criterio principal.
