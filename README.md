# Sistema de Gestión de Cochera

## Flujo de Trabajo (Git Workflow)
1. Clonar el repositorio:
   `git clone https://github.com/tu-usuario/sistema-gestion-cochera.git`
2. Cambiarse a la rama develop:
   `git checkout develop` y `git pull origin develop`
3. Crear una rama para tu historia/tarea desde develop:
   `git checkout -b feature/HU1-configurar-tarifas`

## Convención de Commits
Los mensajes deben ser claros y descriptivos siguiendo este formato:
- `feat: agregar formulario de configuración de tarifas`
- `fix: corregir cálculo de tarifa por hora`
- `docs: actualizar instrucciones en README`

## Proceso de Pull Requests (PR) y Merges
1. Sube tu rama local a GitHub: `git push origin feature/nombre-rama`
2. Abre un Pull Request dirigido hacia la rama **develop**.
3. Solicita la revisión a al menos 1 compañero de equipo.
4. Una vez aprobado y pasadas las verificaciones, realiza el Merge.