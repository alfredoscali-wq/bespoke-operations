import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildManagedNetworkDeviceOrFilter,
  isManagedNetworkDevice,
  selectManagedNetworkDevices,
} from "../lib/network/devices/managed.ts"
import { formatNetworkTimestamp } from "../lib/network/labels.ts"
import { tallyManagedMonitoringSummary } from "../lib/network/monitoring/summary-tally.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function functionSource(source, name) {
  const patterns = [
    `export async function ${name}`,
    `export function ${name}`,
    `async function ${name}`,
  ]
  let start = -1
  for (const pattern of patterns) {
    start = source.indexOf(pattern)
    if (start !== -1) break
  }
  assert.notEqual(start, -1, `no se encontró ${name}`)
  const from = source.slice(start)
  const cuts = [
    from.indexOf("\nexport async function ", 1),
    from.indexOf("\nexport function ", 1),
    from.indexOf("\nasync function ", 1),
  ].filter((index) => index !== -1)
  const next = cuts.length === 0 ? -1 : Math.min(...cuts)
  return next === -1 ? from : from.slice(0, next)
}

const companyA = "company-a"
const companyB = "company-b"
const agentA = "agent-a"
const agentB = "agent-b"

const coreLab = {
  companyId: companyA,
  agentId: agentA,
  managementIp: "192.168.56.2",
  origin: "discovery",
}
const nodoNorte = {
  companyId: companyA,
  agentId: agentA,
  managementIp: "10.10.1.2",
  origin: "discovery",
}
const neighbor11 = {
  companyId: companyA,
  agentId: agentA,
  managementIp: "10.10.1.1",
  origin: "neighbor",
}
const targetCore = {
  companyId: companyA,
  agentId: agentA,
  host: "192.168.56.2",
}
const targetNorte = {
  companyId: companyA,
  agentId: agentA,
  host: "10.10.1.2",
}

test("1: device con target coincidente aparece en lista", () => {
  const listed = selectManagedNetworkDevices(
    [coreLab, neighbor11],
    [targetCore, targetNorte]
  )
  assert.equal(listed.includes(coreLab), true)
})

test("2: device sin target coincidente no aparece", () => {
  const listed = selectManagedNetworkDevices([nodoNorte], [targetCore])
  assert.equal(listed.includes(nodoNorte), false)
})

test("3: neighbor origin=neighbor sin target no aparece", () => {
  const listed = selectManagedNetworkDevices([neighbor11], [targetCore, targetNorte])
  assert.equal(listed.includes(neighbor11), false)
  assert.equal(isManagedNetworkDevice(neighbor11, targetNorte), false)
})

test("4: neighbor con target coincidente sí aparece", () => {
  const neighborTarget = {
    companyId: companyA,
    agentId: agentA,
    host: "10.10.1.1",
  }
  assert.equal(isManagedNetworkDevice(neighbor11, neighborTarget), true)
  const listed = selectManagedNetworkDevices([neighbor11], [neighborTarget])
  assert.deepEqual(listed, [neighbor11])
})

test("5: diferente company_id no aparece", () => {
  const otherCompanyTarget = { ...targetCore, companyId: companyB }
  assert.equal(isManagedNetworkDevice(coreLab, otherCompanyTarget), false)
})

test("6: diferente agent_id no aparece", () => {
  const otherAgentTarget = { ...targetCore, agentId: agentB }
  assert.equal(isManagedNetworkDevice(coreLab, otherAgentTarget), false)
})

test("7: host y management_ip con espacios matchean por btrim", () => {
  const paddedDevice = {
    companyId: companyA,
    agentId: agentA,
    managementIp: "  192.168.56.2  ",
    origin: "discovery",
  }
  const paddedTarget = {
    companyId: companyA,
    agentId: agentA,
    host: " 192.168.56.2 ",
  }
  assert.equal(isManagedNetworkDevice(paddedDevice, paddedTarget), true)
  assert.equal(isManagedNetworkDevice(paddedDevice, targetCore), true)
})

test("8: múltiples targets coincidentes no duplican el device", () => {
  const listed = selectManagedNetworkDevices(
    [coreLab],
    [targetCore, { ...targetCore }, targetCore]
  )
  assert.equal(listed.length, 1)
  assert.equal(listed[0], coreLab)

  const filter = buildManagedNetworkDeviceOrFilter([
    { agent_id: agentA, host: "192.168.56.2" },
    { agent_id: agentA, host: " 192.168.56.2 " },
    { agent_id: agentA, host: "192.168.56.2" },
  ])
  assert.equal(filter, `and(agent_id.eq.${agentA},management_ip.eq.192.168.56.2)`)
})

test("9: la lista sigue aplicando el status operativo existente", () => {
  const list = functionSource(
    read("lib/network/devices/queries.ts"),
    "listNetworkDevices"
  )
  assert.match(list, /listNetworkDeviceOperationalStatuses/)
  assert.match(list, /operationalStatus/)
  assert.match(list, /displayMonitoringStatus|online|offline|degraded/)
  assert.doesNotMatch(list, /NETWORK_MONITORING_STATUS_TTL_MS/)
  assert.match(
    read("lib/network/monitoring/queries.ts"),
    /displayMonitoringStatus\(row\.status, row\.last_poll_at\)/
  )
})

test("10: Discovery no fue modificado; vecinos no se eliminan", () => {
  const list = functionSource(
    read("lib/network/devices/queries.ts"),
    "listNetworkDevices"
  )
  const detail = functionSource(
    read("lib/network/devices/queries.ts"),
    "getNetworkDeviceDetail"
  )
  const persist = functionSource(
    read("lib/network/devices/queries.ts"),
    "persistDiscoverySnapshot"
  )

  assert.match(list, /network_discovery_targets/)
  assert.match(list, /buildManagedNetworkDeviceOrFilter/)
  assert.match(list, /\.or\(managedFilter\)/)
  assert.doesNotMatch(list, /origin/)
  assert.doesNotMatch(list, /deleted_at: now/)
  assert.doesNotMatch(detail, /buildManagedNetworkDeviceOrFilter/)
  assert.doesNotMatch(detail, /network_discovery_targets/)
  assert.match(persist, /origin/)
  assert.match(persist, /upsertNetworkDevice/)
  assert.doesNotMatch(read("network-agent/src/connectors/mikrotik/index.ts"), /listNetworkDevices/)
})

test("Último visto usa last_poll_at de Monitoring, no Discovery ni last_success_at", () => {
  const screen = read("components/network/network-devices-screen.tsx")
  const list = functionSource(
    read("lib/network/devices/queries.ts"),
    "listNetworkDevices"
  )
  const statuses = functionSource(
    read("lib/network/monitoring/queries.ts"),
    "listNetworkDeviceOperationalStatuses"
  )
  const detailScreen = read("components/network/network-device-detail-screen.tsx")

  assert.match(screen, /formatNetworkTimestamp\(device\.lastPollAt\)/)
  assert.doesNotMatch(screen, /device\.lastSeenAt/)
  assert.doesNotMatch(screen, /last_success_at|lastSuccessAt/)
  assert.match(list, /lastPollAt: operational\?\.lastPollAt \?\? null/)
  assert.doesNotMatch(list, /lastPollAt: .*last_seen_at/)
  assert.doesNotMatch(list, /last_success_at/)
  assert.match(statuses, /lastPollAt: row\.last_poll_at/)
  assert.doesNotMatch(statuses, /last_success_at/)
  assert.match(detailScreen, /formatNetworkLastSeen\(device\.lastSeenAt\)/)
})

test("NULL last_poll_at no inventa fecha", () => {
  assert.equal(formatNetworkTimestamp(null), "—")
  assert.equal(formatNetworkTimestamp(undefined), "—")
  assert.equal(formatNetworkTimestamp(""), "—")
  assert.notEqual(formatNetworkTimestamp(null), new Date().toISOString())
})

test("Resumen cuenta solo dispositivos administrados", () => {
  const companyId = "company-a"
  const agentA = "agent-a"
  const inventory = [
    { id: "core", companyId, agentId: agentA, managementIp: "192.168.56.2" },
    { id: "norte", companyId, agentId: agentA, managementIp: "10.10.1.2" },
    { id: "sur", companyId, agentId: agentA, managementIp: "10.10.2.2" },
    { id: "n11", companyId, agentId: agentA, managementIp: "10.10.1.1" },
    { id: "n21", companyId, agentId: agentA, managementIp: "10.10.2.1" },
  ]
  const targets = [
    { companyId, agentId: agentA, host: "192.168.56.2" },
    { companyId, agentId: agentA, host: "10.10.1.2" },
    { companyId, agentId: agentA, host: "10.10.2.2" },
  ]
  const managed = selectManagedNetworkDevices(inventory, targets)
  assert.equal(inventory.length, 5)
  assert.equal(managed.length, 3)
  assert.deepEqual(
    managed.map((item) => item.id).sort(),
    ["core", "norte", "sur"]
  )

  const now = Date.parse("2026-08-30T16:10:00.000Z")
  const recent = new Date(now - 60_000).toISOString()
  const kpis = tallyManagedMonitoringSummary({
    managedDeviceIds: new Set(managed.map((item) => item.id)),
    statusRows: [
      { device_id: "core", status: "online", last_poll_at: recent },
      { device_id: "norte", status: "online", last_poll_at: recent },
      { device_id: "sur", status: "online", last_poll_at: recent },
      { device_id: "n11", status: "online", last_poll_at: recent },
      { device_id: "n21", status: "unknown", last_poll_at: recent },
    ],
    interfaceRows: [
      { device_id: "core", status: "up" },
      { device_id: "n11", status: "up" },
      { device_id: "n21", status: "down" },
    ],
    now,
  })
  assert.equal(kpis.devicesOnline, 3)
  assert.equal(kpis.devicesOffline, 0)
  assert.equal(kpis.devicesUnknown, 0)
  assert.equal(kpis.interfacesUp, 1)
  assert.equal(kpis.interfacesDown, 0)

  const summary = functionSource(
    read("lib/network/agents/queries.ts"),
    "getNetworkHomeSummary"
  )
  assert.match(summary, /selectManagedNetworkDevices/)
  assert.match(summary, /deviceCount: managed\.length/)
  assert.doesNotMatch(summary, /devices\.count/)
  assert.doesNotMatch(summary, /origin/)

  const count = functionSource(
    read("lib/network/monitoring/queries.ts"),
    "countNetworkMonitoringSummary"
  )
  assert.match(count, /tallyManagedMonitoringSummary/)
  assert.match(count, /device_id/)

  const status = read("lib/network/monitoring/status.ts")
  assert.match(status, /NETWORK_MONITORING_STATUS_TTL_MS/)
  assert.match(status, /export function displayMonitoringStatus/)

  const list = functionSource(
    read("lib/network/devices/queries.ts"),
    "listNetworkDevices"
  )
  assert.match(list, /buildManagedNetworkDeviceOrFilter/)
  assert.doesNotMatch(
    read("lib/network/discovery/parse-snapshot.ts"),
    /getNetworkHomeSummary|tallyManagedMonitoringSummary/
  )
  assert.match(
    read("lib/network/topology/queries.ts"),
    /isManagedNetworkDevice/
  )
})

