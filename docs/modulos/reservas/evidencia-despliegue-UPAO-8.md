# Evidencia de Despliegue y Ciclo DevOps CI/CD en Blue

## 1. Ciclo Automatizado Implementado

Al integrar cambios en la rama develop, el pipeline de integración y despliegue continuo ejecuta automáticamente las pruebas y publica en el ambiente de pre-producción (Blue) solo si todas las verificaciones pasan:

| Etapa | Disparador | Verificación |
| --- | --- | --- |
| Pruebas automatizadas (CI) | Automático en cada push o Pull Request | Levanta una base de datos PostgreSQL efímera, aplica migraciones, carga datos iniciales y ejecuta las 7 suites de calidad y seguridad. Si una falla, bloquea el despliegue. |
| Despliegue en Blue (Pre-producción) | Automático al aprobar CI en develop | Dispara el despliegue en Render Staging y comprueba disponibilidad HTTP 200 en el servicio en vivo. |
| Despliegue en Green (Producción) | Automático al fusionar develop en main | Job configurado y listo para la promoción final a Producción planificada en el cierre del Sprint 3 (UPAO-98). |

## 2. Enlaces de Respaldo

| Recurso | Enlace |
| --- | --- |
| Definición del pipeline CI/CD | [ci-cd.yml en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/.github/workflows/ci-cd.yml) |
| Ejecuciones automáticas del pipeline | [GitHub Actions](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions) |
| Orquestador de pruebas automatizadas | [run-all-tests.js en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/develop/scripts/run-all-tests.js) |
| Rama integrada (Blue / Staging) | [Rama develop en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/tree/develop) |
| Aplicación en vivo (Blue / Staging) | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| Ambiente productivo (Green / main) | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |

## 3. Verificación Final
- Integración continua: 7 de 7 suites aprobadas automáticamente en GitHub Actions.
- Pruebas visuales E2E: 5 de 5 capturas aprobadas en navegador.
- Servicio Blue en vivo: desplegado y respondiendo HTTP 200 contra PostgreSQL Neon Staging.
- Aislamiento de Producción: la rama main se mantiene intacta hasta la promoción controlada de cierre de sprint.
