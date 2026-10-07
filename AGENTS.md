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
| Base de datos | PostgreSQL — nube: **Neon** (plan gratuito); local opcional: Docker (base `cochera-adev`) |
| ORM | **Prisma** |
| Control de versiones | Git + GitHub |
| Despliegue | **Render** (plan free) — `render.yaml`, rama `main` |

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
│   └── config/          # Configuración (cliente Prisma)
├── prisma/              # Esquema, migraciones y seed
├── scripts/             # Utilidades (setup de skills)
├── docs/                # Documentación
│   ├── arquitectura/    # Arquitectura y estructura técnica
│   ├── datos/           # Modelo de datos y diagrama ER
│   ├── diseño/          # Guía de estilos y lineamientos de interfaz
│   └── modulos/         # Documentación por módulo/funcionalidad
├── .env                 # Configuración local (NO se sube a Git)
├── .env.example         # Ejemplo de configuración
├── .gitignore
├── package.json
├── render.yaml          # Blueprint de despliegue en Render
├── server.js            # Punto de entrada del backend
├── README.md
└── AGENTS.md            # Este archivo
```

Cada carpeta tiene una única responsabilidad. **No crear capas/carpetas innecesarias**; mantener la estructura simple.

---

## 4. Comandos

> Prisma 6 ya está configurado (`prisma/schema.prisma` + migración inicial). Requiere `DATABASE_URL` en `.env` (ver `.env.example`).

| Comando | Descripción |
| --- | --- |
| `npm install` | Instalar dependencias. |
| `npm run setup:skills` | Instalar las skills estándar del equipo (ver §10). |
| `npm run dev` | Levantar backend en desarrollo con recarga automática. |
| `npm start` | Levantar el servidor. |
| `npm run db:deploy` | Aplicar migraciones pendientes (BD compartida). |
| `npm run db:seed` | Cargar datos iniciales (tipos, tarifas, métodos de pago, usuario). |
| `npm run db:migrate` | Crear/aplicar migraciones en desarrollo. |
| `npm run db:generate` | Generar el cliente Prisma. |
| `npm run db:studio` | Explorar la base de datos. |

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
- Implementación: `prisma/schema.prisma` + `prisma/migrations/` (Prisma 6, PostgreSQL). Aplicar con `npm run db:deploy`.
- Diagrama editable: `docs/datos/diagrama-er.erd`.
- Entidades: `usuario`, `tipo_vehiculo`, `tarifa`, `estadia`, `pago`, `metodo_pago`.
- Regla clave: una estadía está activa mientras `hora_salida IS NULL`; no se permite un nuevo ingreso para una placa con estadía activa (garantizado por índice único parcial).

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
6. **Integración a `main`:** la rama `main` **solo** se actualiza con un merge desde `develop` (nunca directamente desde ramas `feature/` o `chore/`), y únicamente al cierre de la tarea de configuración *Integración final al repositorio en GitHub* (ej. UPAO-36) con autorización. Antes de ese merge, `develop` debe tener todas las ramas del sprint integradas y sin conflictos.

---

## 8. Metodología Scrum y control de alcance

**Trabajamos con Scrum, por sprints.** Estas reglas son obligatorias para personas y agentes de IA:

- **Solo se avanza lo planificado:** únicamente se trabaja en las Historias/Subtareas del **sprint en curso**, en el **orden definido en Jira** (Análisis y Diseño → Prototipado → Codificación → Test → Configuración).
- **Prohibido adelantar trabajo no planificado:** no implementar funcionalidad de Historias de **sprints futuros** ni del **backlog sin sprint**, aunque parezca fácil o "necesaria". Si surge una necesidad, se registra como nota/pregunta para el equipo; **no se programa**.
- **Prohibido revivir alcance de HUs anteriores:** no volver a tocar ni mezclar funcionalidad de Historias ya cerradas en la tarea actual. Si hay que corregir algo de una HU previa, se hace en su propia rama/ticket.
- **Antes de codificar, verificar en Jira:** (a) la HU está `En curso`, (b) la subtarea está asignada a ti, y (c) es la siguiente en el orden planificado.
- **Cambios de alcance:** solo con autorización del dueño del producto y con la Historia/Subtarea actualizada en Jira **antes** de programar.
- **Si falta información o hay ambigüedad:** detenerse y preguntar al equipo. No inventar reglas de negocio ni asumir requisitos.
- **No cerrar una subtarea** sin sus criterios de aceptación cumplidos y verificados.

---

## 9. Jira

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
- **Definition of Done (DoD):** subtareas de Análisis, Prototipado, Codificación, Test y Configuración completadas; criterios de aceptación cumplidos; documentación actualizada (§11); PR aprobado por 1 revisor e integrado a `develop`; historia en estado `Listo`.

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

## 10. Skills y flujo de trabajo de los agentes

Para que **todos los integrantes y sus agentes de IA** trabajen igual, se usa el mismo set de skills y el mismo flujo.

### Skills estándar del equipo

Instaladas globalmente para todos los agentes (`~\.agents\skills`). Ejecutar estos comandos en cada máquina nueva:

```bash
# Especificación (Spec Kit)
npx skills add dceoy/speckit-agent-skills@speckit-constitution -g -y
npx skills add dceoy/speckit-agent-skills@speckit-specify -g -y
npx skills add dceoy/speckit-agent-skills@speckit-plan -g -y
npx skills add dceoy/speckit-agent-skills@speckit-tasks -g -y
npx skills add dceoy/speckit-agent-skills@speckit-implement -g -y

# Datos y ORM (oficiales de Prisma)
npx skills add prisma/skills@prisma-database-setup -g -y
npx skills add prisma/skills@prisma-client-api -g -y
npx skills add prisma/skills@prisma-cli -g -y

# UI/UX
npx skills add nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max -g -y
npx skills add anthropics/skills@frontend-design -g -y

# Calidad, testing, dominio y documentación
npx skills add mattpocock/skills@code-review -g -y
npx skills add mattpocock/skills@tdd -g -y
npx skills add mattpocock/skills@diagnosing-bugs -g -y
npx skills add mattpocock/skills@domain-modeling -g -y
npx skills add mattpocock/skills@grill-with-docs -g -y

# Seguridad de API
npx skills add usestrix/strix@api-security-testing -g -y
```

| Fase | Skill | Para qué |
| --- | --- | --- |
| Mapa del código | **graphify** | Grafo/consulta del codebase (ya instalada en OpenCode). |
| Especificación | `speckit-constitution` | Principios del proyecto. |
| Especificación | `speckit-specify` | Convertir una HU en especificación. |
| Especificación | `speckit-plan` | Plan técnico. |
| Especificación | `speckit-tasks` | Desglose en tareas. |
| Especificación | `speckit-implement` | Implementar tareas. |
| Datos/ORM | `prisma-database-setup`, `prisma-client-api`, `prisma-cli` | Prisma + PostgreSQL (setup, cliente, migraciones). |
| Dominio | `domain-modeling` | Modelar el dominio y las entidades. |
| UI/UX | `ui-ux-pro-max` ("UX Pro") | Diseño y mejora de interfaces. |
| UI/UX | `frontend-design` | Criterio de diseño frontend. |
| Calidad | `code-review` | Revisión de código/PR. |
| Testing | `tdd` | Desarrollo guiado por pruebas. |
| Debugging | `diagnosing-bugs` | Diagnóstico de bugs. |
| Seguridad | `api-security-testing` | Pruebas de seguridad de API. |
| Documentación | `grill-with-docs` | Verificar que la documentación refleje el código. |

> graphify se instala a nivel de OpenCode; si usas otro agente, instala su equivalente para no perder el mapa del proyecto.
> Nota: el escaneo de Snyk marcó `code-review` como _High Risk_; revisar su contenido antes de usarla o reemplazarla por `thermo-nuclear-code-quality-review` (ya instalada).

### Flujo estándar de trabajo de un agente

1. **Entender:** usar `graphify` para ubicar el código afectado (nunca asumir la estructura).
2. **Especificar y planificar:** `speckit-specify` → `speckit-plan` → `speckit-tasks` (con `speckit-constitution` como marco) antes de escribir código.
3. **Datos (si aplica):** modelar con `domain-modeling` y trabajar el esquema con `prisma-database-setup`, `prisma-client-api` y `prisma-cli`.
4. **Implementar:** con `speckit-implement` y `tdd`, respetando §5, §8 y el alcance de la subtarea.
5. **UI (si aplica):** usar `ui-ux-pro-max` y `frontend-design`, respetando la guía de estilos del proyecto.
6. **Verificar:** `code-review` antes del PR; `api-security-testing` sobre los endpoints; `diagnosing-bugs` si algo falla.
7. **Documentar y reportar:** `grill-with-docs`, actualizar la documentación (§11) y mover el estado en Jira.

---

## 11. Documentación y actualización de avances

- **Regla de oro:** todo cambio importante se documenta **en la misma rama/PR** en que se realiza. Si no está documentado, la tarea **no está terminada**.
- Mapa de actualización según el cambio:

| Si cambia... | Actualizar... |
| --- | --- |
| Estructura, capas o stack | `docs/arquitectura/Arquitectura.md` y §2/§3 de este archivo |
| Modelo de datos (tablas, campos, relaciones) | `docs/datos/Modelo_de_Datos.md` y `diagrama-er.erd` |
| UI, colores, tipografía o componentes | Guía de estilos y `UI_Kit_Estilos_Cochera.svg` / `.html` |
| Comportamiento o reglas de un módulo | `docs/modulos/<modulo>/` |
| Comandos, scripts o dependencias | `package.json` y §4 de este archivo |
| Decisiones de metodología o flujo | Este archivo (`AGENTS.md`) |

- **Avances en Jira:** al iniciar una subtarea → `En curso`; al terminarla y documentarla → `Listo`. No marcar `Listo` sin PR mergeado a `develop` (o verificación acordada).
- **No duplicar documentación:** enlazar a `docs/` en lugar de copiar contenido.

---

## 12. Documentación del proyecto

| Tema | Archivo |
| --- | --- |
| Arquitectura y estructura | [`docs/arquitectura/Arquitectura.md`](docs/arquitectura/Arquitectura.md) |
| Modelo de datos | [`docs/datos/Modelo_de_Datos.md`](docs/datos/Modelo_de_Datos.md) |
| Guía rápida de Prisma | [`docs/datos/Guia_Prisma.md`](docs/datos/Guia_Prisma.md) |
| Diagrama ER | `docs/datos/diagrama-er.erd` |
| Guía de estilos UI/UX | [`docs/diseño/Guía de Estilos y Lineamientos de Interfaz.md`](docs/diseño/Guía%20de%20Estilos%20y%20Lineamientos%20de%20Interfaz.md) |
| UI Kit (referencia visual) | `docs/diseño/UI_Kit_Estilos_Cochera.svg` / `.html` |
| Módulos | `docs/modulos/<modulo>/` |
| Flujo Git / commits / PR | [`README.md`](README.md) |

---

## 13. Reglas para agentes de IA

- Responder y documentar en **español**.
- **Cumplir §8:** no avanzar trabajo no planificado ni funcionalidad de HUs anteriores/futuras.
- **Usar las skills y el flujo de §10** antes y durante la implementación.
- **Documentar según §11** antes de dar una tarea por terminada.
- Antes de implementar, revisar la documentación de `docs/` correspondiente al módulo.
- Respetar la guía de estilos y las validaciones peruanas descritas arriba.
- **No** hacer `commit`, `push` ni abrir PR si no se solicita explícitamente.
- No inventar reglas de negocio: si falta información, preguntar o dejar `TODO`.
- Mantener la estructura de carpetas simple; no agregar dependencias sin justificarlo.

---

## 14. Pendientes conocidos

- Compartir el `DATABASE_URL` de Neon con el equipo (por privado; ver README).
- API implementada para login y tarifas; falta el resto de módulos del Sprint 1 (en su orden).
- **Despliegue demo (UPAO-36):** login + tarifas publicados en **Render** (plan free, rama `main`, BD Neon) mediante `render.yaml`; `DATABASE_URL` es variable secreta del panel de Render. El despliegue productivo de la Reserva Web (Epic UPAO-28) sigue siendo trabajo futuro.
- Posible error de nombre en `public/css/stye.css` (¿`style.css`?).
- Confirmar la **URL del tablero de Jira** (ver §9).
- Priorizar las historias del **Sprint 1** (UPAO-16, UPAO-6, UPAO-7, UPAO-11, UPAO-17) respetando el orden planificado.
