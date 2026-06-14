# Configuración de Supabase — Bespoke Operations

Esta guía describe cómo conectar el proyecto Next.js con tu instancia de Supabase **sin modificar la lógica de negocio existente** (mocks y providers siguen activos).

## Requisitos previos

- Proyecto creado en [Supabase Dashboard](https://supabase.com/dashboard)
- **Project URL** (Settings → API → Project URL)
- **Publishable key** (anon / public key) — segura para el cliente y variables `NEXT_PUBLIC_*`
- **Secret key** (service role) — **solo servidor**, no incluir en el frontend

## 1. Crear `.env.local`

En la raíz del repositorio (`bespoke-operations/`), crea un archivo `.env.local` (está ignorado por git):

```bash
cp .env.example .env.local
```

## 2. Completar variables

Edita `.env.local` con los valores de tu proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| Variable | Dónde obtenerla | Uso |
|----------|-----------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API → Project URL | URL base del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Settings → API → **anon** / publishable key | Cliente browser y server con RLS |

### Secret key (fase posterior)

La **service role key** no se usa en esta etapa. Cuando implementes operaciones administrativas o migraciones server-side, añádela **solo** en `.env.local`:

```env
# NUNCA exponer al navegador — no usar prefijo NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

No la agregues a `.env.example` ni la subas al repositorio.

## 3. Reiniciar el servidor de desarrollo

Next.js carga variables de entorno al iniciar:

```bash
npm run dev
```

Tras cambiar `.env.local`, detén y vuelve a ejecutar `npm run dev`.

## 4. Verificar la conexión

Con el servidor en marcha y `.env.local` configurado:

```bash
curl http://localhost:3000/api/health/supabase
```

Respuesta esperada (200):

```json
{
  "ok": true,
  "configured": true,
  "reachable": true,
  "message": "Supabase connection successful.",
  "checkedAt": "2026-06-13T...",
  "details": { "hasSession": false }
}
```

`hasSession: false` es normal: aún no hay autenticación implementada.

Si faltan variables (503):

```json
{
  "ok": false,
  "configured": false,
  "reachable": false,
  "message": "Supabase environment variables are not configured.",
  "error": "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
}
```

## 5. Clientes disponibles

| Archivo | Entorno | Import |
|---------|---------|--------|
| `lib/supabase/client.ts` | Client Components, hooks | `import { createClient } from "@/lib/supabase/client"` |
| `lib/supabase/server.ts` | Server Components, Route Handlers | `import { createClient } from "@/lib/supabase/server"` |

Ambos usan `@supabase/ssr` y son compatibles con **Next.js 16 App Router** (`cookies()` async en server).

## 6. Qué no cambia en esta etapa

- Mocks en `lib/data/*`
- Providers React (`ProjectsProvider`, `TasksProvider`, etc.)
- UI de Dashboard, Obras, Tareas, Cuadrillas, Evidencias, Operario
- Tablas, migraciones, RLS y Storage buckets

## 7. Próximos pasos (fuera de este alcance)

1. Añadir `middleware.ts` para refresh de sesión cuando se implemente auth
2. Crear migraciones SQL iniciales
3. Sustituir mocks módulo por módulo
4. Configurar buckets de Storage para evidencias
