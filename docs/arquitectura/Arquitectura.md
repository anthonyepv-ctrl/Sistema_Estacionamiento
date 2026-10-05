# Arquitectura y estructura del proyecto

## 1. Arquitectura

El sistema utilizará una arquitectura web cliente-servidor:

```text
Frontend
   ↓
API REST
   ↓
Backend Node.js (Express + Prisma/TypeORM)
   ↓
PostgreSQL
```

## 2. Estructura del proyeecto

```
Sistema_Estacionamiento/
│
├── public/              # Interfaz del sistema
│   ├── css/
│   ├── js/
│   └── index.html
|
│
├── src/                 # Código del backend
│   ├── routes/          # Rutas de la API
│   ├── models/          # Modelos y acceso a datos
│   └── config/          # Configuración
│
├── docs/                # Documentación
│   ├── arquitectura/
│   ├── datos/
│   ├── diseño/
│   └── modulos/
│
├── .env                 # Configuración local (no se sube a Git)
├── .env.example         # Ejemplo de configuración
├── .gitignore
├── package.json
├── README.md
├── AGENTS.md            # Contexto e instrucciones
└── server.js
```

## 3. Organización de la documentación

arquitectura/: arquitectura y estructura técnica.
datos/: modelo de datos y diagrama ER.
diseño/: guía de estilos y lineamientos de interfaz.
modulos/: documentación específica de cada módulo o funcionalidad.

Ejemplo:
```
docs/
└── modulos/
    └── tarifas/
        ├── requerimientos.md
        ├── reglas-negocio.md
        └── ui.md
```


## 4. Principios
Mantener una estructura simple y fácil de entender.
Separar interfaz, backend y documentación.
Cada carpeta debe tener una responsabilidad clara.
No crear capas o carpetas innecesarias.
La arquitectura podrá evolucionar conforme aumente la complejidad del sistema.
Estado

Definición inicial de arquitectura.


**Este es el que yo usaría.** Es suficientemente formal para documentar la decisión, pero no te hace perder tiempo escribiendo docum