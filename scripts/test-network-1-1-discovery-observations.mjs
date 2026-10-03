/**
 * Discovery observations: classify WAN/LAN/VLAN/unknown without promoting neighbors.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"
import { classifyNetworkInterfaceScope } from "../lib/network/discovery/interface-scope.ts"
import {
  buildNetworkDiscoveryObservationView,
  isOperationalTopologyDevice,
  listNetworkDiscoveryObservationItems,
  networkObservationGroupLabel,
  formatObservedInterfaceLabel,
  summarizeNetworkDiscoveryObservations,
} from "../lib/network/discovery/observations.ts"
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
    /hostname, mac_address, manufacturer, model, firmware_version, origin/
  )
  assert.doesNotMatch(
    read("lib/network/discovery/observation-queries.ts"),
    /\.delete\(/
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
  assert.match(jobsRoute, /getNetworkDiscoveryObservations/)
  assert.match(jobsRoute, /success: true, jobs, observations/)
  assert.match(ui, /Último discovery/)
  assert.match(ui, /Total observado/)
  assert.match(ui, /Nombre \/ Identity/)
  assert.match(ui, /Interfaz donde fue observado/)
  assert.match(ui, /observations\.items/)
  assert.doesNotMatch(ui, /Aceptar|Rechazar|Agregar manualmente/)
  assert.doesNotMatch(ui, /\/api\/network\/devices/)
})
