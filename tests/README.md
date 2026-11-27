# Mapa de Pruebas Automatizadas por Sprint e Historia (Proyecto UPAO)

Este directorio contiene todas las suites automatizadas del Sistema de Gestion de Cochera (UPAO), organizadas segun la historia de usuario y el tipo de verificacion.

## Ejecucion general (CI/CD y local)

Para ejecutar el runner completo que integra las 9 suites principales contra la base de datos configurada en `.env`:

```bash
npm test
```

Nota: `npm test` ejecuta `scripts/run-all-tests.js`, levanta un servidor aislado con su propio puerto de pruebas (o reutiliza el configurado segun cada suite) y garantiza que todas las verificaciones pasen antes de integrar a `develop` o `main`.

---

## Clasificacion por Sprint e Historia de Usuario

### Sprint 1 — Operacion base y Tarifas

| Historia | Nombre | Archivo de prueba | Comando NPM | Documentacion de modulo |
| --- | --- | --- | --- | --- |
| UPAO-16 | Configurar tarifas | `tests/test-no-regresion.js` | `npm run test:regresion` | `docs/modulos/tarifas/` |
| UPAO-6 | Registrar ingreso | `tests/e2e-ingreso.js`, `tests/test-concurrencia-aforo.js` | `npm run test:e2e`, `npm run test:concurrencia` | `docs/modulos/ingresos/` |
| UPAO-7 | Registrar salida | `tests/test-integridad-cobro.js`, `tests/test-no-regresion.js` | `npm run test:integridad`, `npm run test:regresion` | `docs/modulos/salidas/` |
| UPAO-11 | Ver estado de espacios | `tests/test-no-regresion.js` | `npm run test:regresion` | `docs/modulos/espacios-publicos/` |
| UPAO-17 | Consultar ingresos recaudados | `tests/test-no-regresion.js`, `tests/test-auditoria-batalla.js` | `npm run test:regresion`, `npm run test:auditoria` | `docs/modulos/reportes/` |

### Sprint 2 — Notas, Graficos, Ocupacion y Disponibilidad

| Historia | Nombre | Archivo de prueba | Comando NPM | Documentacion de modulo |
| --- | --- | --- | --- | --- |
| UPAO-9 | Adjuntar notas | `tests/e2e-ingreso.js`, `tests/test-no-regresion.js` | `npm run test:e2e`, `npm run test:regresion` | `docs/modulos/ingresos/` |
| UPAO-18 | Graficos de ingresos | `tests/e2e-graficos-estadisticos.js`, `tests/test-graficos-mes.js` | `npm run test:graficos`, `node tests/test-graficos-mes.js` | `docs/modulos/estadisticas/` |
| UPAO-19 | Consultar nivel de ocupacion | `tests/test-no-regresion.js`, `tests/test-auditoria-batalla.js` | `npm run test:regresion`, `npm run test:auditoria` | `docs/modulos/ocupacion/` |
| UPAO-20 | Ver espacios disponibles | `tests/e2e-disponibilidad.js` | `npm run test:disponibilidad` | `docs/modulos/espacios-publicos/` |

### Sprint 3 — Reservas Web, Pagos Culqi y Auditoria Legal/Seguridad

| Historia | Nombre | Archivo de prueba | Comando NPM | Documentacion de modulo |
| --- | --- | --- | --- | --- |
| UPAO-21 | Realizar reserva y pago Culqi | `tests/test-pasarela-culqi-unit.js`, `tests/test-reservas-sprint3.js` | `npm run test:culqi`, `npm run test:reservas` | `docs/modulos/reservas/` |
| UPAO-22 | Anular reserva y reembolso Culqi | `tests/test-upao22-anulacion.js`, `tests/test-anulacion-reservas-e2e.js` | `npm run test:upao22` | `docs/modulos/reservas/` |
| UPAO-8 | Buscar reservas y garita | `tests/test-upao8-garita.js`, `tests/test-upao8-garita-e2e.js` | `npm run test:upao8` | `docs/modulos/reservas/` |
| UPAO-23 | Consultar historial de estados | `tests/test-upao23-historial.js`, `tests/test-upao23-historial-e2e.js` | `npm run test:upao23` | `docs/modulos/reservas/` |

### Seguridad, Resiliencia y Auditoria Transversal (Batalla de Errores)

| Cobertura | Archivo de prueba | Comando NPM | Documentacion |
| --- | --- | --- | --- |
| Control de acceso (RBAC) y tokens | `tests/test-seguridad-api.js` | `npm run test:seguridad` | `docs/arquitectura/Arquitectura.md` |
| Ataques automatizados (fuerza bruta 429, JSON bomb 413, SQLi, XSS, IDOR) | `tests/test-ataque-bot.js` | `npm run test:ataque` | `docs/modulos/reservas/auditoria-batalla-errores.md` |
| Auditoria adversarial (INT4, timezone Lima, POS, usuarios, Libro de Reclamaciones, CSP) | `tests/test-auditoria-batalla.js` | `npm run test:auditoria` | `docs/modulos/reservas/auditoria-batalla-errores.md` |
| Estres y concurrencia extrema | `tests/stress-judge-test.js` | `node tests/stress-judge-test.js` | `docs/modulos/reservas/` |
