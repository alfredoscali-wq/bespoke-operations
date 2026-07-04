# Arquitectura (BASELINE 1.0)

## Visión general

Bespoke Operations es una aplicación **Next.js 16** (App Router) con **TypeScript**, **React 19**, **Tailwind CSS** y **shadcn/ui**. Persistencia y autenticación en **Supabase** (Postgres + Auth + Storage).

```
Presentación (app/)
    ↓
Dominio (lib/)
    ↓
Datos (lib/supabase/)
    ↓
Supabase (Postgres + Auth + Storage)
```

---

## Next.js

### Estructura de rutas

```
app/
  (auth)/           Login, cambio de contraseña
  (dashboard)/      Backoffice autenticado
  operario/         Portal Operario (PWA)
  api/              Route handlers
    mobile/v1/      Mobile API (Field Agent)
    auth/           Helpers de autenticación backoffice
    …
```

### Patrones

- **Server Components** para páginas estáticas y metadata
- **Client Components** (`"use client"`) para interactividad, providers y formularios
- **Middleware** para protección de rutas y redirección por rol
- **Suspense** en módulos con search params

---

## Supabase

- **Auth:** email/DNI + contraseña; sesiones SSR con cookies en backoffice y operario
- **Database:** Postgres con enums tipados (`task_status`, etc.)
- **Storage:** buckets privados para evidencias, fotos de OT y reportes
- **RLS:** aislamiento multi-tenant por `company_id`

---

## Multi-tenant

Cada registro operativo pertenece a una **empresa** (`companies.id` → `company_id` en tablas hijas).

- Función SQL `auth_user_company_id()` resuelve la empresa del usuario autenticado
- Políticas RLS filtran lectura/escritura por `company_id`
- Plataforma demo tiene guard adicional de solo lectura

---

## Providers

Los módulos del backoffice encapsulan estado en **React Context providers** compuestos por módulo:

| Provider stack | Módulo |
|----------------|--------|
| `TasksModuleProviders` | OT, Archivo OT |
| `PlanificacionModuleProviders` | Planificación |
| `CalendarModuleProviders` | Calendario |
| `ObrasModuleProviders` | Obras |
| `EvidenciasModuleProviders` | Evidencias |
| `DashboardHomeProviders` | Dashboard |

Patrón típico:

```
ProjectsProvider
  → CustomersProvider
    → EmployeesProvider
      → TasksProvider
        → CrewsProvider
          → {children}
```

Cada provider carga datos de Supabase, expone CRUD y sincroniza estado local tras mutaciones.

---

## Organización del proyecto

```
lib/
  auth/              Autenticación y rutas protegidas
  tasks/             Dominio de OT (workflow, work-order, archivado)
  planificacion/     Planificación, execution/dispatch order
  customers/         Clientes, migración comercial, filtros
  mobile/v1/         Mobile API — servicios, middleware, contratos
  supabase/          Queries, mappers, repositorios
  roles/             Módulos de app y visibilidad por rol
  navigation/        Items de menú y construcción de sidebar
  operations/        Perfiles operativos
  audit/             Auditoría y trazabilidad

components/
  tareas/            UI de OT (listado, detalle, workflow)
  planificacion/     UI de planificación
  operario/          Portal Operario
  clientes/          Módulo clientes
  layout/            Shell, sidebar, header
  providers/         Stacks de providers por módulo

supabase/
  migrations/        Migraciones SQL versionadas
```

---

## Capas de API

| Capa | Consumidor | Auth |
|------|------------|------|
| Server Components + providers | Backoffice | Cookie |
| `/operario` + TasksProvider | Portal Operario | Cookie |
| `/api/mobile/v1/*` | Field Agent | Bearer |

La lógica de negocio compartida vive en `lib/`. Los route handlers de Mobile API son adaptadores delgados.

---

## Documentos relacionados

- [ARCHITECTURE.md](../ARCHITECTURE.md) — detalle Mobile API layer
- [08 - DATABASE.md](./08%20-%20DATABASE.md) — modelo de datos
- [mobile-api.md](./mobile-api.md) — contratos HTTP Field Agent
