# Bespoke Operations

## BASELINE 1.0

**Release Candidate:** RC1.3 + RC1.4  
**Fecha:** Julio 2026  
**Commit de referencia:** `beba564`

---

## Resumen

**Bespoke Operations** es la plataforma operativa multi-tenant de Bespoke para coordinar trabajo de campo en telecomunicaciones e infraestructura: clientes, cuadrillas, órdenes de trabajo, planificación, evidencias y reportes.

BASELINE 1.0 consolida la arquitectura operativa definitiva, el workflow de OT, la planificación dinámica con doble carril de orden, el histórico en Archivo OT, el Portal Operario y la Mobile API para Bespoke Field Agent (Android), con aislamiento multi-tenant y auditoría completa.

---

## Principales características

- **Arquitectura Operativa 3.0** — Separación clara entre backoffice, ejecución de campo y capa Mobile API; dominio compartido en `lib/`
- **Workflow definitivo** — Programada → Asignada → En Curso → Pendiente de Cierre → **Finalizada** (estado terminal)
- **Planificación Dinámica** — `execution_order` (planificación) y `dispatch_order` (operativo); confirmación incremental y replanificación con ruta congelada
- **Archivo OT** — Módulo independiente (`/operations/archivo-ot`) de solo lectura para OT finalizadas
- **Portal Operario** — PWA de campo en `/operario` con agenda, checklist, evidencias e incidencias
- **Field Agent Android** — Mobile API v1 (`/api/mobile/v1/`) con login, jornada, agenda, ejecución y cierre
- **Multi-tenant** — Aislamiento por `company_id` en todas las entidades operativas
- **Seguridad RLS** — Políticas Postgres por tenant; guard de solo lectura en plataforma demo
- **Auditoría completa** — Log del sistema con trazabilidad de eventos operativos y comerciales
- **Documentación oficial** — Suite `docs/01`–`docs/12` describiendo producto, workflow, permisos, arquitectura y limitaciones

---

## Estado

Versión estable preparada para **piloto operativo**.

El código compila sin errores (`npm run type-check`, `npm run build`). La documentación oficial refleja el estado implementado. Las limitaciones conocidas están documentadas y no bloquean un piloto controlado.

---

## Limitaciones conocidas

Las siguientes restricciones forman parte del alcance declarado de BASELINE 1.0. No se presentan como bugs sino como diferencias respecto a una versión futura:

| Limitación | Impacto en piloto |
|------------|-------------------|
| **GPS Tiempo Real** | Sin tracking continuo de operarios; GPS puntual en OT |
| **Push Notifications** | Sin alertas push; consulta activa de la aplicación |
| **Planificación transaccional** | Confirmación masiva no atómica; mitigación operativa por reintento |
| **Paridad submit Web/Mobile** | Validaciones de cierre distintas entre Portal Operario y Field Agent |

Detalle completo: [10 - KNOWN_LIMITATIONS.md](./10%20-%20KNOWN_LIMITATIONS.md)

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [01 - PRODUCT_OVERVIEW](./01%20-%20PRODUCT_OVERVIEW.md) | Visión general y módulos |
| [02 - OPERATIONAL_WORKFLOW](./02%20-%20OPERATIONAL_WORKFLOW.md) | Workflow de OT |
| [03 - CLIENT_LIFECYCLE](./03%20-%20CLIENT_LIFECYCLE.md) | Ciclo de vida del cliente |
| [04 - PLANNING](./04%20-%20PLANNING.md) | Planificación operativa |
| [05 - PERMISSIONS](./05%20-%20PERMISSIONS.md) | Perfiles y permisos |
| [06 - FIELD_AGENT](./06%20-%20FIELD_AGENT.md) | Field Agent y Portal Operario |
| [07 - ARCHITECTURE](./07%20-%20ARCHITECTURE.md) | Arquitectura técnica |
| [08 - DATABASE](./08%20-%20DATABASE.md) | Modelo de datos |
| [09 - CHANGELOG_BASELINE](./09%20-%20CHANGELOG_BASELINE.md) | Historial del baseline |
| [10 - KNOWN_LIMITATIONS](./10%20-%20KNOWN_LIMITATIONS.md) | Limitaciones oficiales |
| [12 - GO_NO_GO_BASELINE](./12%20-%20GO_NO_GO_BASELINE.md) | Revisión GO/NO-GO |

---

## Historial de release candidate

| RC | Entregable |
|----|------------|
| C4.3 | Workflow terminal Finalizada |
| RC1.1 | Archivo OT como módulo operativo |
| RC1.2 | Documentación oficial BASELINE 1.0 |
| RC1.3 + RC1.4 | Release Notes y revisión GO/NO-GO |
