/**
 * Discovery observations: classify WAN/LAN/VLAN/unknown without promoting neighbors.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"
import { classifyNetworkInterfaceScope } from "../lib/network/discovery/interface-scope.ts"
import { findMatchingNetworkInterfaceId } from "../lib/network/discovery/interface-match.ts"
import {
  buildNetworkDiscoveryObservationView,
  isOperationalTopologyDevice,
  listNetworkDiscoveryObservationItems,
  networkObservationGroupLabel,
  formatObservedInterfaceLabel,
  summarizeNetworkDiscoveryObservations,
} from "../lib/network/discovery/observations.ts"
import {
  filterDevicesSeenInDiscoveryJob,
  nextDiscoveryObservationState,
  pickLatestCompletedDiscoveryJob,
  withLatestDiscoveryJobMeta,
} from "../lib/network/discovery/latest-run.ts"
import { buildCanonicalTopologyGraph } from "../lib/network/topology/graph.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "co-abnet"
const AGENT = "ag-abnet"
const CORE = "dev-core"
const PILAR = "dev-pilar"
const CPE = "dev-cpe"
const UNKNOWN = "dev-unknown"

const targets = [{ companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" }]

const interfaces = [
  {
    id: "if-wan",
    deviceId: CORE,
    name: "ether1",
    description: "WAN",
    interfaceType: "ether",
  },
  {
    id: "if-vlan101",
    deviceId: CORE,
    name: "vlan101",
    description: "Bridge LAN - vlan101",
    interfaceType: "vlan",
  },
  {
    id: "if-ether8",
    deviceId: CORE,
    name: "ether8",
    description: null,
    interfaceType: "ether",
  },
]

const devices = [
  {
    id: CORE,
    companyId: COMPANY,
    agentId: AGENT,
    managementIp: "177.53.120.11",
  },
  {
    id: PILAR,
    companyId: COMPANY,
    agentId: AGENT,
    managementIp: "10.20.0.1",
  },
  {
    id: CPE,
    companyId: COMPANY,
    agentId: AGENT,
    managementIp: "10.101.0.50",
  },
  {
    id: UNKNOWN,
    companyId: COMPANY,
    agentId: AGENT,
    managementIp: "10.9.9.9",
  },
]

const links = [
  {
    fromDeviceId: CORE,
    toDeviceId: PILAR,
    fromInterfaceId: "if-wan",
    toInterfaceId: null,
  },
  {
    fromDeviceId: CORE,
    toDeviceId: CPE,
    fromInterfaceId: "if-vlan101",
    toInterfaceId: null,
  },
  {
    fromDeviceId: CORE,
    toDeviceId: UNKNOWN,
    fromInterfaceId: "if-ether8",
    toInterfaceId: null,
  },
]

test("ether1 sin comentario no es WAN; comentario WAN sí", () => {
  assert.equal(
    classifyNetworkInterfaceScope({
      name: "ether1",
      interfaceType: "ether",
      description: null,
    }),
    "unknown"
  )
  assert.equal(
    classifyNetworkInterfaceScope({
      name: "ether1",
      interfaceType: "ether",
      description: "WAN",
    }),
    "wan"
  )
})

test("vlan101 y Bridge LAN - vlan101 son LAN/VLAN", () => {
  assert.equal(
    classifyNetworkInterfaceScope({
      name: "vlan101",
      interfaceType: "vlan",
      description: "Bridge LAN - vlan101",
    }),
    "vlan"
  )
  assert.equal(
    classifyNetworkInterfaceScope({
      name: "Bridge LAN",
      interfaceType: "bridge",
      description: null,
    }),
    "lan"
  )
})

test("etherN,bridgeN es LAN; etherN solo no; WAN/uplink siguen WAN", () => {
  assert.equal(classifyNetworkInterfaceScope({ name: "ether2,bridge1" }), "lan")
  assert.equal(classifyNetworkInterfaceScope({ name: "ether3,bridge1" }), "lan")
  assert.equal(classifyNetworkInterfaceScope({ name: "ether4,bridge1" }), "lan")
  assert.equal(
    classifyNetworkInterfaceScope({
      name: "ether2",
      interfaceType: "ether",
      description: null,
    }),
    "unknown"
  )
  assert.equal(classifyNetworkInterfaceScope({ name: "ether1,WAN" }), "wan")
  assert.equal(classifyNetworkInterfaceScope({ name: "uplink" }), "wan")
  assert.equal(
    classifyNetworkInterfaceScope({
      name: "ether1,bridge1",
      relatedInterfaces: [
        { name: "ether1", interfaceType: "ether", description: "WAN" },
      ],
    }),
    "wan"
  )
  const source = read("lib/network/discovery/interface-scope.ts")
  assert.doesNotMatch(source, /AS5|AS6|AS7|AS 5/)
})

test("neighbor WAN se conserva observado y no se administra", () => {
  assert.equal(
    isManagedNetworkDevice(
      { companyId: COMPANY, agentId: AGENT, managementIp: "10.20.0.1" },
      targets[0]
    ),
    false
  )
  const summary = summarizeNetworkDiscoveryObservations({
    devices,
    targets,
    links,
    interfaces,
  })
  assert.equal(summary.total, 4)
  assert.equal(summary.core, 1)
  assert.equal(summary.wan, 1)
  assert.equal(summary.lanVlan, 1)
  assert.equal(summary.unknown, 1)
  assert.equal(isOperationalTopologyDevice({ kind: "neighbor" }), false)
})

test("neighbor vlan101 queda LAN/VLAN y se conserva", () => {
  const summary = summarizeNetworkDiscoveryObservations({
    devices: devices.filter((device) => device.id === CORE || device.id === CPE),
    targets,
    links: links.filter((link) => link.toDeviceId === CPE),
    interfaces,
  })
  assert.equal(summary.core, 1)
  assert.equal(summary.lanVlan, 1)
  assert.equal(summary.wan, 0)
  assert.equal(summary.unknown, 0)
  assert.equal(summary.total, 2)
})

test("neighbor con interfaz desconocida queda unknown y no se elimina ni administra", () => {
  const summary = summarizeNetworkDiscoveryObservations({
    devices: devices.filter((device) => device.id === CORE || device.id === UNKNOWN),
    targets,
    links: links.filter((link) => link.toDeviceId === UNKNOWN),
    interfaces,
  })
  assert.equal(summary.unknown, 1)
  assert.equal(summary.core, 1)
  assert.equal(
    isManagedNetworkDevice(
      { companyId: COMPANY, agentId: AGENT, managementIp: "10.9.9.9" },
      targets[0]
    ),
    false
  )
})

test("el Core origin discovery sigue administrado y en topología operativa", () => {
  assert.equal(
    isManagedNetworkDevice(
      { companyId: COMPANY, agentId: AGENT, managementIp: "177.53.120.11" },
      targets[0]
    ),
    true
  )
  assert.equal(isOperationalTopologyDevice({ kind: "managed" }), true)

  const graph = buildCanonicalTopologyGraph(
    [
      {
        id: CORE,
        companyId: COMPANY,
        agentId: AGENT,
        siteId: "site-malagueno",
        hostname: "RB3011 - Core Malagueño",
        managementIp: "177.53.120.11",
        deviceType: "router",
        origin: "discovery",
        kind: "managed",
        operationalStatus: "online",
        lastPollAt: null,
        interfaces: [],
      },
      {
        id: PILAR,
        companyId: COMPANY,
        agentId: AGENT,
        siteId: "site-malagueno",
        hostname: "Pilar",
        managementIp: "10.20.0.1",
        deviceType: "router",
        origin: "neighbor",
        kind: "neighbor",
        operationalStatus: null,
        lastPollAt: null,
        interfaces: [],
      },
      {
        id: CPE,
        companyId: COMPANY,
        agentId: AGENT,
        siteId: "site-malagueno",
        hostname: "Cliente Ejemplo",
        managementIp: "10.101.0.50",
        deviceType: "other",
        origin: "neighbor",
        kind: "neighbor",
        operationalStatus: null,
        lastPollAt: null,
        interfaces: [],
      },
    ],
    [
      {
        id: "l-wan",
        fromDeviceId: CORE,
        toDeviceId: PILAR,
        fromInterfaceName: "ether1",
        toInterfaceName: null,
        protocol: "mndp",
      },
      {
        id: "l-vlan",
        fromDeviceId: CORE,
        toDeviceId: CPE,
        fromInterfaceName: "vlan101",
        toInterfaceName: null,
        protocol: "mndp",
      },
    ]
  )

  assert.equal(graph.nodes.length, 1)
  assert.equal(graph.nodes[0].id, CORE)
  assert.equal(graph.nodes[0].kind, "managed")
  assert.equal(graph.edges.length, 0)
})

test("no se toca el Agent, TLS ni el connector MikroTik", () => {
  assert.doesNotMatch(
    read("network-agent/src/connectors/mikrotik/index.ts"),
    /classifyNetworkInterfaceScope|summarizeNetworkDiscoveryObservations/
  )
  assert.doesNotMatch(
    read("network-agent/src/connectors/mikrotik/api-client.ts"),
    /classifyNetworkInterfaceScope/
  )
  assert.doesNotMatch(
    read("network-agent/src/index.ts"),
    /classifyNetworkInterfaceScope/
  )
  assert.match(
    read("lib/network/discovery/observation-queries.ts"),
    /from\("network_devices"\)/
  )
  assert.match(
    read("lib/network/discovery/observation-queries.ts"),
    /hostname, mac_address, manufacturer, model, firmware_version, origin, last_seen_at/
  )
  assert.match(
    read("lib/network/discovery/observation-queries.ts"),
    /from_interface_id, from_interface_name, to_interface_id/
  )
  assert.doesNotMatch(
    read("lib/network/discovery/observation-queries.ts"),
    /\.delete\(/
  )
  assert.match(
    read("lib/network/discovery/observation-queries.ts"),
    /\.gte\("last_seen_at"/
  )
  assert.match(
    read("lib/network/discovery/observation-queries.ts"),
    /\.lte\("last_seen_at"/
  )
})

test("la bandeja lista las observaciones clasificadas sin promover Devices", () => {
  const detailedDevices = [
    {
      ...devices[0],
      hostname: "RB3011 - Core Malagueño",
      macAddress: "aa:bb:cc:00:00:01",
      manufacturer: "MikroTik",
      model: "RB3011UiAS",
      firmwareVersion: "6.48.6",
      origin: "discovery",
    },
    {
      ...devices[1],
      hostname: "RB1100x2 - Pilar",
      managementIp: "177.53.120.17",
      macAddress: "aa:bb:cc:00:00:02",
      manufacturer: "MikroTik",
      model: "RB1100x2",
      firmwareVersion: "6.49.8",
      origin: "neighbor",
    },
    {
      ...devices[2],
      hostname: "Humberto Lara",
      managementIp: "10.168.1.32",
      macAddress: "aa:bb:cc:00:00:03",
      manufacturer: "MikroTik",
      model: "hAP ac2",
      firmwareVersion: "6.48.6",
      origin: "neighbor",
    },
    {
      ...devices[3],
      hostname: "Neighbor ether8",
      managementIp: "10.9.9.9",
      macAddress: "aa:bb:cc:00:00:04",
      manufacturer: "MikroTik",
      model: "RB750",
      firmwareVersion: "6.48",
      origin: "neighbor",
    },
  ]
  const detailedLinks = links.map((link, index) => ({
    ...link,
    protocol: index === 0 ? "mndp" : "lldp",
  }))

  const view = buildNetworkDiscoveryObservationView({
    devices: detailedDevices,
    targets,
    links: detailedLinks,
    interfaces,
  })

  assert.equal(view.total, 4)
  assert.equal(view.core, 1)
  assert.equal(view.wan, 1)
  assert.equal(view.lanVlan, 1)
  assert.equal(view.unknown, 1)
  assert.equal(view.items.length, 4)
  assert.equal(view.items[0].scope, "core")
  assert.equal(view.items[0].hostname, "RB3011 - Core Malagueño")
  assert.equal(view.items[0].managementIp, "177.53.120.11")
  assert.equal(view.items[0].origin, "discovery")
  assert.equal(view.items[0].discoveredBy, null)

  const wan = view.items.find((item) => item.scope === "wan")
  assert.ok(wan)
  assert.equal(wan.hostname, "RB1100x2 - Pilar")
  assert.equal(wan.observedInterfaceName, "ether1")
  assert.equal(wan.observedInterfaceDescription, "WAN")
  assert.equal(wan.discoveredBy, "mndp")
  assert.equal(wan.origin, "neighbor")
  assert.equal(networkObservationGroupLabel("core"), "CORE")
  assert.equal(networkObservationGroupLabel(wan.scope), "WAN")
  assert.equal(
    formatObservedInterfaceLabel(
      wan.observedInterfaceName,
      wan.observedInterfaceDescription
    ),
    "ether1 · WAN"
  )
  assert.equal(
    formatObservedInterfaceLabel("ether1 - WAN", "WAN"),
    "ether1 - WAN"
  )

  const lan = view.items.find((item) => item.scope === "vlan")
  assert.ok(lan)
  assert.equal(lan.hostname, "Humberto Lara")
  assert.equal(lan.managementIp, "10.168.1.32")
  assert.equal(lan.observedInterfaceName, "vlan101")
  assert.equal(networkObservationGroupLabel(lan.scope), "LAN/VLAN")
  assert.equal(networkObservationGroupLabel("unknown"), "UNKNOWN")

  const unknown = view.items.find((item) => item.scope === "unknown")
  assert.ok(unknown)
  assert.equal(unknown.hostname, "Neighbor ether8")
  assert.equal(unknown.observedInterfaceName, "ether8")

  const items = listNetworkDiscoveryObservationItems({
    devices: detailedDevices,
    targets,
    links: detailedLinks,
    interfaces,
  })
  assert.equal(items.length, 4)
  assert.equal(
    isManagedNetworkDevice(
      {
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "177.53.120.17",
      },
      targets[0]
    ),
    false
  )
})

test("GET /api/network/jobs y Discovery leen observaciones persistidas", () => {
  const jobsRoute = read("app/api/network/jobs/route.ts")
  const ui = read("components/network/network-discovery-screen.tsx")
  assert.match(jobsRoute, /getNetworkDiscoveryObservationSets/)
  assert.match(jobsRoute, /latestObservations/)
  assert.match(jobsRoute, /historicalObservations/)
  assert.match(jobsRoute, /observations: historicalObservations/)
  assert.match(ui, /Último discovery/)
  assert.match(ui, /observados en esta corrida/)
  assert.match(ui, /Observaciones históricas/)
  assert.match(ui, /en inventario/)
  assert.match(ui, /Nombre \/ Identity/)
  assert.match(ui, /Interfaz donde fue observado/)
  assert.match(ui, /latestObservations\.items/)
  assert.match(ui, /nextDiscoveryObservationState/)
  assert.doesNotMatch(ui, /Total observado/)
  assert.doesNotMatch(ui, /Aceptar|Rechazar|Agregar manualmente/)
  assert.doesNotMatch(ui, /\/api\/network\/devices/)
})

const malaguenoIfaces = [
  { id: "if-wan", name: "ether1 - WAN" },
  { id: "if-vlan101", name: "Bridge LAN - vlan101" },
  { id: "if-vlan200", name: "Bridge LAN - vlan200 - Public" },
  { id: "if-vlan211", name: "Bridge LAN - vlan211 - Gestion CPE" },
  { id: "if-bridge", name: "Bridge - LAN" },
  { id: "if-ether2", name: "ether2" },
]

test("ether1 coincide de forma segura con ether1 - WAN", () => {
  assert.equal(
    findMatchingNetworkInterfaceId(malaguenoIfaces, "ether1"),
    "if-wan"
  )
  assert.equal(
    findMatchingNetworkInterfaceId(malaguenoIfaces, "ether1 - WAN"),
    "if-wan"
  )
})

test("vlan101 coincide de forma segura con Bridge LAN - vlan101", () => {
  assert.equal(
    findMatchingNetworkInterfaceId(malaguenoIfaces, "vlan101"),
    "if-vlan101"
  )
})

test("vlan211 coincide de forma segura con Bridge LAN - vlan211 - Gestion CPE", () => {
  assert.equal(
    findMatchingNetworkInterfaceId(malaguenoIfaces, "vlan211"),
    "if-vlan211"
  )
})

test("si hay varias candidatas el match queda null", () => {
  assert.equal(
    findMatchingNetworkInterfaceId(
      [
        { id: "if-a", name: "ether1 - WAN" },
        { id: "if-b", name: "ether1 - backup" },
      ],
      "ether1"
    ),
    null
  )
  assert.equal(findMatchingNetworkInterfaceId(malaguenoIfaces, "LAN"), null)
  assert.equal(findMatchingNetworkInterfaceId(malaguenoIfaces, "ether1foo"), null)
})

test("sin match conserva from_interface_name y no inventa interfaz", () => {
  const persist = read("lib/network/devices/queries.ts")
  const migration = read(
    "supabase/migrations/20261231000100_network_links_from_interface_name.sql"
  )
  assert.equal(findMatchingNetworkInterfaceId(malaguenoIfaces, "wlan3"), null)
  assert.match(persist, /from_interface_name: input.fromInterfaceName/)
  assert.match(persist, /findMatchingNetworkInterfaceId/)
  const linkLoop = persist.slice(
    persist.indexOf("for (const link of input.snapshot.links)"),
    persist.indexOf("async function upsertNetworkDevice")
  )
  assert.doesNotMatch(linkLoop, /upsertNetworkInterface/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS from_interface_name text/)
})

test("observation con interface_id null usa el nombre observado para UI y scope", () => {
  const view = buildNetworkDiscoveryObservationView({
    devices: [
      {
        id: CORE,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "177.53.120.11",
        hostname: "RB3011 - Core Malagueño",
        origin: "discovery",
      },
      {
        id: "dev-humberto",
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.168.1.32",
        hostname: "Humberto lara",
        origin: "neighbor",
      },
    ],
    targets,
    links: [
      {
        fromDeviceId: CORE,
        toDeviceId: "dev-humberto",
        fromInterfaceId: null,
        fromInterfaceName: "vlan211",
        toInterfaceId: null,
        protocol: "mndp",
      },
    ],
    interfaces: [
      {
        id: "if-vlan211",
        deviceId: CORE,
        name: "Bridge LAN - vlan211 - Gestion CPE",
        description: null,
        interfaceType: "vlan",
      },
    ],
  })

  assert.equal(view.total, 2)
  assert.equal(view.core, 1)
  assert.equal(view.lanVlan, 1)
  assert.equal(view.unknown, 0)
  const humberto = view.items.find((item) => item.id === "dev-humberto")
  assert.ok(humberto)
  assert.equal(humberto.scope, "vlan")
  assert.equal(humberto.observedInterfaceName, "vlan211")
  assert.equal(networkObservationGroupLabel(humberto.scope), "LAN/VLAN")
  assert.equal(
    formatObservedInterfaceLabel(
      humberto.observedInterfaceName,
      humberto.observedInterfaceDescription
    ),
    "vlan211"
  )
  assert.equal(classifyNetworkInterfaceScope({ name: "vlan211" }), "vlan")

  const ui = read("components/network/network-discovery-screen.tsx")
  assert.match(ui, /formatObservedInterfaceLabel/)
  assert.match(ui, /item\.observedInterfaceName/)
})

const JOB_STARTED = "2026-10-03T17:00:00.000Z"
const JOB_COMPLETED = "2026-10-03T17:01:00.000Z"
const JOB_SEEN = "2026-10-03T17:00:30.000Z"
const OLD_SEEN = "2026-10-02T12:00:00.000Z"

function malaguenoJob(overrides = {}) {
  return {
    id: "4141dfc7-0000-4000-8000-000000000001",
    status: "completed",
    agentId: AGENT,
    startedAt: JOB_STARTED,
    completedAt: JOB_COMPLETED,
    payload: {
      targetId: "target-malagueno",
      targetName: "Core Malagueño",
      host: "177.53.120.11",
    },
    result: { deviceCount: 59, targetId: "target-malagueno" },
    targetName: "Core Malagueño",
    targetHost: "177.53.120.11",
    ...overrides,
  }
}

function inventory62() {
  const latest = Array.from({ length: 59 }, (_, index) => ({
    id: index === 0 ? CORE : `dev-run-${index}`,
    companyId: COMPANY,
    agentId: AGENT,
    managementIp: index === 0 ? "177.53.120.11" : `10.200.0.${index}`,
    hostname: index === 0 ? "RB3011 - Core Malagueño" : `Neighbor ${index}`,
    lastSeenAt: JOB_SEEN,
    origin: index === 0 ? "discovery" : "neighbor",
  }))
  const historicalOnly = [
    {
      id: "hist-as-old-1",
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.9.9.1",
      hostname: "Histórico 1",
      lastSeenAt: OLD_SEEN,
      origin: "neighbor",
    },
    {
      id: "hist-as-old-2",
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.9.9.2",
      hostname: "Histórico 2",
      lastSeenAt: OLD_SEEN,
      origin: "neighbor",
    },
    {
      id: "hist-as-old-3",
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.9.9.3",
      hostname: "Histórico 3",
      lastSeenAt: OLD_SEEN,
      origin: "neighbor",
    },
  ]
  return { latest, historicalOnly, all: [...latest, ...historicalOnly] }
}

test("último job de 59 devices no mezcla 3 observaciones históricas", () => {
  const job = pickLatestCompletedDiscoveryJob([malaguenoJob()])
  assert.ok(job)
  assert.equal(job.id, "4141dfc7-0000-4000-8000-000000000001")
  const { latest, historicalOnly, all } = inventory62()
  const latestDevices = filterDevicesSeenInDiscoveryJob(all, job)
  const latestView = withLatestDiscoveryJobMeta(
    buildNetworkDiscoveryObservationView({
      devices: latestDevices,
      targets,
      links: [],
      interfaces: [],
    }),
    job
  )
  const historicalView = buildNetworkDiscoveryObservationView({
    devices: all,
    targets,
    links: [],
    interfaces: [],
  })

  assert.equal(latestDevices.length, 59)
  assert.equal(latestView.total, 59)
  assert.equal(historicalView.total, 62)
  assert.equal(latestView.targetName, "Core Malagueño")
  for (const device of historicalOnly) {
    assert.equal(latestDevices.some((item) => item.id === device.id), false)
    assert.equal(historicalView.items.some((item) => item.id === device.id), true)
  }
  assert.equal(
    latestView.items.some((item) => item.id === "hist-as-old-1"),
    false
  )
})

test("un discovery posterior reemplaza latestObservations", () => {
  const first = malaguenoJob()
  const later = malaguenoJob({
    id: "bbbbbbbb-0000-4000-8000-000000000002",
    startedAt: "2026-10-03T18:00:00.000Z",
    completedAt: "2026-10-03T18:01:00.000Z",
    result: { deviceCount: 4, targetId: "target-malagueno" },
  })
  const picked = pickLatestCompletedDiscoveryJob([first, later])
  assert.equal(picked?.id, later.id)

  const laterDevices = [
    {
      id: CORE,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "177.53.120.11",
      lastSeenAt: "2026-10-03T18:00:20.000Z",
    },
    {
      id: "dev-new-2",
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.1.1.2",
      lastSeenAt: "2026-10-03T18:00:20.000Z",
    },
    {
      id: "dev-new-3",
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.1.1.3",
      lastSeenAt: "2026-10-03T18:00:20.000Z",
    },
    {
      id: "dev-new-4",
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.1.1.4",
      lastSeenAt: "2026-10-03T18:00:20.000Z",
    },
  ]
  const staleFromFirstRun = inventory62().all.map((device) =>
    device.id === CORE ? laterDevices[0] : device
  )
  const combined = [
    ...laterDevices,
    ...staleFromFirstRun.filter(
      (device) => !laterDevices.some((item) => item.id === device.id)
    ),
  ]
  const latestDevices = filterDevicesSeenInDiscoveryJob(combined, picked)
  assert.equal(latestDevices.length, 4)
  assert.equal(
    latestDevices.every((device) => device.lastSeenAt?.startsWith("2026-10-03T18:")),
    true
  )
})

test("el polling reemplaza latestObservations al completar y conserva estado si faltan", () => {
  const previous = {
    latest: withLatestDiscoveryJobMeta(
      { total: 62, core: 1, wan: 10, lanVlan: 51, unknown: 0, items: [{ id: "old" }] },
      malaguenoJob()
    ),
    historical: { total: 62, core: 1, wan: 10, lanVlan: 51, unknown: 0, items: [] },
  }
  const completedLatest = withLatestDiscoveryJobMeta(
    { total: 59, core: 1, wan: 10, lanVlan: 48, unknown: 0, items: [{ id: "new" }] },
    malaguenoJob()
  )
  const replaced = nextDiscoveryObservationState(previous, {
    latestObservations: completedLatest,
    historicalObservations: {
      total: 62,
      core: 1,
      wan: 10,
      lanVlan: 51,
      unknown: 0,
      items: [],
    },
  })
  assert.equal(replaced.latest?.total, 59)
  assert.equal(replaced.latest?.items[0]?.id, "new")
  assert.equal(replaced.historical?.total, 62)

  const transient = nextDiscoveryObservationState(replaced, {})
  assert.equal(transient.latest?.total, 59)
  assert.equal(transient.historical?.total, 62)

  const persist = read("lib/network/devices/queries.ts")
  const persistFn = persist.slice(
    persist.indexOf("export async function persistDiscoverySnapshot"),
    persist.indexOf("async function upsertNetworkDevice")
  )
  const managed = read("lib/network/devices/managed.ts")
  assert.doesNotMatch(persistFn, /\.delete\(/)
  assert.match(persistFn, /upsertNetworkDevice/)
  assert.match(managed, /managementIp\.trim\(\) === target\.host\.trim\(\)/)
})

