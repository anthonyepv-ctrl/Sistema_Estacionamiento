# Módulo Nivel de Ocupación y Afluencia — Análisis y Diseño (UPAO-19 / Subtarea 1)

> **Historia de Usuario:** UPAO-19 — Consultar nivel de ocupación  
> **Épica:** UPAO-27 (Administración y Supervisión del Negocio)  
> **Rol:** Dueño  
> **Story Points:** 2 SP · Sprint 2  
> **Subtarea:** Análisis y diseño del cálculo de aforo concurrente, distribución de afluencia por bloques horarios y exportación  

---

## 1. Objetivo y Justificación de Negocio

### 1.1. Objetivo
Diseñar la arquitectura técnica, algorítmica y de interfaz de usuario para permitir que el **Dueño** de la cochera consulte y analice el nivel de ocupación, aforo pico simultáneo y la afluencia de vehículos en cualquier rango de fechas seleccionado, agrupados por bloques horarios, con capacidad de exportación a formatos estándar (Excel / PDF / CSV).

### 1.2. Justificación de Negocio
1. **Detección de Horas Pico (Picos de Demanda):** Identificar en qué franjas horarias (mañana, mediodía, tarde o noche) se concentran los ingresos para optimizar la asignación del personal de recepción, vigilancia y mantenimiento.
2. **Dimensionamiento y Capacidad Operativa:** Conocer el **aforo máximo alcanzado simultáneamente** en el período para determinar si la cochera estuvo cerca del colapso de capacidad (100% ocupado) o si existe capacidad ociosa para captar abonados mensuales o habilitar reservas web (UPAO-28).
3. **Comportamiento por Tipo de Vehículo:** Discriminar la demanda entre automóviles/camionetas y motocicletas, permitiendo reconfigurar dinámicamente la distribución física de plazas si la demanda de motos supera las previsiones.
4. **Portabilidad y Auditoría Operativa:** Generar reportes imprimibles y exportables para juntas administrativas, balances de fin de mes y sustento ante entidades fiscalizadoras.

---

## 2. Requerimientos y Criterios de Aceptación (UPAO-19)

| ID | Criterio de Aceptación | Solución Técnica de Análisis y Diseño |
|:---:|---|---|
| **CA-01** | Selección de rango de fechas con validación defensiva | Inputs tipo fecha (`Fecha Inicio` y `Fecha Fin`). Validación dual (cliente y servidor): se bloquea y rechaza con `HTTP 400` si `fechaInicio > fechaFin` o si alguna fecha es futura respecto a la hora local peruana (`America/Lima`). Por defecto se inicializa con los últimos 7 días hasta la fecha de hoy. |
| **CA-02** | Tarjetas de resumen de volumen y aforo máximo | Tarjetas KPI con tipografía JetBrains Mono que muestran: Total de vehículos ingresados, desglose de Autos vs. Motos, y el **Aforo Máximo Simultáneo** (pico de concurrencia de vehículos presentes al mismo tiempo dentro de la cochera durante el rango). |
| **CA-03** | Gráfico de barras por bloques horarios (horas pico) | Gráfico visual interactivo con barras por bloques horarios de 2 horas (ej. `06:00-08:00`, `08:00-10:00`, `10:00-12:00`, `12:00-14:00`, `14:00-16:00`, `16:00-18:00`, `18:00-20:00`, `20:00-22:00`, `22:00-24:00`), identificando visualmente el bloque con mayor afluencia. |
| **CA-04** | Estado informativo sin movimientos | Si en el rango consultado no hubo estadías registradas, las tarjetas reflejan `0` y el contenedor del gráfico despliega un mensaje amigable: *"No se registran movimientos ni ingresos para el período seleccionado"*. |
| **CA-05** | Exportación de datos de ocupación | Botones de acción para exportar la bitácora analítica a **Excel / CSV** y generar una vista imprimible / PDF con el consolidado del período y detalle de transacciones. |

---

## 3. Modelo Algorítmico y Matemático de Ocupación

### 3.1. Algoritmo de Barrido de Eventos para Aforo Máximo Simultáneo (*Sweep-Line Algorithm*)
Para calcular de manera exacta el **Aforo Máximo Concurrente** sin costosos escaneos segundo a segundo, se modela el problema como un barrido temporal sobre los intervalos `[hora_ingreso, hora_salida]` de cada estadía:

```text
Intervalo Vehículo 1: |=========================|
Intervalo Vehículo 2:       |===============================|
Intervalo Vehículo 3:             |==============|
                      ▲     ▲     ▲             ▲           ▲
Eventos en Tiempo:   +1    +1    +1            -1          -1
Concurrencia:         1     2     3 (PICO)      2           1
```

#### Reglas de Ejecución:
1. Cada estadía que intersecte el rango consultado genera hasta 2 eventos:
   - Evento `+1` (Ingreso) en `hora_ingreso`.
   - Evento `-1` (Salida) en `hora_salida` (si el vehículo aún se encuentra en cochera, `hora_salida` se asume como `Math.min(ahora, finPeriodo)`).
2. Se ordenan cronológicamente todos los eventos. Si un ingreso y una salida ocurren exactamente al mismo milisegundo, el ingreso se procesa primero.
3. Se itera acumulando la concurrencia:
   $$\text{AforoActual}_{t} = \text{AforoActual}_{t-1} + \Delta$$
   $$\text{AforoPico} = \max(\text{AforoActual}_{t})$$
4. Se calcula tanto el aforo pico global como el aforo pico por categoría (Autos vs. Motos).

### 3.2. Discretización de Bloques Horarios
Para reflejar la afluencia y picos de demanda según los criterios de aceptación, los ingresos se clasifican en franjas estándar de 2 horas (convertidas a hora peruana `UTC-5`):

| Código Bloque | Intervalo Local (Lima) | Etiqueta UI | Propósito Operativo |
|---|---|---|---|
| `B01` | 06:00 a 07:59:59 | `06:00 - 08:00` | Apertura matutina temprana |
| `B02` | 08:00 a 09:59:59 | `08:00 - 10:00` | Hora punta ingreso laboral / trámites |
| `B03` | 10:00 a 11:59:59 | `10:00 - 12:00` | Demanda media matutina |
| `B04` | 12:00 a 13:59:59 | `12:00 - 14:00` | Hora punta almuerzo y rotación alta |
| `B05` | 14:00 a 15:59:59 | `14:00 - 16:00` | Demanda media vespertina |
| `B06` | 16:00 a 17:59:59 | `16:00 - 18:00` | Demanda previa a salida laboral |
| `B07` | 18:00 a 19:59:59 | `18:00 - 20:00` | Hora punta noche / compras / cena |
| `B08` | 20:00 a 21:59:59 | `20:00 - 22:00` | Demanda nocturna |
| `B09` | 22:00 a 05:59:59 | `22:00 - 06:00` | Turno trasnochador / pernocte |

---

## 4. Especificación de la API REST

### 4.1. Endpoint de Consulta de Ocupación
* **Ruta:** `GET /api/ocupacion`
* **Control de Acceso:** Requiere sesión activa con rol `DUENO`.
* **Parámetros Query:**
  - `fechaInicio` (string, `YYYY-MM-DD`, obligatorio).
  - `fechaFin` (string, `YYYY-MM-DD`, obligatorio).

#### Respuestas HTTP:
* **200 OK (Con datos):**
```json
{
  "rango": {
    "fechaInicio": "2026-10-24",
    "fechaFin": "2026-10-30"
  },
  "resumen": {
    "totalVehiculos": 48,
    "totalAutos": 34,
    "totalMotos": 14,
    "aforoMaximoSimultaneo": 12,
    "aforoMaximoAutos": 8,
    "aforoMaximoMotos": 4,
    "capacidadTotalCochera": 20
  },
  "bloquesHorarios": [
    { "bloque": "06:00 - 08:00", "cantidad": 3, "porcentaje": 6.25 },
    { "bloque": "08:00 - 10:00", "cantidad": 14, "porcentaje": 29.17, "esPico": true },
    { "bloque": "10:00 - 12:00", "cantidad": 6, "porcentaje": 12.50 },
    { "bloque": "12:00 - 14:00", "cantidad": 10, "porcentaje": 20.83 },
    { "bloque": "14:00 - 16:00", "cantidad": 5, "porcentaje": 10.42 },
    { "bloque": "16:00 - 18:00", "cantidad": 4, "porcentaje": 8.33 },
    { "bloque": "18:00 - 20:00", "cantidad": 4, "porcentaje": 8.33 },
    { "bloque": "20:00 - 22:00", "cantidad": 2, "porcentaje": 4.17 },
    { "bloque": "22:00 - 06:00", "cantidad": 0, "porcentaje": 0.00 }
  ],
  "sinDatos": false
}
```

* **200 OK (Sin movimientos en el período):**
```json
{
  "rango": { "fechaInicio": "2026-09-01", "fechaFin": "2026-09-05" },
  "resumen": {
    "totalVehiculos": 0,
    "totalAutos": 0,
    "totalMotos": 0,
    "aforoMaximoSimultaneo": 0,
    "aforoMaximoAutos": 0,
    "aforoMaximoMotos": 0,
    "capacidadTotalCochera": 20
  },
  "bloquesHorarios": [],
  "sinDatos": true,
  "mensaje": "No se registran movimientos ni ingresos para el período seleccionado"
}
```

* **400 Bad Request (Validación Defensiva):**
```json
{
  "error": "La fecha de inicio no puede ser posterior a la fecha de fin"
}
```
o
```json
{
  "error": "No se pueden consultar reportes de fechas futuras"
}
```

---

### 4.2. Endpoint de Exportación de Datos de Ocupación
* **Ruta:** `GET /api/ocupacion/exportar`
* **Parámetros Query:**
  - `fechaInicio` (`YYYY-MM-DD`)
  - `fechaFin` (`YYYY-MM-DD`)
  - `formato` (`csv` / `excel`)
* **Cabeceras de Respuesta:**
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="reporte_ocupacion_2026-10-24_2026-10-30.csv"`
* **Estructura de Columnas (CSV estándar con BOM UTF-8):**
  `ID_Estadia, Placa, Tipo_Vehiculo, Fecha_Ingreso, Hora_Ingreso, Fecha_Salida, Hora_Salida, Tiempo_Horas, Estado`

---

## 5. Diseño de Interfaz de Usuario (UI/UX)

Siguiendo estrictamente la [Guía de Estilos y Lineamientos de Interfaz](../../diseño/Guía%20de%20Estilos%20y%20Lineamientos%20de%20Interfaz.md):
- **Tipografía:** Geist Sans (etiquetas, textos, botones) y JetBrains Mono (métricas numéricas, fechas y placas).
- **Colores:**
  - Fondo: Neutro suave `#F3F4F6`
  - Primario institucional: Azul corporativo `#1E3A8A`
  - Acento horas pico: Ámbar advertencia `#F59E0B`
  - Éxito / aforo óptimo: Verde esmeralda `#10B981`
  - Lleno / crítico: Rojo peligro `#EF4444`

### 5.1. Wireframe Conceptual del Módulo

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Volver al Menú Principal                                                  │
│                                                                             │
│ Nivel de Ocupación y Afluencia                                              │
│ Monitoreo de concurrencia simultánea, aforo pico y bloques horarios         │
├─────────────────────────────────────────────────────────────────────────────┤
│ [FILTROS Y ACCIONES]                                                        │
│ Fecha Inicio: [ 2026-10-24 📅 ]   Fecha Fin: [ 2026-10-30 📅 ]              │
│ [ [🔍 Consultar] ]   [ [📥 Exportar CSV/Excel] ]   [ [🖨️ Imprimir / PDF] ] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [TARJETAS KPI]                                                              │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ │ Total Vehículos│ │ Total Autos    │ │ Total Motos    │ │ Aforo Máximo   │ │
│ │       48       │ │       34       │ │       14       │ │   12 veh. (60%)│ │
│ │ en el período  │ │ 70.8% del total│ │ 29.2% del total│ │ Pico simultáneo│ │
│ └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ [GRÁFICO DE BARRAS — AFLUENCIA POR BLOQUES HORARIOS]                        │
│ Cant. ▲                                                                     │
│       │        ┌───┐                                                        │
│    14 │        │   │ (Hora Pico)                                            │
│    10 │        │   │        ┌───┐                                           │
│       │  ┌───┐ │   │  ┌───┐ │   │  ┌───┐  ┌───┐  ┌───┐                      │
│     0 └──┴───┴─┴───┴──┴───┴─┴───┴──┴───┴──┴───┴──┴───┴────────────────►     │
│        06-08   08-10  10-12 12-14  14-16  16-18  18-20  20-22  22-06        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Plan de Trabajo por Subtareas (Scrum)

1. **Subtarea 1 (Análisis y Diseño - UPAO-19/S1):** Este documento técnico de especificación.
2. **Subtarea 2 (Prototipado - UPAO-19/S2):** Vista `view-ocupacion`, integración en dashboard, selectores de fecha, renderizado del gráfico de barras SVG/Canvas y diseño responsive.
3. **Subtarea 3 (Codificación - UPAO-19/S3):** Rutas `/api/ocupacion` y `/api/ocupacion/exportar`, algoritmo de barrido temporal en JavaScript/Prisma y validación defensiva.
4. **Subtarea 4 (Test y Depuración - UPAO-19/S4):** Matriz de casos de prueba, suite E2E en Playwright, video demostrativo MP4 y registro de Defect Log.
5. **Subtarea 5 (Configuración y Despliegue en Blue - UPAO-19/S5):** Verificación de no regresión (`npm run test:regresion`), integración en `develop`, despliegue en Render Blue y evidencia formal.
