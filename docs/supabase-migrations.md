# Supabase — Migraciones

## Fase 2: tabla `projects`

Archivo: `supabase/migrations/20260613000000_create_projects.sql`

## Fase 2B: tabla `tasks`

Archivo: `supabase/migrations/20260614000000_create_tasks.sql`

Ejecuta esta migración **después** de `projects` (FK opcional `project_id`).

## Fase 2C: tabla `evidences` + bucket Storage

Archivo: `supabase/migrations/20260615000000_create_evidences.sql`

Ejecuta esta migración **después** de `projects` y `tasks` (FKs opcionales `project_id`, `task_id`).

Incluye:

- Tabla `evidences` con metadatos, comentarios e historial en JSONB
- Bucket privado `evidences` (50 MB por archivo)
- Políticas RLS de desarrollo para tabla y Storage

## Fase 2D: upload y previews reales

La app resuelve `previewUrl` con esta prioridad:

1. Signed URL desde `storage_path` (bucket privado `evidences`)
2. Columna `preview_url`
3. Placeholder Unsplash por tipo de archivo

Upload desde `/evidencias` → **Subir evidencia** (insert + Storage + `storage_path`).

Verificar en Dashboard → **Storage** → bucket `evidences` y en **Table Editor** → columna `storage_path`.

## Fase 3: multiempresa (`companies`)

Archivo: `supabase/migrations/20260616000000_create_companies.sql`

Ejecuta **después** de `projects`, `tasks` y `evidences`.

Incluye:

- Tabla `companies` con empresa seed **Bespoke Demo**
- Columna `company_id` en `projects`, `tasks`, `evidences`
- Backfill de registros existentes a Bespoke Demo
- `DEFAULT` en DB para inserts sin `company_id` (compatibilidad con app actual)
- Unicidad de `code` por empresa (`company_id`, `code`)

Constante en código: `lib/supabase/company.constants.ts` → `BESPOKE_DEMO_COMPANY_ID`

### Aplicar en Supabase Dashboard

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Copia el contenido del archivo de migración
4. Ejecuta el script
5. Verifica en **Table Editor** que existen `companies` y `company_id` en las tablas operativas

### Aplicar con Supabase CLI (opcional)

```bash
supabase link --project-ref uzupiqviwraxnnsymbdl
supabase db push
```

## Verificar desde la app

Tras aplicar la migración, puedes probar el repositorio desde un Route Handler temporal o consola server-side:

```typescript
import { listProjects } from "@/lib/supabase/projects.repository"

const result = await listProjects()
console.log(result)
```

## Políticas RLS

La migración incluye políticas permisivas para desarrollo (sin auth). Sustituir cuando se implementen roles en una fase posterior.

---

## Historial de migraciones aplicadas en Supabase remoto

Registro de migraciones del repositorio **confirmadas aplicadas** en el proyecto Supabase de desarrollo/producción (SQL Editor o `supabase db push`). Actualizar esta tabla al aplicar nuevas migraciones.

**Última actualización del historial:** 2026-08-28  
**Última migración aplicada en remoto:** `20261149000106_materials_1_0_7_catalog_inventory.sql`

### Materiales 1.0 — Inventario y catálogo (2026-08-28)

Todas las migraciones del módulo Materiales (sprints 1.0 → 1.0.7) están **aplicadas en Supabase remoto**.

| Archivo | Sprint | Contenido | Remoto |
|---------|--------|-----------|--------|
| `20261149000100_materials_1_0_inventory.sql` | 1.0 | Tablas (`warehouses`, `materials`, `material_stock_levels`, `material_movements`), enums, RLS, RPCs base | ✅ Aplicada |
| `20261149000101_materials_1_0_1_hotfix.sql` | 1.0.1 | Hotfix `create_material` + depósito inicial (histórico; 1.0.7 revierte el stock level al crear) | ✅ Aplicada |
| `20261149000102_materials_1_0_2_inventory_backfill.sql` | 1.0.2 | Backfill stock levels para materiales activos sin fila de inventario | ✅ Aplicada |
| `20261149000103_materials_1_0_4_catalog_photo.sql` | 1.0.4 | Foto de catálogo + módulo `attachments` para materiales | ✅ Aplicada |
| `20261149000104_materials_1_0_5_catalog_delete.sql` | 1.0.5 | `delete_material` — eliminación lógica del catálogo | ✅ Aplicada |
| `20261149000105_materials_1_0_6_reusable_codes.sql` | 1.0.6 | Códigos reutilizables (`materials_company_active_code_unique`), foto en alta, mensajes duplicado | ✅ Aplicada |
| `20261149000106_materials_1_0_7_catalog_inventory.sql` | 1.0.7 | Separación catálogo ≠ inventario; `create_material` sin stock level; limpieza huérfanos | ✅ Aplicada |

**Nota:** Sprint 1.0.3 (corrección de stock + UX) no generó migración SQL; los cambios son solo de aplicación.

**Estado funcional tras 1.0.7:** crear material solo registra catálogo; inventario aparece al registrar entrada de stock. KPI y UI: **Materiales en catálogo** / **Catálogo** / **Inventario**.

### Verificar en remoto

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%materials_1_0%'
ORDER BY version;
```

Deben listarse las siete entradas anteriores.
