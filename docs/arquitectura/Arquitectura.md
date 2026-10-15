# Arquitectura y estructura del proyecto

## 1. Arquitectura actual

Sistema web **cliente-servidor**: el backend sirve la interfaz y la API REST en el mismo origen (sin CORS).

```text
[Navegador del usuario]
        │  HTTPS
        ▼
[Render — Web Service "cochera-sp" (plan free)]
        │  Node.js 22 + Express 5
        │  Sirve: public/ (frontend) + /api (API REST)
        │  Prisma 6 (ORM)
        ▼
[Neon — PostgreSQL en la nube (región sa-east-1)]
```

- El backend Express sirve la interfaz (`public/`) y la API REST (`/api`) en el mismo origen.
- El acceso a datos se realiza con **Prisma 6** (`prisma/schema.prisma` + migraciones).
- La base de datos es **PostgreSQL gestionado en Neon**, compartida por el equipo.
- El despliegue demo se hace en **Render** (plan free) desde la rama `main`, con `render.yaml`.

## 2. Entornos

| Entorno | Aplicación | Base de datos | Ejecución |
| --- | --- | --- | --- |
| Local (desarrollo) | `npm run dev` → http://localhost:3000 | Neon (compartida) | `DATABASE_URL` en `.env` |
| Demo (nube) | Render (plan free, rama `main`) | Neon (compartida) | `render.yaml`; `DATABASE_URL` como variable secreta en Render |

## 3. Estructura del proyecto

```text
Sistema_Estacionamiento/
├── public/              # Interfaz del sistema (frontend)
│   ├── css/
│   ├── js/
│   └── index.html
├── src/                 # Código del backend
│   ├── config/          # Configuración (cliente Prisma)
│   └── routes/          # Rutas de la API (auth, tarifas)
├── prisma/              # Esquema, migraciones y seed
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
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
└── AGENTS.md            # Contexto e instrucciones del equipo
```

## 4. Organización de la documentación

- `arquitectura/`: arquitectura y estructura técnica.
- `datos/`: modelo de datos y diagrama ER.
- `diseño/`: guía de estilos y lineamientos de interfaz.
- `modulos/`: documentación específica de cada módulo o funcionalidad.

## 5. Principios

- Mantener una estructura simple y fácil de entender.
- Separar interfaz, backend y documentación; cada carpeta con una responsabilidad clara.
- No crear capas o carpetas innecesarias.
- La arquitectura podrá evolucionar conforme aumente la complejidad del sistema.

## 6. Estado actual (Sprint 2 y Despliegue Final)

- **Módulos implementados y verificados:**
  - **Login y Tarifas (UPAO-16):** autenticación por roles (Dueño/Recepción) con bcrypt y configuración de tarifas por hora/fracción.
  - **Registrar Ingreso (UPAO-6 / UPAO-37..41):** detección de tipo, normalización de placa y validación Poka-Yoke MTC (DEF-03).
  - **Registrar Salida y Cobro (UPAO-7 / UPAO-43..45):** cálculo automático de horas/fracción y registro de pago (Efectivo/Yape/POS).
  - **Visualizar Aforo (UPAO-11 / UPAO-47..51):** cálculo dinámico de ocupación y listado de vehículos activos en cochera.
  - **Reporte de Ingresos Diarios y Cuadre de Caja (UPAO-17 / UPAO-52..55):** consolidado diario, sumatoria por método de pago (Efectivo vs. Yape), desglose de dinero físico/digital, filtros interactivos y consulta por fecha con zona horaria de Perú (`-05:00`).
- **Despliegue en Producción (Render + Neon):**
  - **URL Demo en la Nube:** [`https://cochera-sp.onrender.com`](https://cochera-sp.onrender.com)
  - **Plataforma:** Render Web Service (plan free, rama `main`).
  - **Base de Datos:** PostgreSQL en Neon (compartida), gestionada mediante Prisma 6.
  - **Variables y Secretos:** `DATABASE_URL` configurada como variable de entorno secreta en el panel de Render (`render.yaml`).
  - **Commit de Release / Despliegue en `main`:** [`3d0db0c`](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/commit/3d0db0c)

