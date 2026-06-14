# Supabase — Migraciones

## Fase 2: tabla `projects`

Archivo: `supabase/migrations/20260613000000_create_projects.sql`

### Aplicar en Supabase Dashboard

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Copia el contenido del archivo de migración
4. Ejecuta el script
5. Verifica en **Table Editor** que existe la tabla `projects`

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
