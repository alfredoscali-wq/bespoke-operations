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
import {
  NETWORK_DISCOVERY_TRANSPORT_OPTIONS,
  networkDiscoveryTransportPayload,
} from "../lib/network/labels.ts"
import {
  buildArpIpByMac,
  canonicalMacAddress,
  resolveObservedManagementIp,
} from "../lib/network/discovery/arp-enrichment.ts"
import { buildDeviceFingerprint, normalizeMacAddress } from "../lib/network/discovery/fingerprint.ts"
import {
  NETWORK_DISCOVERY_JOB_POLL_MS,
  hasNetworkDiscoveryJobInflight,
  isNetworkDiscoveryJobInflight,
  targetHasNetworkDiscoveryJobInflight,
} from "../lib/network/discovery/job-poll.ts"
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
    assert.equal(ok.draft.protocol, "api")
    assert.equal(ok.draft.port, defaultNetworkTargetPort("api"))
    assert.equal(ok.draft.port, 8728)
    assert.equal(ok.draft.password, "secret")
  }

  const ssl = validateNetworkDiscoveryTargetDraft({
    agentId: "agent-1",
    name: "ABNet Core",
    vendor: "mikrotik",
    host: "177.53.120.11",
    protocol: "api",
    port: 8729,
    username: "bespoke-api",
    password: "secret",
  })
  assert.equal(ssl.ok, true)
  if (ssl.ok) {
    assert.equal(ssl.draft.protocol, "api")
    assert.equal(ssl.draft.port, 8729)
  }

  const apiSslProtocol = validateNetworkDiscoveryTargetDraft({
    agentId: "agent-1",
    name: "ABNet Core",
    vendor: "mikrotik",
    host: "177.53.120.11",
    protocol: "api-ssl",
    port: 8729,
    username: "bespoke-api",
    password: "secret",
  })
  assert.equal(apiSslProtocol.ok, false)
})

test("el selector de Discovery mapea SSL 8729 a protocol api sin api-ssl", () => {
  const plain = networkDiscoveryTransportPayload("api")
  assert.deepEqual(plain, { protocol: "api", port: 8728 })

  const ssl = networkDiscoveryTransportPayload("api-8729")
  assert.deepEqual(ssl, { protocol: "api", port: 8729 })
  assert.notEqual(ssl.protocol, "api-ssl")

  const rest = networkDiscoveryTransportPayload("rest")
  assert.deepEqual(rest, { protocol: "rest", port: 443 })

  for (const option of NETWORK_DISCOVERY_TRANSPORT_OPTIONS) {
    assert.notEqual(option.protocol, "api-ssl")
    const payload = networkDiscoveryTransportPayload(option.value)
    assert.notEqual(payload.protocol, "api-ssl")
  }

  const ui = read("components/network/network-discovery-screen.tsx")
  const labels = read("lib/network/labels.ts")
  assert.match(labels, /API RouterOS SSL \(8729\)/)
  assert.match(ui, /NETWORK_DISCOVERY_TRANSPORT_OPTIONS/)
  assert.match(ui, /networkDiscoveryTransportPayload/)
  assert.match(ui, /protocol,\r?\n\s*port/)
  assert.doesNotMatch(ui, /protocol:\s*["']api-ssl["']/)
  assert.doesNotMatch(labels, /protocol:\s*["']api-ssl["']/)
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

test("ARP enriquece IP de neighbors sin address y no crea devices extra", () => {
  const snapshot = mapMikrotikFactsToSnapshot({
    host: "177.53.120.11",
    targetId: "target-malagueno",
    siteId: null,
    identity: { name: "RB3011 - Core Malagueno" },
    resource: { version: "6.48.6", "board-name": "RB3011UiAS", platform: "MikroTik" },
    routerboard: { model: "RB3011UiAS", "serial-number": "CORE1" },
    interfaces: [
      {
        name: "ether3",
        type: "ether",
        "mac-address": "48:8F:5A:00:00:03",
        running: "true",
        disabled: "false",
        comment: "LAN NETPOWER",
      },
    ],
    addresses: [
      { address: "177.53.120.11/24", interface: "ether1 - WAN", disabled: "false" },
    ],
    neighbors: [
      {
        identity: "Humberto lara",
        address: "10.168.1.32",
        "mac-address": "AA:BB:CC:11:22:32",
        interface: "vlan211",
      },
      {
        identity: "AS 5",
        "mac-address": "2C:C8:1B:CE:DF:DE",
        interface: "ether3",
      },
      {
        identity: "AS 7",
        "mac-address": "CC:2D:E0:0A:23:E0",
        interface: "ether3",
      },
      {
        identity: "Sin ARP",
        "mac-address": "00:11:22:33:44:55",
        interface: "ether3",
      },
      {
        identity: "ARP ambiguo",
        "mac-address": "AA:AA:AA:AA:AA:01",
        interface: "ether3",
      },
    ],
    arp: [
      {
        address: "10.100.101.11",
        "mac-address": "2c:c8:1b:ce:df:de",
        complete: "true",
      },
      {
        address: "10.100.101.13",
        "mac-address": "CC-2D-E0-0A-23-E0",
        complete: "true",
      },
      {
        address: "10.9.9.9",
        "mac-address": "DE:AD:BE:EF:00:01",
        complete: "true",
      },
      {
        address: "10.1.1.1",
        "mac-address": "AA:AA:AA:AA:AA:01",
        complete: "true",
      },
      {
        address: "10.1.1.2",
        "mac-address": "AA:AA:AA:AA:AA:01",
        complete: "true",
      },
    ],
  })

  const byName = Object.fromEntries(
    snapshot.devices.map((device) => [device.hostname, device])
  )
  assert.equal(snapshot.devices.length, 6)
  assert.equal(byName["Humberto lara"].managementIp, "10.168.1.32")
  assert.equal(byName["Humberto lara"].managementIpSource, "neighbor")
  assert.equal(byName["AS 5"].managementIp, "10.100.101.11")
  assert.equal(byName["AS 5"].managementIpSource, "arp")
  assert.equal(byName["AS 5"].macAddress, "2C:C8:1B:CE:DF:DE")
  assert.equal(byName["AS 7"].managementIp, "10.100.101.13")
  assert.equal(byName["AS 7"].managementIpSource, "arp")
  assert.equal(byName["Sin ARP"].managementIp, null)
  assert.equal(byName["Sin ARP"].managementIpSource, null)
  assert.equal(byName["ARP ambiguo"].managementIp, null)
  assert.equal(byName["ARP ambiguo"].managementIpSource, null)
  assert.equal(
    snapshot.devices.some((device) => device.managementIp === "10.9.9.9"),
    false
  )
  assert.equal(
    snapshot.devices.some((device) => device.macAddress === "DE:AD:BE:EF:00:01"),
    false
  )
  assert.equal(
    snapshot.links.find((link) => link.toLocalKey.includes("2c:c8:1b:ce:df:de"))
      ?.fromInterfaceName,
    "ether3"
  )

  const connector = read("network-agent/src/connectors/mikrotik/index.ts")
  const rest = read("network-agent/src/connectors/mikrotik/rest-client.ts")
  const mapper = read("network-agent/src/connectors/mikrotik/map-discovery.ts")
  const persist = read("lib/network/devices/queries.ts")
  assert.match(connector, /\/ip\/arp\/print/)
  assert.match(rest, /\/rest\/ip\/arp/)
  assert.match(mapper, /buildArpIpByMac/)
  assert.match(persist, /management_ip: input\.device\.managementIp/)
  assert.doesNotMatch(persist, /from\("network_arp"\)/)
  assert.doesNotMatch(read("lib/network/discovery/interface-scope.ts"), /buildArpIpByMac/)
  assert.doesNotMatch(read("lib/network/discovery/observations.ts"), /buildArpIpByMac/)
  assert.doesNotMatch(read("lib/network/discovery/interface-match.ts"), /buildArpIpByMac/)
})

test("ARP ambiguo para la misma MAC no elige IP arbitraria", () => {
  assert.equal(
    canonicalMacAddress("2C:C8:1B:CE:DF:DE"),
    canonicalMacAddress("2c-c8-1b-ce-df-de")
  )
  const arpIpByMac = buildArpIpByMac([
    { macAddress: "AA:AA:AA:AA:AA:01", address: "10.1.1.1", complete: "true" },
    { macAddress: "aa:aa:aa:aa:aa:01", address: "10.1.1.2", complete: "true" },
    { macAddress: "BB:BB:BB:BB:BB:02", address: "10.2.2.2", complete: "true" },
    { macAddress: "BB:BB:BB:BB:BB:02", address: "10.2.2.2", complete: "true" },
  ])
  assert.equal(arpIpByMac.has("aa:aa:aa:aa:aa:01"), false)
  assert.equal(arpIpByMac.get("bb:bb:bb:bb:bb:02"), "10.2.2.2")

  const neighborWins = resolveObservedManagementIp({
    neighborIp: "10.168.1.32",
    neighborMac: "AA:BB:CC:11:22:32",
    arpIpByMac: new Map([["aa:bb:cc:11:22:32", "10.9.9.9"]]),
  })
  assert.equal(neighborWins.managementIp, "10.168.1.32")
  assert.equal(neighborWins.source, "neighbor")

  const fromArp = resolveObservedManagementIp({
    neighborIp: null,
    neighborMac: "2C:C8:1B:CE:DF:DE",
    arpIpByMac: new Map([["2c:c8:1b:ce:df:de", "10.100.101.11"]]),
  })
  assert.equal(fromArp.managementIp, "10.100.101.11")
  assert.equal(fromArp.source, "arp")

  const missing = resolveObservedManagementIp({
    neighborIp: null,
    neighborMac: "00:11:22:33:44:55",
    arpIpByMac,
  })
  assert.equal(missing.managementIp, null)
  assert.equal(missing.source, null)
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

test("Discovery hace polling GET mientras hay jobs pending/running y se detiene al terminar", () => {
  assert.equal(NETWORK_DISCOVERY_JOB_POLL_MS, 2_000)
  assert.equal(hasNetworkDiscoveryJobInflight([]), false)
  assert.equal(hasNetworkDiscoveryJobInflight([{ status: "completed" }]), false)
  assert.equal(hasNetworkDiscoveryJobInflight([{ status: "failed" }]), false)
  assert.equal(hasNetworkDiscoveryJobInflight([{ status: "cancelled" }]), false)
  assert.equal(hasNetworkDiscoveryJobInflight([{ status: "pending" }]), true)
  assert.equal(hasNetworkDiscoveryJobInflight([{ status: "running" }]), true)
  assert.equal(hasNetworkDiscoveryJobInflight([{ status: "dispatched" }]), true)
  assert.equal(isNetworkDiscoveryJobInflight("completed"), false)
  assert.equal(isNetworkDiscoveryJobInflight("failed"), false)

  const jobs = [
    { status: "pending", payload: { targetId: "t-1" } },
    { status: "completed", payload: { targetId: "t-2" } },
  ]
  assert.equal(targetHasNetworkDiscoveryJobInflight(jobs, "t-1"), true)
  assert.equal(targetHasNetworkDiscoveryJobInflight(jobs, "t-2"), false)

  const ui = read("components/network/network-discovery-screen.tsx")
  assert.match(ui, /NETWORK_DISCOVERY_JOB_POLL_MS/)
  assert.match(ui, /hasNetworkDiscoveryJobInflight/)
  assert.match(ui, /setInterval/)
  assert.match(ui, /clearInterval/)
  assert.match(ui, /jobsRequestInFlight/)
  assert.match(ui, /void refreshJobs\(\)/)

  const refreshJobs = ui.slice(
    ui.indexOf("const refreshJobs"),
    ui.indexOf("const load")
  )
  assert.match(refreshJobs, /fetch\("\/api\/network\/jobs"\)/)
  assert.doesNotMatch(refreshJobs, /method:\s*["']POST["']/)
  assert.doesNotMatch(refreshJobs, /JSON\.stringify\(\{\s*targetId/)
  assert.match(ui, /nextDiscoveryObservationState/)
  assert.match(ui, /latestObservations/)
  assert.match(ui, /setLatestObservations\(next\.latest\)/)
  assert.match(ui, /targetHasNetworkDiscoveryJobInflight\(jobs, target\.id\)/)
  assert.match(ui, /if \(!shouldPollJobs\) return undefined/)
  assert.equal((ui.match(/setInterval/g) ?? []).length, 1)
  assert.equal((ui.match(/clearInterval/g) ?? []).length, 1)
})
