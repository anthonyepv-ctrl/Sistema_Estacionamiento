# Correcciones del informe de auditoría — Versión Corregida

> **Rama:** `Version-Corregida`
> **Fecha:** 14/11/2026
> **Base:** `feature/UPAO-20-interfaz-vista-publica-disponibilidad` (commit `c2169ac` + correcciones QA locales)
> **Informe de referencia:** `INFORME_AUDITORIA_Y_DEFECTOS_IA.md` (entregado por el equipo auditor; documento externo, no versionado en este repositorio)
> **Entorno verificado:** local `http://localhost:3000` con base de datos de staging (Neon).

---

## 1. Resumen de correcciones

| ID | Hallazgo | Corrección aplicada | Archivos |
| --- | --- | --- | --- |
| **D-01** | Expiración de transacción en Neon (`P2028`) a los 5 s | Se configuró `maxWait: 10000` y `timeout: 15000` en las transacciones de ingreso y salida | `src/routes/ingresos.js`, `src/routes/salidas.js` |
| **D-02** | `normalizarPlaca` borraba caracteres inválidos y aceptaba `ABC@123` | Se valida el texto original antes de normalizar; caracteres fuera de `A-Z`, `0-9`, espacio y guion responden HTTP 400. Se aplica también en salidas para mantener coherencia | `src/config/placas.js`, `src/routes/ingresos.js`, `src/routes/salidas.js` |
| **D-03** | `estadiaId` corrupto (`-1`, `"null"`) respondía 404/500 | Ya corregido en la ronda QA previa: se valida entero positivo antes de Prisma y se responde HTTP 400. Se volvió a verificar con la API | `src/routes/salidas.js` |
| **D-04** | Exportación de ocupación entrega CSV, no XLSX binario | Se declara formalmente como salvedad técnica aceptada; el CSV usa BOM UTF-8 y abre en Excel. No se agrega dependencia para XLSX | — |
| **A11y-01** | Tarjetas del menú inaccesibles por teclado | Se agregó `role="button"`, `tabindex="0"` y `aria-label` a las 8 tarjetas; `Enter` y `Espacio` activan el módulo; anillo de foco visible | `public/index.html`, `public/js/app.js`, `public/css/style.css` |
| **A11y-02** | Alerta de aforo lleno no anunciada | Las tarjetas de disponibilidad son `role="region"` con `aria-live="polite"` y `aria-atomic="true"`; la hora de actualización queda fuera de la zona anunciada y solo se escribe el DOM cuando el valor cambia | `public/index.html`, `public/js/disponibilidad.js` |

## 2. Detalle técnico

### D-01 · Timeout transaccional

```javascript
const estadia = await prisma.$transaction(async (tx) => {
  // lógica existente
}, {
  maxWait: 10000,
  timeout: 15000
});
```

Se aplicó el mismo bloque en `src/routes/salidas.js`. Con ello, una transacción que tarde hasta 15 s ya no se cierra con `P2028`; además, `maxWait` da 10 s para adquirir conexión en la nube.

### D-02 · Validación estricta de placa

`src/config/placas.js` expone:

```javascript
const CARACTERES_PLACA_INVALIDOS = /[^A-Z0-9 -]/i;

function tieneCaracteresInvalidos(valor) {
  if (valor === undefined || valor === null) return false;
  return CARACTERES_PLACA_INVALIDOS.test(String(valor));
}
```

`POST /api/ingresos` y `POST /api/salidas` responden:

```json
{ "error": "La placa contiene caracteres inválidos. Solo se admiten letras, números, espacios y guiones." }
```

### D-03 · Identificador de estadía

La validación existente se mantiene:

```javascript
const id = Number(estadiaId);
if (!Number.isInteger(id) || id <= 0) {
  return res.status(400).json({ error: 'Identificador de estadía inválido.' });
}
```

Verificado con `-1`, `"null"` y `"abc"` → **HTTP 400**. Un ID válido inexistente sigue respondiendo **HTTP 404**.

### D-04 · Exportación de ocupación

`GET /api/ocupacion/exportar?formato=excel` devuelve CSV con BOM UTF-8 (`text/csv`). Es un formato que Excel abre directamente, pero no es un binario `.xlsx`. Se mantiene así para no incorporar una dependencia pesada; queda declarado como limitación conocida.

### A11y-01 · Navegación por teclado

Cada tarjeta del dashboard declara:

```html
<div class="module-card" id="card-modulo-ingreso" role="button" tabindex="0"
     aria-label="Abrir módulo de registro de ingreso vehicular">
```

En `public/js/app.js`:

```javascript
document.querySelectorAll('.module-card').forEach((card) => {
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      card.click();
    }
  });
});
```

Se añadió `.module-card:focus-visible` con contorno azul corporativo.

### A11y-02 · Anuncio de aforo lleno

Las tarjetas de la vista pública declaran:

```html
<div class="card disponibilidad-card" id="card-disponibilidad-autos"
     role="region" aria-live="polite" aria-atomic="true"
     aria-label="Disponibilidad de espacios para automóviles">
```

La hora de actualización usa `aria-live="off"` para no repetir el anuncio cada 30 s. `renderizarPanel` solo modifica el texto cuando el valor cambia.

## 3. Verificación ejecutada

| Verificación | Resultado |
| --- | --- |
| Script de auditoría de API (`verificar-correcciones.js`) | **13/13 PASA** |
| `npm run test:validaciones` | **12/12 PASS** |
| `npm run test:seguridad` | **15/15 PASS** |
| `npm run test:regresion` | **12/12 PASS** |
| `npm run test:integridad` | **1/1 PASS** |
| `npm run test:concurrencia` | **1/1 PASS** |
| `npm run test:disponibilidad` | **24/24 PASS** |
| `npm run test:e2e` | **15 OK, 0 fallas** |
| `npm run test:graficos` | **20/20 PASS** |

Casos adicionales verificados: placa `ABC@123` → 400; `<script>alert(1)</script>` → 400; `estadiaId` `-1`, `"null"`, `"abc"` → 400; placa inválida en salida → 400; reporte sin token → 401.

## 4. Evidencia visual

Las capturas se conservan **fuera del repositorio**, en la carpeta local:

```text
evidencias/Version-Corregida/capturas/
├── 01_dashboard_foco_teclado.png
├── 02_teclado_abre_ingreso.png
├── 03_backend_rechaza_placa_invalida.png
├── 04_backend_rechaza_id_invalido.png
├── 05_disponibilidad_aforo_lleno_aria.png
├── 06_panel_verificacion_api.png
└── 07_codigo_corregido.png
```

> La carpeta `evidencias/` está excluida mediante `.git/info/exclude`; no se sube a GitHub.

## 5. Archivos modificados en esta ronda

- `src/config/placas.js` (nuevo en la ronda QA previa; se agregó `tieneCaracteresInvalidos`).
- `src/routes/ingresos.js`, `src/routes/salidas.js`.
- `public/index.html`, `public/js/app.js`, `public/js/disponibilidad.js`, `public/css/style.css`.
- `docs/modulos/qa-correcciones-version-corregida.md` (este archivo).
- `tests/test-validaciones-api.js` y script `test:validaciones` en `package.json`.

> La rama incluye además las correcciones QA previas documentadas en [`qa-correcciones-aplicadas.md`](qa-correcciones-aplicadas.md).
