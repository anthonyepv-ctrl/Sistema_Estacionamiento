# NORMATIVA DE CONSISTENCIA EN EL DESARROLLO DEL SISTEMA DE GESTIÓN DE COCHERA

## Guía de Estilos y Lineamientos de Interfaz (UI/UX)

---

## 1. Formatos de Texto y Tipografía

- **Tipografía Primaria** (UI general, títulos, navegación y formularios): **Geist Sans** (Alternativa nativa del sistema: Segoe UI).
- **Tipografía Secundaria** (Métricas numéricas, moneda PEN, códigos y placas): **JetBrains Mono** (Alternativa nativa del sistema: Consolas, monospace).

### Jerarquía Tipográfica

| Nivel | Tamaño / Peso | Fuente | Uso |
| --- | --- | --- | --- |
| Título Principal / Headers (H1) | 24px \| Bold (700) | Geist Sans | Nombres de módulos principales (ej. Configuración de Tarifas). |
| Subtítulos (H2 / H3) | 16px - 18px \| SemiBold (600) | Geist Sans | Encabezados de contenedores Bento y títulos de formularios. |
| Cuerpo de texto (Body) | 14px \| Regular (400) | Geist Sans | Nombres descriptivos de vehículos, opciones y filas de tablas. |
| Etiquetas de campos (Labels) | 13px \| Medium (500) | Geist Sans | Etiquetas superiores de formularios (ej. Tipo de Vehículo, Modalidad). |
| Texto secundario / Captions | 12px \| Regular (400) | Geist Sans | Mensajes de ayuda, indicaciones de formato y marcas de tiempo. |
| Destacados / Placas / Montos (Data Display) | 18px - 28px \| Bold (700) | JetBrains Mono | Cifras clave de tarifas activas y códigos numéricos. |
| Badges / Identificadores | 11px \| SemiBold (600) | JetBrains Mono | Indicadores breves de categoría y estado (ej. AUTO, MOTO, ACTIVO). |

### Transformación de Texto

- **Placas de vehículos:** Siempre en MAYÚSCULAS (`text-transform: uppercase;`) con guion divisor (ej. `ABC-123`).
- **Montos monetarios:** Formato estándar de Moneda Peruana con dos decimales: `S/ 0.00` (ej. `S/ 4.50`, `S/ 10.00`).
- **Identificadores de categoría:** Siempre en MAYÚSCULAS en etiquetas tipo badge (`AUTO`, `MOTO`, `CAMIONETA`, `PESADO`).

---

## 2. Validaciones de Campos e Inputs

### A. Identificación de Vehículos (Normativa SUNARP / MTC)

**Placa de Auto / Camioneta (Categoría M / N):**

- **Longitud y Formato:** 6 caracteres alfanuméricos con guion intermedio (`ABC-123` o `A1B-234`).
- **RegEx:** `^[A-Z0-9]{3}-?[A-Z0-9]{3}$`
- **Transformación:** Automático a MAYÚSCULAS (`text-transform: uppercase;`).
- **Input Type:** `text` con máscara de auto-completado de guion.

**Placa de Motocicleta / Menores (Categoría L):**

- **Longitud y Formato:** 6 caracteres alfanuméricos (`1234-AB` o `AB-1234`).
- **RegEx:** `^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$`
- **Transformación:** Automático a MAYÚSCULAS (`text-transform: uppercase;`).

**Feedback de Error:**

> "Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A)."

### B. Datos de Contacto y Personas (Usuarios y Clientes)

**Teléfono / Celular (Perú):**

- **Longitud:** Exactamente 9 dígitos numéricos.
- **RegEx:** `^9\d{8}$` (Debe iniciar obligatoriamente con el dígito 9).
- **Input Type:** `tel` o `numeric`.
- **Feedback de Error:** "Ingrese un número celular válido de 9 dígitos que inicie con 9."

**Correo Electrónico:**

- **Longitud:** Máximo 100 caracteres.
- **RegEx:** `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- **Transformación:** Automático a minúsculas (`text-transform: lowercase;`).
- **Input Type:** `email`.
- **Feedback de Error:** "Ingrese un correo electrónico válido (ej. usuario@dominio.com)."

**Documento de Identidad (DNI / RUC - Perú):**

- **DNI:** Exactamente 8 dígitos numéricos (`^\d{8}$`). Input Type: `numeric`.
- **RUC:** Exactamente 11 dígitos numéricos, iniciando con 10, 15, 17 o 20 (`^(10|15|17|20)\d{9}$`). Input Type: `numeric`.
- **Feedback de Error:** "Ingrese un número de documento válido (DNI: 8 dígitos / RUC: 11 dígitos)."

### C. Tarifas, Precios y Cobros

**Tarifa / Importe Monetario:**

- **Longitud:** Hasta 6 caracteres útiles (incluyendo punto decimal).
- **RegEx:** `^\d+(\.\d{1,2})?$`
- **Rango:** Mínimo `0.01` | Máximo permitido por hora o fracción `999.99`.
- **Restricción de Entrada:** Bloqueo de caracteres alfabéticos, negativos (`-`) o símbolos (`S/`, `$`). Solo admite dígitos del `0` al `9` y un único separador decimal (`.`).
- **Input Type:** `text` con validación en evento `input` o `numeric`.
- **Feedback de Error:** "Ingrese un monto numérico válido mayor a 0.00 (ej. 4.50)."
- **Feedback de Éxito:** "Tarifa actualizada correctamente"

### D. Comportamiento y Estados Visuales de los Inputs

- **Estado Reposo (Default):** Borde perimetral de 1px en `#D0D7DE`, fondo `#FFFFFF`, texto `#1F2328`, placeholder `#656D76`.
- **Estado Activo / Focus:** Borde perimetral en `#0969DA` con anillo exterior de enfoque (`outline: 2px solid rgba(9, 105, 218, 0.2)`).
- **Estado de Error:** Borde perimetral en `#CF222E`, fondo de alerta `#FFEBE9`, mensaje explicativo debajo del campo en tipografía de 12px color `#CF222E`.
- **Estado de Éxito / Guardado:** Banner superior/inferior con fondo `#E6F6EB`, borde `#1A7F37`, ícono check y tipografía en `#1A7F37`.

---

## 3. Paleta de Colores Corporativa

Diseñada para un entorno operativo de alto contraste, legible en pantallas de caja o en dispositivos móviles.

| Rol del Color | Nombre | Código Hex | Uso en la Interfaz |
| --- | --- | --- | --- |
| Primario | Azul Corporativo | `#1E3A8A` | Barras de navegación, botones principales, encabezados. |
| Secundario / Acento | Ámbar / Garaje | `#F59E0B` | Botones de acción secundaria, alertas de aforo medio. |
| Éxito (Success) | Verde Esmeralda | `#10B981` | Estado "Disponible", pago confirmado, botón "Registrar Ingreso", mensaje de tarifa. |
| Peligro (Danger) | Rojo Carmesí | `#EF4444` | Estado "Aforo Lleno", botón "Registrar Salida", alertas críticas. |
| Fondo (Background) | Gris Claro | `#F3F4F6` | Fondo general de la aplicación. |
| Superficies (Cards) | Blanco Puro | `#FFFFFF` | Tarjetas de datos, modales, formularios. |
| Bordes Estructurales | Gris Borde | `#E5E7EB` | Contorno de 1px en tarjetas Bento, inputs y separadores. |
| Texto Principal | Gris Oscuro | `#111827` | Textos, títulos y valores numéricos. |
| Texto Secundario | Gris Medio | `#6B7280` | Etiquetas de formulario, placeholders y mensajes de ayuda. |

---

## 4. Lineamientos Generales de Interfaz (UX/UI Rules)

### A. Diseño "First-Keypad" (Optimizado para Operadores y Garita)

- **Autofocus Estratégico:** El cursor debe ubicarse automáticamente en el campo principal al cargar cada módulo:
  - En **Módulo de Ingreso:** foco automático en el campo de **Placa**.
  - En **Módulo de Tarifas:** foco automático en el campo **Nueva Tarifa**.
- **Atajos de Teclado:**
  - La tecla **ENTER** envía y procesa el formulario activo (registro, cobro o actualización) para evitar el cambio forzado al mouse.
  - La tecla **ESC** cierra ventanas modales o cancela acciones abiertas.

### B. Indicadores de Aforo Visuales (Semáforo Dinámico)

**Badge de Ocupación Global:** Cambia de color y etiqueta en tiempo real:

- **Verde (`#10B981`):** Ocupación normal (< 80%).
- **Amarillo / Ámbar (`#F59E0B`):** Alta ocupación / Alerta preventiva (80% al 99%).
- **Rojo Carmesí (`#EF4444`):** Aforo completo (100% ocupado) - Bloquea visualmente el botón de ingreso con advertencia.

### C. Manejo de Estados en Pantalla y Prevención de Errores

- **Estados de Botones:** Todo botón debe contemplar estados **Default, Hover, Active, Disabled y Loading** (con spinner indicador durante peticiones a BD/API).
- **Prevención de Doble Registro (Anti-Debounce):** Los botones "Cobrar", "Registrar Ingreso" y "Actualizar Tarifa" deben inhabilitarse inmediatamente al primer clic mientras la petición esté en curso, previniendo duplicidad de transacciones.

### D. Retroalimentación Inmediata (Toasts & Notificaciones)

Notificaciones flotantes temporales (duración: **3.5 a 4 segundos**) fijadas en la esquina superior derecha o inferior central:

- **Éxito en Tarifas (Criterio Jira UPAO-16):** Toast verde (`#10B981`) con el texto exacto **"Tarifa actualizada correctamente"**.
- **Éxito en Ingreso:** Toast verde (`#10B981`) con **"Ingreso registrado: Placa [ABC-123]"**.
- **Error / Conflicto:** Toast rojo (`#EF4444`) con **"Error: La placa ya cuenta con un ingreso activo"** o **"Error: Ingrese un valor numérico válido"**.

### E. Formato de Comprobantes e Impresión Térmica

- **Hoja de Estilos de Impresión (`@media print`):** Oculta automáticamente elementos de navegación, sidebars, fondos oscuros y botones de acción.
- **Formato Ticket POS:** Salida configurada en monocromo con dimensiones fijas para rollo térmico continuo estándar de **80 mm** o **58 mm**, usando tipografía monoespaciada para alineación de montos e IGV.

### F. Diseño Adaptativo (Layout Responsivo)

**Breakpoints Operativos:**

- **Desktop / Monitor de Garita (≥ 1024px):** Distribución Bento Grid en múltiples columnas para visualizar tarifas o aforo y formulario simultáneamente en pantalla completa sin scroll.
- **Tablet / Dispositivo Móvil (768px a 1023px):** Reorganización vertical a una columna única con botones de toque agrandados (mínimo **44px** de alto) para pantalla táctil.
