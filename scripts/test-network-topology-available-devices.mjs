/**
 * Dispositivos disponibles para la topología curada.
 * Salen de network_devices menos placements activos. Los links no filtran.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  collectDiscoveryJobDeviceIds,
  curatedTopologyDeviceTypeLabel,
  selectAvailableCuratedTopologyDevices,
} from "../lib/network/topology/available-devices.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "company-a"
const OTHER = "company-b"
const CORE = "core"
const POWERBOX = "powerbox"
const AS5 = "as5"
const AS6 = "as6"
const AS7 = "as7"

function device(id, overrides = {}) {
  return {
    id,
    companyId: COMPANY,
    hostname: id,
    managementIp: null,
    deviceType: "router",
    model: null,
    status: "online",
    deletedAt: null,
    ...overrides,
  }
}

const devices = [
  device(CORE, { hostname: "RB3011 Core Malagueño", managementIp: "10.0.0.1" }),
  device(POWERBOX, { hostname: "PowerBox", managementIp: "10.0.0.2" }),
  device(AS5, { hostname: "AS5", managementIp: "10.0.0.5" }),
  device(AS6, { hostname: "AS6" }),
  device(AS7, { hostname: "AS7", managementIp: "10.0.0.7" }),
  device("foreign", { companyId: OTHER, hostname: "Core B" }),
  device("gone", { hostname: "Eliminado", deletedAt: "2026-01-01T00:00:00.000Z" }),
]

function placement(deviceId, overrides = {}) {
  return {
    companyId: COMPANY,
    deviceId,
    deletedAt: null,
    ...overrides,
  }
}

function ids(result) {
  return result.map((item) => item.id)
}

function select(input) {
  return selectAvailableCuratedTopologyDevices({
    companyId: COMPANY,
    coreDeviceId: CORE,
    discoveredDeviceIds: [CORE, POWERBOX, AS5, AS6, AS7, "bare", "ip-only", "named"],
    placements: [],
    ...input,
  })
}

test("1. descubiertos sin placement aparecen bajo el Core", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices,
    placements: [placement(CORE)],
  })
  assert.deepEqual(ids(available), [AS5, AS6, AS7, POWERBOX])
  assert.equal(available.some((item) => item.id === CORE), false)
  assert.equal(available.find((item) => item.id === AS7).managementIp, "10.0.0.7")
})

test("2. un hijo ya colocado deja de estar disponible", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices,
    placements: [placement(CORE), placement(POWERBOX)],
  })
  assert.deepEqual(ids(available), [AS5, AS6, AS7])
})

test("3. los nietos colocados no aparecen al agregar hijos de PowerBox", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: POWERBOX,
    devices,
    placements: [
      placement(CORE),
      placement(POWERBOX),
      placement(AS5),
      placement(AS6),
    ],
  })
  assert.deepEqual(ids(available), [AS7])
})

test("4. un network_link no es requisito ni filtro", () => {
  const linked = device(AS5, { hostname: "AS5", hasNetworkLink: true })
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices: [device(CORE), linked],
    placements: [placement(CORE)],
  })
  assert.deepEqual(ids(available), [AS5])
})

test("5. un dispositivo sin network_link sigue disponible", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices: [device(CORE), device(AS5, { hasNetworkLink: false })],
    placements: [placement(CORE)],
  })
  assert.deepEqual(ids(available), [AS5])
})

test("6. un placement eliminado vuelve a dejar el dispositivo disponible", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices,
    placements: [
      placement(CORE),
      placement(AS5, { deletedAt: "2026-02-01T00:00:00.000Z" }),
    ],
  })
  assert.equal(available.some((item) => item.id === AS5), true)
})

test("7. un dispositivo de otra empresa no aparece", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices,
    placements: [placement(CORE)],
  })
  assert.equal(available.some((item) => item.companyId === OTHER || item.id === "foreign"), false)
  assert.equal(available.some((item) => item.id === "gone"), false)
})

test("8. el padre seleccionado no puede ser hijo de sí mismo", () => {
  const available = select({
    companyId: COMPANY,
    parentDeviceId: CORE,
    devices: [device(CORE), device(AS5)],
    placements: [],
  })
  assert.deepEqual(ids(available), [AS5])
})

test("el label usa hostname, luego IP y luego id", () => {
  const available = select({
    companyId: COMPANY,
    devices: [
      device("bare", { hostname: "  ", managementIp: "  " }),
      device("ip-only", { hostname: "", managementIp: "192.168.1.8" }),
      device("named", { hostname: "Nodo", managementIp: "192.168.1.9" }),
    ],
    placements: [],
  })
  assert.deepEqual(
    available.map((item) => item.hostname?.trim() || item.managementIp?.trim() || item.id),
    ["192.168.1.8", "bare", "Nodo"]
  )
})

const MALAGUENO = "core-malagueno"
const RIO = "core-rio"
const JOB = {
  id: "job-malagueno",
  agentId: "agent-1",
  startedAt: "2026-03-01T10:00:00.000Z",
  completedAt: "2026-03-01T10:05:00.000Z",
  targetId: "target-malagueno",
  targetName: "Malagueño",
  targetHost: "10.1.0.1",
}

test("1b. Malagueño no incluye lo descubierto solo por Río Segundo", () => {
  const available = select({
    coreDeviceId: MALAGUENO,
    parentDeviceId: MALAGUENO,
    discoveredDeviceIds: [MALAGUENO, POWERBOX, AS5, AS6, AS7],
    devices: [
      device(MALAGUENO, { hostname: "Core Malagueño" }),
      device(POWERBOX),
      device(AS5),
      device(AS6),
      device(AS7),
      device(RIO, { hostname: "Core Río Segundo" }),
      device("switch-rio", { hostname: "Switch Río" }),
    ],
    placements: [placement(MALAGUENO)],
  })
  assert.deepEqual(ids(available), [AS5, AS6, AS7, POWERBOX])
})

test("2b. Río Segundo no incluye lo exclusivo de Malagueño", () => {
  const available = select({
    coreDeviceId: RIO,
    parentDeviceId: RIO,
    discoveredDeviceIds: [RIO, "switch-rio"],
    devices: [
      device(MALAGUENO, { hostname: "Core Malagueño" }),
      device(POWERBOX),
      device(RIO, { hostname: "Core Río Segundo" }),
      device("switch-rio", { hostname: "Switch Río" }),
    ],
    placements: [placement(RIO)],
  })
  assert.deepEqual(ids(available), ["switch-rio"])
})

test("3b. el Discovery encuentra un dispositivo aunque no tenga network_link", () => {
  const found = collectDiscoveryJobDeviceIds({
    job: JOB,
    devices: [
      { id: AS5, lastSeenAt: "2026-03-01T10:02:00.000Z" },
      { id: "later", lastSeenAt: "2026-03-01T11:00:00.000Z" },
    ],
    links: [],
  })
  assert.equal(found.has(AS5), true)
  assert.equal(found.has("later"), false)
})

test("4b. un dispositivo con link dentro del Discovery también entra", () => {
  const found = collectDiscoveryJobDeviceIds({
    job: JOB,
    devices: [{ id: AS5, lastSeenAt: "2026-04-01T00:00:00.000Z" }],
    links: [
      {
        fromDeviceId: MALAGUENO,
        toDeviceId: AS5,
        lastSeenAt: "2026-03-01T10:01:00.000Z",
      },
    ],
  })
  assert.equal(found.has(AS5), true)
  assert.equal(found.has(MALAGUENO), true)
})

test("8. el tipo sale de modelo, fabricante o tipo de catálogo, no del estado", () => {
  assert.equal(
    curatedTopologyDeviceTypeLabel({
      model: "PowerBox",
      manufacturer: "MikroTik",
      deviceType: "other",
    }),
    "PowerBox"
  )
  assert.equal(
    curatedTopologyDeviceTypeLabel({
      model: "",
      manufacturer: "MikroTik",
      deviceType: "unknown",
    }),
    "MikroTik"
  )
  assert.equal(
    curatedTopologyDeviceTypeLabel({ deviceType: "cpe", status: "unknown" }),
    "CPE"
  )
  assert.equal(
    curatedTopologyDeviceTypeLabel({ deviceType: "switch" }),
    "Switch"
  )
  assert.notEqual(
    curatedTopologyDeviceTypeLabel({ model: "PowerBox", deviceType: "other" }),
    "Desconocido"
  )
})

test("9. sin tipo en Discovery ni en el dispositivo queda Desconocido", () => {
  assert.equal(
    curatedTopologyDeviceTypeLabel({
      deviceType: "other",
      manufacturer: " ",
      model: null,
    }),
    "Desconocido"
  )
})

test("la consulta usa el último Discovery del Core y no el inventario completo", () => {
  const queries = read("lib/network/topology/queries.ts")
  const listFn = queries.slice(
    queries.indexOf("export async function listAvailableCuratedTopologyDevices"),
    queries.indexOf("export async function getNetworkTopologyGraph")
  )
  const editor = read("components/network/curated-topology-editor.tsx")
  const route = read("app/api/network/topology/available-devices/route.ts")
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(listFn, /pickLatestCompletedDiscoveryJobForTarget/)
  assert.match(listFn, /pickLatestCompletedDiscoveryJobForHost/)
  assert.match(listFn, /network_discovery_targets/)
  assert.match(listFn, /\.gte\("last_seen_at", job\.startedAt\)/)
  assert.match(listFn, /\.lte\("last_seen_at", job\.completedAt\)/)
  assert.match(listFn, /from\("network_topology_placements"\)/)
  assert.match(listFn, /\.eq\("company_id", companyId\)/)
  assert.doesNotMatch(listFn, /buildManagedNetworkDeviceOrFilter/)
  assert.match(route, /coreDeviceId/)
  assert.match(route, /auth\.companyId/)
  assert.match(editor, /coreDeviceId/)
  assert.match(editor, /typeLabel/)
  assert.match(screen, /coreDeviceId=\{activeCoreId\}/)
  assert.match(editor, /No hay dispositivos disponibles para agregar\./)
  assert.doesNotMatch(editor, /useNetworkDevicesQuery/)
  assert.match(read("lib/network/devices/queries.ts"), /buildManagedNetworkDeviceOrFilter/)
})
