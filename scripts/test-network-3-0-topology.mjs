import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"
import { NETWORK_MONITORING_STATUS_TTL_MS } from "../lib/network/constants.ts"
import { displayMonitoringStatus } from "../lib/network/monitoring/status.ts"
import { NETWORK_UI_REFETCH_INTERVAL_MS } from "../lib/network/react-query/defaults.ts"
import { networkQueryKeys } from "../lib/network/react-query/keys.ts"
import {
  buildCanonicalTopologyGraph,
  buildTopologyEdgeDetail,
  formatTopologyLinkLabel,
  formatTopologyNodeIdentity,
  formatTopologyPeerLink,
  formatTopologyProtocols,
  mergeTopologyEdges,
  resolveTopologySelection,
  topologyManagedDeviceHref,
  uniqueTopologyInterfaces,
} from "../lib/network/topology/graph.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "co-1"
const AGENT = "ag-1"
const SITE = "site-1"
const CORE_M = "dev-core-m"
const CORE_N = "dev-core-n"
const NORTE_M = "dev-norte-m"
const NORTE_N = "dev-norte-n"
const SUR_M = "dev-sur-m"

function labDevice(input) {
  return {
    companyId: COMPANY,
    agentId: AGENT,
    siteId: SITE,
    deviceType: "router",
    operationalStatus: input.kind === "managed" ? "online" : null,
    interfaces: [],
    origin: "discovery",
    hostname: null,
    managementIp: null,
    lastPollAt: null,
    ...input,
  }
}

function labDevices() {
  return [
    labDevice({
      id: CORE_M,
      hostname: "CORE-LAB",
      managementIp: "192.168.56.2",
      origin: "discovery",
      kind: "managed",
      lastPollAt: "2026-08-30T16:00:00.000Z",
      interfaces: [{ id: "c-e2", name: "ether2", status: "up" }],
    }),
    labDevice({
      id: NORTE_M,
      hostname: "NODO-NORTE",
      managementIp: "10.10.1.2",
      origin: "discovery",
      kind: "managed",
      lastPollAt: "2026-08-30T16:00:00.000Z",
      interfaces: [
        { id: "n-e2", name: "ether2", status: "up" },
        { id: "n-e3", name: "ether3", status: "up" },
      ],
    }),
    labDevice({
      id: SUR_M,
      hostname: "NODO-SUR",
      managementIp: "10.10.2.2",
      origin: "discovery",
      kind: "managed",
      lastPollAt: "2026-08-30T16:00:00.000Z",
      interfaces: [{ id: "s-e2", name: "ether2", status: "up" }],
    }),
    labDevice({
      id: CORE_N,
      hostname: "CORE-LAB",
      managementIp: "10.10.1.1",
      origin: "neighbor",
      kind: "neighbor",
    }),
    labDevice({
      id: NORTE_N,
      hostname: "NODO-NORTE",
      managementIp: "10.10.2.1",
      origin: "neighbor",
      kind: "neighbor",
    }),
  ]
}

function labLinks() {
  return [
    {
      id: "l1",
      fromDeviceId: CORE_M,
      toDeviceId: NORTE_M,
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "mndp",
    },
    {
      id: "l2",
      fromDeviceId: NORTE_M,
      toDeviceId: CORE_N,
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "mndp",
    },
    {
      id: "l3",
      fromDeviceId: NORTE_M,
      toDeviceId: SUR_M,
      fromInterfaceName: "ether3",
      toInterfaceName: null,
      protocol: "mndp",
    },
    {
      id: "l4",
      fromDeviceId: SUR_M,
      toDeviceId: NORTE_N,
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "mndp",
    },
  ]
}

test("1: la ruta /network/topology existe", () => {
  const page = read("app/(dashboard)/network/topology/page.tsx")
  assert.match(page, /NetworkTopologyScreen/)
  assert.match(read("components/network/network-subnav.tsx"), /\/network\/topology/)
  assert.match(read("lib/navigation/nav-items.ts"), /href: "\/network\/topology"/)
})

test("2: existe la API y query de topology", () => {
  assert.match(read("app/api/network/topology/route.ts"), /getNetworkTopologyGraph/)
  assert.match(read("lib/network/topology/queries.ts"), /export async function getNetworkTopologyGraph/)
})

test("3: el grafo devuelve nodes y edges", () => {
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /buildCanonicalTopologyGraph\(devices, rawLinks\)/)
  const graph = read("lib/network/topology/graph.ts")
  assert.match(graph, /nodes/)
  assert.match(graph, /edges: mergeTopologyEdges/)
  const types = read("lib/network/topology/types.ts")
  assert.match(types, /export type NetworkTopologyGraph/)
  assert.match(types, /nodes: NetworkTopologyNode\[\]/)
  assert.match(types, /edges: NetworkTopologyEdge\[\]/)
})

test("4-5: administrados vs vecinos usan el criterio de target, no origin", () => {
  const companyId = "co-1"
  const agentId = "ag-1"
  const managed = isManagedNetworkDevice(
    { companyId, agentId, managementIp: "192.168.56.2", origin: "neighbor" },
    { companyId, agentId, host: "192.168.56.2" }
  )
  const neighbor = isManagedNetworkDevice(
    { companyId, agentId, managementIp: "10.10.1.1", origin: "discovery" },
    { companyId, agentId, host: "192.168.56.2" }
  )
  assert.equal(managed, true)
  assert.equal(neighbor, false)
  const query = read("lib/network/topology/queries.ts")
  assert.match(query, /isManagedNetworkDevice/)
  assert.match(query, /kind: managed \? "managed" : "neighbor"/)
  assert.match(query, /origin: row.origin/)
  assert.doesNotMatch(query, /kind: row.origin/)
})

test("6-8: no se inventan ni duplican enlaces; se conservan interfaces", () => {
  const query = read("lib/network/topology/queries.ts")
  assert.match(query, /from\("network_links"\)/)
  assert.doesNotMatch(query, /agent_id === .*agent_id/)
  assert.match(query, /buildCanonicalTopologyGraph\(devices, rawLinks\)/)

  const forward = {
    id: "link-1",
    fromDeviceId: "core",
    toDeviceId: "norte",
    fromInterfaceName: "ether2",
    toInterfaceName: null,
    protocol: "mndp",
  }
  const reverse = {
    id: "link-2",
    fromDeviceId: "norte",
    toDeviceId: "core",
    fromInterfaceName: "wlan1",
    toInterfaceName: null,
    protocol: "mndp",
  }
  const merged = mergeTopologyEdges([forward, reverse])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].label, "ether2 ↔ wlan1")
  assert.equal(merged[0].localInterfaceName, "ether2")
  assert.equal(merged[0].remoteInterfaceName, "wlan1")
  assert.equal(formatTopologyLinkLabel("ether2", null), "ether2")
  assert.equal(formatTopologyLinkLabel(null, null), "—")
  assert.equal(mergeTopologyEdges([]).length, 0)
})

test("9-11: administrados usan freshness 2.6; vecinos no reciben status inventado", () => {
  const query = read("lib/network/topology/queries.ts")
  assert.match(query, /listNetworkDeviceOperationalStatuses/)
  assert.match(query, /operationalStatus: managed/)
  assert.match(query, /displayed === "online"/)
  assert.match(query, /: null/)
  const now = Date.parse("2026-08-30T16:00:00.000Z")
  const recent = new Date(now - 60_000).toISOString()
  const stale = new Date(now - 301_000).toISOString()
  assert.equal(displayMonitoringStatus("online", recent, now), "online")
  assert.equal(displayMonitoringStatus("online", stale, now), "unknown")
  assert.doesNotMatch(query, /displayMonitoringStatus/)
})

test("12-15: Discovery, Agent, auto-poll y jobs no fueron modificados", () => {
  assert.doesNotMatch(
    read("lib/network/discovery/parse-snapshot.ts"),
    /getNetworkTopologyGraph|\/network\/topology/
  )
  assert.doesNotMatch(
    read("network-agent/src/index.ts"),
    /getNetworkTopologyGraph|\/network\/topology/
  )
  assert.doesNotMatch(
    read("lib/network/monitoring/queries.ts"),
    /getNetworkTopologyGraph/
  )
  const due = read("lib/network/monitoring/queries.ts")
  assert.match(due, /export async function findDueMonitoringDevice/)
  assert.doesNotMatch(
    read("lib/network/jobs/queries.ts"),
    /getNetworkTopologyGraph/
  )
  assert.doesNotMatch(
    read("lib/network/jobs/agent-execution.ts"),
    /getNetworkTopologyGraph/
  )
})

test("16-17: refresh automático 15s via React Query, sin Realtime ni timers", () => {
  const hook = read("lib/network/react-query/use-network-topology-query.ts")
  assert.match(hook, /\.\.\.NETWORK_QUERY_OPTIONS/)
  assert.match(hook, /networkQueryKeys\.topology\(\)/)
  assert.match(hook, /fetch\("\/api\/network\/topology"\)/)
  assert.doesNotMatch(hook, /staleTime: Infinity/)
  assert.doesNotMatch(hook, /setInterval/)
  assert.doesNotMatch(hook, /setTimeout/)
  assert.doesNotMatch(hook, /realtime|channel\(/i)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.doesNotMatch(screen, /setInterval/)
  assert.doesNotMatch(screen, /setTimeout/)
  assert.doesNotMatch(screen, /realtime|channel\(|supabase\.channel/i)
  assert.doesNotMatch(screen, /fetch\(/)
  assert.match(screen, /resolveTopologySelection/)
  assert.match(screen, /isPending && graph\.nodes\.length === 0/)
})

test("deduplica el mismo enlace y combina protocolos CDP/LLDP/MNDP", () => {
  const duplicates = mergeTopologyEdges([
    {
      id: "a",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "cdp,lldp,mndp",
    },
    {
      id: "b",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "cdp,lldp,mndp",
    },
    {
      id: "c",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "mndp",
    },
  ])
  assert.equal(duplicates.length, 1)
  assert.equal(
    duplicates[0].localInterfaceName?.toLowerCase() === "ether2" ||
      duplicates[0].remoteInterfaceName?.toLowerCase() === "ether2",
    true
  )
  assert.equal(duplicates[0].protocol, "cdp,lldp,mndp")

  const reordered = mergeTopologyEdges([
    {
      id: "m",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "mndp",
    },
    {
      id: "l",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "lldp",
    },
    {
      id: "c",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "cdp",
    },
  ])
  assert.equal(reordered.length, 1)
  assert.equal(reordered[0].protocol, "cdp,lldp,mndp")
})

test("interfaces distintas no se fusionan; A→B y B→A equivalentes sí", () => {
  const distinct = mergeTopologyEdges([
    {
      id: "e2",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "mndp",
    },
    {
      id: "e3",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "ether3",
      toInterfaceName: null,
      protocol: "mndp",
    },
  ])
  assert.equal(distinct.length, 2)

  const reverse = mergeTopologyEdges([
    {
      id: "fwd",
      fromDeviceId: "core",
      toDeviceId: "norte",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "cdp",
    },
    {
      id: "rev",
      fromDeviceId: "norte",
      toDeviceId: "core",
      fromInterfaceName: "wlan1",
      toInterfaceName: null,
      protocol: "lldp",
    },
  ])
  assert.equal(reverse.length, 1)
  assert.equal(reverse[0].label, "ether2 ↔ wlan1")
  assert.equal(reverse[0].protocol, "cdp,lldp")
})

test("panel identifica destino por hostname + IP; nodos homónimos no se fusionan", () => {
  assert.equal(
    formatTopologyNodeIdentity("NODO-NORTE", "10.10.1.2"),
    "NODO-NORTE · 10.10.1.2"
  )
  assert.equal(
    formatTopologyNodeIdentity("NODO-NORTE", "10.10.2.1"),
    "NODO-NORTE · 10.10.2.1"
  )
  assert.notEqual(
    formatTopologyNodeIdentity("NODO-NORTE", "10.10.1.2"),
    formatTopologyNodeIdentity("NODO-NORTE", "10.10.2.1")
  )

  const edge = mergeTopologyEdges([
    {
      id: "link",
      fromDeviceId: "aaa-norte",
      toDeviceId: "zzz-core",
      fromInterfaceName: "ether2",
      toInterfaceName: null,
      protocol: "cdp,lldp,mndp",
    },
  ])[0]
  assert.equal(
    formatTopologyPeerLink({
      selectedDeviceId: "aaa-norte",
      edge,
      peerHostname: "CORE-LAB",
      peerManagementIp: "192.168.56.2",
    }),
    "ether2 → CORE-LAB · 192.168.56.2 · cdp,lldp,mndp"
  )

  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /formatTopologyPeerLink/)
  assert.doesNotMatch(screen, /other\.hostname \|\| other\.managementIp/)
})

test("interfaces del nodo no se duplican; Discovery permanece intacto", () => {
  const unique = uniqueTopologyInterfaces([
    { id: "i1", name: "ether2", status: "up" },
    { id: "i1", name: "ether2", status: "up" },
    { id: "i2", name: "ether2", status: "up" },
    { id: "i3", name: "ether3", status: "up" },
  ])
  assert.equal(unique.length, 2)
  assert.deepEqual(
    unique.map((item) => item.name),
    ["ether2", "ether3"]
  )
  assert.match(read("lib/network/topology/queries.ts"), /uniqueTopologyInterfaces/)
  assert.doesNotMatch(
    read("lib/network/discovery/parse-snapshot.ts"),
    /mergeTopologyEdges|formatTopologyPeerLink|buildCanonicalTopologyGraph/
  )
})

test("identidad canónica: 5 devices → 3 nodos; vecinos .1 se resuelven al administrado", () => {
  const graph = buildCanonicalTopologyGraph(labDevices(), labLinks())
  assert.equal(labDevices().length, 5)
  assert.equal(graph.nodes.length, 3)
  assert.deepEqual(
    graph.nodes.map((node) => node.id).sort(),
    [CORE_M, NORTE_M, SUR_M].sort()
  )
  assert.equal(
    graph.nodes.every((node) => node.kind === "managed"),
    true
  )

  const core = graph.nodes.find((node) => node.hostname === "CORE-LAB")
  const norte = graph.nodes.find((node) => node.hostname === "NODO-NORTE")
  assert.equal(core?.id, CORE_M)
  assert.equal(core?.managementIp, "192.168.56.2")
  assert.equal(norte?.id, NORTE_M)
  assert.equal(norte?.managementIp, "10.10.1.2")
  assert.equal(
    graph.nodes.some((node) => node.managementIp === "10.10.1.1"),
    false
  )
  assert.equal(
    graph.nodes.some((node) => node.managementIp === "10.10.2.1"),
    false
  )
})

test("enlaces bidireccionales equivalentes se fusionan a CORE↔NORTE y NORTE↔SUR", () => {
  const graph = buildCanonicalTopologyGraph(labDevices(), labLinks())
  assert.equal(graph.edges.length, 2)

  const pairKey = (edge) =>
    [edge.sourceDeviceId, edge.targetDeviceId].sort().join("::")
  const keys = graph.edges.map(pairKey).sort()
  assert.deepEqual(keys, [`${CORE_M}::${NORTE_M}`, `${NORTE_M}::${SUR_M}`].sort())

  const norteEdges = graph.edges.filter(
    (edge) => edge.sourceDeviceId === NORTE_M || edge.targetDeviceId === NORTE_M
  )
  assert.equal(norteEdges.length, 2)

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const labels = norteEdges
    .map((edge) => {
      const otherId =
        edge.sourceDeviceId === NORTE_M ? edge.targetDeviceId : edge.sourceDeviceId
      const other = nodesById.get(otherId)
      return formatTopologyPeerLink({
        selectedDeviceId: NORTE_M,
        edge,
        peerHostname: other?.hostname,
        peerManagementIp: other?.managementIp,
      })
    })
    .sort()
  assert.deepEqual(labels, [
    "ether2 → CORE-LAB · 192.168.56.2 · mndp",
    "ether3 → NODO-SUR · 10.10.2.2 · mndp",
  ])
  assert.equal(
    labels.some((label) => label.includes("10.10.1.1") || label.includes("10.10.2.1")),
    false
  )
})

test("no se fusionan enlaces físicos distintos; vecino sin equivalente permanece", () => {
  const distinct = buildCanonicalTopologyGraph(labDevices(), [
    ...labLinks(),
    {
      id: "l-extra",
      fromDeviceId: NORTE_M,
      toDeviceId: CORE_M,
      fromInterfaceName: "ether5",
      toInterfaceName: null,
      protocol: "lldp",
    },
  ])
  const coreNorte = distinct.edges.filter((edge) => {
    const pair = [edge.sourceDeviceId, edge.targetDeviceId].sort().join("::")
    return pair === `${CORE_M}::${NORTE_M}`
  })
  assert.equal(coreNorte.length, 2)
  assert.equal(distinct.edges.length, 3)

  const orphan = labDevice({
    id: "dev-switch",
    hostname: "SWITCH-FOO",
    managementIp: "10.10.9.9",
    origin: "neighbor",
    kind: "neighbor",
  })
  const withOrphan = buildCanonicalTopologyGraph([...labDevices(), orphan], labLinks())
  assert.equal(withOrphan.nodes.length, 4)
  const leftover = withOrphan.nodes.find((node) => node.id === "dev-switch")
  assert.equal(leftover?.kind, "neighbor")
  assert.equal(leftover?.managementIp, "10.10.9.9")

  const otherSite = labDevice({
    id: "dev-norte-other-site",
    hostname: "NODO-NORTE",
    managementIp: "10.99.0.1",
    origin: "neighbor",
    kind: "neighbor",
    siteId: "site-other",
  })
  const scoped = buildCanonicalTopologyGraph([...labDevices(), otherSite], labLinks())
  assert.equal(scoped.nodes.length, 4)
  assert.equal(
    scoped.nodes.some((node) => node.id === "dev-norte-other-site"),
    true
  )
})

test("Discovery, freshness 2.6 y Devices 2.7 permanecen intactos", () => {
  assert.doesNotMatch(
    read("lib/network/discovery/parse-snapshot.ts"),
    /buildCanonicalTopologyGraph|topologyCanonicalIdentityKey/
  )
  assert.doesNotMatch(
    read("network-agent/src/index.ts"),
    /buildCanonicalTopologyGraph/
  )
  const status = read("lib/network/monitoring/status.ts")
  assert.match(status, /NETWORK_MONITORING_STATUS_TTL_MS/)
  assert.match(status, /export function displayMonitoringStatus/)
  assert.doesNotMatch(status, /buildCanonicalTopologyGraph/)
  const query = read("lib/network/topology/queries.ts")
  assert.match(query, /listNetworkDeviceOperationalStatuses/)
  assert.match(
    read("lib/network/devices/queries.ts"),
    /buildManagedNetworkDeviceOrFilter/
  )
  assert.doesNotMatch(
    read("lib/network/devices/queries.ts"),
    /buildCanonicalTopologyGraph/
  )
  assert.doesNotMatch(
    read("lib/network/devices/managed.ts"),
    /buildCanonicalTopologyGraph/
  )
})

test("3.1: detalle de enlace A/B conserva interfaces, protocolos e identidad", () => {
  const graph = buildCanonicalTopologyGraph(labDevices(), labLinks())
  assert.equal(graph.nodes.length, 3)
  assert.equal(graph.edges.length, 2)
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const coreNorte = graph.edges.find((edge) => {
    const pair = [edge.sourceDeviceId, edge.targetDeviceId].sort().join("::")
    return pair === `${CORE_M}::${NORTE_M}`
  })
  assert.ok(coreNorte)
  const detail = buildTopologyEdgeDetail(coreNorte, nodesById)
  assert.equal(detail.localInterfaceName, "ether2")
  assert.equal(detail.remoteInterfaceName, "ether2")
  assert.equal(detail.interfacesLabel, "ether2 ↔ ether2")
  assert.equal(detail.protocol, "mndp")
  assert.equal(detail.protocolsLabel, "MNDP")
  assert.equal(detail.endpointA.identity, "CORE-LAB · 192.168.56.2")
  assert.equal(detail.endpointB.identity, "NODO-NORTE · 10.10.1.2")
  assert.equal(detail.endpointA.managementIp, "192.168.56.2")
  assert.equal(detail.endpointB.managementIp, "10.10.1.2")
  assert.equal(
    detail.endpointA.identity.includes("10.10.1.1") ||
      detail.endpointB.identity.includes("10.10.1.1"),
    false
  )
})

test("3.1: administrado muestra estado y href; vecino no inventa estado ni navega", () => {
  const orphan = labDevice({
    id: "dev-switch",
    hostname: "SWITCH-FOO",
    managementIp: "10.10.9.9",
    origin: "neighbor",
    kind: "neighbor",
  })
  const graph = buildCanonicalTopologyGraph(
    [...labDevices(), orphan],
    [
      ...labLinks(),
      {
        id: "l-orphan",
        fromDeviceId: CORE_M,
        toDeviceId: "dev-switch",
        fromInterfaceName: "ether1",
        toInterfaceName: "ether8",
        protocol: "cdp,lldp,mndp",
      },
    ]
  )
  assert.equal(graph.nodes.length, 4)
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const mixed = graph.edges.find((edge) => {
    const pair = [edge.sourceDeviceId, edge.targetDeviceId].sort().join("::")
    return pair === `${CORE_M}::dev-switch`
  })
  assert.ok(mixed)
  const detail = buildTopologyEdgeDetail(mixed, nodesById)
  assert.equal(detail.localInterfaceName, "ether1")
  assert.equal(detail.remoteInterfaceName, "ether8")
  assert.equal(detail.protocolsLabel, "CDP · LLDP · MNDP")
  assert.equal(detail.endpointA.identity, "CORE-LAB · 192.168.56.2")
  assert.equal(detail.endpointB.identity, "SWITCH-FOO · 10.10.9.9")
  assert.equal(detail.endpointA.monitored, true)
  assert.equal(detail.endpointA.operationalStatus, "online")
  assert.equal(detail.endpointA.lastPollAt, "2026-08-30T16:00:00.000Z")
  assert.equal(detail.endpointA.deviceHref, `/network/devices/${CORE_M}`)
  assert.equal(detail.endpointB.monitored, false)
  assert.equal(detail.endpointB.operationalStatus, null)
  assert.equal(detail.endpointB.lastPollAt, null)
  assert.equal(detail.endpointB.deviceHref, null)
  assert.equal(topologyManagedDeviceHref(orphan), null)
  assert.equal(
    topologyManagedDeviceHref({ id: CORE_M, kind: "managed" }),
    `/network/devices/${CORE_M}`
  )
  assert.equal(formatTopologyProtocols("cdp,lldp,mndp"), "CDP · LLDP · MNDP")
  assert.equal(formatTopologyProtocols(null), "—")
  assert.equal(formatTopologyLinkLabel("ether2", null), "ether2")

  const now = Date.parse("2026-08-30T16:00:00.000Z")
  const recent = new Date(now - 60_000).toISOString()
  const stale = new Date(now - 301_000).toISOString()
  assert.equal(displayMonitoringStatus("online", recent, now), "online")
  assert.equal(displayMonitoringStatus("online", stale, now), "unknown")
  assert.doesNotMatch(
    read("lib/network/topology/graph.ts"),
    /displayMonitoringStatus/
  )
  assert.match(
    read("lib/network/topology/queries.ts"),
    /listNetworkDeviceOperationalStatuses/
  )
  assert.match(read("lib/network/topology/queries.ts"), /lastPollAt: managed/)
})

test("3.1: panel selecciona nodo o enlace y reutiliza la query única", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /kind: "edge"/)
  assert.match(screen, /kind: "node"/)
  assert.match(screen, /buildTopologyEdgeDetail/)
  assert.match(screen, /Ver dispositivo/)
  assert.match(screen, /topologyManagedDeviceHref/)
  assert.match(screen, /No monitoreado/)
  assert.match(screen, /Cerrar/)
  assert.match(screen, /setSelection\(null\)/)
  assert.doesNotMatch(screen, /Ver detalle/)
  assert.doesNotMatch(screen, /displayMonitoringStatus/)
  assert.match(screen, /resolveTopologySelection/)
  const hook = read("lib/network/react-query/use-network-topology-query.ts")
  assert.match(hook, /\.\.\.NETWORK_QUERY_OPTIONS/)
  assert.doesNotMatch(hook, /staleTime: Infinity/)
})

test("hotfix refresh: 15s, query key, endpoint y sin timers/Realtime", () => {
  assert.equal(NETWORK_UI_REFETCH_INTERVAL_MS, 15_000)
  assert.deepEqual(networkQueryKeys.topology(), ["network", "topology"])
  const hook = read("lib/network/react-query/use-network-topology-query.ts")
  assert.match(hook, /networkQueryKeys\.topology\(\)/)
  assert.match(hook, /\.\.\.NETWORK_QUERY_OPTIONS/)
  assert.match(hook, /fetch\("\/api\/network\/topology"\)/)
  assert.doesNotMatch(hook, /setInterval/)
  assert.doesNotMatch(hook, /setTimeout/)
  assert.doesNotMatch(hook, /realtime|channel\(/i)
  const route = read("app/api/network/topology/route.ts")
  assert.match(route, /export async function GET/)
  assert.match(route, /getNetworkTopologyGraph/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /useNetworkTopologyQuery\(\)/)
  assert.doesNotMatch(screen, /fetch\(/)
  assert.doesNotMatch(screen, /setInterval/)
  assert.doesNotMatch(screen, /setTimeout/)
})

test("hotfix refresh: la selección se conserva o se limpia según el grafo nuevo", () => {
  const nodes = [{ id: "dev-core" }, { id: "dev-norte" }]
  const edges = [{ id: "edge-core-norte" }]
  assert.deepEqual(
    resolveTopologySelection({ kind: "node", id: "dev-core" }, nodes, edges),
    { kind: "node", id: "dev-core" }
  )
  assert.deepEqual(
    resolveTopologySelection({ kind: "edge", id: "edge-core-norte" }, nodes, edges),
    { kind: "edge", id: "edge-core-norte" }
  )
  assert.deepEqual(
    resolveTopologySelection({ kind: "node", id: "dev-core" }, [...nodes], [...edges]),
    { kind: "node", id: "dev-core" }
  )
  assert.equal(
    resolveTopologySelection({ kind: "node", id: "gone" }, nodes, edges),
    null
  )
  assert.equal(
    resolveTopologySelection({ kind: "edge", id: "gone" }, nodes, edges),
    null
  )
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /resolveTopologySelection\(\s*selection/)
  assert.doesNotMatch(screen, /setSelection\(null\).*data/)
})

test("hotfix refresh: freshness 2.6 sigue en lectura y puede verse en el próximo fetch", () => {
  assert.equal(NETWORK_MONITORING_STATUS_TTL_MS, 300_000)
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /listNetworkDeviceOperationalStatuses/)
  assert.doesNotMatch(queries, /from\("network_device_status"\)/)
  const statuses = read("lib/network/monitoring/queries.ts")
  assert.match(statuses, /export async function listNetworkDeviceOperationalStatuses/)
  assert.match(statuses, /displayMonitoringStatus\(row\.status, row\.last_poll_at\)/)
  assert.equal(
    displayMonitoringStatus("online", "2026-08-30T16:00:00.000Z", Date.parse("2026-08-30T16:04:59.000Z")),
    "online"
  )
  assert.equal(
    displayMonitoringStatus("online", "2026-08-30T16:00:00.000Z", Date.parse("2026-08-30T16:05:00.000Z")),
    "unknown"
  )
})


