# Plan de Pruebas y Depuración — Anulación de Reserva (`UPAO-22` / Subtarea `UPAO-89`)

> **Historia de Usuario:** `UPAO-22` — Anular reserva (3 Story Points · Sprint 3)  
> **Subtarea Jira:** `UPAO-89` — Probar y depurar anulación de reserva, liberación de espacios y permisos  
> **Matriz complementaria:** [`docs/modulos/reservas/Casos_de_Prueba_Sprint3.xlsx`](Casos_de_Prueba_Sprint3.xlsx)

---

## 1. Evaluación de Casos de Prueba Diseñados en Análisis (`UPAO-22`)

| ID | Caso de Prueba | Resultado Obtenido | Estado |
| --- | --- | --- | --- |
| **CP-22-01** | 1- Válido: Anulación de reserva vigente con reembolso automático Culqi | Verificado en `U22-01` (`DELETE /api/reservas/:id`) y `SP3-06` (`POST /api/reservas/:id/anular`): ejecuta `POST /v2/refunds` con `reason: 'solicitud_comprador'` e `Idempotency-Key`, guarda `pasarelaReembolsoId`, cambia a `ANULADA` (`REEMBOLSADO`) y libera `+1` espacio inmediato en `/api/publico/disponibilidad`. | Aprobado |
| **CP-22-02** | 2- Inválido: Anular reserva de otro conductor | Verificado en `U22-02` y `SP3-16`: otro `CONDUCTOR` (y roles `RECEPCIONISTA`/`DUENO`) reciben HTTP `403 Forbidden`; ID no numérico recibe `400` e ID inexistente `404`. | Aprobado |
| **CP-22-03** | 3- Inválido: Anular reserva ya utilizada o ya anulada | Verificado en `U22-03`, `U22-04`, `U22-05` y `SP3-17`: re-anulación, doble clic simultáneo y carrera contra ingreso en garita rechazan con `409 Conflict` garantizando exclusión mutua y cero doble reembolso. | Aprobado |
| **CP-22-04** | 4- Inválido: Anular reserva con tolerancia (30 min) vencida | Verificado en `U22-03` y `SP3-17`: al vencer `fechaLimite`, persiste `VENCIDA` bajo lock y rechaza con `409 Conflict` y `0` llamadas a `/v2/refunds`. | Aprobado |

---

## 2. Verificaciones Adicionales de Integridad y Concurrencia (`tests/test-upao22-anulacion.js`)

| Prueba | Escenario Verificado | Resultado |
| --- | --- | --- |
| **U22-01** | `DELETE /api/reservas/:id` + reembolso Culqi + recálculo inmediato `+1` en disponibilidad pública | Aprobado |
| **U22-02** | Límites de entrada y autorización (`400` ID no numérico, `404` inexistente, `403` rol no conductor y reserva ajena) | Aprobado |
| **U22-03** | Re-anulación (`409`) y reserva expirada (`VENCIDA` persistida sin reembolso) | Aprobado |
| **U22-04** | Carrera simultánea `DELETE /api/reservas/:id` (mock Culqi 300 ms) vs `POST /api/reservas/:id/confirmar` (Garita) → exclusión mutua estricta | Aprobado |
| **U22-05** | Doble clic concurrente en `DELETE /api/reservas/:id` → `200` + `409` y exactamente `1` reembolso | Aprobado |
| **U22-06** | Fallo en Culqi `/v2/refunds` (`400` / `500`) → HTTP `502`, reserva intacta en `VIGENTE` / `PAGADO` | Aprobado |
| **U22-07** | Reserva sin `pasarelaPagoId` (`null`) → `ANULADA` conservando `estadoPago` original sin `REEMBOLSADO` falso y `0` llamadas a Culqi | Aprobado |

---

## 3. Comandos de Ejecución

```bash
node tests/test-upao22-anulacion.js
node tests/test-pasarela-culqi-unit.js
CULQI_MOCK=1 node tests/test-reservas-sprint3.js
npm run test:regresion
```

---

## 4. Defect Log (`UPAO-22`)

| ID Defecto | Descripción | Causa Raíz | Solución Aplicada | Estado |
| --- | --- | --- | --- | --- |
| **DEF-22-01** | Riesgo de carrera financiera entre anulación y confirmación en garita | `reembolsarCargo()` se ejecutaba antes de entrar a `prisma.$transaction` y el timeout de transacción (`20s`) coincidía con el de Culqi (`20s`). | Se implementó lock por reserva `pg_advisory_xact_lock(780000::int, id::int)` en anulación y confirmación (orden acíclico sin bloquear ingresos walk-in), `timeout: 30000` y persistencia segura de `VENCIDA`. | Cerrado |
| **DEF-22-02** | Disponibilidad pública no se refrescaba tras anular desde la web | `public/js/reservas.js` invocaba `window.disponibilidadModulo.consultar()`, método inexistente (`disponibilidad.js` exporta `recargar`). | Se corrigió a `window.disponibilidadModulo.recargar()` tras cada anulación exitosa o recuperada. | Cerrado |
| **DEF-22-03** | `estadoPago: 'REEMBOLSADO'` falso en reservas sin cargo y `402` en fallos de refund | `anularReservaHandler` escribía `REEMBOLSADO` aunque `pasarelaPagoId` fuera `null`; `culqi.js` no validaba `data.id` ni mapeaba rechazos de `/v2/refunds` a `502`. | Se condicionó `estadoPago` y el mensaje al reembolso real; `reembolsar()` ahora valida `amount > 0`, `data.id` y devuelve `502` ante fallos de pasarela. | Cerrado |
| **DEF-22-04** | Modal `#modal-anular` sin recuperación ante corte de red y botón Cancelar activo en vuelo | `DELETE /api/reservas/:id` no re-consultaba `/api/reservas/mias` ante timeout de proxy ni bloqueaba el cierre durante la operación. | Se congeló la reserva objetivo, se deshabilitaron botones de cierre en vuelo y se agregó recuperación automática contra `/api/reservas/mias`. | Cerrado |
| **DEF-22-05** | Vista doble simultánea, botón desalineado y variables CSS indefinidas en *Mis Reservas* | `#contenedor-tarjetas-reservas` y la tabla se mostraban juntos; `style.css` y `reservas.js` usaban `--text-main`/`--text-muted` no definidos en `:root`. | Se aplicó vista adaptativa única (tabla 1 línea en escritorio `>=768px`, tarjetas en móvil `<768px`) y se corrigieron tokens a `--text`/`--text2`. | Cerrado |

---

## 5. Trazabilidad en GitHub (`develop`)
- **Backend y adaptador Culqi (`UPAO-88`):** `src/routes/reservas.js` · `src/payments/culqi.js`
- **Interfaz Mis Reservas y Modal (`UPAO-87`):** `public/index.html` · `public/js/reservas.js` · `public/css/style.css`
- **Suites de pruebas (`UPAO-89`):** `tests/test-upao22-anulacion.js` · `tests/test-pasarela-culqi-unit.js` · `tests/test-reservas-sprint3.js` · `tests/test-no-regresion.js`
