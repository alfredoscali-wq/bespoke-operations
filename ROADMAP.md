# Roadmap — Bespoke Operations

Phased delivery for the operational platform and its integration with Bespoke Field Agent.

---

## Ecosystem context

- **Bespoke Operations** — planning, OT lifecycle, customers, RRHH, reports
- **Bespoke Field Agent** — Android execution client (consumes Mobile API)
- **Operario PWA** — browser field portal (same codebase, cookie auth)

---

## Completed / in progress

| Sprint | Scope | Status |
|--------|-------|--------|
| ABNET 1.0 | OT intake (cuadrilla, turno, duración, GPS) | Done |
| Workflow | `programada` → `asignada` → … | Done |
| Planning UX 1.0 | Planificación Operativa (read-only base) | Done |
| Planning 1.1 | Edición rápida supervisor | Done |
| **API Mobile 0.1** | Mobile API foundation + login | Done |
| **API Mobile 0.1.1** | Standard response envelope + request ID | Done |

---

## API Mobile 0.1 — Foundation (done)

- Versioned base path `/api/mobile/v1/`
- Isolated `lib/mobile/v1/` layer
- `POST /api/mobile/v1/auth/login` with stable contract
- Placeholder directories for device, workday, tasks, gps, evidence
- Documentation in `docs/mobile-api.md`

**Exit criteria:** Compiles; no Backoffice/PWA regressions; login contract documented.

---

## API Mobile — Next phases (planned)

| Phase | Endpoints | Depends on |
|-------|-----------|------------|
| 0.2 Auth refresh | `POST /auth/refresh`, session revocation | Mobile 0.1 |
| 0.3 Device | `POST /device/register`, device binding | Mobile 0.1 |
| 1.0 Workday | `GET /workday/current` — published jornada | Planning publish sprint |
| 1.1 Tasks | Assigned OT list + detail for operario | OT assign workflow |
| 2.0 GPS | Batch upload | Field Agent GPS sprint |
| 2.1 Evidence | Photo/metadata upload | Field Agent evidence sprint |
| 3.0 Sync | Idempotent sync + offline reconciliation | Field Agent offline |

---

## Operations roadmap (selected)

| Item | Notes |
|------|-------|
| Publicar Jornada | Supervisor publishes planned day → Field Agent download |
| ABNET ERP import | Mass OT import |
| Field Agent login integration | Consume Mobile API 0.1 |

---

## Related documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/mobile-api.md](./docs/mobile-api.md)
