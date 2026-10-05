# AGENTS.md — Sistema de Gestión de Cochera

Contexto e instrucciones compartidas para todo el equipo (y para agentes de IA) que trabajen en este repositorio.

> Mantener este archivo actualizado. Si cambia el stack, el flujo de trabajo o la metodología, actualizar aquí.

---

## 1. Descripción del proyecto

Sistema web para la **gestión de una cochera/estacionamiento**: registro de ingreso y salida de vehículos, cálculo y cobro de tarifas por hora/fracción, control de aforo y administración de usuarios.

- **Idioma del producto y de la documentación:** Español (Perú).
- **Moneda:** Soles peruanos (PEN, `S/`).
- **Normativas consideradas:** formatos de placa SUNARP/MTC, DNI/RUC (Perú), celular de 9 dígitos.

---

## 2. Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | HTML + CSS + JavaScript (vanilla) en `public/` |
| Backend | Node.js + Express (`server.js`, `src/`) |
| Base de datos | PostgreSQL (base `cochera-adev`) |
| ORM | **Prisma** |
| Control de versiones | Git + GitHub |

---

## 3. Estructura del proyecto

```text
Sistema_Estacionamiento/
├── public/              # Interfaz del sistema (frontend)
│   ├── css/
│   ├── js/
│   └── index.html
├── src/                 # Código del backend
│   ├── routes/          # Rutas de la API
│   ├── models/          # Modelos y acceso a datos
│   └── config/          # Configuración
├── docs/                # Documentación
│   ├── arquitectura/    # Arquitectura y estructura técnica
│   ├── datos/           # Modelo de datos y diagrama ER
│   ├── diseño/          # Guía de estilos y lineamientos de interfaz
│   └── modulos/         # Documentación por módulo/funcionalidad
├── .env                 # Configuración local (NO se sube a Git)
├── .env.example         # Ejemplo de configuración
├── .gitignore
├── package.json
├── server.js            # Punto de entrada del backend
├── README.md
└── AGENTS.md            # Este archivo
```

Cada carpeta tiene una única responsabilidad. **No crear capas/carpetas innecesarias**; mantener la estructura simple.

---

## 4. Comandos

> `package.json` aún está vacío. Estos scripts son la convención a implementar; actualizar aquí cuando existan.

| Comando | Descripción |
| --- | --- |
| `npm install` | Instalar dependencias. |
| `npm run dev` | Levantar backend en desarrollo con recarga automática. |
| `npm start` | Levantar el servidor. |
| `npx prisma migrate dev` | Crear/aplicar migraciones en desarrollo. |
| `npx prisma generate` | Generar el cliente Prisma. |
| `npx prisma studio` | Explorar la base de datos. |

---

## 5. Convenciones de código

- **Idioma:** nombres de carpetas, tablas y documentación en español; identificar claramente los campos en `snake_case` dentro de la BD.
- **Frontend/UI:** seguir estrictamente la [Guía de Estilos y Lineamientos de Interfaz](docs/diseño/Guía%20de%20Estilos%20y%20Lineamientos%20de%20Interfaz.md):
  - Tipografía: **Geist Sans** (UI) y **JetBrains Mono** (métricas/placas/montos).
  - Paleta corporativa: azul `#1E3A8A`, ámbar `#F59E0B`, verde `#10B981`, rojo `#EF4444`, fondo `#F3F4F6`.
  - Montos en formato `S/ 0.00`; placas en MAYÚSCULAS con guion (`ABC-123`).
- **Validaciones:** respetar las RegEx y formatos peruanos descritos en la guía (placa, celular, correo, DNI/RUC, tarifa).
- **Estados de UI:** todo botón debe manejar `Default`, `Hover`, `Active`, `Disabled` y `Loading`; los toasts duran 3.5–4 s.
- **Comentarios:** no agregar comentarios al código salvo que se soliciten.

---

## 6. Modelo de datos

- Referencia: [`docs/datos/Modelo_de_Datos.md`](docs/datos/Modelo_de_Datos.md).
- Diagrama editable: `docs/datos/diagrama-er.erd` (base `cochera-adev`, PostgreSQL).
- Entidades principales: `TARIFA`, `TIPO_VEHICULO`, `ESTADIA`, `PAGO`, `METODO_PAGO`, `USUARIO`.
- Regla clave: una estadía está activa mientras `hora_salida IS NULL`; no se permite un nuevo ingreso para una placa con estadía activa.

---

## 7. Flujo de trabajo (Git)

1. Partir siempre de `develop` actualizada: `git checkout develop` → `git pull origin develop`.
2. Crear la rama de la tarea: `git checkout -b feature/HU1-configurar-tarifas` (o `feature/<CLAVE-JIRA>-descripcion`).
3. Commits con convención:
   - `feat: agregar formulario de configuración de tarifas`
   - `fix: corregir cálculo de tarifa por hora`
   - `docs: actualizar instrucciones en README`
   - `chore:`, `test:`, `refactor:` según corresponda.
4. Push de la rama: `git push origin feature/nombre-rama`.
5. Abrir **Pull Request** hacia `develop`, con **al menos 1 revisor**; merge tras aprobación y verificaciones.

---

## 8. Jira

- **Proyecto / clave:** `UPAO`.
- **URL del tablero:** _TODO (pendiente de confirmar)_.
- **Metodología:** trabajo por **sprints** (actual: **Sprint 1**).
- **Tipos de incidencia:** `Epic`, `Historia`, `Subtask`.
- **Estados del flujo:** `Por hacer` → `En curso` → `Listo`.
- **Prioridad por defecto:** `Medium`.
- **Tipos de tarea (subtasks):** `Análisis y Diseño`, `Prototipado`, `Codificación`, `Test` (`Tsdt`), `Configuración`.
- **Escala de Story Points:** 1, 2, 3, 5.

### Épicas

| Clave | Épica |
| --- | --- |
| UPAO-26 | Operación y Control de la cochera |
| UPAO-27 | Administración y Supervisión del Negocio |
| UPAO-28 | Manejo de Reserva Web |

### Historias del Sprint 1

| Clave | Historia | Estado | SP | Épica |
| --- | --- | --- | --- | --- |
| UPAO-16 | Configurar tarifas | En curso | 3 | Administración y Supervisión del Negocio |
| UPAO-6 | Registrar ingreso | Por hacer | 2 | Operación y Control de la cochera |
| UPAO-7 | Registrar salida | Por hacer | 3 | Operación y Control de la cochera |
| UPAO-11 | Ver estado de espacios | Por hacer | 1 | Operación y Control de la cochera |
| UPAO-17 | Consultar ingresos recaudados | Por hacer | 2 | Administración y Supervisión del Negocio |

> Backlog futuro (sin sprint asignado): UPAO-8 Buscar reservas, UPAO-9 Adjuntar notas, UPAO-18 Gráficos de ingresos, UPAO-19 Consultar nivel de ocupación, UPAO-20 Ver espacios disponibles, UPAO-21 Realizar reserva, UPAO-22 Anular reserva, UPAO-23 Consultar historial de estados.

### Convenciones de Jira

- **Redacción de historias:** `Como <rol> quiero <acción> para <beneficio>` (roles: recepcionista, dueño).
- **Criterios de aceptación:** van en el campo *Criterios de Aceptación* como lista de viñetas (`* ...`), verificables y sin ambigüedad.
- **Subtareas por historia (patrón):** Análisis y Diseño → Prototipado → Codificación → Test → Configuración (integración/subida a GitHub).
- **Nomenclatura de ramas:** `feature/<CLAVE-JIRA>-descripcion` (ej. `feature/UPAO-16-configurar-tarifas`).
- **Referencia en commits/PR:** incluir la clave del ticket (ej. `feat: ... (UPAO-16)`).
- **Definition of Done (DoD):** _propuesto_ — subtareas de Análisis, Prototipado, Codificación, Test y Configuración completadas; criterios de aceptación cumplidos; PR aprobado por 1 revisor e integrado a `develop`; historia en estado `Listo`.

### Equipo

| Nombre / usuario |
| --- |
| ALBERTH JAIR FLORES LEONARDO |
| ANTHONY EDUARDO PITA VERASTEGUI |
| CRISTIAN LEONARDO ALIAGA VASQUEZ |
| Fabrizzio Martin Gutierrez Gamboa |
| jsantistebann1 |
| nvanleeuweng1 |

---

## 9. Documentación del proyecto

| Tema | Archivo |
| --- | --- |
| Arquitectura y estructura | [`docs/arquitectura/Arquitectura.md`](docs/arquitectura/Arquitectura.md) |
| Modelo de datos | [`docs/datos/Modelo_de_Datos.md`](docs/datos/Modelo_de_Datos.md) |
| Diagrama ER | `docs/datos/diagrama-er.erd` |
| Guía de estilos UI/UX | [`docs/diseño/Guía de Estilos y Lineamientos de Interfaz.md`](docs/diseño/Guía%20de%20Estilos%20y%20Lineamientos%20de%20Interfaz.md) |
| UI Kit (referencia visual) | `docs/diseño/UI_Kit_Estilos_Cochera.svg` / `.html` |
| Módulos | `docs/modulos/<modulo>/` |
| Flujo Git / commits / PR | [`README.md`](README.md) |

---

## 10. Reglas para agentes de IA

- Responder y documentar en **español**.
- Antes de implementar, revisar la documentación de `docs/` correspondiente al módulo.
- Respetar la guía de estilos y las validaciones peruanas descritas arriba.
- **No** hacer `commit`, `push` ni abrir PR si no se solicita explícitamente.
- No inventar reglas de negocio: si falta información, preguntar o dejar `TODO`.
- Mantener la estructura de carpetas simple; no agregar dependencias sin justificarlo.

---

## 11. Pendientes conocidos

- `package.json`, `server.js` y `.env.example` están vacíos: definir scripts, servidor Express y variables de entorno (ej. `DATABASE_URL`, `PORT`).
- Configurar Prisma (`schema.prisma`, migraciones) según `docs/datos/Modelo_de_Datos.md`.
- Posible error de nombre en `public/css/stye.css` (¿`style.css`?).
- Confirmar la **URL del tablero de Jira** (ver §8).
- Priorizar las historias del **Sprint 1** (UPAO-16, UPAO-6, UPAO-7, UPAO-11, UPAO-17) al iniciar el desarrollo.
