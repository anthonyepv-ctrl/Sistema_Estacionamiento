# Evidencia de Integración en Blue y Pase a Producción (Green) — Sprint 3

## 1. Ciclo DevOps CI/CD Ejecutado

Con el cierre de la última historia del Sprint 3 (UPAO-23), se validó la integración completa en Pre-producción (rama develop / ambiente Blue) y la promoción controlada hacia Producción (rama main / ambiente Green) mediante Pull Request aprobado por el pipeline automatizado:

| Etapa | Rama / Ambiente | Verificación |
| --- | --- | --- |
| Pruebas automatizadas (CI) | develop y main | Ejecución de las 8 suites (Culqi, UPAO-22, UPAO-8, UPAO-23, Sprint 3, Ataque/Bot, RBAC y No Regresión) sobre PostgreSQL 16 efímero en GitHub Actions. |
| Pre-producción (Blue) | develop / Render Staging | Despliegue automático tras aprobar CI y healthcheck HTTP 200 contra PostgreSQL Neon Staging. |
| Producción (Green) | main / Render Producción | Promoción controlada mediante Pull Request develop hacia main con despliegue automático y healthcheck HTTP 200 en producción. |

## 2. Subsanación de Vista Pública para Culqi Producción
Se incorporaron en la vista pública del portal los requisitos comerciales y legales solicitados por Culqi para producción: catálogo con imágenes, precios vigentes desde base de datos y descripciones de servicio, flujo de reserva y pago visible, datos del comercio (Cochera SP, RUC 10607991664, dirección, teléfono y correo) y modales de Términos y Condiciones, Política de Privacidad y Política de Anulaciones y Reembolsos.

## 3. Enlaces de Respaldo

| Recurso | Enlace |
| --- | --- |
| Pipeline CI/CD | [ci-cd.yml en GitHub](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/blob/main/.github/workflows/ci-cd.yml) |
| Ejecuciones automáticas (CI/CD) | [GitHub Actions](https://github.com/anthonyepv-ctrl/Sistema_Estacionamiento/actions) |
| Ambiente Blue (Pre-producción) | [https://sistema-estacionamiento-yk2d.onrender.com](https://sistema-estacionamiento-yk2d.onrender.com) |
| Ambiente Green (Producción) | [https://cochera-sp.onrender.com](https://cochera-sp.onrender.com) |
