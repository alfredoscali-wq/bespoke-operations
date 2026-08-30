import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { ACTIVITY_ACTIONS, isActivityAction } from "../lib/activity-engine/activity-actions.ts"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../lib/audit/types.ts"
import { canAccessPathWithModules, createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"
import {
  NETWORK_DEVICE_TYPES,
  NETWORK_VENDORS,
} from "../lib/network/constants.ts"
import {
  defaultNetworkTargetPort,
  resolveTrustedCompanyId,
  validateNetworkDiscoveryTargetDraft,
} from "../lib/network/integrity.ts"
import { buildDeviceFingerprint, normalizeMacAddress } from "../lib/network/discovery/fingerprint.ts"
import { parseDiscoverySnapshot } from "../lib/network/discovery/parse-snapshot.ts"
import {
  compactDiscoveryResult,
  encryptNetworkDeviceSecret,
  decryptNetworkDeviceSecret,
  stripNetworkSecrets,
} from "../lib/network/secrets.ts"
import { encodeSentence, decodeSentences } from "../network-agent/src/connectors/mikrotik/protocol.ts"
import { mapMikrotikFactsToSnapshot } from "../network-agent/src/connectors/mikrotik/map-discovery.ts"
import { getNetworkConnector } from "../network-agent/src/connectors/registry.ts"
import { ConnectorError } from "../network-agent/src/connectors/types.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

test("inventario Network no reutiliza isp_connections", () => {
  const sql = read("supabase/migrations/20261151000100_network_1_discovery.sql")
  assert.match(sql, /CREATE TABLE public.network_devices/)
  assert.match(sql, /CREATE TABLE public.network_interfaces/)
  assert.match(sql, /CREATE TABLE public.network_links/)
  assert.match(sql, /CREATE TABLE public.network_discovery_targets/)
  assert.match(sql, /Independent from isp_connections/)
  assert.match(sql, /auth_user_has_allowed_module\('network'\)/)
  assert.match(sql, /auth_is_demo_platform_read_only\(\)/)
  assert.match(sql, /ALTER COLUMN site_id DROP NOT NULL/)
  assert.doesNotMatch(sql, /ALTER TABLE public.isp_connections/)
  assert.doesNotMatch(sql, /routeros|snmp|mikrotik api/i)
})

test("Cloud no contiene acceso MikroTik; el connector vive en el Agent", () => {
  const persist = read("lib/network/jobs/agent-execution.ts")
  const mapper = read("network-agent/src/connectors/mikrotik/map-discovery.ts")
  const registry = read("network-agent/src/connectors/registry.ts")
  assert.match(persist, /persistDiscoverySnapshot/)
  assert.doesNotMatch(persist, /\/system\/identity|8728|RouterOS/)
  assert.match(mapper, /manufacturer: "MikroTik"/)
  assert.match(registry, /ubiquiti/)
  assert.match(registry, /createMikrotikConnector/)
  assert.doesNotMatch(read("lib/network/discovery/parse-snapshot.ts"), /node:net/)
})

test("Agent API de jobs usa namespace propio", () => {
  assert.match(read("app/api/network/v1/jobs/route.ts"), /claimAuthorizedNetworkAgentJob/)
  assert.match(read("app/api/network/v1/jobs/[jobId]/result/route.ts"), /submitNetworkAgentJobResult/)
  assert.doesNotMatch(read("app/api/network/v1/jobs/route.ts"), /mobile\/v1/)
})

test("UI inventory y discovery están en el módulo network", () => {
  assert.equal(
    canAccessPathWithModules("/network/devices", {
      ...createEmptyModuleVisibility(),
      network: true,
    }),
    true
  )
  assert.equal(
    canAccessPathWithModules("/network/discovery", createEmptyModuleVisibility()),
    false
  )
  assert.deepEqual(NETWORK_DEVICE_TYPES.includes("router"), true)
  assert.deepEqual(NETWORK_VENDORS[0], "mikrotik")
})

test("el tenant autenticado ignora company_id del resultado de discovery", () => {
  const trusted = "00000000-0000-4000-8000-000000000002"
  assert.equal(
    resolveTrustedCompanyId(trusted, "00000000-0000-4000-8000-000000000001"),
    trusted
  )
})

test("destino MikroTik exige credencial y no acepta otros vendors todavía", () => {
  const missingPassword = validateNetworkDiscoveryTargetDraft({
    agentId: "agent-1",
    name: "POP core",
    vendor: "mikrotik",
    host: "10.0.0.1",
    protocol: "api",
    username: "admin",
    password: "",
  })
  assert.equal(missingPassword.ok, false)

  const otherVendor = validateNetworkDiscoveryTargetDraft({
    agentId: "agent-1",
    name: "AP",
    vendor: "ubiquiti",
    host: "10.0.0.2",
    protocol: "api",
    username: "admin",
    password: "secret",
  })
  assert.equal(otherVendor.ok, false)

  const ok = validateNetworkDiscoveryTargetDraft({
    agentId: "agent-1",
    name: "POP core",
    vendor: "mikrotik",
    host: "10.0.0.1",
    protocol: "api",
    username: "admin",
    password: "secret",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.draft.port, defaultNetworkTargetPort("api"))
    assert.equal(ok.draft.password, "secret")
  }
})

test("las contraseñas se cifran y se strippean de resultados", () => {
  const key = Buffer.from("a".repeat(32))
  const encrypted = encryptNetworkDeviceSecret("super-secret", key)
  assert.notEqual(encrypted.ciphertext, "super-secret")
  assert.equal(decryptNetworkDeviceSecret(encrypted, key), "super-secret")

  const stripped = stripNetworkSecrets({
    host: "10.0.0.1",
    password: "x",
    nested: { token: "y", count: 2 },
  })
  assert.deepEqual(stripped, { host: "10.0.0.1", nested: { count: 2 } })

  const compact = compactDiscoveryResult({
    vendor: "mikrotik",
    targetId: "t1",
    deviceCount: 1,
    interfaceCount: 2,
    linkCount: 0,
    warnings: [],
    primaryHostname: "core",
    primaryManagementIp: "10.0.0.1",
  })
  assert.equal("password" in compact, false)
})

test("fingerprint y snapshot de discovery son estables", () => {
  assert.equal(normalizeMacAddress("AA-BB-CC-DD-EE-FF"), "aa:bb:cc:dd:ee:ff")
  assert.equal(
    buildDeviceFingerprint({ serialNumber: "H123", macAddress: "aa:bb" }),
    "serial:h123"
  )
  assert.equal(
    buildDeviceFingerprint({ managementIp: "10.0.0.1", manufacturer: "MikroTik" }),
    "ip:10.0.0.1:mikrotik"
  )

  const parsed = parseDiscoverySnapshot({
    vendor: "mikrotik",
    targetId: "target-1",
    devices: [
      {
        localKey: "target",
        hostname: "core-1",
        manufacturer: "MikroTik",
        model: "CCR2004",
        serialNumber: "ABC",
        deviceType: "router",
        managementIp: "10.0.0.1",
        macAddress: "aa:bb:cc:dd:ee:ff",
        firmwareVersion: "7.16",
        status: "online",
        origin: "discovery",
        interfaces: [
          {
            name: "ether1",
            macAddress: "aa:bb:cc:dd:ee:ff",
            status: "up",
            interfaceType: "ether",
            addresses: [{ address: "10.0.0.1", prefixLength: 24 }],
          },
        ],
      },
      {
        localKey: "neighbor:11:22",
        hostname: "ap-1",
        manufacturer: "MikroTik",
        deviceType: "ap",
        managementIp: "10.0.0.8",
        macAddress: "11:22:33:44:55:66",
        status: "unknown",
        origin: "neighbor",
        interfaces: [],
      },
    ],
    links: [
      {
        fromLocalKey: "target",
        fromInterfaceName: "ether1",
        toLocalKey: "neighbor:11:22",
        toInterfaceName: null,
        protocol: "mndp",
      },
    ],
    warnings: [],
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.snapshot.devices.length, 2)
    assert.equal(parsed.snapshot.links.length, 1)
    assert.equal(parsed.snapshot.devices[0].interfaces[0].addresses[0].address, "10.0.0.1")
  }
})

test("el mapper MikroTik arma device, interfaces, IPs y vecinos", () => {
  const snapshot = mapMikrotikFactsToSnapshot({
    host: "192.168.88.1",
    targetId: "target-1",
    siteId: null,
    identity: { name: "POP-Centro" },
    resource: { version: "7.16.1", "board-name": "CCR2004-16G-2S+", platform: "MikroTik" },
    routerboard: { model: "CCR2004-16G-2S+", "serial-number": "H8E012345" },
    interfaces: [
      {
        name: "ether1",
        type: "ether",
        "mac-address": "48:8F:5A:00:00:01",
        running: "true",
        disabled: "false",
        comment: "uplink",
        speed: "1Gbps",
      },
    ],
    addresses: [
      { address: "192.168.88.1/24", interface: "ether1", disabled: "false" },
    ],
    neighbors: [
      {
        identity: "Torre-Norte",
        address: "10.10.10.2",
        "mac-address": "48:8F:5A:00:00:99",
        interface: "ether1",
        platform: "MikroTik",
        board: "RB4011",
      },
    ],
  })

  assert.equal(snapshot.vendor, "mikrotik")
  assert.equal(snapshot.devices[0].hostname, "POP-Centro")
  assert.equal(snapshot.devices[0].serialNumber, "H8E012345")
  assert.equal(snapshot.devices[0].interfaces[0].addresses[0].address, "192.168.88.1")
  assert.equal(snapshot.devices[1].origin, "neighbor")
  assert.equal(snapshot.links.length, 1)
  assert.equal(snapshot.links[0].fromInterfaceName, "ether1")
})

test("protocolo RouterOS encode/decode roundtrip", () => {
  const encoded = encodeSentence(["/login", "=name=admin", "=password=secret"])
  const decoded = decodeSentences(Buffer.concat([encoded, Buffer.alloc(0)]))
  assert.equal(decoded.sentences.length, 1)
  assert.equal(decoded.sentences[0].attributes.name, "admin")
  assert.equal(decoded.sentences[0].attributes.password, "secret")
})

test("registry deja conectores futuros sin cambiar el runner", () => {
  assert.throws(
    () => getNetworkConnector({ vendor: "ubiquiti", targetId: "t", siteId: null }),
    ConnectorError
  )
  const mikrotik = getNetworkConnector({
    vendor: "mikrotik",
    targetId: "t",
    siteId: null,
  })
  assert.equal(mikrotik.vendor, "mikrotik")
})

test("Activity y Audit reutilizan engines existentes", () => {
  assert.equal(isActivityAction(ACTIVITY_ACTIONS.DISCOVERY_COMPLETED), true)
  assert.equal(isActivityAction(ACTIVITY_ACTIONS.DISCOVERY_FAILED), true)
  assert.equal(AUDIT_ACTIONS.NETWORK_DISCOVERY_COMPLETED, "NETWORK_DISCOVERY_COMPLETED")
  assert.equal(AUDIT_ENTITY_TYPES.NETWORK_DEVICE, "network_device")
  assert.equal(AUDIT_ENTITY_TYPES.NETWORK_AGENT_JOB, "network_agent_job")
})

test("el payload persistido del job no guarda password", () => {
  const jobsRoute = read("app/api/network/jobs/route.ts")
  assert.match(jobsRoute, /targetId: target.id/)
  assert.match(jobsRoute, /host: target.host/)
  assert.doesNotMatch(jobsRoute, /password/)
  assert.doesNotMatch(jobsRoute, /username/)
})
