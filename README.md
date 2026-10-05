# Sistema de Gestión de Cochera

## Puesta en marcha (onboarding)

1. Clonar el repositorio e instalar dependencias: `npm install`.
2. Instalar las skills estándar del equipo: `npm run setup:skills` (ver `AGENTS.md` §10).
3. Leer **`AGENTS.md`** (obligatorio) y la documentación de `docs/` antes de desarrollar.

> Los agentes de IA también deben seguir `AGENTS.md` (archivos puente: `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/`).

## Flujo de Trabajo (Git Workflow)
1. Clonar el repositorio:
   `git clone https://github.com/tu-usuario/sistema-gestion-cochera.git`
2. Cambiarse a la rama develop:
   `git checkout develop` y `git pull origin develop`
3. Crear una rama para tu historia/tarea desde develop:
   `git checkout -b feature/UPAO-16-configurar-tarifas`

## Convención de Commits
Los mensajes deben ser claros y descriptivos siguiendo este formato:
- `feat: agregar formulario de configuración de tarifas`
- `fix: corregir cálculo de tarifa por hora`
- `docs: actualizar instrucciones en README`
- Incluir la clave del ticket cuando aplique: `feat: ... (UPAO-16)`

## Proceso de Pull Requests (PR) y Merges
1. Sube tu rama local a GitHub: `git push origin feature/nombre-rama`
2. Abre un Pull Request dirigido hacia la rama **develop** (usa la plantilla `.github/pull_request_template.md`; incluye el checklist de `AGENTS.md`: alcance, skills, documentación y pruebas).
3. Solicita la revisión a al menos 1 compañero de equipo.
4. Una vez aprobado y pasadas las verificaciones, realiza el Merge.
