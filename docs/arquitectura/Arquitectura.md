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

## 6. Estado actual (Sprint 1)

- **Implementado (UPAO-16):** login con contraseña cifrada (bcrypt), menú principal y módulo de tarifas (consulta y actualización), con API REST sobre Prisma y BD en Neon.
- **Despliegue demo (UPAO-36):** Render (plan free) desde `main`; `DATABASE_URL` configurada como secreto en el panel de Render.
- **Pendiente del sprint:** registrar ingreso (UPAO-6), registrar salida (UPAO-7), ver estado de espacios (UPAO-11) y consultar ingresos recaudados (UPAO-17), en el orden planificado.
