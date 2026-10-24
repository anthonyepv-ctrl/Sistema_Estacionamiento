# Estrategia de Ambientes Blue / Green, Despliegue y Plantilla de Pruebas

**Documento Técnico y Metodológico — Proyecto Sistema de Cochera**  
**Fecha de formalización:** 24/10/2026 (Retrospectiva Sprint 1 / Inicio Sprint 2)  
**Estado:** Aprobado por el equipo

---

## 1. Justificación y Origen (Retrospectiva del Sprint 1)

Al culminar con éxito el **Sprint 1** (100% de las 5 Historias de Usuario en estado `Listo` y desplegadas en la nube), el sistema pasó a encontrarse **operativo y público en producción** en Render ([`https://cochera-sp.onrender.com`](https://cochera-sp.onrender.com)).

### 1.1. Hallazgos clave de la retrospectiva:
- **Cosas buenas:** La metodología de 5 fases por historia (*Análisis → Prototipado → Codificación → Pruebas/Depuración → Integración*) funcionó con alta efectividad; las validaciones defensivas (*Poka-Yoke* de placas MTC) evitaron errores humanos y la seguridad de secretos fue impecable.
- **Riesgo detectado:** Al tener el sistema ya desplegado en producción, cualquier commit o historia intermedia del Sprint 2 que se fusione a `main` corre el riesgo de introducir inestabilidad o pantallas a medio terminar en la demo activa del cliente/profesor.
- **Fricción en Jira:** En las primeras subtareas las evidencias de prueba se subían dispersas y sin formato uniforme, dificultando la auditoría de los criterios de aceptación.

### 1.2. Acuerdos de mejora adoptados:
1. **Adopción de estrategia Blue / Green (Staging vs. Producción):** Aislar completamente el entorno de pruebas continuas (`develop`) del entorno estable y público (`main`).
2. **Cero costo en infraestructura:** Aprovechar las funciones nativas gratuitas de Render (auto-sleep) y Neon (database branching).
3. **Formalización obligatoria del Markdown de Pruebas:** Estandarizar la estructura de `plan-pruebas.md` con bitácora de defectos (*Defect Log*) y trazabilidad directa a GitHub.

---

## 2. Definición de los Ambientes Blue y Green

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FLUJO BLUE / GREEN                              │
└────────────────────────────────────────────────────────────────────────┘

 [Feature Branch]  ──(PR / Merge)──►  [Rama develop]  ──(PR al cierre de HU)──►  [Rama main]
                                            │                                          │
                                            ▼ (Auto-deploy)                            ▼ (Auto-deploy)
                                   ┌─────────────────┐                        ┌─────────────────┐
                                   │  AMBIENTE BLUE  │                        │ AMBIENTE GREEN  │
                                   │    (Staging)    │                        │  (Producción)   │
                                   └────────┬────────┘                        └────────┬────────┘
                                            │                                          │
                                            ▼                                          ▼
                                   ┌─────────────────┐                        ┌─────────────────┐
                                   │   BD Neon Blue  │                        │  BD Neon Green  │
                                   │ (Branch Staging)│                        │  (Branch Main)  │
                                   └─────────────────┘                        └─────────────────┘
```

| Parámetro | Ambiente Blue (Staging / Pre-producción) | Ambiente Green (Producción / Live) |
|---|---|---|
| **Propósito** | Pruebas integrales de cada HU del sprint, grabación de videos y validación de regresión | Servicio oficial y estable accesible a usuarios finales y evaluadores |
| **Rama Git** | `develop` | `main` |
| **Servicio Render** | Web Service: `cochera-staging` (plan free) | Web Service: `cochera-sp` (plan free) |
| **URL Pública** | `https://cochera-staging.onrender.com` | `https://cochera-sp.onrender.com` |
| **Base de Datos** | PostgreSQL Neon — Rama `staging` (o BD `cochera_staging`) | PostgreSQL Neon — Rama `main` (BD productiva) |
| **Cuándo se actualiza** | En cada integración de subtarea/historia aprobada en desarrollo | **Únicamente al completar y validar la historia completa** en Blue |

---

## 3. Viabilidad Técnica y Costo: ¿Por qué es 100% GRATIS?

Tanto Render como Neon permiten sostener esta arquitectura dual **sin ningún costo económico**:

### 3.1. En Render (Plan Free)
* **Límite mensual:** Render otorga **750 horas de cómputo gratuitas al mes** por cuenta.
* **Mecanismo de Sleep:** Los servicios en el plan free se suspenden automáticamente tras 15 minutos de inactividad. Mientras están en modo reposo, **no consumen horas de cómputo**.
* **Uso real del equipo:**
  - El ambiente **Green** solo recibe tráfico esporádico de demostraciones.
  - El ambiente **Blue** solo se despierta durante las sesiones de prueba y grabación de evidencias.
  - El consumo combinado rara vez supera las 40–60 horas mensuales, manteniéndose muy por debajo del límite de 750h.

### 3.2. En Neon (PostgreSQL Free Tier)
* **Database Branching nativo:** Neon soporta hasta 10 branches gratuitas con tecnología *Copy-on-Write*.
* Una rama de base de datos (`staging`) es una copia aislada instantánea de la base de datos principal (`main`):
  - No duplica el almacenamiento base.
  - Los datos insertados en las pruebas E2E en Blue **no contaminan** la base de datos de Green.
  - Ambas ramas comparten la cuota gratuita de 0.5 GB de almacenamiento y 100 horas activas de cómputo Neon.

---

## 4. Guía de Configuración del Ambiente Blue (Paso a Paso)

### Paso 1: Crear la rama de Base de Datos en Neon
1. Iniciar sesión en la consola de [Neon](https://console.neon.tech).
2. Seleccionar el proyecto `cochera-adev` (o el proyecto activo del equipo).
3. Ir al menú **Branches** en la barra lateral izquierda y hacer clic en **New Branch**.
4. Nombre de la rama: `staging` (basada en `main`).
5. Copiar la cadena de conexión generada (`postgresql://.../neondb?sslmode=require`).
6. Aplicar las migraciones existentes en la rama staging:
   ```bash
   npx prisma migrate deploy
   node prisma/seed.js
   ```

### Paso 2: Crear el Web Service Blue en Render
1. En [Render Dashboard](https://dashboard.render.com), hacer clic en **New → Web Service**.
2. Seleccionar el repositorio `anthonyepv-ctrl/Sistema_Estacionamiento`.
3. Configurar los siguientes campos:
   - **Name:** `cochera-staging`
   - **Branch:** `develop`
   - **Runtime:** `Node`
   - **Build Command:** `npm install --include=dev && npx prisma generate`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. En la sección **Environment Variables**, agregar la variable secreta:
   - Key: `DATABASE_URL`
   - Value: *(pegar la cadena de conexión de la branch `staging` de Neon)*
5. Hacer clic en **Create Web Service**.

---

## 5. Ciclo de Vida y Promoción (De Blue a Green)

Para cada una de las Historias de Usuario del **Sprint 2** (`UPAO-9`, `UPAO-18`, `UPAO-19`, `UPAO-20`):

1. **Desarrollo en Feature Branch:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<CLAVE-JIRA>-descripcion
   ```
2. **Integración a Blue (Staging):**
   - Al terminar las subtareas de *Codificación* y *Test*, se abre PR hacia `develop`.
   - Tras el merge a `develop`, Render despliega automáticamente a `https://cochera-staging.onrender.com` (Ambiente Blue).
3. **Validación E2E en Blue:**
   - Se ejecutan las pruebas finales sobre la URL de Blue.
   - Se genera el video MP4 y se llena el Defect Log en `plan-pruebas.md`.
4. **Paso a Green (Producción):**
   - Una vez que la historia en Blue está verificada sin defectos abiertos, se abre un Pull Request de `develop` hacia `main`.
   - Se aprueba el PR con al menos 1 revisor.
   - Render actualiza automáticamente el ambiente **Green** (`https://cochera-sp.onrender.com`).

---

## 6. Plantilla Estándar Obligatoria de Pruebas y Defect Log

A partir del Sprint 2, toda subtarea de prueba debe generar y versionar su documentación bajo el archivo:  
`docs/modulos/<modulo>/plan-pruebas.md`

### 6.1. Estructura interna del Markdown (`plan-pruebas.md`):

```markdown
# Plan de Pruebas y Registro de Depuración — <MÓDULO> (<CLAVE-JIRA>)

## 1. Objetivo y Alcance
Verificar el correcto funcionamiento de los criterios de aceptación de la historia...

## 2. Entorno de Pruebas
- Servidor: Ambiente Blue (Staging en Render: https://cochera-staging.onrender.com)
- Base de Datos: PostgreSQL Neon (Branch staging)
- Herramienta: Playwright Chromium con cursor visual y captura MP4

## 3. Matriz de Casos de Prueba
| ID | Caso de Prueba | Pasos a Ejecutar | Resultado Esperado | Resultado |
|:---:|---|---|---|:---:|
| CP-01 | ... | ... | ... | PASA |
| CP-02 | ... | ... | ... | PASA |

## 4. Registro de Defectos Depurados (Defect Log)
| ID | Caso | Falla Encontrada | Causa Raíz | Corrección Aplicada | Commit Fix | Estado |
|:---:|:---:|---|---|---|:---:|:---:|
| DEF-01 | CP-XX | ... | ... | ... | [`hash`](url_commit) | SUPERADO |

## 5. Evidencias y Trazabilidad en GitHub
- Video Demostrativo MP4: [`demostracion_pruebas_<clave>.mp4`](url_blob_github)
- Commit de Corrección en GitHub: [`hash`](url_commit)
- Pull Request / Merge a develop: [`#PR`](url_pr)
- Rama de la tarea: [`feature/...`](url_branch)
```

### 6.2. Formato estándar para el reporte en Jira:

```text
h3. Evidencias de la Subtarea de Pruebas (<CLAVE-JIRA>)

* Ambiente de Validación (Blue / Staging):
https://cochera-staging.onrender.com

* Documento de Plan de Pruebas y Defect Log (.md):
https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/<modulo>/plan-pruebas.md

* Video Demostrativo MP4 de Pruebas E2E:
https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/docs/modulos/<modulo>/evidencias/<video>.mp4

* Commit de la solución en GitHub:
https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/<hash>

* Rama de la tarea en GitHub:
https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/feature/<nombre-rama>
```
