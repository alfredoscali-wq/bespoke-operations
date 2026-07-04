# Changelog — BASELINE 1.0

Resumen consolidado del trabajo realizado hasta el estado definitivo del producto.

---

## Consolidación de plataforma

### Infraestructura y calidad (C3.5)

- Baseline de calidad: `type-check`, `build`, estructura de proyecto consolidada
- Refactor de helpers en `lib/` y eliminación de código legacy
- Consolidación de provider stacks por módulo (`components/providers/`)

### Multi-tenant (C1)

- Tabla `companies` y columna `company_id` en entidades operativas
- RLS por tenant en tablas core (`20260913000100_multi_tenant_rls_sprint_c1.sql`)
- Función `auth_user_company_id()` para scoping automático
- Plataforma demo con guard de solo lectura

---

## Auditoría y riesgos (C4.1)

- RLS reforzado en `crew_members`, `project_history`, `employee_availability`, `task_photos`
- Políticas de storage alineadas con tenant
- Trigger `enforce_task_status_workflow` en base de datos
- Paridad mobile/web en visibilidad de agenda e incidencias
- Correcciones de riesgos críticos identificados en revisión operativa

---

## QA operativo (C4.2)

- Auditoría integral de 8 escenarios operativos
- Validación de flujos: planificación, ejecución, cierre, clientes, permisos
- Resultado: **GO CONDICIONAL** para piloto ABNet
- Issues documentados en limitaciones conocidas (no bloqueantes para baseline)

---

## Workflow definitivo (C4.3)

- **Finalizada** es el único estado terminal de OT completada
- Eliminado estado `cerrada` del workflow operativo (backfill a `finalizada`)
- Eliminada acción `close` y transición `finalizada → cerrada`
- Trigger DB actualizado: `is_allowed_task_status_transition`
- Helpers: `isTaskArchivedStatus`, `normalizeTaskStatusFromDatabase`
- Migración: `20260915000100_baseline_workflow_finalizada_terminal.sql`

---

## Archivo OT (RC1.1)

- Módulo independiente en menú Operaciones
- Ruta `/operations/archivo-ot` (listado) y `/operations/archivo-ot/[id]` (detalle)
- Solo OT con `status = finalizada`
- Solo lectura: sin editar, eliminar, replanificar ni cambiar estado
- Órdenes de Trabajo (`/tareas`) muestra únicamente OT activas:
  - programada, asignada, en-curso, pendiente-cierre
- Reutilización de providers, listado, filtros y detalle existentes
- Redirección desde legacy `?category=finalizadas` en `/tareas`

---

## Funcionalidades incluidas en BASELINE 1.0

| Área | Entregable |
|------|------------|
| Clientes | Directorio operativo, migración comercial, estados comerciales |
| OT | Tipos de servicio, checklist operativo, workflow completo |
| Planificación | execution_order + dispatch_order, planificación dinámica |
| Campo | Portal Operario + Mobile API v1 (Field Agent) |
| Evidencias | Registro fotográfico con storage privado |
| RRHH | Empleados, cuadrillas, disponibilidad, novedades |
| Reportes | Operativos y automáticos semanales |
| Roles | Roles de empresa con visibilidad por módulo |
| Auditoría | Log del sistema con trazabilidad de eventos |

---

## Commits de referencia

| Commit | Descripción |
|--------|-------------|
| `7c6e255` | C4.1 — fix critical operational risks |
| `d802df3` | C4.3 — finalize Baseline 1.0 operational workflow |
| `e1b68e1` | RC1.1 — Archivo OT as standalone operations module |

---

## Documentación (RC1.2)

Generación de documentación oficial BASELINE 1.0 en `docs/` (este conjunto de archivos).
