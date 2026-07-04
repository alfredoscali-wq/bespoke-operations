# Base de Datos (BASELINE 1.0)

## Motor y convenciones

- **Postgres** gestionado por Supabase
- Identificadores UUID para entidades principales
- Timestamps `created_at`, `updated_at` en tablas operativas
- Enums SQL para estados tipados (`task_status`, etc.)
- Multi-tenant via columna `company_id` en tablas operativas

---

## Principales tablas

### Organización

| Tabla | Propósito |
|-------|-----------|
| `companies` | Empresas tenant |
| `company_roles` | Roles personalizados por empresa |
| `employees` | Empleados RRHH vinculados a Auth |
| `employee_availability` | Ausencias, licencias, novedades |

### Operaciones

| Tabla | Propósito |
|-------|-----------|
| `customers` | Clientes / abonados |
| `projects` | Obras |
| `tasks` | Órdenes de trabajo |
| `task_photos` | Fotos de checklist y referencia |
| `task_incidents` | Incidencias reportadas |
| `evidences` | Evidencias documentales |
| `crews` | Cuadrillas |
| `crew_members` | Integrantes de cuadrilla |

### Configuración

| Tabla | Propósito |
|-------|-----------|
| `work_order_types` | Tipos de OT y checklist operativo |
| `incident_types` | Tipos de incidencia configurables |
| `materials` | Inventario de materiales |

### Mobile / Campo

| Tabla | Propósito |
|-------|-----------|
| `mobile_devices` | Dispositivos corporativos autorizados |
| `work_team_shifts` | Jornadas / turnos de cuadrilla |

### Auditoría y reportes

| Tabla | Propósito |
|-------|-----------|
| `audit_events` | Log del sistema |
| `automatic_report_runs` | Ejecuciones de reportes automáticos |
| `project_history` | Historial de obras |

---

## Relaciones clave

```
companies
  ├── employees
  ├── customers
  ├── projects
  ├── tasks ────── customers (customer_id)
  │     ├── task_photos
  │     └── task_incidents
  ├── crews
  │     └── crew_members ── employees
  ├── evidences ── tasks, projects
  └── work_order_types
```

### tasks (campos destacados)

| Campo | Uso |
|-------|-----|
| `status` | Estado del workflow |
| `service_type` | Tipo comercial de OT |
| `crew_id` | Cuadrilla asignada |
| `execution_order` | Orden en carril de planificación |
| `dispatch_order` | Orden en carril operativo |
| `due_date` | Fecha programada |
| `completed_at` | Timestamp de finalización |
| `company_id` | Tenant |

---

## Soft delete

Patrón estándar: columna `deleted_at` (timestamp nullable).

| Comportamiento | Detalle |
|----------------|---------|
| Lectura | RLS excluye filas con `deleted_at IS NOT NULL` |
| Borrado lógico | UPDATE set `deleted_at = now()` |
| Borrado definitivo | Solo administrador de sistema; elimina registro y dependencias |

Aplica a: `tasks`, `projects`, `customers`, `employees`, `crews`, `evidences`, entre otras.

---

## RLS (Row Level Security)

BASELINE 1.0 implementa aislamiento multi-tenant en tablas operativas core (Sprint C1):

- **SELECT:** `company_id = auth_user_company_id()` AND `deleted_at IS NULL`
- **INSERT/UPDATE:** mismo `company_id` + guard demo read-only
- Funciones helper: `auth_user_company_id()`, `auth_is_demo_platform_read_only()`

Tablas con RLS reforzado en C4.1:

- `crew_members`
- `project_history`
- `employee_availability`
- `task_photos` (+ storage policies)

El trigger `enforce_task_status_workflow` valida transiciones de estado a nivel de base de datos.

---

## Migraciones

Las migraciones viven en `supabase/migrations/` con prefijo timestamp:

```
20260613000000_create_projects.sql
20260614000000_create_tasks.sql
…
20260915000100_baseline_workflow_finalizada_terminal.sql
```

### Aplicación

```bash
supabase link --project-ref <project-ref>
supabase db push
```

O manualmente via SQL Editor del Dashboard.

### Hitos de migración (BASELINE 1.0)

| Sprint | Migración destacada |
|--------|---------------------|
| Multi-tenant | `20260616000000_create_companies.sql` |
| Clientes | `20260732000100_create_customers.sql` |
| Workflow cierre | `20260738000100_task_closure_workflow_sprint_2_3.sql` |
| execution_order | `20260903000100_task_execution_order.sql` |
| dispatch_order | `20260904000100_task_dispatch_order.sql` |
| Multi-tenant RLS | `20260913000100_multi_tenant_rls_sprint_c1.sql` |
| Riesgos críticos | `20260914000100_critical_risks_sprint_c4_1.sql` |
| Finalizada terminal | `20260915000100_baseline_workflow_finalizada_terminal.sql` |

Documentación operativa de setup: [supabase-setup.md](./supabase-setup.md), [supabase-migrations.md](./supabase-migrations.md)

---

## Storage

| Bucket | Contenido |
|--------|-----------|
| `evidences` | Archivos de evidencias |
| Fotos OT | Paths en `task_photos.storage_path` |

Políticas de storage alineadas con RLS de tenant.
