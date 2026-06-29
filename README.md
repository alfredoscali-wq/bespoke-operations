# Bespoke Operations

Multi-tenant operational platform for Bespoke: customers, HR, work orders, crews, planning, evidence, and reports.

Part of the **Bespoke ecosystem** together with **Bespoke Field Agent** (Android) and platform services (Supabase).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind, shadcn/ui |
| Database / Auth | Supabase |
| Maps (planning) | Leaflet |

---

## Getting started

```bash
npm install
cp .env.example .env.local   # configure Supabase keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Quality checks

```bash
npm run type-check
npm run build
```

---

## Project structure

```
app/
  (dashboard)/          Backoffice modules
  operario/             Operario PWA
  api/
    mobile/v1/          Mobile API (Field Agent)
    auth/               Backoffice auth helpers
    …
lib/
  mobile/v1/            Mobile API services
  auth/                 Shared authentication
  supabase/             Data access
  tasks/                Work order domain
  planificacion/        Operational planning
docs/
  mobile-api.md         Mobile API contracts
```

---

## Mobile API

Dedicated, versioned HTTP API for **Bespoke Field Agent** only.

- Base path: `/api/mobile/v1/`
- Does not replace Backoffice or Operario routes
- First endpoint: `POST /api/mobile/v1/auth/login`

Full contract and error codes: [docs/mobile-api.md](./docs/mobile-api.md)

Architecture overview: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, Mobile API layer |
| [ROADMAP.md](./ROADMAP.md) | Delivery phases |
| [docs/mobile-api.md](./docs/mobile-api.md) | Mobile API contracts |
| [docs/supabase-setup.md](./docs/supabase-setup.md) | Supabase configuration |
| [docs/supabase-migrations.md](./docs/supabase-migrations.md) | Database migrations |

---

## Ecosystem

```
Bespoke Operations (this repo)
  ├── Backoffice Web
  ├── Operario PWA
  └── Mobile API ──► Bespoke Field Agent (Android)
```

Operations owns business logic. Field Agent executes published work on device.
