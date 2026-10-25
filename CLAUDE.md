# CLAUDE.md

> Este proyecto centraliza su contexto en **AGENTS.md**. Léelo completo antes de cualquier tarea.

@AGENTS.md

Si el import anterior no funciona, abre y lee `AGENTS.md` directamente.

Reglas críticas que debes cumplir (detalle en `AGENTS.md`):

- **§8 Scrum / alcance:** solo se trabaja en lo planificado del sprint en curso; prohibido adelantar Historias futuras o revivir Historias cerradas.
- **§10 Skills / flujo:** usar `graphify`, Spec Kit y las skills de la fase (Prisma, UI/UX, TDD, code-review, etc.).
- **§11 Documentación:** todo cambio importante se documenta en la misma rama; sin documentación, la tarea no está terminada.
- **§7 Ambientes Blue / Green:** el desarrollo e integración continua se hace siempre sobre **Blue (Staging / `develop`)**; nunca fusionar a **Green (`main`)** antes de validar la historia completa.
- **Pruebas y Defect Log:** documentar cada módulo en `plan-pruebas.md` con defect log y video de evidencia con links a GitHub.
- **No** hacer `commit`, `push` ni PR sin autorización explícita del usuario.
