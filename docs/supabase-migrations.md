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
