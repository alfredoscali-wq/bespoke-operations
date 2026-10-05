/**
 * Discovery destination admin: view/edit/test/delete authorized MikroTik targets.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { canAccessPathWithModules, createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"
import {
  validateNetworkDiscoveryTargetDraft,
  validateNetworkDiscoveryTargetUpdate,
} from "../lib/network/integrity.ts"
import { mapNetworkTargetRow } from "../lib/network/mapper.ts"
import { stripNetworkSecrets } from "../lib/network/secrets.ts"
import { NETWORK_TARGET_DECRYPT_ERROR } from "../lib/network/management/errors.ts"
import {
  NETWORK_TARGET_AUTH_ERROR_MESSAGE,
  NETWORK_TARGET_AUTH_REJECTED,
  NETWORK_TARGET_CONNECTION_OK_MESSAGE,
  NETWORK_TARGET_DECRYPT_USER_MESSAGE,
  attachNetworkDiscoveryTargetConnection,
  mapNetworkTargetConnectionMessage,
} from "../lib/network/targets/connection.ts"
import { canAccessNetworkModule, canWriteNetworkModule } from "../lib/network/permissions.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const SECRET_JSON_KEYS = [
  "password",
  "secret",
  "secret_ciphertext",
  "secretCiphertext",
  "secret_iv",
  "secretIv",
  "secret_tag",
  "secretTag",
]

function assertNoSecrets(value, label) {
  const json = JSON.stringify(value)
  for (const key of SECRET_JSON_KEYS) {
    assert.equal(
      json.includes(`"${key}"`),
      false,
      `${label} no debe incluir ${key}`
    )
  }
}

const mappedRow = {
  id: "target-1",
  company_id: "co-1",
  agent_id: "agent-1",
  site_id: "site-1",
  name: "POP core",
  vendor: "mikrotik",
  host: "10.0.0.1",
  port: 8728,
  protocol: "api",
  username: "admin",
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  secret_ciphertext: "cipher",
}

function mappedTarget(extras) {
  return mapNetworkTargetRow(mappedRow, extras)
}

test("1. listar destinos reutiliza network_discovery_targets", () => {
  const listRoute = read("app/api/network/targets/route.ts")
  const queries = read("lib/network/targets/queries.ts")
  const ui = read("components/network/network-discovery-targets-panel.tsx")
  const screen = read("components/network/network-discovery-screen.tsx")
  assert.match(listRoute, /listNetworkDiscoveryTargets/)
  assert.match(listRoute, /hydrateNetworkDiscoveryTargets/)
  assert.match(listRoute, /requireNetworkReadContext/)
  assert.match(queries, /from\("network_discovery_targets"\)/)
  assert.match(queries, /\.is\("deleted_at", null\)/)
  assert.match(queries, /username/)
  assert.match(ui, /Destinos MikroTik autorizados/)
  assert.match(screen, /NetworkDiscoveryTargetsPanel/)
  assert.match(screen, /placeholder="Destino"/)
  assert.match(screen, /Configurar MikroTik/)
  assert.doesNotMatch(queries, /company_mikrotik_integrations/)
  assert.doesNotMatch(listRoute, /company_mikrotik_integrations/)
})

test("2. ver destino incluye usuario y nunca la contraseña", () => {
  const mapped = mappedTarget({
    agentName: "Agent POP",
    siteName: "Malagueño",
  })
  assert.equal(mapped.username, "admin")
  assert.equal(mapped.hasSecret, true)
  assert.equal("password" in mapped, false)
  assertNoSecrets(mapped, "mapNetworkTargetRow")
  assert.equal(mapped.agentName, "Agent POP")
  assert.equal(mapped.siteName, "Malagueño")

  const mapper = read("lib/network/mapper.ts")
  const mappedFn = mapper.slice(mapper.indexOf("export function mapNetworkTargetRow"))
  assert.doesNotMatch(mappedFn, /password:/)
  assert.match(mappedFn, /username: row\.username/)
  assert.match(mappedFn, /hasSecret/)

  const ui = read("components/network/network-discovery-targets-panel.tsx")
  assert.match(ui, /DialogTitle>Destino MikroTik/)
  assert.match(ui, /label="Usuario"/)
  assert.match(ui, /label="Último discovery"/)
  assert.doesNotMatch(ui, /label="Contraseña"/)
})

test("3. editar destino usa PATCH y el validador de update", () => {
  const itemRoute = read("app/api/network/targets/[id]/route.ts")
  const ui = read("components/network/network-discovery-targets-panel.tsx")
  assert.match(itemRoute, /export async function PATCH/)
  assert.match(itemRoute, /validateNetworkDiscoveryTargetUpdate/)
  assert.match(itemRoute, /updateNetworkDiscoveryTarget/)
  assert.match(itemRoute, /requireNetworkWriteContext/)
  assert.match(ui, />\s*Editar\s*</)
  assert.match(ui, /method: "PATCH"/)
  assert.match(ui, /\/api\/network\/targets\/\$\{active\.id\}/)

  const parsed = validateNetworkDiscoveryTargetUpdate({
    agentId: "agent-1",
    name: "Core editado",
    vendor: "mikrotik",
    host: "10.0.0.8",
    protocol: "api",
    username: "bespoke-api",
    password: "nueva",
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.draft.name, "Core editado")
    assert.equal(parsed.draft.host, "10.0.0.8")
    assert.equal(parsed.draft.username, "bespoke-api")
    assert.equal(parsed.draft.password, "nueva")
  }
})

test("4. cambiar contraseña re-cifra el secreto", () => {
  const queries = read("lib/network/targets/queries.ts")
  const updateFn = queries.slice(
    queries.indexOf("export async function updateNetworkDiscoveryTarget"),
    queries.indexOf("export async function softDeleteNetworkDiscoveryTarget")
  )
  assert.match(updateFn, /encryptNetworkDeviceSecret/)
  assert.match(updateFn, /secret_ciphertext/)
  assert.match(updateFn, /nextSecret/)
  assert.doesNotMatch(updateFn, /password:/)

  const withPassword = validateNetworkDiscoveryTargetUpdate({
    agentId: "agent-1",
    name: "POP core",
    vendor: "mikrotik",
    host: "10.0.0.1",
    protocol: "api",
    username: "admin",
    password: "reemplazo",
  })
  assert.equal(withPassword.ok, true)
  if (withPassword.ok) {
    assert.equal(withPassword.draft.password, "reemplazo")
  }
})

test("5. conservar contraseña cuando el campo queda vacío", () => {
  const keepEmpty = validateNetworkDiscoveryTargetUpdate({
    agentId: "agent-1",
    name: "POP core",
    vendor: "mikrotik",
    host: "10.0.0.1",
    protocol: "api",
    username: "admin",
    password: "",
  })
  assert.equal(keepEmpty.ok, true)
  if (keepEmpty.ok) {
    assert.equal("password" in keepEmpty.draft, false)
  }

  const keepMissing = validateNetworkDiscoveryTargetUpdate({
    agentId: "agent-1",
    name: "POP core",
    vendor: "mikrotik",
    host: "10.0.0.1",
    protocol: "api",
    username: "admin",
  })
  assert.equal(keepMissing.ok, true)
  if (keepMissing.ok) {
    assert.equal(keepMissing.draft.password, undefined)
  }

  const createStillRequires = validateNetworkDiscoveryTargetDraft({
    agentId: "agent-1",
    name: "POP core",
    vendor: "mikrotik",
    host: "10.0.0.1",
    protocol: "api",
    username: "admin",
    password: "",
  })
  assert.equal(createStillRequires.ok, false)

  const queries = read("lib/network/targets/queries.ts")
  const updateFn = queries.slice(
    queries.indexOf("export async function updateNetworkDiscoveryTarget"),
    queries.indexOf("export async function softDeleteNetworkDiscoveryTarget")
  )
  assert.match(updateFn, /nextSecret/)
  assert.match(updateFn, /if \(nextSecret\)/)
})

test("6. probar conexión exitosa usa diagnostic y no ejecuta Discovery", () => {
  const testRoute = read("app/api/network/targets/[id]/test/route.ts")
  const jobsRoute = read("app/api/network/jobs/route.ts")
  const ui = read("components/network/network-discovery-targets-panel.tsx")
  assert.match(testRoute, /DIAGNOSTIC_EXECUTABLE_JOB_TYPE/)
  assert.match(testRoute, /createPendingNetworkAgentJob/)
  assert.match(testRoute, /targetId: target.id/)
  assert.match(testRoute, /host: target.host/)
  assert.doesNotMatch(testRoute, /jobType: "discovery"/)
  assert.doesNotMatch(testRoute, /password/)
  assert.doesNotMatch(testRoute, /username/)
  assert.doesNotMatch(testRoute, /company_mikrotik_integrations/)
  assert.match(jobsRoute, /jobType: "discovery"/)
  assert.match(ui, /Probar conexión/)
  assert.match(ui, /\/api\/network\/targets\/\$\{target\.id\}\/test/)
  assert.match(ui, /NETWORK_TARGET_CONNECTION_OK_MESSAGE/)

  const targets = attachNetworkDiscoveryTargetConnection(
    [mappedTarget()],
    [
      {
        jobType: "diagnostic",
        status: "completed",
        payload: { targetId: "target-1" },
        errorMessage: null,
        completedAt: "2026-10-04T12:00:00.000Z",
      },
    ]
  )
  assert.equal(targets[0].connectionStatus, "ok")
  assert.equal(targets[0].connectionMessage, NETWORK_TARGET_CONNECTION_OK_MESSAGE)
})

test("7. error de autenticación se muestra sin secretos", () => {
  const targets = attachNetworkDiscoveryTargetConnection(
    [mappedTarget()],
    [
      {
        jobType: "diagnostic",
        status: "failed",
        payload: { targetId: "target-1" },
        errorMessage: NETWORK_TARGET_AUTH_REJECTED,
        completedAt: "2026-10-04T12:00:00.000Z",
      },
    ]
  )
  assert.equal(targets[0].connectionStatus, "auth_error")
  assert.equal(targets[0].connectionMessage, NETWORK_TARGET_AUTH_ERROR_MESSAGE)
  assert.doesNotMatch(targets[0].connectionMessage ?? "", /secret|password/i)
  assertNoSecrets(targets[0], "auth error target")

  const other = attachNetworkDiscoveryTargetConnection(
    [mappedTarget()],
    [
      {
        jobType: "diagnostic",
        status: "failed",
        payload: { targetId: "target-1" },
        errorMessage: "timeout al conectar",
      },
    ]
  )
  assert.equal(other[0].connectionStatus, "error")
  assert.equal(other[0].connectionMessage, "timeout al conectar")

  const decrypt = attachNetworkDiscoveryTargetConnection(
    [mappedTarget()],
    [
      {
        jobType: "diagnostic",
        status: "failed",
        payload: { targetId: "target-1" },
        errorMessage: NETWORK_TARGET_DECRYPT_ERROR,
      },
    ]
  )
  assert.equal(decrypt[0].connectionStatus, "error")
  assert.equal(decrypt[0].connectionMessage, NETWORK_TARGET_DECRYPT_USER_MESSAGE)
  assert.equal(
    mapNetworkTargetConnectionMessage("auth failed for password=supersecret"),
    "Error de conexión."
  )
})

test("8. eliminar destino usa soft delete", () => {
  const queries = read("lib/network/targets/queries.ts")
  const itemRoute = read("app/api/network/targets/[id]/route.ts")
  const ui = read("components/network/network-discovery-targets-panel.tsx")
  const deleteFn = queries.slice(
    queries.indexOf("export async function softDeleteNetworkDiscoveryTarget")
  )
  assert.match(deleteFn, /deleted_at/)
  assert.match(deleteFn, /from\("network_discovery_targets"\)/)
  assert.match(itemRoute, /export async function DELETE/)
  assert.match(itemRoute, /softDeleteNetworkDiscoveryTarget/)
  assert.match(ui, /¿Eliminar este destino de Discovery\?/)
  assert.match(ui, /method: "DELETE"/)
})

test("9. eliminar no borra dispositivos ni historial", () => {
  const queries = read("lib/network/targets/queries.ts")
  const deleteFn = queries.slice(
    queries.indexOf("export async function softDeleteNetworkDiscoveryTarget")
  )
  assert.doesNotMatch(deleteFn, /network_devices/)
  assert.doesNotMatch(deleteFn, /network_agent_jobs/)
  assert.doesNotMatch(deleteFn, /network_discovery_observations/)
  assert.doesNotMatch(deleteFn, /network_interfaces/)
  assert.doesNotMatch(deleteFn, /network_links/)
  assert.doesNotMatch(deleteFn, /network_alarms/)
  assert.doesNotMatch(deleteFn, /network_topology/)
  assert.doesNotMatch(deleteFn, /\.delete\(/)

  const itemRoute = read("app/api/network/targets/[id]/route.ts")
  const deleteRoute = itemRoute.slice(itemRoute.indexOf("export async function DELETE"))
  assert.doesNotMatch(deleteRoute, /network_devices/)
  assert.doesNotMatch(deleteRoute, /persistDiscoverySnapshot/)

  const ui = read("components/network/network-discovery-targets-panel.tsx")
  assert.match(ui, /No se borran/)
  assert.match(ui, /dispositivos descubiertos/)
})

test("10. autorización filtra por company/tenant", () => {
  const queries = read("lib/network/targets/queries.ts")
  const itemRoute = read("app/api/network/targets/[id]/route.ts")
  const testRoute = read("app/api/network/targets/[id]/test/route.ts")
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(itemRoute, /auth\.companyId/)
  assert.match(itemRoute, /getNetworkDiscoveryTarget\(client, auth\.companyId, id\)/)
  assert.match(testRoute, /getNetworkDiscoveryTarget\(client, auth\.companyId, id\)/)
  assert.match(testRoute, /companyId: auth\.companyId/)
})

test("11. usuario sin permisos no puede editar/eliminar/probar", () => {
  assert.equal(
    canAccessPathWithModules("/network/discovery", createEmptyModuleVisibility()),
    false
  )
  assert.equal(
    canAccessNetworkModule({
      systemRole: "user",
      roleCode: "viewer",
      moduleVisibility: createEmptyModuleVisibility(),
    }),
    false
  )
  assert.equal(
    canWriteNetworkModule({
      systemRole: "user",
      roleCode: "viewer",
      moduleVisibility: createEmptyModuleVisibility(),
    }),
    false
  )

  const itemRoute = read("app/api/network/targets/[id]/route.ts")
  const testRoute = read("app/api/network/targets/[id]/test/route.ts")
  const context = read("lib/network/route-context.ts")
  const getFn = itemRoute.slice(
    itemRoute.indexOf("export async function GET"),
    itemRoute.indexOf("export async function PATCH")
  )
  const patchFn = itemRoute.slice(
    itemRoute.indexOf("export async function PATCH"),
    itemRoute.indexOf("export async function DELETE")
  )
  const deleteFn = itemRoute.slice(itemRoute.indexOf("export async function DELETE"))
  assert.match(getFn, /requireNetworkReadContext/)
  assert.doesNotMatch(getFn, /requireNetworkWriteContext/)
  assert.match(patchFn, /requireNetworkWriteContext/)
  assert.match(deleteFn, /requireNetworkWriteContext/)
  assert.match(testRoute, /requireNetworkWriteContext/)
  assert.match(context, /No tiene acceso a Network/)
  assert.match(context, /requireWritablePlatformSession/)
})

test("12. credenciales nunca aparecen en respuestas", () => {
  const mapped = mappedTarget()
  const stripped = stripNetworkSecrets({
    ...mapped,
    password: "should-not-leak",
    secret_ciphertext: "cipher",
  })
  assertNoSecrets(stripped, "stripped target")
  assert.equal(stripped.username, "admin")

  const listRoute = read("app/api/network/targets/route.ts")
  const itemRoute = read("app/api/network/targets/[id]/route.ts")
  const testRoute = read("app/api/network/targets/[id]/test/route.ts")
  assert.match(listRoute, /stripNetworkSecrets/)
  assert.match(itemRoute, /stripNetworkSecrets/)
  assert.match(testRoute, /stripNetworkSecrets/)
  assert.doesNotMatch(listRoute, /password:/)
  assert.doesNotMatch(testRoute, /password/)
  assert.doesNotMatch(read("lib/network/targets/queries.ts"), /password:/)
  assert.doesNotMatch(
    read("lib/network/mapper.ts").slice(
      read("lib/network/mapper.ts").indexOf("export function mapNetworkTargetRow")
    ),
    /password:/
  )
})

test("último discovery se toma de jobs discovery y no se mezcla en el selector", () => {
  const targets = attachNetworkDiscoveryTargetConnection(
    [mappedTarget()],
    [
      {
        jobType: "diagnostic",
        status: "completed",
        payload: { targetId: "target-1" },
        completedAt: "2026-10-04T12:00:00.000Z",
      },
      {
        jobType: "discovery",
        status: "completed",
        payload: { targetId: "target-1" },
        completedAt: "2026-10-03T08:00:00.000Z",
      },
    ]
  )
  assert.equal(targets[0].connectionStatus, "ok")
  assert.equal(targets[0].lastDiscoveryAt, "2026-10-03T08:00:00.000Z")

  const jobsRoute = read("app/api/network/jobs/route.ts")
  assert.match(jobsRoute, /listNetworkDiscoveryJobs/)
  assert.doesNotMatch(
    jobsRoute.slice(jobsRoute.indexOf("export async function GET"), jobsRoute.indexOf("export async function POST")),
    /listNetworkManagementJobs/
  )
})
