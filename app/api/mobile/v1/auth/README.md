# Mobile API — auth endpoints

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/mobile/v1/auth/login` | Public | Implemented |
| GET | `/api/mobile/v1/auth/me` | Bearer | Implemented |
| POST | `/api/mobile/v1/auth/refresh` | — | Planned |
| POST | `/api/mobile/v1/auth/logout` | — | Planned |

See `docs/mobile-api.md` for request/response contracts.

Protected routes use `handleProtectedMobileRoute` — never validate Bearer tokens manually in route handlers.
