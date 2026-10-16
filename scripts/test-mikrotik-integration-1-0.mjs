import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

process.env.BESPOKE_MIKROTIK_SECRET = "test-mikrotik-secret-key-not-for-prod"

const {
  encryptMikrotikPassword,
  decryptMikrotikPassword,
  isPackedMikrotikPassword,
} = await import("../lib/integrations/mikrotik/crypto.ts")
const {
  parseMikrotikCreateInput,
  parseMikrotikUpdateInput,
  shouldResetConnectionState,
} = await import("../lib/integrations/mikrotik/validate.ts")
const {
  mapMikrotikIntegrationPublic,
  assertNoMikrotikSecrets,
} = await import("../lib/integrations/mikrotik/public.ts")
const {
  canManageMikrotikIntegrations,
  resolveSessionCompanyId,
} = await import("../lib/integrations/mikrotik/access.ts")
const { MikrotikClient } = await import("../lib/integrations/mikrotik/client.ts")
const { testMikrotikConnection } = await import("../lib/integrations/mikrotik/connection.ts")
const { createMikrotikAdapter } = await import("../lib/integrations/mikrotik/adapter.ts")
const {
  classifyMikrotikNetworkError,
  MikrotikIntegrationError,
  stripMikrotikSecrets,
  sanitizeMikrotikErrorMessage,
} = await import("../lib/integrations/mikrotik/errors.ts")
const {
  createMockMikrotikRestFetch,
  MOCK_MIKROTIK_IDENTITY,
  MOCK_MIKROTIK_PASSWORD,
  MOCK_MIKROTIK_USER,
  MOCK_MIKROTIK_VERSION,
} = await import("../lib/integrations/mikrotik/mock-routeros.ts")
const { AUDIT_ACTIONS } = await import("../lib/audit/types.ts")
const { mapLegacyAuditActionToActivity } = await import("../lib/activity/legacy-audit-map.ts")
const { ACTIVITY_ACTIONS } = await import("../lib/activity/types.ts")

const root = resolve(import.meta.dirname, "..")
function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PASSWORD = "super-secret-router-pass"

function settingsUser(overrides = {}) {
  return {
    systemRole: "administrador",
    roleCode: "administrador",
    companyId: COMPANY_A,
    moduleVisibility: { settings: true },
    ...overrides,
  }
}

function secretRow(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: COMPANY_A,
    name: "CORE ABNET 01",
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password_encrypted: encryptMikrotikPassword(PASSWORD),
    enabled: true,
    last_connection_at: null,
    last_connection_status: "never_checked",
    last_connection_error: null,
    last_router_identity: null,
    created_at: "2026-09-29T19:00:00.000Z",
    updated_at: "2026-09-29T19:00:00.000Z",
    deleted_at: null,
    ...overrides,
  }
}

function createMemoryStore(seed = []) {
  const rows = seed.map((row) => ({ ...row }))
  return {
    list(companyId) {
      return rows
        .filter((row) => row.company_id === companyId && !row.deleted_at)
        .map((row) => mapMikrotikIntegrationPublic(row))
    },
    get(companyId, id) {
      const row = rows.find(
        (item) => item.id === id && item.company_id === companyId && !item.deleted_at
      )
      return row ? mapMikrotikIntegrationPublic(row) : null
    },
    getSecret(companyId, id) {
      return (
        rows.find(
          (item) => item.id === id && item.company_id === companyId && !item.deleted_at
        ) ?? null
      )
    },
    insert(companyId, input) {
      const row = secretRow({
        id: "22222222-2222-4222-8222-222222222222",
        company_id: companyId,
        name: input.name,
        host: input.host,
        port: input.port,
        protocol: input.protocol,
        username: input.username,
        password_encrypted: encryptMikrotikPassword(input.password),
        enabled: input.enabled,
        last_connection_status: input.enabled ? "never_checked" : "disabled",
      })
      rows.push(row)
      return mapMikrotikIntegrationPublic(row)
    },
    updateConnection(companyId, id, state) {
      const row = rows.find(
        (item) => item.id === id && item.company_id === companyId && !item.deleted_at
      )
      if (!row) return null
      Object.assign(row, state)
      return mapMikrotikIntegrationPublic(row)
    },
  }
}

test("1 crear integracion valida cifra la contrasena y no la devuelve", () => {
  const parsed = parseMikrotikCreateInput({
    name: "CORE ABNET 01",
    host: "10.10.10.1",
    port: 443,
    protocol: "https-rest",
    username: "api-read",
    password: PASSWORD,
    enabled: true,
    companyId: COMPANY_B,
  })
  assert.equal(parsed.ok, true)
  const store = createMemoryStore()
  const created = store.insert(COMPANY_A, parsed.value)
  const secret = store.getSecret(COMPANY_A, created.id)
  assert.equal(created.companyId, COMPANY_A)
  assert.equal(created.host, "10.10.10.1")
  assert.equal("password" in created, false)
  assert.equal("password_encrypted" in created, false)
  assert.equal(isPackedMikrotikPassword(secret.password_encrypted), true)
  assert.notEqual(secret.password_encrypted, PASSWORD)
  assert.equal(decryptMikrotikPassword(secret.password_encrypted), PASSWORD)
  assertNoMikrotikSecrets(created)
})


test("2 rechaza company_id ajeno al listar o leer", () => {
  const store = createMemoryStore([secretRow()])
  assert.equal(store.list(COMPANY_B).length, 0)
  assert.equal(store.get(COMPANY_B, secretRow().id), null)
  assert.equal(store.getSecret(COMPANY_B, secretRow().id), null)
  assert.equal(store.list(COMPANY_A).length, 1)
})

test("3 password nunca aparece en response publica", () => {
  const publicRow = mapMikrotikIntegrationPublic(secretRow())
  const serialized = JSON.stringify(publicRow)
  assert.equal(serialized.includes(PASSWORD), false)
  assert.equal(serialized.includes("password_encrypted"), false)
  assert.doesNotMatch(serialized, /"password"/)
  assertNoMikrotikSecrets(publicRow)
})

test("4 password nunca aparece en logs sanitizados", () => {
  const raw = "Authentication failed for user api-read password " + PASSWORD
  const sanitized = sanitizeMikrotikErrorMessage(raw, [PASSWORD])
  assert.equal(sanitized.includes(PASSWORD), false)
  const stripped = stripMikrotikSecrets({
    username: "api-read",
    password: PASSWORD,
    password_encrypted: "cipher",
    Authorization: "Basic abc",
    host: "10.0.0.1",
  })
  assert.deepEqual(stripped, { username: "api-read", host: "10.0.0.1" })
})

test("5 credencial queda cifrada con clave dedicada y sin fallback service_role", () => {
  const cryptoSource = read("lib/integrations/mikrotik/crypto.ts")
  assert.match(cryptoSource, /BESPOKE_MIKROTIK_SECRET/)
  assert.doesNotMatch(cryptoSource, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(cryptoSource, /NEXT_PUBLIC_/)
  const packed = encryptMikrotikPassword("abc")
  assert.equal(isPackedMikrotikPassword(packed), true)
  assert.equal(decryptMikrotikPassword(packed), "abc")
})

test("6 test connection exitoso con mock MikroTik", async () => {
  const client = new MikrotikClient({
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password: MOCK_MIKROTIK_PASSWORD,
    fetchImpl: createMockMikrotikRestFetch(),
  })
  const result = await client.testConnection()
  assert.equal(result.ok, true)
  assert.equal(result.identity.name, MOCK_MIKROTIK_IDENTITY)
  assert.equal(result.resource.version, MOCK_MIKROTIK_VERSION)
  assert.equal(result.snapshot.identity, MOCK_MIKROTIK_IDENTITY)
  assert.equal(JSON.stringify(result).includes(MOCK_MIKROTIK_PASSWORD), false)
})

test("7 authentication failed", async () => {
  const client = new MikrotikClient({
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password: "wrong-password",
    fetchImpl: createMockMikrotikRestFetch(),
  })
  await assert.rejects(
    () => client.testConnection(),
    (error) => {
      assert.equal(error instanceof MikrotikIntegrationError, true)
      assert.equal(error.code, "AUTHENTICATION_FAILED")
      assert.equal(error.message.includes("wrong-password"), false)
      return true
    }
  )
})

test("8 timeout", async () => {
  const client = new MikrotikClient({
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password: MOCK_MIKROTIK_PASSWORD,
    timeoutMs: 20,
    fetchImpl: createMockMikrotikRestFetch({ delayMs: 500 }),
  })
  await assert.rejects(
    () => client.testConnection(),
    (error) => {
      assert.equal(error.code, "CONNECTION_TIMEOUT")
      return true
    }
  )
})

test("9 router disabled", async () => {
  await assert.rejects(
    () =>
      testMikrotikConnection({
        host: "10.0.0.1",
        port: 443,
        protocol: "https-rest",
        username: MOCK_MIKROTIK_USER,
        password: MOCK_MIKROTIK_PASSWORD,
        enabled: false,
        fetchImpl: createMockMikrotikRestFetch(),
      }),
    (error) => {
      assert.equal(error.code, "ROUTER_DISABLED")
      return true
    }
  )
})

test("10 usuario sin permiso rechazado", () => {
  assert.equal(canManageMikrotikIntegrations(settingsUser()), true)
  assert.equal(
    canManageMikrotikIntegrations(
      settingsUser({
        systemRole: "supervisor",
        roleCode: "supervisor",
        moduleVisibility: { settings: false },
      })
    ),
    false
  )
  assert.equal(canManageMikrotikIntegrations(null), false)
})

test("11 usuario de otra company rechazado", () => {
  assert.equal(resolveSessionCompanyId(settingsUser({ companyId: COMPANY_A })), COMPANY_A)
  assert.equal(resolveSessionCompanyId(settingsUser({ companyId: "  " })), null)
  const store = createMemoryStore([secretRow()])
  const other = settingsUser({ companyId: COMPANY_B })
  assert.equal(store.get(other.companyId, secretRow().id), null)
})

test("12 getIdentity funciona", async () => {
  const client = new MikrotikClient({
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password: MOCK_MIKROTIK_PASSWORD,
    fetchImpl: createMockMikrotikRestFetch(),
  })
  const identity = await client.getIdentity()
  assert.equal(identity.name, MOCK_MIKROTIK_IDENTITY)
})

test("13 getSystemResource funciona", async () => {
  const adapter = createMikrotikAdapter({
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password: MOCK_MIKROTIK_PASSWORD,
    fetchImpl: createMockMikrotikRestFetch(),
  })
  const resource = await adapter.getSystemResource()
  assert.equal(resource.version, MOCK_MIKROTIK_VERSION)
  assert.equal(resource.uptime, "1w2d3h4m5s")
  assert.equal(resource.cpuLoad, "3")
})

test("14 y 15 last_connection_at y status se actualizan", async () => {
  const store = createMemoryStore([secretRow()])
  const client = new MikrotikClient({
    host: "10.0.0.1",
    port: 443,
    protocol: "https-rest",
    username: MOCK_MIKROTIK_USER,
    password: MOCK_MIKROTIK_PASSWORD,
    fetchImpl: createMockMikrotikRestFetch(),
  })
  const probed = await client.testConnection()
  const updated = store.updateConnection(COMPANY_A, secretRow().id, {
    last_connection_at: "2026-09-29T22:32:00.000Z",
    last_connection_status: "connected",
    last_connection_error: null,
    last_router_identity: probed.snapshot,
  })
  assert.equal(updated.lastConnectionAt, "2026-09-29T22:32:00.000Z")
  assert.equal(updated.lastConnectionStatus, "connected")
  assert.equal(updated.lastRouterIdentity.identity, MOCK_MIKROTIK_IDENTITY)
})

test("16 no se permite acceso al secreto desde frontend", () => {
  const ui = read("components/configuracion/mikrotik-integrations-config-page.tsx")
  const envExample = read(".env.example")
  const cryptoSource = read("lib/integrations/mikrotik/crypto.ts")
  assert.doesNotMatch(ui, /password_encrypted/)
  assert.doesNotMatch(ui, /BESPOKE_MIKROTIK_SECRET/)
  assert.doesNotMatch(ui, /Authorization/)
  assert.match(envExample, /BESPOKE_MIKROTIK_SECRET=/)
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_BESPOKE_MIKROTIK/)
  assert.match(cryptoSource, /process.env\[MIKROTIK_SECRET_ENV\]/)
})

test("rutas usan company_id de sesion", () => {
  const listRoute = read("app/api/integrations/mikrotik/route.ts")
  const itemRoute = read("app/api/integrations/mikrotik/[id]/route.ts")
  const testRoute = read("app/api/integrations/mikrotik/[id]/test/route.ts")
  const session = read("lib/integrations/mikrotik/session.ts")
  assert.match(session, /resolveSessionCompanyId/)
  assert.match(session, /canManageMikrotikIntegrations/)
  assert.match(listRoute, /auth.companyId/)
  assert.match(itemRoute, /auth.companyId/)
  assert.match(testRoute, /auth.companyId/)
  assert.doesNotMatch(listRoute, /body.companyId/)
  assert.doesNotMatch(itemRoute, /searchParams/)
  assert.match(testRoute, /requireMikrotikWriteSession/)
})

test("cambiar host usuario o password resetea estado", () => {
  assert.equal(shouldResetConnectionState({ host: "10.0.0.2" }), true)
  assert.equal(shouldResetConnectionState({ username: "other" }), true)
  assert.equal(shouldResetConnectionState({ password: "x" }), true)
  assert.equal(shouldResetConnectionState({ enabled: false }), false)
  const parsed = parseMikrotikUpdateInput({ password: "" })
  assert.equal(parsed.ok, true)
  assert.equal("password" in parsed.value, false)
})

test("errores de red se clasifican", () => {
  const timeout = classifyMikrotikNetworkError({ name: "AbortError", message: "aborted" })
  assert.equal(timeout, "CONNECTION_TIMEOUT")
  const tls = classifyMikrotikNetworkError({
    message: "unable_to_verify_leaf_signature",
  })
  assert.equal(tls, "TLS_ERROR")
  const refused = classifyMikrotikNetworkError({ cause: { code: "ECONNREFUSED" } })
  assert.equal(refused, "CONNECTION_REFUSED")
})

test("auditoria MikroTik existe y mapea a settings", () => {
  assert.equal(AUDIT_ACTIONS.MIKROTIK_CONNECTION_TEST, "MIKROTIK_CONNECTION_TEST")
  assert.equal(
    mapLegacyAuditActionToActivity(AUDIT_ACTIONS.MIKROTIK_CONNECTION_TEST),
    ACTIVITY_ACTIONS.SETTINGS_UPDATE
  )
  const audit = read("lib/integrations/mikrotik/audit.ts")
  assert.match(audit, /MIKROTIK_CONNECTION_TEST/)
  assert.doesNotMatch(audit, /password/)
  assert.match(audit, /stripMikrotikSecrets/)
})

test("capa ISP no llama RouterOS desde UI", () => {
  const adapter = read("lib/integrations/mikrotik/adapter.ts")
  const port = read("lib/integrations/isp/router-read-port.ts")
  const ui = read("components/configuracion/mikrotik-integrations-config-page.tsx")
  assert.match(adapter, /implements IspRouterReadPort/)
  assert.match(port, /IspRouterReadPort/)
  assert.doesNotMatch(ui, /system.identity/)
  assert.doesNotMatch(ui, /password_encrypted/)
})
