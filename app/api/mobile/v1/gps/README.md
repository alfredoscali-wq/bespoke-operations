# Mobile API — GPS

## GPS Live heartbeat (implemented)

`POST /api/mobile/v1/gps/heartbeat` stores the last known position of the
**crew** bound to the authenticated device while its shift is `ACTIVE`.

Full contract: `docs/mobile-api.md` (GPS Live heartbeat).

Tenant, `company_id`, and `work_team_id` are resolved by the backend from the
session and device. Body `companyId` / `workTeamId` are ignored.

This is not Presence (`task_presence_events`). It is not a history trail.

## GPS batches (placeholder)

Routes under `/api/mobile/v1/gps/` for historical GPS batches from Field Agent
remain a future sprint. GPS Live does not persist a row per ping.
