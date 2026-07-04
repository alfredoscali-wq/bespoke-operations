# Limitaciones Conocidas (BASELINE 1.0)

Documento exclusivo de restricciones vigentes al cierre del baseline. No incluye roadmap ni funcionalidades planificadas fuera de este alcance.

---

## 1. GPS Tiempo Real

**Estado:** no implementado.

Bespoke Operations almacena coordenadas GPS puntuales en OT y clientes (resolución de ubicación al crear/editar órdenes), pero **no existe tracking en tiempo real** de operarios ni cuadrillas en movimiento.

Field Agent y Portal Operario capturan ubicación en momentos puntuales (checklist, evidencias); no hay transmisión continua de posición.

---

## 2. Push Notifications

**Estado:** no implementado.

No hay infraestructura de notificaciones push (FCM/APNs) integrada en BASELINE 1.0. Los operarios y supervisores deben consultar la aplicación activamente para ver cambios de agenda, incidencias o solicitudes de cierre.

---

## 3. Planificación transaccional

**Estado:** confirmación no atómica.

La confirmación y replanificación masiva de OT ejecuta **múltiples actualizaciones individuales** desde el cliente. No existe un RPC transaccional único que garantice atomicidad batch.

**Impacto:** en condiciones de error parcial de red o servidor, una confirmación masiva podría dejar un subconjunto de OT actualizadas. Mitigación operativa: reintentar o replanificar manualmente.

**Referencia técnica:** comentario en `20260914000100_critical_risks_sprint_c4_1.sql` — atomicidad diferida a RPC futuro.

---

## 4. Paridad submit Web/Mobile

**Estado:** validaciones distintas intencionalmente.

Al solicitar cierre de OT (`submit-for-approval`), las reglas de validación **no son idénticas** entre superficies:

| Superficie | Validación |
|------------|------------|
| **Field Agent (Mobile API)** | Checklist operativo según plantilla del tipo de OT (`validateOperationalChecklistComplete`) |
| **Portal Operario / Web** | Checklist legacy + pasos operativos con fotos + conteo de evidencias (`validateTaskClosureForSubmit`) |

**Impacto:** una OT podría ser cerrable desde una superficie y bloqueada desde otra según configuración del tipo de OT y evidencias cargadas.

**Resolución prevista:** unificar validación en servicio compartido (fuera de BASELINE 1.0).

---

## Alcance de este documento

Solo las cuatro limitaciones anteriores forman parte del registro oficial de BASELINE 1.0. Cualquier otra mejora o funcionalidad futura debe gestionarse en roadmap posterior, no aquí.
