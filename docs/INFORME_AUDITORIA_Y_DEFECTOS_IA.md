# INFORME DE AUDITORÍA, CONTROL DE CALIDAD Y DEFECTOS TÉCNICOS (PROMPT READY PARA IA)

**Proyecto:** Sistema de Gestión y Control de Cochera (SP)  
**Entorno:** Node.js v24 + Express 5 + Prisma ORM 6.19 + PostgreSQL (Neon Cloud) + SPA Vanilla JS  
**Rama evaluada:** `develop` (actualizada con `origin/develop`)  
**Fecha:** Noviembre 2026  
**Rol del auditor:** Juez de Calidad / Rompe-Proyectos (Evaluación destructiva y de accesibilidad)  

---

> [!NOTE]
> **OBJETIVO DE ESTE DOCUMENTO:**  
> Este informe está estructurado para que cualquier agente de Inteligencia Artificial (Claude, GPT, DeepSeek, Gemini, etc.) o desarrollador pueda entender inmediatamente el contexto del negocio, la relación con las 13 Historias de Usuario del backlog, los defectos exactos encontrados con sus rutas de archivo y números de línea, y las correcciones de código precisas a implementar.

---

## 1. CONTEXTO DEL SISTEMA Y ESTRUCTURA DEL PROYECTO

### 1.1 Arquitectura y Tecnologías
* **Frontend:** Single Page Application (SPA) con HTML5 semántico, CSS3 corporativo y JavaScript puro en [`public/`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public).
* **Backend:** API REST en Node.js + Express estructurada en [`server.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/server.js) y [`src/routes/`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/routes).
* **Base de Datos & ORM:** PostgreSQL en Neon (servidor serverless en AWS `sa-east-1`), administrado mediante **Prisma ORM** ([`prisma/schema.prisma`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/prisma/schema.prisma)).
* **Seguridad y RBAC:** Token firmado con HMAC-SHA256 propio ([`src/config/auth.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/config/auth.js)) con roles `DUEÑO` y `RECEPCIONISTA`.

### 1.2 Mapa de Archivos Clave
```text
Sistema_Estacionamiento/
├── public/
│   ├── css/style.css                # Estilos corporativos y accesibilidad
│   ├── js/
│   │   ├── app.js                   # Enrutamiento SPA, login y gestión de tarifas/ingreso/salida
│   │   ├── disponibilidad.js        # Portada pública y polling de aforo (UPAO-20)
│   │   ├── estadisticas.js          # Gráficos SVG y recaudación mensual (UPAO-18)
│   │   ├── ocupacion.js             # Bitácora y picos de afluencia (UPAO-19)
│   │   └── reportes.js              # Cuadre de caja diario (UPAO-17)
│   └── index.html                   # Vista única que contiene todas las pantallas
├── src/
│   ├── config/
│   │   ├── auth.js                  # Lógica de tokens y autorización RBAC
│   │   ├── espacios.js              # Persistencia local de capacidad configurada
│   │   └── prisma.js                # Cliente singleton de Prisma ORM
│   └── routes/
│       ├── auth.js                  # POST /api/auth/login, GET /api/auth/sesion
│       ├── espacios.js              # GET /api/espacios, PUT /api/espacios/capacidad
│       ├── ingresos.js              # POST /api/ingresos, GET /api/ingresos/activos
│       ├── ocupacion.js             # GET /api/ocupacion, GET /api/ocupacion/exportar
│       ├── publico.js               # GET /api/publico/disponibilidad
│       ├── reportes.js              # GET /api/reportes/diario, /graficos-mes, /exportar
│       ├── salidas.js               # POST /api/salidas, GET /api/salidas/activos
│       └── tarifas.js               # GET /api/tarifas, PUT /api/tarifas/:id
├── prisma/
│   ├── schema.prisma                # Modelos Usuario, Estadia, Tarifa, MetodoPago, Pago
│   └── seed.js                      # Carga inicial de tarifas y credenciales base
└── server.js                        # Montaje de Express y middlewares
```

---

## 2. MATRIZ DE CUMPLIMIENTO DE LAS 13 HISTORIAS DE USUARIO (.XLSX)

El Product Backlog consta de 13 Historias divididas en 3 Sprints:

| N° | Código | Título | Sprint | Puntos | Estado en .xlsx | Estado Real en Código | Salida del Sistema vs. Salida Esperada |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | **UPAO-16** | Configurar tarifas | Sprint 1 | 3 SP | Listo | **Operativo (100%)** | Actualiza `precioHora` y `precioFraccion`. Restringe a solo rol DUEÑO con HTTP 403. Valida números positivos `0.01 - 999.99`. |
| **2** | **UPAO-6** | Registrar ingreso | Sprint 1 | 2 SP | Listo | **Operativo (90%)** | Formatea placas MTC (`ABC-123`, `1234-AB`). Bloquea duplicados activos con HTTP 409. Bloquea si aforo está en cero. *(Presenta Defecto D-02 en backend).* |
| **3** | **UPAO-7** | Registrar salida | Sprint 1 | 3 SP | Listo | **Operativo (90%)** | Búsqueda por placa/ID. Cobro mínimo 1 hora + fracciones. Admite Efectivo y Yape. Idempotencia ante doble clic. *(Presenta Defecto D-03 en IDs corruptos).* |
| **4** | **UPAO-11** | Ver estado de espacios | Sprint 1 | 1 SP | Listo | **Operativo (100%)** | Paneles independientes para Autos y Motos. Fórmula `max(0, Capacidad - Ocupados)`. |
| **5** | **UPAO-17** | Consultar ingresos | Sprint 1 | 2 SP | Listo | **Operativo (100%)** | Reporte diario en Soles (S/). Desglose Efectivo vs Yape. Bloquea fechas futuras con HTTP 400. Acceso exclusivo DUEÑO. |
| **6** | **UPAO-9** | Adjuntar notas | Sprint 2 | 2 SP | Listo | **Operativo (100%)** | Campo opcional hasta 250 chars. Inmutable en BD. Registra recepcionista y fecha. Visualización visible en card ámbar en Salidas. |
| **7** | **UPAO-18** | Gráficos de ingresos | Sprint 2 | 5 SP | Listo | **Operativo (100%)** | Selector año/mes bloqueando meses futuros. Gráfico de barras diarias SVG y dona por método. Exportación a CSV con BOM UTF-8. Exclusivo DUEÑO. |
| **8** | **UPAO-19** | Nivel de ocupación | Sprint 2 | 2 SP | Listo | **Operativo (100%)** | Rango de fechas con bloqueo de rangos invertidos o futuros. Aforo máximo concurrente y detección de hora pico (`esPico: true`). Exportación a CSV. |
| **9** | **UPAO-20** | Ver espacios disponibles | Sprint 2 | 1 SP | Listo | **Operativo (100%)** | Portada pública `/` sin login. Fórmula `max(0, Cap - EnCochera - Reservas)`. Polling cada 30s. Alerta de "Aforo lleno" al llegar a 0. |
| **10** | **UPAO-8** | Buscar reservas | Sprint 3 | 2 SP | Por hacer | **Planificado (Sprint 3)** | Correctamente diferido para Sprint 3. No hay código roto en `develop`. |
| **11** | **UPAO-21** | Realizar reserva | Sprint 3 | 2 SP | Por hacer | **Planificado (Sprint 3)** | Correctamente diferido para Sprint 3. Se retiraron botones de interfaz (commit `c2169ac`). |
| **12** | **UPAO-22** | Anular reserva | Sprint 3 | 2 SP | Por hacer | **Planificado (Sprint 3)** | Correctamente diferido para Sprint 3. |
| **13** | **UPAO-23** | Historial de estados | Sprint 3 | 2 SP | Por hacer | **Planificado (Sprint 3)** | Correctamente diferido para Sprint 3. |

---

## 3. CATÁLOGO DE DEFECTOS Y VULNERABILIDADES (UBICACIÓN Y SOLUCIÓN)

### 🔴 DEFECTO CRÍTICO D-01: Expiración de Transacción en Neon genera HTTP 500 (`P2028`)
* **Historias de Usuario asociadas:** UPAO-6 (Registrar ingreso) y UPAO-7 (Registrar salida).
* **Archivos afectados:**
  1. [`Sistema_Estacionamiento/src/routes/ingresos.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/routes/ingresos.js#L127) (Línea 127)
  2. [`Sistema_Estacionamiento/src/routes/salidas.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/routes/salidas.js#L131) (Línea 131)
* **Descripción del error:**  
  Tanto el registro de ingreso como el de salida ejecutan transacciones interactivas de Prisma con locks consultando la base de datos en la nube (Neon en São Paulo `sa-east-1`). Prisma tiene un tiempo límite de transacción por defecto de **5000 milisegundos**. Si la latencia de red o la concurrencia supera los 5 segundos (registrado en auditoría en **5885 ms**), Prisma lanza la excepción:
  ```text
  PrismaClientKnownRequestError: Transaction API error: Transaction already closed: 
  A query cannot be executed on an expired transaction. The timeout for this transaction 
  was 5000 ms, however 5885 ms passed since the start of the transaction.
  Code: 'P2028'
  ```
  Esto provoca que el servidor Express capture el error y responda `HTTP 500 {"error": "No se pudo registrar la salida..."}`.
* **Solución requerida en código:**  
  Aumentar explícitamente el timeout de la transacción a 15 segundos en ambos archivos:
  ```javascript
  // En src/routes/ingresos.js (L127) y src/routes/salidas.js (L131):
  const estadia = await prisma.$transaction(async (tx) => {
    // ... lógica transaccional ...
  }, {
    maxWait: 10000, // Tiempo máximo esperando adquirir conexión
    timeout: 15000  // Tiempo máximo de ejecución antes de expirar
  });
  ```

---

### 🟠 DEFECTO D-02: Normalización Permisiva en Backend permite Caracteres Inválidos (Caso 4 de UPAO-6)
* **Historia de Usuario asociada:** UPAO-6 (Registrar ingreso) — Caso de prueba 4: *"Inválido: Espacios y caracteres raros (Placa: 'ABC@123') -> Intercepta y bloquea"*.
* **Archivo afectado:** [`Sistema_Estacionamiento/src/routes/ingresos.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/routes/ingresos.js#L41-L78) (Líneas 41 a 78).
* **Descripción del error:**  
  En el frontend ([`public/js/app.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/js/app.js)), el input intercepta caracteres no alfanuméricos en tiempo real. Sin embargo, en el backend, la función `normalizarPlaca` aplica:
  ```javascript
  const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  ```
  Si una petición externa (vía Postman, curl o script) envía `placa: "ABC@123"`, el backend simplemente borra el `@`, la convierte en `ABC-123`, pasa la validación y responde **HTTP 201 Created** en lugar de **HTTP 400 Bad Request**.
* **Solución requerida en código:**  
  Validar la existencia de caracteres prohibidos en el string original antes de normalizar:
  ```javascript
  // En src/routes/ingresos.js (alrededor de la Línea 65):
  if (placaRaw && /[^A-Z0-9\s-]/i.test(placaRaw)) {
    return res.status(400).json({ error: 'La placa contiene caracteres inválidos. Solo se admiten letras y números.' });
  }
  ```

---

### 🟠 DEFECTO D-03: `estadiaId` corrupto responde HTTP 404 o 500 en lugar de 400 (Caso 6 de UPAO-7)
* **Historia de Usuario asociada:** UPAO-7 (Registrar salida) — Caso de prueba 6: *"Inválido: ID de estadía corrupto/negativo (-1 o 'null') -> Backend responde con HTTP 400 Bad Request"*.
* **Archivo afectado:** [`Sistema_Estacionamiento/src/routes/salidas.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/routes/salidas.js#L84-L100) (Líneas 84 a 100).
* **Descripción del error:**  
  El backend valida la presencia de `estadiaId` con:
  ```javascript
  const whereCond = estadiaId
    ? { id: Number(estadiaId), horaSalida: null }
    : { placa: String(placa).trim().toUpperCase(), horaSalida: null };
  ```
  1. Si `estadiaId = -1`, se realiza una búsqueda `{ id: -1 }`. Como no existe, responde **HTTP 404 Not Found** (*"No se encontró una estadía activa"*), cuando el criterio del Excel exige **HTTP 400 Bad Request**.
  2. Si `estadiaId = "null"`, `Number("null")` se evalúa como `NaN`, lo cual provoca una excepción no controlada en Prisma y devuelve **HTTP 500**.
* **Solución requerida en código:**  
  Validar que el `estadiaId`, si viene provisto, sea un entero positivo:
  ```javascript
  // En src/routes/salidas.js (alrededor de la Línea 87):
  if (estadiaId !== undefined) {
    const idNum = Number(estadiaId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'El identificador de estadía debe ser un número entero positivo.' });
    }
  }
  ```

---

### 🟡 DEFECTO D-04: Exportación de Ocupación no ofrece formato XLSX real (UPAO-19)
* **Historia de Usuario asociada:** UPAO-19 (Consultar nivel de ocupación) — Criterio: *"Exportación de bitácora a formato CSV/Excel"*.
* **Archivo afectado:** [`Sistema_Estacionamiento/src/routes/ocupacion.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/src/routes/ocupacion.js#L274) (Línea 274).
* **Descripción:**  
  El endpoint `GET /api/ocupacion/exportar?formato=excel` acepta el parámetro `formato=excel`, pero devuelve el mismo contenido de texto en formato CSV (`text/csv`). Aunque Excel abre archivos CSV con BOM automáticamente, no es un binario nativo `.xlsx`. Es una salvedad técnica defendible para no sobrecargar dependencias, pero debe declararse formalmente.

---

## 4. EVALUACIÓN DE ACCESIBILIDAD (A11Y) Y EXPERIENCIA DE USUARIO

Evaluación sobre [`public/index.html`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/index.html) y [`public/css/style.css`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/css/style.css):

### 🔵 Hallazgo A11y-01: Inaccesibilidad por Teclado en el Menú Principal (Dashboard)
* **Ubicación:** [`public/index.html:132-260`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/index.html#L132-L260) y [`public/js/app.js:245-265`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/js/app.js#L245-L265).
* **Problema:**  
  Los accesos a los módulos son contenedores `<div class="module-card">`. No tienen el atributo `tabindex="0"`, ni `role="button"`, ni escuchan el evento `keydown` (teclas `Enter` o `Espacio`).
* **Impacto:**  
  Un usuario o jurado evaluador que intente navegar utilizando únicamente la tecla `Tab` saltará por completo las tarjetas de los módulos y no podrá acceder a las pantallas de tarifas, reportes u ocupación sin el ratón.
* **Solución requerida en HTML:**
  ```html
  <!-- Ejemplo en cada module-card de index.html -->
  <div class="module-card" id="card-modulo-ingreso" role="button" tabindex="0" aria-label="Abrir módulo de registro de ingreso vehicular">
  ```
  Y en `public/js/app.js`, registrar la navegación al presionar Enter o Espacio.

---

### 🔵 Hallazgo A11y-02: Alerta de Aforo Lleno no anunciada a Lectores de Pantalla
* **Ubicación:** [`public/index.html:1026-1070`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/index.html#L1026-L1070) y [`public/js/disponibilidad.js`](file:///c:/Users/LeonardoLP/Desktop/SistemaDeCochera/Sistema_Estacionamiento/public/js/disponibilidad.js).
* **Problema:**  
  Cuando el contador de cupos llega a 0, la tarjeta adopta un borde rojo y añade la clase visual `.lleno`. Sin embargo, no contiene un atributo `role="status"` ni `aria-live="polite"`. Los usuarios con discapacidad visual que usen lector de pantalla (como NVDA o VoiceOver) no se enteran en tiempo real de que la cochera se ha llenado.
* **Solución requerida en HTML:**
  ```html
  <div class="card disponibilidad-card" id="card-disponibilidad-autos" role="region" aria-live="polite" aria-atomic="true">
  ```

---

## 5. AUDITORÍA DE CAMPOS VACÍOS Y VALORES INVÁLIDOS

Comportamiento verificado en la API ante entradas vacías y ataques de inyección:

| Campo / Parámetro | Entrada de Prueba | Comportamiento del Backend | Código HTTP | Dictamen |
| :--- | :--- | :--- | :---: | :---: |
| **Tarifa - Monto vacío** | `precioHora: ""` | Valida que sea número positivo mayor a 0.00. | `400 Bad Request` | ✅ Seguro |
| **Tarifa - Monto negativo** | `precioHora: -5.00` | Rechaza valores menores o iguales a cero. | `400 Bad Request` | ✅ Seguro |
| **Tarifa - Caracteres** | `precioHora: "abc"` | Regex `/^\d+(\.\d{1,2})?$/` lo intercepta. | `400 Bad Request` | ✅ Seguro |
| **Ingreso - Placa vacía** | `placa: ""` | Detecta ausencia de placa obligatoria. | `400 Bad Request` | ✅ Seguro |
| **Ingreso - Nota vacía** | `nota: ""` o `"   "` | Función `trim()` lo sanitiza y almacena `null`. | `201 Created` | ✅ Conforme a UPAO-9 |
| **Ingreso - Nota > 250** | String de 280 letras | Trunca/rechaza por exceder límite de 250 chars. | `400 Bad Request` | ✅ Seguro |
| **Ingreso - XSS Script** | `<script>alert(1)</script>` | Se persiste como texto plano sin ejecución en DOM. | `201 Created` | ✅ Seguro |
| **Salida - Placa vacía** | `placa: ""` y sin ID | Exige especificar vehículo para salida. | `400 Bad Request` | ✅ Seguro |
| **Salida - Método inválido** | `metodoPago: "Bitcoin"` | Valida contra lista blanca (Efectivo, Yape, POS). | `400 Bad Request` | ✅ Seguro |
| **Ocupación - Rango invertido** | `inicio: 2026-10-30, fin: 2026-10-20` | Compara strings y bloquea si inicio > fin. | `400 Bad Request` | ✅ Seguro |
| **Ocupación - Fecha futura** | `inicio: 2027-01-01` | Compara contra fecha actual de Perú (UTC-5). | `400 Bad Request` | ✅ Seguro |
| **Disponibilidad - SQL Injection** | `?q=' OR 1=1--` | Query parameters ajenos son ignorados; ORM previene inyecciones. | `200 OK Seguro` | ✅ Inmune |

---

## 6. INSTRUCCIONES DE CORRECCIÓN (PATCHES SUGERIDOS)

Cualquier IA o desarrollador que reciba este informe puede aplicar directamente estos tres parches clave:

### Parche 1: Aumentar timeout transaccional en `src/routes/ingresos.js` y `src/routes/salidas.js`
```javascript
// Reemplazar:
const estadia = await prisma.$transaction(async (tx) => { ... });

// Por:
const estadia = await prisma.$transaction(async (tx) => {
  // lógica existente
}, {
  maxWait: 10000,
  timeout: 15000
});
```

### Parche 2: Validación estricta de placa en `src/routes/ingresos.js`
```javascript
// Agregar antes de normalizarPlaca:
if (placaRaw && /[^A-Z0-9\s-]/i.test(placaRaw)) {
  return res.status(400).json({ error: 'Formato de placa inválido (debe cumplir estructura peruana MTC).' });
}
```

### Parche 3: Validación defensiva de `estadiaId` en `src/routes/salidas.js`
```javascript
// Agregar al inicio del POST /api/salidas:
if (estadiaId !== undefined && (!Number.isInteger(Number(estadiaId)) || Number(estadiaId) <= 0)) {
  return res.status(400).json({ error: 'Identificador de estadía inválido.' });
}
```
