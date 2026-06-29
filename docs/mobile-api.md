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

## Bearer authentication

Protected Mobile API routes require a Supabase access token obtained from login.

### Authorization header

```
Authorization: Bearer <access_token>
```

| Rule | Detail |
|------|--------|
| Accepted scheme | `Bearer` only |
| Not accepted | Cookies, query string, custom headers |
| Token logging | Never log tokens server-side |

### Authentication flow

```
Client Request (Authorization: Bearer …)
        ↓
mobileBearerMiddleware
        ↓
extractBearerToken
        ↓
resolveMobileAuthFromAccessToken → Supabase auth.getUser(jwt)
        ↓
employees lookup + access validation
        ↓
MobileAuthContext
        ↓
Endpoint handler (via handleProtectedMobileRoute)
```

Route handlers receive `MobileAuthenticatedContext` and must **not** parse `Authorization` manually.

### MobileAuthContext

Built once per authenticated request:

| Field | Source |
|-------|--------|
| `authUserId` | Supabase Auth user id |
| `employeeId` | RRHH employee record |
| `companyId` | Employee company |
| `role` | `system_role` |
| `email` | Employee email or auth email |
| `displayName` | Employee full name |

### Unauthorized responses

When the Bearer token is missing, malformed, invalid, or expired, the API responds with:

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | No autorizado |

All token failures share the same public response (no distinction between missing, expired, or invalid).

### Helpers (server)

| Function | Purpose |
|----------|---------|
| `requireAuthenticatedMobileUser()` | Runs bearer middleware; returns context or error response |
| `getAuthenticatedMobileUser()` | Returns `MobileAuthContext` from authenticated context |
| `requireAuthenticatedUser()` | Same as above; for explicit handler usage |
| `requireCompany()` | Ensures `companyId` is present |
| `requireEmployee()` | Ensures `employeeId` is present |
| `handleProtectedMobileRoute()` | Wrapper for protected route handlers |

Refresh token exchange is prepared in `lib/mobile/v1/auth/contracts.ts` but not implemented yet.

---

## Authentication endpoints

### POST `/api/mobile/v1/auth/login`

Public. Authenticates a field user and returns Supabase tokens for subsequent mobile requests.

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
| 401 | `UNAUTHORIZED` | No autorizado (Bearer inválido o ausente) |
| 403 | `USER_DISABLED` | Usuario deshabilitado |
| 404 | `EMPLOYEE_NOT_FOUND` | Empleado inexistente |
| 405 | `INVALID_REQUEST` | Método no permitido |
| 500 | `INTERNAL_ERROR` | Error interno |

---

### GET `/api/mobile/v1/auth/me`

Protected. Returns the authenticated mobile user profile.

#### Request headers

```
Authorization: Bearer <access_token>
```

#### Success — `200`

```json
{
  "success": true,
  "apiVersion": "v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "serverTime": "2026-06-29T22:15:30Z",
  "data": {
    "id": "auth-user-uuid",
    "name": "Juan Pérez",
    "email": "juan@empresa.com",
    "companyId": "company-uuid",
    "employeeId": "employee-uuid",
    "role": "operario"
  }
}
```

#### Error example — `401`

```json
{
  "success": false,
  "apiVersion": "v1",
  "requestId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "serverTime": "2026-06-29T22:16:01Z",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No autorizado"
  }
}
```

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | No autorizado |
| 403 | `USER_DISABLED` | Usuario deshabilitado |
| 404 | `EMPLOYEE_NOT_FOUND` | Empleado inexistente |
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
  error-factory.ts              Error envelope builder
  handle-mobile-route.ts        Public / protected route wrappers
  request-context.ts            Request ID + mobile headers
  types/responses.ts            Envelope TypeScript types
  auth/
    mobile-bearer-middleware.ts Bearer authentication
    mobile-token-resolver.ts    Supabase JWT validation
    mobile-auth-context.ts      Authenticated user context
    mobile-auth-helpers.ts      require/get helpers
lib/auth/                       Shared auth identity & session mapping
lib/supabase/                   Data access (employees, admin client)
```

Route handlers must not embed business rules or hand-build JSON envelopes.

---

## Security notes

- Login uses Supabase `signInWithPassword` with the public anon key (stateless, no cookies).
- Protected routes validate `Authorization: Bearer` via Supabase `auth.getUser(jwt)` — no cookies or query tokens.
- Employee access checks reuse RRHH flags (`system_access`, employment status).
- Access tokens are never logged.
- Refresh token, device registration, and session revocation endpoints are prepared in `lib/mobile/v1/auth/contracts.ts` for future sprints.
