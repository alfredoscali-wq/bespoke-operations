# Architecture — Bespoke Operations

Bespoke Operations is the operational brain of the Bespoke ecosystem: customers, employees, work orders, crews, planning, evidence, and reporting.

Field execution happens in **Bespoke Field Agent** (Android). The Operario PWA serves browser-based field workflows. This application owns business logic; mobile and PWA clients consume published APIs.

---

## Client surfaces

| Surface | Users | Auth | API style |
|---------|-------|------|-----------|
| Backoffice Web | Admin, Supervisor, Ventas, RRHH | Cookie session (Supabase SSR) | Server Components + internal data layer |
| Operario PWA | Operarios | Cookie session | Same app, `/operario` routes |
| Field Agent (Android) | Operarios | Bearer tokens | **Mobile API** `/api/mobile/v1/` |

The Mobile API does **not** replace existing routes. It is an isolated layer optimized for native clients.

---

## Application layers (Next.js)

```
┌─────────────────────────────────────────────────────────┐
│  Presentation — app/(dashboard), app/operario, Compose│
├─────────────────────────────────────────────────────────┤
│  API routes — app/api/*                                 │
│    ├── Existing backoffice/cron/audit routes            │
│    └── Mobile API — app/api/mobile/v1/*                 │
├─────────────────────────────────────────────────────────┤
│  Domain & services — lib/*                              │
│    auth, tasks, employees, planificacion, mobile, …     │
├─────────────────────────────────────────────────────────┤
│  Data — lib/supabase/* (queries, mappers, repositories) │
├─────────────────────────────────────────────────────────┤
│  Supabase — Postgres + Auth + Storage                   │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile API

**Purpose:** Expose stable, versioned endpoints for Bespoke Field Agent without coupling the Android app to Backoffice internals or cookie-based auth.

**Responsibilities:**

- Authenticate field users and return token-based sessions
- (Future) Device registration, workday download, task sync, GPS, evidence

**Out of scope for Mobile API:**

- Duplicating Backoffice CRUD screens
- Replacing `/api/auth/*` or Operario PWA flows

**Versioning:** `/api/mobile/v1/`. New breaking contracts ship under `v2` while `v1` remains available.

**Structure:**

```
app/api/mobile/v1/
  auth/login/       POST — public login
  auth/me/          GET  — bearer-protected profile (Sprint API Mobile 0.2)
  auth/             refresh, logout — planned
  device/           planned
  workday/          planned
  tasks/            planned
  gps/              planned
  evidence/         planned

lib/mobile/v1/
  response-factory.ts   Standard success envelope
  error-factory.ts      Standard error envelope
  request-context.ts    Request ID + optional mobile headers
  types/responses.ts    Envelope contracts
  handle-mobile-route.ts  Public / protected wrappers
  auth/
    mobile-bearer-middleware.ts
    mobile-token-resolver.ts
    mobile-auth-context.ts
    mobile-auth-helpers.ts
    login service, validation, contracts
  errors.ts             error codes
  constants.ts          MOBILE_API_VERSION (single source)
```

**Protected route flow:**

```
Authorization: Bearer <token>
  → mobileBearerMiddleware
  → resolveMobileAuthFromAccessToken (Supabase getUser)
  → MobileAuthContext
  → handleProtectedMobileRoute → endpoint
```

**Auth flow (login):**

```
Field Agent → POST /api/mobile/v1/auth/login
           → lib/mobile/v1/auth/login-service
           → Supabase signInWithPassword (reuse email/DNI candidates)
           → employees lookup + access validation
           → tokens + minimal user payload
```

Business validation stays in shared `lib/auth` and `lib/supabase/employees` modules.

---

## Related documents

- [README.md](./README.md) — Setup and overview
- [ROADMAP.md](./ROADMAP.md) — Delivery phases
- [docs/mobile-api.md](./docs/mobile-api.md) — Mobile API contracts
