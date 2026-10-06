# Instala globalmente las skills estandar del equipo (ver AGENTS.md seccion 10).
# Uso: npm run setup:skills   (o)   powershell -ExecutionPolicy Bypass -File .\scripts\setup-skills.ps1

$skills = @(
    'dceoy/speckit-agent-skills@speckit-constitution',
    'dceoy/speckit-agent-skills@speckit-specify',
    'dceoy/speckit-agent-skills@speckit-plan',
    'dceoy/speckit-agent-skills@speckit-tasks',
    'dceoy/speckit-agent-skills@speckit-implement',
    'prisma/skills@prisma-database-setup',
    'prisma/skills@prisma-client-api',
    'prisma/skills@prisma-cli',
    'nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max',
    'anthropics/skills@frontend-design',
    'mattpocock/skills@code-review',
    'mattpocock/skills@tdd',
    'mattpocock/skills@diagnosing-bugs',
    'mattpocock/skills@domain-modeling',
    'mattpocock/skills@grill-with-docs',
    'usestrix/strix@api-security-testing'
)

$failed = @()
foreach ($skill in $skills) {
    Write-Host "-> Instalando $skill ..." -ForegroundColor Cyan
    npx --yes skills add $skill -g -y
    if ($LASTEXITCODE -ne 0) { $failed += $skill }
}

Write-Host ""
if ($failed.Count -eq 0) {
    Write-Host "OK: skills instaladas globalmente (~\.agents\skills)." -ForegroundColor Green
} else {
    Write-Host "Atencion: fallaron estas skills: $($failed -join ', ')" -ForegroundColor Yellow
    Write-Host "Reintenta cada una manualmente." -ForegroundColor Yellow
}

# Nota: graphify (mapa del codebase) se instala aparte en OpenCode; ver AGENTS.md seccion 10.
