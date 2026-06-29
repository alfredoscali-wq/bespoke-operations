# Mobile API

Versioned HTTP API consumed exclusively by **Bespoke Field Agent** (Android).

It coexists with existing Backoffice and Operario PWA routes. Business logic remains in Bespoke Operations; this layer exposes mobile-optimized contracts and orchestrates existing auth and domain services.

---

## Base path

```
/api/mobile/v1/
```

Future versions will use `/api/mobile/v2/` without breaking existing clients.

The active version is centralized in `lib/mobile/v1/constants.ts` (`MOBILE_API_VERSION`).

---

## Standard response envelope

Every Mobile API response — success or error — uses the same top-level structure. Functional payloads never appear at the root; they live inside `data` on success.

### Success

```json
{
  "success": true,
  "apiVersion": "v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "serverTime": "2026-06-29T22:15:30Z",
  "data": {}
}
```

| Field | Description |
|-------|-------------|
| `success` | Always `true` |
| `apiVersion` | API version (`v1`) |
| `requestId` | Unique id per request (`crypto.randomUUID()`) |
| `serverTime` | UTC ISO 8601 timestamp at response time |
| `data` | Endpoint-specific payload |

### Error

```json
{
  "success": false,
  "apiVersion": "v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "serverTime": "2026-06-29T22:15:30Z",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Credenciales inválidas"
  }
}
```

| Field | Description |
|-------|-------------|
| `success` | Always `false` |
| `apiVersion` | API version (`v1`) |
| `requestId` | Same semantics as success |
| `serverTime` | UTC ISO 8601 timestamp at response time |
| `error.code` | Machine-readable error code |
| `error.message` | Human-readable message (Spanish) |

All routes must use `lib/mobile/v1/response-factory.ts` and `lib/mobile/v1/error-factory.ts`. Do not build ad-hoc JSON in route handlers.

---

## Request metadata

### Response header

| Header | Description |
|--------|-------------|
| `X-Request-Id` | Mirrors `requestId` in the JSON body |

### Optional client headers

Read and logged at debug level when present. **Not required** in Sprint 0.1.1.

| Header | Purpose |
|--------|---------|
| `X-Mobile-Client` | Client identifier (e.g. `bespoke-field-agent`) |
| `X-App-Version` | App semver from the device |
| `X-Platform` | Platform (`android`) |

---

## Authentication

### POST `/api/mobile/v1/auth/login`

Authenticates a field user and returns Supabase tokens for subsequent mobile requests.

#### Request

```json
{
  "email": "12345678",
  "password": "********",
  "deviceId": "uuid-del-dispositivo",
  "appVersion": "1.0.0",
  "platform": "android"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `email` | Yes | Accepts **email or DNI**, same rules as Backoffice login |
| `password` | Yes | Supabase Auth password |
| `deviceId` | Yes | Stable device identifier from Field Agent |
| `appVersion` | Yes | Semantic app version string |
| `platform` | Yes | Must be `android` |

#### Success — `200`

```json
{
  "success": true,
  "apiVersion": "v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "serverTime": "2026-06-29T22:15:30Z",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "v1...",
    "expiresIn": 3600,
    "user": {
      "id": "auth-user-uuid",
      "name": "Juan Pérez",
      "email": "juan@empresa.com",
      "companyId": "company-uuid",
      "employeeId": "employee-uuid",
      "role": "operario"
    }
  }
}
```

| `data` field | Description |
|--------------|-------------|
| `accessToken` | Bearer token for authenticated mobile calls |
| `refreshToken` | Token for future refresh endpoint (not implemented yet) |
| `expiresIn` | Access token lifetime in seconds |
| `user.id` | Supabase Auth user id |
| `user.employeeId` | RRHH employee record id |
| `user.role` | System role (`operario`, `supervisor`, etc.) |

#### Error example — `401`

```json
{
  "success": false,
  "apiVersion": "v1",
  "requestId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "serverTime": "2026-06-29T22:16:01Z",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Credenciales inválidas"
  }
}
```

#### Error codes

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_REQUEST` | Validation error (missing fields, invalid platform, invalid JSON) |
| 401 | `INVALID_CREDENTIALS` | Credenciales inválidas |
| 403 | `USER_DISABLED` | Usuario deshabilitado |
| 404 | `EMPLOYEE_NOT_FOUND` | Empleado inexistente |
| 405 | `INVALID_REQUEST` | Método no permitido |
| 500 | `INTERNAL_ERROR` | Error interno |

---

## Planned endpoints

| Area | Path prefix | Sprint |
|------|-------------|--------|
| Auth refresh | `/api/mobile/v1/auth/refresh` | TBD |
| Device registration | `/api/mobile/v1/device/` | TBD |
| Workday download | `/api/mobile/v1/workday/` | TBD |
| Tasks | `/api/mobile/v1/tasks/` | TBD |
| GPS batches | `/api/mobile/v1/gps/` | TBD |
| Evidence | `/api/mobile/v1/evidence/` | TBD |

---

## Implementation layout

```
app/api/mobile/v1/              Route handlers (thin)
lib/mobile/v1/
  response-factory.ts           Success envelope builder
  error-factory.ts                Error envelope builder
  request-context.ts              Request ID + mobile headers
  types/responses.ts              Envelope TypeScript types
  auth/                           Auth orchestration
lib/auth/                         Shared auth identity & session mapping
lib/supabase/                     Data access (employees, admin client)
```

Route handlers must not embed business rules or hand-build JSON envelopes.

---

## Security notes

- Login uses Supabase `signInWithPassword` with the public anon key (stateless, no cookies).
- Employee access checks reuse RRHH flags (`system_access`, employment status).
- Refresh token, device registration, and session revocation endpoints are prepared in `lib/mobile/v1/auth/contracts.ts` for future sprints.
