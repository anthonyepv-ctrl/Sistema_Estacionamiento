# Módulo Vista Pública de Disponibilidad — Interfaz (UPAO-20)

> Historia: **UPAO-20 — Ver espacios disponibles** · Épica **UPAO-28 (Manejo de Reserva Web)** · Sprint 2 · Rol **Conductor** (usuario externo).

Vista pública implementada en `public/` (HTML + CSS + JS vanilla), conectada al endpoint real `GET /api/publico/disponibilidad` y siguiendo la Guía de Estilos y el análisis [`analisis.md`](analisis.md).

## Pantalla

- **Acceso sin sesión:** botón **"Ver Espacios Disponibles (Conductor)"** en la pantalla de login, o URL directa `/#disponibilidad`.
- **Acceso con sesión:** tarjeta **"Espacios Disponibles"** en el menú principal, visible para todos los roles.
- **Encabezado:** badge **VISTA PÚBLICA**, título "Disponibilidad de Espacios" y texto de consulta en tiempo real.
- **Dos paneles independientes:** Automóviles y Motocicletas.
- Cada panel muestra:
  - Capacidad total, vehículos en cochera y reservas vigentes.
  - Caja destacada con el número de cupos y el texto `espacio disponible` / `espacios disponibles`.
  - Badge de estado: `DISPONIBLE` o `Aforo lleno`.
  - Botón **Reservar espacio**.
  - Hora de última actualización en formato 24 h de Perú (`America/Lima`).
- **Aviso inferior:** recuerda que para reservar se debe iniciar sesión.
- **Estado crítico:** el panel completo pasa a rojo suave, el badge muestra **"Aforo lleno"**, la caja muestra `0` y el botón queda deshabilitado con tooltip.

## Comportamiento

- **Carga inicial:** al abrir la vista se consulta el endpoint y se renderizan ambos paneles.
- **Polling:** actualización automática cada **30 segundos** con `setInterval`; se detiene al salir de la vista para no dejar peticiones en segundo plano.
- **Cálculo mostrado:** los cupos provienen del servidor con la fórmula `max(0, capacidad − enCochera − reservasVigentes)`.
- **Reserva sin sesión:** el frontend verifica `token` / `usuario` en `localStorage` y, como respaldo, la sesión activa de la aplicación. Si no hay sesión, muestra el login, limpia el hash y **no llama a ningún endpoint de reserva**; no se muestran mensajes adicionales.
- **Reserva con sesión:** al no existir aún el flujo de UPAO-21, el botón no ejecuta ninguna acción ni crea reservas.
- **Cierre de sesión:** se limpia el rol en memoria, los datos del usuario en el encabezado y el hash `#disponibilidad`, evitando que la vista pública quede asociada a una sesión cerrada.
- **Error de API:** se conserva la última información visible y se muestra un toast `"No se pudo actualizar la disponibilidad en tiempo real."`.
- **Responsive:** por debajo de 640 px los paneles se apilan y el botón de reserva ocupa el ancho completo.

## Verificación

Datos de staging al 05/11/2026:

| Indicador | Autos | Motos | Total |
| --- | ---: | ---: | ---: |
| Capacidad | 10 | 10 | 20 |
| En cochera | 7 | 5 | 12 |
| Reservas vigentes | 0 | 0 | 0 |
| Disponibles | **3** | **5** | **8** |

Casos verificados:

- Acceso público desde login y desde `/#disponibilidad`, sin sesión.
- Polling: segunda petición al endpoint a los 30 s.
- Reserva sin sesión: redirección a login y hash limpio, sin toast ni llamada a la API.
- Reserva con sesión: sin acción ni llamada de escritura (UPAO-21 pendiente).
- Estado crítico simulado: autos en `0` → panel rojo, badge "Aforo lleno", botón `disabled` + `aria-disabled="true"`, tooltip exacto; motos conserva sus cupos.
- Responsive a 600 px: una columna y botón a ancho completo.
- Sin errores de consola.

### Nota de sesión

El sistema actual no emite JWT: la sesión se mantiene en memoria (`rolActual`) y se refleja en `#header-user-section`. La verificación de reserva contempla las claves `token`/`usuario` de `localStorage` si existieran y usa la sesión activa como respaldo, sin inventar un token.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `public/index.html` | Botón de acceso en login, tarjeta del menú, vista `#view-disponibilidad` y carga del script. |
| `public/css/style.css` | Estilos de paneles, cupos, estado crítico, aviso y responsive. |
| `public/js/disponibilidad.js` | Consulta, polling, renderizado, estado crítico y flujo de reserva. |
| `public/js/app.js` | Ruta de vista, tarjeta del menú, acceso por hash y limpieza de sesión. |
| `src/routes/publico.js` | Endpoint `GET /api/publico/disponibilidad`. |
| `server.js` | Montaje de `/api/publico`. |
| `docs/modulos/espacios-publicos/analisis.md` | Análisis y diseño (UPAO-20 / Subtarea 4.1). |
| `docs/modulos/espacios-publicos/api.md` | Contrato del endpoint público. |

## Evidencias

1. **Acceso público desde login:** [`evidencias/01_acceso_publico_login.png`](evidencias/01_acceso_publico_login.png)
2. **Vista pública con cupos:** [`evidencias/02_vista_publica_disponibilidad.png`](evidencias/02_vista_publica_disponibilidad.png)
3. **Estado de aforo lleno:** [`evidencias/03_estado_aforo_lleno.png`](evidencias/03_estado_aforo_lleno.png)
4. **Vista móvil (600 px):** [`evidencias/04_vista_movil.png`](evidencias/04_vista_movil.png)
5. **Acceso desde el menú principal:** [`evidencias/05_dashboard_acceso.png`](evidencias/05_dashboard_acceso.png)

## API

Endpoints, parámetros, respuesta y reglas de cálculo: [`api.md`](api.md).
