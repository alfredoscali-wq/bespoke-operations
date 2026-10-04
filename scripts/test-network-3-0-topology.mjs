import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"
import { NETWORK_MONITORING_STATUS_TTL_MS } from "../lib/network/constants.ts"
import { buildNetworkDiscoveryObservationView } from "../lib/network/discovery/observations.ts"
import {
  filterDevicesSeenInDiscoveryJob,
  pickLatestCompletedDiscoveryJob,
  pickLatestCompletedDiscoveryJobForHost,
} from "../lib/network/discovery/latest-run.ts"
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
import {
  attachNestedLocalTopology,
  buildLocalCoreTopologyView,
  expandTopologyChildIdsWithManagedAliases,
  isLikelyCustomerCpe,
  pickCanonicalManagedDeviceId,
  resolveLocalManagedDeviceId,
  selectTopologyRootIds,
  visualDedupeKey,
  infraVisualGroupKey,
  collectLocalTopologyMacs,
  observationMatchesExcludedMacs,
} from "../lib/network/topology/local-view.ts"
import { buildObservedDeviceManagementState } from "../lib/network/topology/management-state.ts"
import { NETWORK_TARGET_DECRYPT_ERROR } from "../lib/network/management/errors.ts"
import {
  getNetworkManagementProfile,
  resolveNetworkManagementVendor,
  selectManagementAccessOption,
} from "../lib/network/management/vendor.ts"

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
  assert.match(read("app/api/network/topology/route.ts"), /getNetworkTopologyPage/)
  assert.match(read("lib/network/topology/queries.ts"), /export async function getNetworkTopologyGraph/)
  assert.match(read("lib/network/topology/queries.ts"), /export async function getNetworkTopologyPage/)
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

test("no se fusionan enlaces físicos distintos; vecino observado no entra al grafo operativo", () => {
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
  assert.equal(withOrphan.nodes.length, 3)
  assert.equal(
    withOrphan.nodes.some((node) => node.id === "dev-switch"),
    false
  )

  const otherSite = labDevice({
    id: "dev-norte-other-site",
    hostname: "NODO-NORTE",
    managementIp: "10.99.0.1",
    origin: "neighbor",
    kind: "neighbor",
    siteId: "site-other",
  })
  const scoped = buildCanonicalTopologyGraph([...labDevices(), otherSite], labLinks())
  assert.equal(scoped.nodes.length, 3)
  assert.equal(
    scoped.nodes.some((node) => node.id === "dev-norte-other-site"),
    false
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

test("3.1: administrado muestra estado y href; vecinos observados no entran al grafo operativo", () => {
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
  assert.equal(graph.nodes.length, 3)
  assert.equal(
    graph.nodes.every((node) => node.kind === "managed"),
    true
  )
  assert.equal(
    graph.nodes.some((node) => node.id === "dev-switch"),
    false
  )
  const mixed = graph.edges.find((edge) => {
    const pair = [edge.sourceDeviceId, edge.targetDeviceId].sort().join("::")
    return pair === `${CORE_M}::dev-switch`
  })
  assert.equal(mixed, undefined)

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const coreNorte = graph.edges.find((edge) => {
    const pair = [edge.sourceDeviceId, edge.targetDeviceId].sort().join("::")
    return pair === `${CORE_M}::${NORTE_M}`
  })
  assert.ok(coreNorte)
  const detail = buildTopologyEdgeDetail(coreNorte, nodesById)
  assert.equal(detail.endpointA.monitored, true)
  assert.equal(detail.endpointA.operationalStatus, "online")
  assert.equal(detail.endpointA.deviceHref, `/network/devices/${CORE_M}`)
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
  assert.match(screen, /Sin monitoreo/)
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
  assert.match(route, /getNetworkTopologyPage/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /useNetworkTopologyQuery\(/)
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

const MALAGUENO_CORE = "dev-core-malagueno"
const POWERBOX = "dev-powerbox"
const AS5 = "dev-as5"
const AS6 = "dev-as6"
const AS7 = "dev-as7"
const PILAR = "dev-pilar"
const BORDER = "dev-border"
const HAP_1 = "dev-hap-1"
const HAP_2 = "dev-hap-2"
const HISTORICAL = "dev-historical"
const ALLENDE = "dev-allende"
const BARRERA = "dev-barrera"
const AS6_DUP = "dev-as6-dup"
const GENERIC_A = "dev-generic-a"
const GENERIC_B = "dev-generic-b"

function malaguenoObservationInput() {
  const targets = [
    { companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" },
  ]
  const interfaces = [
    {
      id: "if-wan",
      deviceId: MALAGUENO_CORE,
      name: "ether1",
      description: "WAN",
      interfaceType: "ether",
    },
    {
      id: "if-ether3",
      deviceId: MALAGUENO_CORE,
      name: "ether3",
      description: "LAN NETWORKER",
      interfaceType: "ether",
    },
    {
      id: "if-bridge",
      deviceId: MALAGUENO_CORE,
      name: "Bridge LAN - vlan101",
      description: "LAN",
      interfaceType: "bridge",
    },
    {
      id: "if-ether4",
      deviceId: MALAGUENO_CORE,
      name: "ether4",
      description: "LAN",
      interfaceType: "ether",
    },
  ]
  const devices = [
    {
      id: MALAGUENO_CORE,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "177.53.120.11",
      hostname: "RB3011 - Core Malagueño",
      origin: "discovery",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: POWERBOX,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.100.101.4",
      hostname: "PowerBox Malagueño",
      macAddress: "aa:aa:aa:aa:aa:04",
      manufacturer: "MikroTik",
      model: "RB960PGS",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: AS5,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.100.101.11",
      hostname: "AS5",
      macAddress: "aa:aa:aa:aa:aa:05",
      model: "RBwAPG-5HacT2HnD",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: AS6,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.100.101.14",
      hostname: "AS6",
      macAddress: "aa:aa:aa:aa:aa:06",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: AS7,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.100.101.13",
      hostname: "AS7",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: PILAR,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.20.0.1",
      hostname: "ALS - Pilar",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: BORDER,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.30.0.1",
      hostname: "Border Rio Segundo",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: HAP_1,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.168.1.10",
      hostname: "Humberto lara",
      model: "hAP ac2",
      deviceType: "router",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: HAP_2,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.168.1.11",
      hostname: "CPE Casa 2",
      model: "hAP lite",
      deviceType: "cpe",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: AS6_DUP,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.100.101.14",
      hostname: "AS6",
      macAddress: "aa:aa:aa:aa:aa:06",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:11.000Z",
    },
    {
      id: ALLENDE,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.168.1.20",
      hostname: "Allende Susana",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: BARRERA,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.168.1.21",
      hostname: "Barrera Mario",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: GENERIC_A,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: null,
      hostname: "MikroTik",
      model: "RB2011UiAS",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
    {
      id: GENERIC_B,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: null,
      hostname: "MikroTik",
      model: "RB2011UiAS",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T12:00:10.000Z",
    },
  ]
  const links = [
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: PILAR,
      fromInterfaceId: "if-wan",
      fromInterfaceName: "ether1",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: BORDER,
      fromInterfaceId: "if-wan",
      fromInterfaceName: "ether1",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: POWERBOX,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: AS5,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: AS6,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: AS7,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: HAP_1,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: HAP_2,
      fromInterfaceId: "if-ether4",
      fromInterfaceName: "ether4",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: AS6_DUP,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: ALLENDE,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: BARRERA,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: GENERIC_A,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
    {
      fromDeviceId: MALAGUENO_CORE,
      toDeviceId: GENERIC_B,
      fromInterfaceId: "if-bridge",
      fromInterfaceName: "ether3",
      toInterfaceId: null,
      protocol: "mndp",
    },
  ]
  return { devices, targets, links, interfaces }
}

function buildMalaguenoLocalView(extraDevices = []) {
  const input = malaguenoObservationInput()
  const observations = buildNetworkDiscoveryObservationView({
    ...input,
    devices: [...input.devices, ...extraDevices],
  })
  const deviceMeta = new Map(
    [...input.devices, ...extraDevices].map((device) => [
      device.id,
      {
        deviceType: device.deviceType ?? null,
        lastSeenAt: device.lastSeenAt ?? null,
      },
    ])
  )
  return buildLocalCoreTopologyView({
    core: {
      id: MALAGUENO_CORE,
      hostname: "RB3011 - Core Malagueño",
      managementIp: "177.53.120.11",
      operationalStatus: "online",
      lastPollAt: "2026-10-03T12:05:00.000Z",
    },
    jobId: "job-malagueno",
    observations: observations.items,
    links: input.links,
    coreInterfaces: input.interfaces,
    deviceMeta,
  })
}

test("1.0 A: el Core aparece en la vista local", () => {
  const local = buildMalaguenoLocalView()
  assert.equal(local.core.id, MALAGUENO_CORE)
  assert.equal(local.core.hostname, "RB3011 - Core Malagueño")
  assert.equal(local.core.managementIp, "177.53.120.11")
  assert.equal(local.core.operationalStatus, "online")
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /LocalCoreTree/)
  assert.match(screen, /CORE/)
  assert.match(screen, /monitoringLabel/)
})

test("1.0 B: observaciones WAN no aparecen en la topología local", () => {
  const local = buildMalaguenoLocalView()
  const ids = local.interfaceGroups.flatMap((group) => [
    ...group.devices.map((device) => device.id),
    ...group.cpes.map((device) => device.id),
  ])
  assert.equal(ids.includes(PILAR), false)
  assert.equal(ids.includes(BORDER), false)
  assert.equal(Object.hasOwn(local, "wanObservedCount"), false)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.doesNotMatch(screen, /WAN observado/)
  assert.doesNotMatch(
    read("lib/network/topology/local-view.ts"),
    /classifyNetworkInterfaceScope/
  )
})

test("1.0 C: observaciones LAN/VLAN sí aparecen", () => {
  const local = buildMalaguenoLocalView()
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  assert.ok(ether3)
  const ids = ether3.devices.map((device) => device.id)
  assert.equal(ids.includes(POWERBOX), true)
  assert.equal(ids.includes(AS5), true)
  assert.equal(ids.includes(AS6), true)
  assert.equal(ids.includes(AS7), true)
})

test("1.0 D: from_interface_name se conserva y se muestra", () => {
  const local = buildMalaguenoLocalView()
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  assert.equal(ether3.interfaceName, "ether3")
  assert.equal(ether3.interfaceDescription, "LAN NETWORKER")
  assert.equal(ether3.interfaceLabel, "ether3 · LAN NETWORKER")
  for (const device of ether3.devices) {
    assert.equal(device.observedInterfaceName, "ether3")
  }
  assert.equal(
    local.interfaceGroups.some((group) => group.interfaceName === "Bridge LAN - vlan101"),
    false
  )
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /interfaceLabel/)
  assert.match(screen, /observedInterfaceName/)
})

test("1.0 E: CPE no se dibuja como nodo principal y puede contabilizarse", () => {
  assert.equal(
    isLikelyCustomerCpe({ hostname: "Humberto lara", board: "hAP ac2" }),
    true
  )
  assert.equal(isLikelyCustomerCpe({ hostname: "Allende Susana" }), true)
  assert.equal(isLikelyCustomerCpe({ hostname: "AS5" }), false)
  const local = buildMalaguenoLocalView()
  const ids = local.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(ids.includes(HAP_1), false)
  assert.equal(ids.includes(HAP_2), false)
  assert.equal(ids.includes(ALLENDE), false)
  assert.equal(ids.includes(BARRERA), false)
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  const ether4 = local.interfaceGroups.find((group) => group.interfaceName === "ether4")
  const ether3CpeIds = ether3.cpes.map((device) => device.id)
  assert.equal(ether3CpeIds.includes(ALLENDE), true)
  assert.equal(ether3CpeIds.includes(BARRERA), true)
  assert.equal(ether3CpeIds.includes(HAP_1), true)
  assert.equal(ether4.cpes.map((device) => device.id).includes(HAP_2), true)
  assert.ok(local.cpeObservedCount >= 4)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /CPE/)
  assert.match(screen, /observados/)
  assert.match(screen, /SelectedCpeGroupPanel/)
  assert.doesNotMatch(screen, /Allende Susana/)
})

test("1.0 F: no se inventa jerarquía PowerBox → AS5/AS6/AS7", () => {
  const local = buildMalaguenoLocalView()
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  const siblingIds = ether3.devices.map((device) => device.id)
  assert.equal(siblingIds.includes(POWERBOX), true)
  assert.equal(siblingIds.includes(AS5), true)
  assert.equal(siblingIds.includes(AS6), true)
  assert.equal(siblingIds.includes(AS7), true)
  assert.equal(
    Object.prototype.hasOwnProperty.call(ether3.devices[0], "children"),
    false
  )
  const localView = read("lib/network/topology/local-view.ts")
  assert.doesNotMatch(localView, /parentDeviceId/)
  assert.doesNotMatch(localView, /powerbox.*as5/i)
})

test("1.0 G: topology no inventa estado si no hay network_device_status", () => {
  const local = buildMalaguenoLocalView()
  const as5 = local.interfaceGroups
    .flatMap((group) => group.devices)
    .find((device) => device.id === AS5)
  assert.equal(as5.operationalStatus, null)
  assert.equal(as5.lastPollAt, null)
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /statusByDeviceId/)
  assert.doesNotMatch(queries, /operationalStatus: "online"/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /Sin monitoreo/)
})

test("1.0 H: usa el último discovery del host y no mezcla históricos", () => {
  const latestJob = pickLatestCompletedDiscoveryJobForHost(
    [
      {
        id: "job-other",
        status: "completed",
        agentId: AGENT,
        startedAt: "2026-10-03T11:00:00.000Z",
        completedAt: "2026-10-03T11:01:00.000Z",
        targetHost: "10.0.0.1",
        payload: { host: "10.0.0.1" },
      },
      {
        id: "job-malagueno",
        status: "completed",
        agentId: AGENT,
        startedAt: "2026-10-03T12:00:00.000Z",
        completedAt: "2026-10-03T12:00:20.000Z",
        targetHost: "177.53.120.11",
        payload: { host: "177.53.120.11" },
      },
    ],
    "177.53.120.11"
  )
  assert.equal(latestJob.id, "job-malagueno")
  const companyLatest = pickLatestCompletedDiscoveryJob([
    {
      id: "job-other-later",
      status: "completed",
      agentId: AGENT,
      startedAt: "2026-10-03T13:00:00.000Z",
      completedAt: "2026-10-03T13:01:00.000Z",
      targetHost: "10.0.0.1",
      payload: { host: "10.0.0.1" },
    },
    {
      id: "job-malagueno",
      status: "completed",
      agentId: AGENT,
      startedAt: "2026-10-03T12:00:00.000Z",
      completedAt: "2026-10-03T12:00:20.000Z",
      targetHost: "177.53.120.11",
      payload: { host: "177.53.120.11" },
    },
  ])
  assert.equal(companyLatest.id, "job-other-later")
  const seen = filterDevicesSeenInDiscoveryJob(
    [
      { id: AS5, agentId: AGENT, lastSeenAt: "2026-10-03T12:00:10.000Z" },
      { id: HISTORICAL, agentId: AGENT, lastSeenAt: "2026-10-03T11:00:30.000Z" },
    ],
    latestJob
  )
  assert.deepEqual(
    seen.map((device) => device.id),
    [AS5]
  )
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /getLatestNetworkDiscoveryObservationsByHosts/)
  assert.match(
    read("lib/network/discovery/observation-queries.ts"),
    /pickLatestCompletedDiscoveryJobForHost/
  )
  const local = buildMalaguenoLocalView([
    {
      id: HISTORICAL,
      companyId: COMPANY,
      agentId: AGENT,
      managementIp: "10.9.9.9",
      hostname: "Viejo histórico",
      origin: "neighbor",
      lastSeenAt: "2026-10-03T11:00:30.000Z",
    },
  ])
  const ids = local.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(ids.includes(HISTORICAL), false)
})

test("1.0 UI: selector de Core y drawer de observados", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /selectedCoreId/)
  assert.match(screen, /SelectedObservedPanel/)
  assert.match(screen, /Interfaz observada/)
  assert.match(screen, /Discovered-by/)
  assert.match(screen, /Último seen/)
  assert.match(read("app/api/network/topology/route.ts"), /deviceId/)
})

test("1.1 J: dedupe visual no fusiona dispositivos sin evidencia suficiente", () => {
  assert.equal(
    visualDedupeKey({ hostname: "MikroTik", interfaceName: "ether3" }),
    null
  )
  assert.equal(
    visualDedupeKey({
      macAddress: "aa:aa:aa:aa:aa:06",
      hostname: "AS6",
      interfaceName: "ether3",
    }),
    "mac:aa:aa:aa:aa:aa:06"
  )
  const local = buildMalaguenoLocalView()
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  const as6 = ether3.devices.filter((device) => device.hostname === "AS6")
  assert.equal(as6.length, 1)
  const generics = ether3.devices.filter((device) => device.hostname === "MikroTik")
  assert.equal(generics.length, 2)
})

test("1.2 A: un dispositivo observado puede iniciar administración desde Topology", () => {
  const local = buildMalaguenoLocalView()
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  const powerbox = ether3.devices.find((device) => device.id === POWERBOX)
  assert.equal(powerbox.managed, false)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /Administrar dispositivo/)
  assert.match(screen, /NetworkTopologyManageDialog/)
  assert.match(
    read("app/api/network/devices/[deviceId]/manage/route.ts"),
    /administerObservedNetworkDevice/
  )
})

test("1.2 B: fabricante y modelo seleccionan el conector", () => {
  assert.equal(
    resolveNetworkManagementVendor({
      manufacturer: "MikroTik",
      board: "RB960PGS",
    }),
    "mikrotik"
  )
  assert.equal(
    resolveNetworkManagementVendor({
      manufacturer: "Ubiquiti",
      platform: "UBNT",
    }),
    "ubiquiti"
  )
  const service = read("lib/network/management/service.ts")
  assert.match(service, /resolveNetworkManagementVendor/)
  assert.match(service, /getNetworkManagementConnector/)
  assert.doesNotMatch(
    read("components/network/network-topology-manage-dialog.tsx"),
    /Qué fabricante es/
  )
})

test("1.2 C: MikroTik reutiliza el conector existente del Agent", () => {
  const registry = read("network-agent/src/connectors/registry.ts")
  assert.match(registry, /createMikrotikConnector/)
  assert.match(registry, /runDiagnosticJob/)
  assert.match(registry, /connector\.testConnection/)
  assert.match(
    read("network-agent/src/connectors/mikrotik/index.ts"),
    /connectRouterOsApi/
  )
  assert.match(
    read("lib/network/management/service.ts"),
    /upsertNetworkDiscoveryTarget/
  )
  assert.doesNotMatch(
    read("lib/network/jobs/agent-execution.ts"),
    /connectRouterOsApi|8728|RouterOS/
  )
})

test("1.2 D/E/F: API 8728 y API-SSL 8729 usan protocol=api; no existe api-ssl", () => {
  const profile = getNetworkManagementProfile("mikrotik")
  assert.equal(profile.implemented, true)
  assert.deepEqual(
    profile.accessOptions.map((option) => ({
      protocol: option.protocol,
      port: option.port,
    })),
    [
      { protocol: "api", port: 8728 },
      { protocol: "api", port: 8729 },
    ]
  )
  assert.equal(
    selectManagementAccessOption(profile, "api", 8728).protocol,
    "api"
  )
  assert.equal(
    selectManagementAccessOption(profile, "api", 8729).protocol,
    "api"
  )
  const vendor = read("lib/network/management/vendor.ts")
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  const service = read("lib/network/management/service.ts")
  assert.doesNotMatch(vendor, /api-ssl/)
  assert.doesNotMatch(dialog, /api-ssl/)
  assert.doesNotMatch(service, /api-ssl/)
  assert.doesNotMatch(vendor, /protocol:\s*["']rest["']/)
})

test("1.2 G/H: credenciales cifradas y la contraseña no vuelve en GET", () => {
  const targets = read("lib/network/targets/queries.ts")
  assert.match(targets, /encryptNetworkDeviceSecret/)
  assert.match(targets, /upsertNetworkDiscoveryTarget/)
  assert.match(targets, /findNetworkDiscoveryTargetByAgentHost/)
  assert.doesNotMatch(targets, /password:/)
  const mapper = read("lib/network/mapper.ts")
  const mappedTarget = mapper.slice(
    mapper.indexOf("export function mapNetworkTargetRow")
  )
  assert.doesNotMatch(mappedTarget, /password:/)
  assert.match(mappedTarget, /hasSecret/)
  assert.match(
    read("lib/network/management/service.ts"),
    /stripNetworkSecrets/
  )
})

test("1.2 I/J: administrar y descubrir no redirige a Discovery y crea el job", () => {
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(dialog, /Administrar y descubrir/)
  assert.doesNotMatch(dialog, /["']\/network\/discovery["']/)
  assert.doesNotMatch(dialog, /router\.push/)
  assert.doesNotMatch(screen, /router\.push/)
  const service = read("lib/network/management/service.ts")
  assert.match(service, /input\.intent === "test"/)
  assert.match(service, /DISCOVERY_EXECUTABLE_JOB_TYPE/)
  assert.match(service, /createPendingNetworkAgentJob/)
  assert.match(service, /DIAGNOSTIC_EXECUTABLE_JOB_TYPE/)
  assert.match(read("lib/network/jobs/queries.ts"), /"diagnostic"/)
})

test("1.2 K: Topology se actualiza al completar el job", () => {
  const query = read("lib/network/react-query/use-network-topology-query.ts")
  assert.match(query, /discoveryJobs/)
  assert.match(query, /isNetworkDiscoveryJobInflight/)
  assert.match(query, /2_000/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /invalidateQueries/)
  assert.match(screen, /Administrando/)
  assert.match(screen, /NETWORK_JOB_STATUS_LABELS/)
  assert.match(read("lib/network/topology/queries.ts"), /listNetworkManagementJobs/)
})

test("1.2 L: observado no se convierte en administrado hasta una administración válida", () => {
  const local = buildMalaguenoLocalView()
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  for (const device of ether3.devices) {
    assert.equal(device.managed, false)
  }
  const service = read("lib/network/management/service.ts")
  const validateAt = service.indexOf("validateNetworkDiscoveryTargetDraft")
  const upsertAt = service.indexOf("upsertNetworkDiscoveryTarget")
  assert.ok(validateAt !== -1 && upsertAt !== -1 && validateAt < upsertAt)
  assert.equal(
    isManagedNetworkDevice(
      {
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.4",
      },
      { companyId: COMPANY, agentId: AGENT, host: "10.100.101.4" }
    ),
    true
  )
  assert.equal(
    isManagedNetworkDevice(
      {
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.4",
      },
      { companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" }
    ),
    false
  )
})

test("1.2 M: no inventa PowerBox → AP sin evidencia saliente", () => {
  const observations = buildNetworkDiscoveryObservationView(
    malaguenoObservationInput()
  )
  const deviceMeta = new Map(
    malaguenoObservationInput().devices.map((device) => [
      device.id,
      {
        deviceType: device.deviceType ?? null,
        lastSeenAt: device.lastSeenAt ?? null,
      },
    ])
  )
  const withoutEvidence = buildLocalCoreTopologyView({
    core: {
      id: POWERBOX,
      hostname: "PowerBox Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-pb",
    observations: observations.items,
    links: malaguenoObservationInput().links,
    deviceMeta,
    requireOutgoingLink: true,
  })
  const nestedIds = withoutEvidence.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(nestedIds.includes(AS5), false)
  assert.equal(nestedIds.includes(AS6), false)
  assert.equal(nestedIds.includes(AS7), false)

  const withEvidence = buildLocalCoreTopologyView({
    core: {
      id: POWERBOX,
      hostname: "PowerBox Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-pb",
    observations: observations.items,
    links: [
      { fromDeviceId: POWERBOX, toDeviceId: AS5, fromInterfaceName: "ether2" },
      { fromDeviceId: POWERBOX, toDeviceId: AS6, fromInterfaceName: "ether3" },
      { fromDeviceId: POWERBOX, toDeviceId: AS7, fromInterfaceName: "ether4" },
    ],
    deviceMeta,
    requireOutgoingLink: true,
  })
  const byIface = Object.fromEntries(
    withEvidence.interfaceGroups.map((group) => [
      group.interfaceName,
      group.devices.map((device) => device.id),
    ])
  )
  assert.deepEqual(byIface.ether2, [AS5])
  assert.deepEqual(byIface.ether3, [AS6])
  assert.deepEqual(byIface.ether4, [AS7])

  const attached = attachNestedLocalTopology(
    buildMalaguenoLocalView(),
    new Map([[POWERBOX, withEvidence.interfaceGroups]]),
    new Set([MALAGUENO_CORE, POWERBOX])
  )
  const ether3 = attached.interfaceGroups.find(
    (group) => group.interfaceName === "ether3"
  )
  const siblingIds = ether3.devices.map((device) => device.id)
  assert.equal(siblingIds.includes(POWERBOX), true)
  assert.equal(siblingIds.includes(AS5), false)
  const powerbox = ether3.devices.find((device) => device.id === POWERBOX)
  assert.equal(powerbox.managed, true)
  assert.equal(
    powerbox.downstream
      .flatMap((group) => group.devices)
      .some((device) => device.id === AS5 && device.managed === false),
    true
  )
})

test("1.2 N/O: Topology no está acoplada a MikroTik y Ubiquiti puede agregarse después", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  assert.doesNotMatch(screen, /connectRouterOsApi|createMikrotikConnector/)
  assert.doesNotMatch(dialog, /createMikrotikConnector|connectRouterOsApi/)
  assert.match(dialog, /resolveNetworkManagementVendor/)
  assert.match(dialog, /getNetworkManagementProfile/)
  const ubiquiti = getNetworkManagementProfile("ubiquiti")
  assert.equal(ubiquiti.implemented, false)
  assert.equal(ubiquiti.accessOptions.length, 0)
  const connector = read("lib/network/management/connector.ts")
  assert.match(connector, /NetworkManagementConnector/)
  assert.match(connector, /todavía no está implementado/)
  assert.match(
    read("network-agent/src/connectors/registry.ts"),
    /FUTURE_VENDORS/
  )
  assert.match(
    read("network-agent/src/connectors/registry.ts"),
    /ubiquiti/
  )
})

test("1.3 A: un único managed sin parent es Root", () => {
  assert.deepEqual(selectTopologyRootIds([MALAGUENO_CORE], []), [MALAGUENO_CORE])
})

test("1.3 B/C: PowerBox managed sigue siendo hijo LAN/VLAN y no Root", () => {
  const input = malaguenoObservationInput()
  const view = buildNetworkDiscoveryObservationView({
    ...input,
    targets: [
      { companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" },
      { companyId: COMPANY, agentId: AGENT, host: "10.100.101.4" },
    ],
  })
  const powerboxObs = view.items.find((item) => item.id === POWERBOX)
  assert.ok(powerboxObs)
  assert.notEqual(powerboxObs.scope, "core")
  assert.equal(powerboxObs.scope === "lan" || powerboxObs.scope === "vlan", true)
  const coreObs = view.items.find((item) => item.id === MALAGUENO_CORE)
  assert.equal(coreObs.scope, "core")
  assert.equal(view.core, 1)

  const local = buildLocalCoreTopologyView({
    core: {
      id: MALAGUENO_CORE,
      hostname: "RB3011 - Core Malagueño",
      managementIp: "177.53.120.11",
      operationalStatus: "online",
      lastPollAt: "2026-10-03T12:05:00.000Z",
    },
    jobId: "job-malagueno",
    observations: view.items,
    links: input.links,
    coreInterfaces: input.interfaces,
    deviceMeta: new Map(
      input.devices.map((device) => [
        device.id,
        {
          deviceType: device.deviceType ?? null,
          lastSeenAt: device.lastSeenAt ?? null,
        },
      ])
    ),
  })
  const ether3 = local.interfaceGroups.find((group) => group.interfaceName === "ether3")
  const ids = ether3.devices.map((device) => device.id)
  assert.equal(ids.includes(POWERBOX), true)
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, POWERBOX],
      [{ fromDeviceId: MALAGUENO_CORE, toDeviceId: POWERBOX }]
    ),
    [MALAGUENO_CORE]
  )
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /selectTopologyRootIds\(managedIdList, directedLinks\)/)
  assert.match(queries, /rootIds.has/)
})

test("1.3 D: AS5/AS6/AS7 administrados sin padre managed siguen siendo roots", () => {
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, POWERBOX, AS5, AS6, AS7],
      [{ fromDeviceId: MALAGUENO_CORE, toDeviceId: POWERBOX }]
    ),
    [MALAGUENO_CORE, AS5, AS6, AS7]
  )
})

test("1.3 E/F: discovery propio del PowerBox enriquece sin inventar hijos", () => {
  const observations = buildNetworkDiscoveryObservationView(
    malaguenoObservationInput()
  )
  const deviceMeta = new Map(
    malaguenoObservationInput().devices.map((device) => [
      device.id,
      {
        deviceType: device.deviceType ?? null,
        lastSeenAt: device.lastSeenAt ?? null,
      },
    ])
  )
  const withoutEvidence = buildLocalCoreTopologyView({
    core: {
      id: POWERBOX,
      hostname: "PowerBox Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-pb",
    observations: observations.items,
    links: malaguenoObservationInput().links,
    deviceMeta,
    requireOutgoingLink: true,
  })
  assert.equal(
    withoutEvidence.interfaceGroups.flatMap((group) => group.devices).length,
    0
  )

  const withEvidence = buildLocalCoreTopologyView({
    core: {
      id: POWERBOX,
      hostname: "PowerBox Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-pb",
    observations: observations.items,
    links: [
      { fromDeviceId: POWERBOX, toDeviceId: AS5, fromInterfaceName: "ether2" },
      { fromDeviceId: POWERBOX, toDeviceId: AS6, fromInterfaceName: "ether3" },
      { fromDeviceId: POWERBOX, toDeviceId: AS7, fromInterfaceName: "ether4" },
    ],
    deviceMeta,
    requireOutgoingLink: true,
  })
  const attached = attachNestedLocalTopology(
    buildMalaguenoLocalView(),
    new Map([[POWERBOX, withEvidence.interfaceGroups]]),
    new Set([MALAGUENO_CORE, POWERBOX])
  )
  const powerbox = attached.interfaceGroups
    .find((group) => group.interfaceName === "ether3")
    .devices.find((device) => device.id === POWERBOX)
  assert.equal(powerbox.managed, true)
  assert.equal(
    powerbox.downstream.some((group) =>
      group.devices.some((device) => device.id === AS5)
    ),
    true
  )
})

test("1.5: vecinos de infraestructura observados por un administrado aparecen como hijos", () => {
  const managedPowerbox = "dev-powerbox-managed"
  const nested = buildLocalCoreTopologyView({
    core: {
      id: managedPowerbox,
      hostname: "PowerBox Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: "online",
      lastPollAt: "2026-10-03T13:00:00.000Z",
    },
    jobId: "job-pb",
    observations: [
      {
        id: managedPowerbox,
        hostname: "PowerBox Malagueño",
        managementIp: "10.100.101.4",
        macAddress: null,
        observedInterfaceName: null,
        observedInterfaceDescription: null,
        scope: "core",
        platform: "MikroTik",
        board: "RB960PGS",
        version: null,
        discoveredBy: null,
        origin: "discovery",
      },
      {
        id: AS5,
        hostname: "AS5",
        managementIp: "10.100.101.11",
        macAddress: "aa:aa:aa:aa:aa:05",
        observedInterfaceName: "ether2",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RBwAPG-5HacT2HnD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: AS6,
        hostname: "AS6",
        managementIp: "10.100.101.14",
        macAddress: "aa:aa:aa:aa:aa:06",
        observedInterfaceName: "ether3",
        observedInterfaceDescription: null,
        scope: "vlan",
        platform: "MikroTik",
        board: "RBwAPG-5HacT2HnD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: AS7,
        hostname: "AS7",
        managementIp: "10.100.101.17",
        macAddress: "aa:aa:aa:aa:aa:07",
        observedInterfaceName: "ether4",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RBwAPG-5HacT2HnD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: HAP_1,
        hostname: "Humberto lara",
        managementIp: "10.100.101.40",
        macAddress: null,
        observedInterfaceName: "ether5",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "hAP ac2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: PILAR,
        hostname: "Pilar",
        managementIp: "10.200.0.1",
        macAddress: null,
        observedInterfaceName: "ether1",
        observedInterfaceDescription: "WAN",
        scope: "wan",
        platform: null,
        board: null,
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: MALAGUENO_CORE,
        hostname: "RB3011 - Core Malagueño",
        managementIp: "177.53.120.11",
        macAddress: null,
        observedInterfaceName: "ether1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB3011UiAS",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
    ],
    links: [
      { fromDeviceId: managedPowerbox, toDeviceId: AS5, fromInterfaceName: "ether2" },
      { fromDeviceId: managedPowerbox, toDeviceId: AS6, fromInterfaceName: null },
      { fromDeviceId: managedPowerbox, toDeviceId: AS7, fromInterfaceName: "ether4" },
      { fromDeviceId: managedPowerbox, toDeviceId: HAP_1, fromInterfaceName: "ether5" },
      {
        fromDeviceId: managedPowerbox,
        toDeviceId: MALAGUENO_CORE,
        fromInterfaceName: "ether1",
      },
    ],
    deviceMeta: new Map([
      [AS5, { deviceType: "ap" }],
      [AS6, { deviceType: "ap" }],
      [AS7, { deviceType: "ap" }],
      [HAP_1, { deviceType: "cpe" }],
      [MALAGUENO_CORE, { deviceType: "core" }],
    ]),
    requireOutgoingLink: true,
    excludeDeviceIds: new Set([MALAGUENO_CORE]),
  })
  const nestedIds = nested.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(nestedIds.includes(AS5), true)
  assert.equal(nestedIds.includes(AS6), true)
  assert.equal(nestedIds.includes(AS7), true)
  assert.equal(nestedIds.includes(HAP_1), false)
  assert.equal(nestedIds.includes(PILAR), false)
  assert.equal(nestedIds.includes(MALAGUENO_CORE), false)
  const ether5 = nested.interfaceGroups.find((group) => group.interfaceName === "ether5")
  assert.equal(ether5.cpes.map((device) => device.id).includes(HAP_1), true)
  const ether3 = nested.interfaceGroups.find((group) => group.interfaceName === "ether3")
  assert.equal(ether3.devices.map((device) => device.id).includes(AS6), true)

  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: POWERBOX,
      managementIp: "10.100.101.4",
      managedById: new Set([MALAGUENO_CORE, managedPowerbox]),
      managedIdByHost: new Map([["10.100.101.4", managedPowerbox]]),
    }),
    managedPowerbox
  )
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, managedPowerbox],
      [{ fromDeviceId: MALAGUENO_CORE, toDeviceId: managedPowerbox }]
    ),
    [MALAGUENO_CORE]
  )

  const attached = attachNestedLocalTopology(
    buildMalaguenoLocalView(),
    new Map([[POWERBOX, nested.interfaceGroups]]),
    new Set([MALAGUENO_CORE, managedPowerbox]),
    new Map([["10.100.101.4", managedPowerbox]])
  )
  const powerbox = attached.interfaceGroups
    .flatMap((group) => group.devices)
    .find((device) => device.id === POWERBOX)
  assert.equal(powerbox.managed, true)
  const nestedInfra = powerbox.downstream.flatMap((group) => group.devices)
  assert.equal(
    nestedInfra.some((device) => device.id === AS5 && device.managed === false),
    true
  )
  assert.equal(
    nestedInfra.some((device) => device.id === AS6 && device.origin === "neighbor"),
    true
  )
  assert.equal(
    nestedInfra.some((device) => device.id === AS7 && device.managed === false),
    true
  )
  const siblingIds = attached.interfaceGroups
    .flatMap((group) => group.devices)
    .map((device) => device.id)
  assert.equal(siblingIds.includes(AS5), false)
  assert.equal(siblingIds.includes(POWERBOX), true)

  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /resolveLocalManagedDeviceId/)
  assert.match(queries, /selectTopologyRootIds\(managedIdList, directedLinks\)/)
  assert.match(queries, /requireOutgoingLink:\s*true/)
  assert.match(queries, /excludeDeviceIds/)
  assert.doesNotMatch(queries, /AS5|AS6|AS7/)
})

test("1.6: etherN,bridgeN proyecta infraestructura local y no cuela WAN ni el Core", () => {
  const parentId = "dev-access-managed"
  const observedParentId = "dev-access-observed"
  const radioId = "dev-radio-norte"
  const nodoId = "dev-nodo-este"
  const clienteId = "dev-cliente-sur"
  const wanPeerId = "dev-uplink-isp"
  const view = buildNetworkDiscoveryObservationView({
    devices: [
      {
        id: parentId,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.4",
        hostname: "Access Malagueño",
        origin: "discovery",
        model: "RB960PGS",
        deviceType: "router",
      },
      {
        id: observedParentId,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.4",
        hostname: "Access Malagueño",
        origin: "neighbor",
        model: "RB960PGS",
        deviceType: "router",
      },
      {
        id: radioId,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.21",
        hostname: "Radio Norte",
        origin: "neighbor",
        model: "CRS326-24G-2S+",
        deviceType: "switch",
      },
      {
        id: nodoId,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.22",
        hostname: "Nodo Este",
        origin: "neighbor",
        model: "RB921GS-5HPacD",
        deviceType: "router",
      },
      {
        id: clienteId,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.100.101.40",
        hostname: "Cliente Sur",
        origin: "neighbor",
        model: "hAP ac2",
        deviceType: "cpe",
      },
      {
        id: wanPeerId,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "10.20.0.1",
        hostname: "Uplink ISP",
        origin: "neighbor",
        model: "CCR1009",
        deviceType: "router",
      },
      {
        id: MALAGUENO_CORE,
        companyId: COMPANY,
        agentId: AGENT,
        managementIp: "177.53.120.11",
        hostname: "RB3011 - Core Malagueño",
        origin: "neighbor",
        model: "RB3011UiAS",
        deviceType: "core",
      },
    ],
    targets: [{ companyId: COMPANY, agentId: AGENT, host: "10.100.101.4" }],
    links: [
      {
        fromDeviceId: parentId,
        toDeviceId: radioId,
        fromInterfaceId: null,
        fromInterfaceName: "ether2,bridge1",
        toInterfaceId: null,
        protocol: "mndp",
      },
      {
        fromDeviceId: parentId,
        toDeviceId: nodoId,
        fromInterfaceId: null,
        fromInterfaceName: "ether3,bridge1",
        toInterfaceId: null,
        protocol: "mndp",
      },
      {
        fromDeviceId: parentId,
        toDeviceId: clienteId,
        fromInterfaceId: null,
        fromInterfaceName: "ether2,bridge1",
        toInterfaceId: null,
        protocol: "mndp",
      },
      {
        fromDeviceId: parentId,
        toDeviceId: wanPeerId,
        fromInterfaceId: null,
        fromInterfaceName: "ether1,WAN",
        toInterfaceId: null,
        protocol: "mndp",
      },
      {
        fromDeviceId: parentId,
        toDeviceId: MALAGUENO_CORE,
        fromInterfaceId: null,
        fromInterfaceName: "ether1,bridge1",
        toInterfaceId: null,
        protocol: "mndp",
      },
    ],
    interfaces: [
      {
        id: "if-e1",
        deviceId: parentId,
        name: "ether1",
        description: "WAN",
        interfaceType: "ether",
      },
      {
        id: "if-e2",
        deviceId: parentId,
        name: "ether2",
        description: null,
        interfaceType: "ether",
      },
      {
        id: "if-e3",
        deviceId: parentId,
        name: "ether3",
        description: null,
        interfaceType: "ether",
      },
      {
        id: "if-br1",
        deviceId: parentId,
        name: "bridge1",
        description: null,
        interfaceType: "bridge",
      },
    ],
  })
  const byId = Object.fromEntries(view.items.map((item) => [item.id, item]))
  assert.equal(byId[radioId].scope, "lan")
  assert.equal(byId[nodoId].scope, "lan")
  assert.equal(byId[clienteId].scope, "lan")
  assert.equal(byId[wanPeerId].scope, "wan")
  assert.equal(byId[MALAGUENO_CORE].scope, "wan")

  const nested = buildLocalCoreTopologyView({
    core: {
      id: parentId,
      hostname: "Access Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-access",
    observations: view.items,
    links: [
      { fromDeviceId: parentId, toDeviceId: radioId, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: parentId, toDeviceId: nodoId, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: parentId, toDeviceId: clienteId, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: parentId, toDeviceId: wanPeerId, fromInterfaceName: "ether1,WAN" },
      {
        fromDeviceId: parentId,
        toDeviceId: MALAGUENO_CORE,
        fromInterfaceName: "ether1,bridge1",
      },
    ],
    deviceMeta: new Map([
      [radioId, { deviceType: "switch" }],
      [nodoId, { deviceType: "router" }],
      [clienteId, { deviceType: "cpe" }],
    ]),
    requireOutgoingLink: true,
    excludeDeviceIds: new Set([MALAGUENO_CORE]),
  })
  const nestedIds = nested.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(nestedIds.includes(radioId), true)
  assert.equal(nestedIds.includes(nodoId), true)
  assert.equal(nestedIds.includes(clienteId), false)
  assert.equal(nestedIds.includes(wanPeerId), false)
  assert.equal(nestedIds.includes(MALAGUENO_CORE), false)
  const ether2 = nested.interfaceGroups.find(
    (group) => group.interfaceName === "ether2,bridge1"
  )
  assert.equal(ether2.cpes.map((device) => device.id).includes(clienteId), true)
  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: observedParentId,
      managementIp: "10.100.101.4",
      managedById: new Set([MALAGUENO_CORE, parentId]),
      managedIdByHost: new Map([["10.100.101.4", parentId]]),
    }),
    parentId
  )
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, parentId],
      [{ fromDeviceId: MALAGUENO_CORE, toDeviceId: parentId }]
    ),
    [MALAGUENO_CORE]
  )
  const classifier = read("lib/network/discovery/interface-scope.ts")
  const observations = read("lib/network/discovery/observations.ts")
  assert.doesNotMatch(classifier, /AS5|AS6|AS7/)
  assert.doesNotMatch(observations, /AS5|AS6|AS7/)
})

test("1.7: neighbor administrado aliasa al discovery canónico por IP+agent, no por hostname", () => {
  const canonicalId = "dev-access-canonical"
  const observedId = "dev-access-observed"
  const radioId = "dev-radio-norte"
  const nodoId = "dev-nodo-este"
  const extraMacId = "dev-nodo-este-mac"
  const clienteId = "dev-cliente-sur"
  const wanPeerId = "dev-uplink-isp"
  const otherAgentId = "ag-other"
  const otherAgentDeviceId = "dev-other-agent-same-ip"
  const sameNameOtherIpId = "dev-same-name-other-ip"
  const unmatchedNeighborId = "dev-unmatched-neighbor"
  const catalog = [
    {
      id: MALAGUENO_CORE,
      managementIp: "177.53.120.11",
      agentId: AGENT,
      origin: "discovery",
    },
    {
      id: canonicalId,
      managementIp: "10.100.101.4",
      agentId: AGENT,
      origin: "discovery",
    },
    {
      id: observedId,
      managementIp: "10.100.101.4",
      agentId: AGENT,
      origin: "neighbor",
    },
    {
      id: otherAgentDeviceId,
      managementIp: "10.100.101.4",
      agentId: otherAgentId,
      origin: "discovery",
    },
    {
      id: sameNameOtherIpId,
      managementIp: "10.200.0.4",
      agentId: AGENT,
      origin: "discovery",
    },
  ]
  const managedById = new Set(catalog.map((item) => item.id))
  const managedIdByHost = new Map([
    ["177.53.120.11", MALAGUENO_CORE],
    ["10.100.101.4", canonicalId],
    ["10.200.0.4", sameNameOtherIpId],
  ])

  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: observedId,
      managementIp: "10.100.101.4",
      agentId: AGENT,
      origin: "neighbor",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    canonicalId
  )
  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: canonicalId,
      managementIp: "10.100.101.4",
      agentId: AGENT,
      origin: "discovery",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    canonicalId
  )
  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: unmatchedNeighborId,
      managementIp: "10.9.9.9",
      agentId: AGENT,
      origin: "neighbor",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    null
  )
  assert.equal(
    pickCanonicalManagedDeviceId({
      managementIp: "10.100.101.4",
      agentId: otherAgentId,
      managedDevices: catalog,
    }),
    otherAgentDeviceId
  )
  assert.notEqual(
    resolveLocalManagedDeviceId({
      deviceId: observedId,
      managementIp: "10.100.101.4",
      agentId: AGENT,
      origin: "neighbor",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    otherAgentDeviceId
  )
  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: otherAgentDeviceId,
      managementIp: "10.100.101.4",
      agentId: otherAgentId,
      origin: "discovery",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    otherAgentDeviceId
  )
  assert.equal(
    resolveLocalManagedDeviceId({
      deviceId: sameNameOtherIpId,
      managementIp: "10.200.0.4",
      agentId: AGENT,
      origin: "discovery",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    sameNameOtherIpId
  )
  assert.notEqual(
    resolveLocalManagedDeviceId({
      deviceId: observedId,
      managementIp: "10.100.101.4",
      agentId: AGENT,
      origin: "neighbor",
      managedById,
      managedIdByHost,
      managedDevices: catalog,
    }),
    sameNameOtherIpId
  )

  const nested = buildLocalCoreTopologyView({
    core: {
      id: canonicalId,
      hostname: "Access Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-access",
    observations: [
      {
        id: radioId,
        hostname: "Radio Norte",
        managementIp: "10.100.101.21",
        macAddress: null,
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "CRS326-24G-2S+",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: nodoId,
        hostname: "Nodo Este",
        managementIp: "10.100.101.22",
        macAddress: "aa:bb:cc:dd:ee:01",
        observedInterfaceName: "ether3,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: extraMacId,
        hostname: "Nodo Este",
        managementIp: null,
        macAddress: "aa:bb:cc:dd:ee:02",
        observedInterfaceName: "ether3,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: clienteId,
        hostname: "Cliente Sur",
        managementIp: "10.100.101.40",
        macAddress: null,
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "hAP ac2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: wanPeerId,
        hostname: "Uplink ISP",
        managementIp: "10.20.0.1",
        macAddress: null,
        observedInterfaceName: "ether1,WAN",
        observedInterfaceDescription: null,
        scope: "wan",
        platform: null,
        board: "CCR1009",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: MALAGUENO_CORE,
        hostname: "RB3011 - Core Malagueño",
        managementIp: "177.53.120.11",
        macAddress: null,
        observedInterfaceName: "ether1,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB3011UiAS",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
    ],
    links: [
      { fromDeviceId: canonicalId, toDeviceId: radioId, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: canonicalId, toDeviceId: nodoId, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: canonicalId, toDeviceId: extraMacId, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: canonicalId, toDeviceId: clienteId, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: canonicalId, toDeviceId: wanPeerId, fromInterfaceName: "ether1,WAN" },
    ],
    deviceMeta: new Map([
      [radioId, { deviceType: "switch", agentId: AGENT }],
      [nodoId, { deviceType: "router", agentId: AGENT }],
      [extraMacId, { deviceType: "router", agentId: AGENT }],
      [clienteId, { deviceType: "cpe", agentId: AGENT }],
    ]),
    requireOutgoingLink: true,
    excludeDeviceIds: new Set([MALAGUENO_CORE]),
  })
  const nestedIds = nested.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(nestedIds.includes(radioId), true)
  assert.equal(nestedIds.includes(nodoId), true)
  assert.equal(nestedIds.includes(extraMacId), false)
  assert.equal(nestedIds.includes(clienteId), false)
  assert.equal(nestedIds.includes(wanPeerId), false)
  assert.equal(nestedIds.includes(MALAGUENO_CORE), false)
  const ether3 = nested.interfaceGroups.find(
    (group) => group.interfaceName === "ether3,bridge1"
  )
  const nodo = ether3.devices.find((device) => device.hostname === "Nodo Este")
  assert.deepEqual(nodo.observations.map((item) => item.id).sort(), [extraMacId, nodoId].sort())
  assert.equal(nodo.managementIp, "10.100.101.22")
  const ether2 = nested.interfaceGroups.find(
    (group) => group.interfaceName === "ether2,bridge1"
  )
  assert.equal(ether2.cpes.map((device) => device.id).includes(clienteId), true)

  const coreLocal = buildLocalCoreTopologyView({
    core: {
      id: MALAGUENO_CORE,
      hostname: "RB3011 - Core Malagueño",
      managementIp: "177.53.120.11",
      operationalStatus: "online",
      lastPollAt: null,
    },
    jobId: "job-core",
    observations: [
      {
        id: observedId,
        hostname: "Access Malagueño",
        managementIp: "10.100.101.4",
        macAddress: "c4:ad:34:6a:93:ce",
        observedInterfaceName: "Bridge LAN - vlan101",
        observedInterfaceDescription: null,
        scope: "vlan",
        platform: "MikroTik",
        board: "RB960PGS",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
    ],
    links: [
      {
        fromDeviceId: MALAGUENO_CORE,
        toDeviceId: observedId,
        fromInterfaceName: "Bridge LAN - vlan101",
      },
    ],
    deviceMeta: new Map([
      [observedId, { deviceType: "router", agentId: AGENT }],
    ]),
  })
  const attached = attachNestedLocalTopology(
    coreLocal,
    new Map([[observedId, nested.interfaceGroups]]),
    managedById,
    managedIdByHost,
    catalog
  )
  const observedNode = attached.interfaceGroups
    .flatMap((group) => group.devices)
    .find((device) => device.id === observedId)
  assert.equal(observedNode.id, observedId)
  assert.equal(observedNode.managed, true)
  const downstreamIds = observedNode.downstream.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(downstreamIds.includes(radioId), true)
  assert.equal(downstreamIds.includes(nodoId), true)
  assert.equal(downstreamIds.includes(extraMacId), false)
  assert.equal(downstreamIds.includes(clienteId), false)
  assert.equal(downstreamIds.includes(wanPeerId), false)
  assert.equal(downstreamIds.includes(MALAGUENO_CORE), false)
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, canonicalId, observedId],
      [
        { fromDeviceId: MALAGUENO_CORE, toDeviceId: canonicalId },
        { fromDeviceId: MALAGUENO_CORE, toDeviceId: observedId },
      ]
    ),
    [MALAGUENO_CORE]
  )

  const resolver = read("lib/network/topology/local-view.ts")
  const resolveSrc = resolver.slice(
    resolver.indexOf("export function pickCanonicalManagedDeviceId"),
    resolver.indexOf("export function expandTopologyChildIdsWithManagedAliases")
  )
  assert.doesNotMatch(resolveSrc, /hostname/)
  assert.doesNotMatch(resolveSrc, /AS5|AS6|AS7|PowerBox/)
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /managedDevices/)
  assert.match(queries, /origin: device\.origin/)
  assert.doesNotMatch(queries, /AS5|AS6|AS7/)
})

test("1.8: el Core seleccionado no reaparece como downstream por MAC de otra interfaz", () => {
  const accessId = "dev-access-canonical"
  const coreAliasLan = "dev-core-alias-lan"
  const coreAliasNet = "dev-core-alias-net"
  const sameNameOtherMac = "dev-same-name-other-mac"
  const sameIpForeignMac = "dev-same-ip-foreign-mac"
  const radioId = "dev-radio-norte"
  const asFive = "dev-radio-cinco"
  const asSix = "dev-radio-seis"
  const asSeven = "dev-radio-siete"
  const coreIfaces = [
    {
      deviceId: MALAGUENO_CORE,
      name: "ether1 - WAN",
      description: null,
      macAddress: "CC:2D:E0:5A:E6:F6",
    },
    {
      deviceId: MALAGUENO_CORE,
      name: "ether2",
      description: "Enlace",
      macAddress: "CC:2D:E0:5A:E6:F7",
    },
    {
      deviceId: MALAGUENO_CORE,
      name: "ether3",
      description: "LAN NETPOWER",
      macAddress: "CC:2D:E0:5A:E6:F8",
    },
  ]
  const excludedMacs = collectLocalTopologyMacs(coreIfaces, MALAGUENO_CORE)
  assert.equal(excludedMacs.has("cc:2d:e0:5a:e6:f7"), true)
  assert.equal(
    observationMatchesExcludedMacs(
      { fingerprint: "mac:cc:2d:e0:5a:e6:f8" },
      excludedMacs
    ),
    true
  )

  const nested = buildLocalCoreTopologyView({
    core: {
      id: accessId,
      hostname: "Access Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-access",
    observations: [
      {
        id: MALAGUENO_CORE,
        hostname: "RB3011 - Core Malagueño",
        managementIp: "177.53.120.11",
        macAddress: "CC:2D:E0:5A:E6:F6",
        observedInterfaceName: "ether1,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB3011UiAS",
        version: null,
        discoveredBy: "mndp",
        origin: "discovery",
      },
      {
        id: coreAliasLan,
        hostname: "RB3011 - Core Malagueño",
        managementIp: "10.100.101.1",
        macAddress: "CC:2D:E0:5A:E6:F7",
        observedInterfaceName: "ether1,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB3011UiAS",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: coreAliasNet,
        hostname: "RB3011 - Core Malagueño",
        managementIp: "10.168.1.1",
        macAddress: "CC:2D:E0:5A:E6:F8",
        observedInterfaceName: "ether1,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB3011UiAS",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: sameNameOtherMac,
        hostname: "RB3011 - Core Malagueño",
        managementIp: "10.9.9.9",
        macAddress: "AA:BB:CC:DD:EE:FF",
        observedInterfaceName: "ether1,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB3011UiAS",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: sameIpForeignMac,
        hostname: "Otro Nodo",
        managementIp: "177.53.120.11",
        macAddress: "11:22:33:44:55:66",
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "CRS326-24G-2S+",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: radioId,
        hostname: "Radio Norte",
        managementIp: "10.100.101.21",
        macAddress: "22:22:22:22:22:21",
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "CRS326-24G-2S+",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: asFive,
        hostname: "Radio Cinco",
        managementIp: "10.100.101.11",
        macAddress: "22:22:22:22:22:05",
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: asSix,
        hostname: "Radio Seis",
        managementIp: "10.100.101.14",
        macAddress: "22:22:22:22:22:06",
        observedInterfaceName: "ether3,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD r2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: asSeven,
        hostname: "Radio Siete",
        managementIp: "10.100.101.13",
        macAddress: "22:22:22:22:22:07",
        observedInterfaceName: "ether4,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB911G-5HPacD",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
    ],
    links: [
      { fromDeviceId: accessId, toDeviceId: MALAGUENO_CORE, fromInterfaceName: "ether1,bridge1" },
      { fromDeviceId: accessId, toDeviceId: coreAliasLan, fromInterfaceName: "ether1,bridge1" },
      { fromDeviceId: accessId, toDeviceId: coreAliasNet, fromInterfaceName: "ether1,bridge1" },
      { fromDeviceId: accessId, toDeviceId: sameNameOtherMac, fromInterfaceName: "ether1,bridge1" },
      { fromDeviceId: accessId, toDeviceId: sameIpForeignMac, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: accessId, toDeviceId: radioId, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: accessId, toDeviceId: asFive, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: accessId, toDeviceId: asSix, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: accessId, toDeviceId: asSeven, fromInterfaceName: "ether4,bridge1" },
    ],
    deviceMeta: new Map([
      [MALAGUENO_CORE, { deviceType: "core" }],
      [coreAliasLan, { deviceType: "router" }],
      [coreAliasNet, { deviceType: "router" }],
      [sameNameOtherMac, { deviceType: "router" }],
      [sameIpForeignMac, { deviceType: "switch" }],
      [radioId, { deviceType: "switch" }],
      [asFive, { deviceType: "router" }],
      [asSix, { deviceType: "router" }],
      [asSeven, { deviceType: "router" }],
    ]),
    requireOutgoingLink: true,
    excludeDeviceIds: new Set([MALAGUENO_CORE]),
    excludeMacs: excludedMacs,
    coreInterfaces: coreIfaces,
  })
  const nestedIds = nested.interfaceGroups.flatMap((group) =>
    group.devices.map((device) => device.id)
  )
  assert.equal(nestedIds.includes(MALAGUENO_CORE), false)
  assert.equal(nestedIds.includes(coreAliasLan), false)
  assert.equal(nestedIds.includes(coreAliasNet), false)
  assert.equal(nestedIds.includes(sameNameOtherMac), true)
  assert.equal(nestedIds.includes(sameIpForeignMac), true)
  assert.equal(nestedIds.includes(radioId), true)
  assert.equal(nestedIds.includes(asFive), true)
  assert.equal(nestedIds.includes(asSix), true)
  assert.equal(nestedIds.includes(asSeven), true)
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, accessId],
      [{ fromDeviceId: MALAGUENO_CORE, toDeviceId: accessId }]
    ),
    [MALAGUENO_CORE]
  )
  const localView = read("lib/network/topology/local-view.ts")
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /excludeMacs/)
  assert.match(queries, /collectLocalTopologyMacs/)
  assert.match(read("lib/network/discovery/observation-queries.ts"), /mac_address/)
  assert.doesNotMatch(localView, /177\.53\.120\.11/)
  assert.doesNotMatch(localView, /AS 6/)
})

test("1.9: infraestructura en el mismo puerto y board se agrupa visualmente sin fusionar filas", () => {
  const parentId = "dev-access-canonical"
  const first = "dev-radio-a"
  const second = "dev-radio-b"
  const otherIface = "dev-radio-other-port"
  const otherBoard = "dev-radio-other-board"
  const clienteA = "dev-cliente-a"
  const clienteB = "dev-cliente-b"
  assert.equal(
    infraVisualGroupKey({
      hostname: "Radio Norte",
      board: "RB921GS-5HPacD r2",
      origin: "neighbor",
      interfaceName: "ether3,bridge1",
    }),
    infraVisualGroupKey({
      hostname: "Radio Norte",
      board: "RB921GS-5HPacD r2",
      origin: "neighbor",
      interfaceName: "ether3,bridge1",
    })
  )
  assert.equal(
    infraVisualGroupKey({
      hostname: "Radio Norte",
      board: "RB921GS-5HPacD r2",
      origin: "neighbor",
    }),
    null
  )
  const nested = buildLocalCoreTopologyView({
    core: {
      id: parentId,
      hostname: "Access Malagueño",
      managementIp: "10.100.101.4",
      operationalStatus: null,
      lastPollAt: null,
    },
    jobId: "job-access",
    observations: [
      {
        id: first,
        hostname: "Radio Norte",
        managementIp: null,
        macAddress: "CC:2D:E0:5B:80:08",
        observedInterfaceName: "ether3,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD r2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: second,
        hostname: "Radio Norte",
        managementIp: "10.100.101.14",
        macAddress: "CC:2D:E0:5B:80:0A",
        observedInterfaceName: "ether3,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD r2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: otherIface,
        hostname: "Radio Norte",
        managementIp: "10.100.101.15",
        macAddress: "CC:2D:E0:5B:80:0C",
        observedInterfaceName: "ether4,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "RB921GS-5HPacD r2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: otherBoard,
        hostname: "Radio Norte",
        managementIp: "10.100.101.16",
        macAddress: "CC:2D:E0:5B:80:0E",
        observedInterfaceName: "ether3,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "CRS326-24G-2S+",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: clienteA,
        hostname: "Cliente Sur",
        managementIp: "10.100.101.40",
        macAddress: "aa:aa:aa:aa:aa:01",
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "hAP ac2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
      {
        id: clienteB,
        hostname: "Cliente Sur",
        managementIp: "10.100.101.41",
        macAddress: "aa:aa:aa:aa:aa:02",
        observedInterfaceName: "ether2,bridge1",
        observedInterfaceDescription: null,
        scope: "lan",
        platform: "MikroTik",
        board: "hAP ac2",
        version: null,
        discoveredBy: "mndp",
        origin: "neighbor",
      },
    ],
    links: [
      { fromDeviceId: parentId, toDeviceId: first, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: parentId, toDeviceId: second, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: parentId, toDeviceId: otherIface, fromInterfaceName: "ether4,bridge1" },
      { fromDeviceId: parentId, toDeviceId: otherBoard, fromInterfaceName: "ether3,bridge1" },
      { fromDeviceId: parentId, toDeviceId: clienteA, fromInterfaceName: "ether2,bridge1" },
      { fromDeviceId: parentId, toDeviceId: clienteB, fromInterfaceName: "ether2,bridge1" },
    ],
    deviceMeta: new Map([
      [first, { deviceType: "router" }],
      [second, { deviceType: "router" }],
      [otherIface, { deviceType: "router" }],
      [otherBoard, { deviceType: "switch" }],
      [clienteA, { deviceType: "cpe" }],
      [clienteB, { deviceType: "cpe" }],
    ]),
    requireOutgoingLink: true,
  })
  const ether3 = nested.interfaceGroups.find(
    (group) => group.interfaceName === "ether3,bridge1"
  )
  const ether4 = nested.interfaceGroups.find(
    (group) => group.interfaceName === "ether4,bridge1"
  )
  const ether2 = nested.interfaceGroups.find(
    (group) => group.interfaceName === "ether2,bridge1"
  )
  const grouped = ether3.devices.filter((device) => device.hostname === "Radio Norte")
  assert.equal(grouped.length, 2)
  const collapsed = grouped.find((device) => device.managementIp === "10.100.101.14")
  assert.equal(collapsed.observations.length, 2)
  assert.deepEqual(
    collapsed.observations.map((item) => item.id).sort(),
    [first, second].sort()
  )
  assert.equal(
    grouped.some((device) => device.id === otherBoard),
    true
  )
  assert.equal(ether4.devices.map((device) => device.id).includes(otherIface), true)
  assert.equal(ether2.devices.length, 0)
  assert.equal(ether2.cpes.length, 2)
  assert.equal(ether2.cpes.map((device) => device.id).includes(clienteA), true)
  assert.equal(ether2.cpes.map((device) => device.id).includes(clienteB), true)
  assert.doesNotMatch(read("lib/network/topology/local-view.ts"), /AS 6/)
})

test("1.3 G/H: probar conexión no lanza discovery; descubrir exige conexión verificada", () => {
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  assert.match(dialog, /Conexión verificada/)
  assert.match(dialog, /No se pudo conectar/)
  assert.match(dialog, /Sin probar/)
  assert.match(dialog, /connection === "verified"/)
  assert.match(dialog, /intent === "discover" && connection !== "verified"/)
  assert.match(dialog, /jobType === "discovery"/)
  assert.match(dialog, /Cerrar/)
  const service = read("lib/network/management/service.ts")
  assert.match(service, /input\.intent === "test" \|\| input\.intent === "discover"/)
  assert.match(service, /!password\.trim\(\)/)
  assert.match(service, /DISCOVERY_EXECUTABLE_JOB_TYPE/)
  assert.match(service, /DIAGNOSTIC_EXECUTABLE_JOB_TYPE/)
})

test("1.3 I/J: administrar y descubrir permanece en Topology y no cambia el Root", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  assert.doesNotMatch(dialog, /["']\/network\/discovery["']/)
  assert.match(screen, /selectedCoreId && cores.some/)
  assert.match(screen, /invalidateQueries/)
  assert.match(
    read("lib/network/topology/queries.ts"),
    /deviceId \? cores.find/
  )
})

function topologyJob(input) {
  return {
    id: "job-1",
    jobType: "diagnostic",
    status: "failed",
    targetId: "target-1",
    targetHost: "10.100.101.4",
    deviceId: POWERBOX,
    errorMessage: null,
    createdAt: "2026-10-03T19:14:41.000Z",
    completedAt: "2026-10-03T19:14:51.000Z",
    ...input,
  }
}

function powerboxManagementInput(input) {
  return {
    managed: true,
    agentId: AGENT,
    deviceId: POWERBOX,
    managementIp: "10.100.101.4",
    jobs: [],
    targets: [
      {
        agentId: AGENT,
        host: "10.100.101.4",
        updatedAt: "2026-10-03T19:14:40.000Z",
        hasSecret: true,
      },
    ],
    ...input,
  }
}

test("1.4 A: un dispositivo administrado sigue mostrando acciones", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /Reemplazar credenciales/)
  assert.match(screen, /Probar conexión/)
  assert.match(screen, /Descubrir ahora/)
  assert.match(screen, /canAdminister/)
  assert.match(screen, /canReplace/)
})

test("1.4 B: managed + secret no disponible permite reemplazar credenciales", () => {
  const state = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          errorMessage: NETWORK_TARGET_DECRYPT_ERROR,
        }),
      ],
    })
  )
  assert.equal(state.managed, true)
  assert.equal(state.credential, "unavailable")
  assert.equal(state.decryptError, true)
  assert.equal(state.canReplace, true)
  assert.equal(state.canDiscover, false)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /Credencial/)
  assert.match(screen, /No disponible/)
  assert.match(screen, /Reemplazar credenciales/)
})

test("1.4 C: diagnostic exitoso muestra conexión verificada y no es discovery", () => {
  const state = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          status: "completed",
          errorMessage: null,
        }),
      ],
    })
  )
  assert.equal(state.connection, "verified")
  assert.equal(state.discovery, "pending")
  assert.equal(state.credential, "available")
  const service = read("lib/network/management/service.ts")
  assert.match(service, /DIAGNOSTIC_EXECUTABLE_JOB_TYPE/)
  assert.match(service, /input\.intent === "test"/)
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  assert.match(dialog, /jobType === "discovery"/)
})

test("1.4 D: diagnostic fallido es error de conexión, no Discovery fallido", () => {
  const state = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          errorMessage: "authentication failed",
        }),
      ],
    })
  )
  assert.equal(state.connection, "error")
  assert.equal(state.discovery, "pending")
  assert.equal(state.credential, "available")
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /Error de conexión/)
  assert.doesNotMatch(screen, /Discovery: \{jobLabel/)
})

test("1.4 E: decrypt error muestra credencial no disponible", () => {
  const state = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          errorMessage: NETWORK_TARGET_DECRYPT_ERROR,
        }),
      ],
    })
  )
  assert.equal(state.credential, "unavailable")
  assert.equal(state.connection, "untested")
  assert.equal(state.discovery, "pending")
  assert.equal(state.decryptError, true)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /No se pudo descifrar la credencial del destino/)
  assert.match(
    read("lib/network/jobs/agent-execution.ts"),
    /NETWORK_TARGET_DECRYPT_ERROR/
  )
})

test("1.4 F: discovery pendiente si nunca existió job discovery", () => {
  const state = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          errorMessage: NETWORK_TARGET_DECRYPT_ERROR,
        }),
      ],
    })
  )
  assert.equal(state.discovery, "pending")
  assert.equal(state.discoveryJob, null)
})

test("1.4 G: discovery exitoso muestra Discovery completado", () => {
  const state = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          id: "job-discovery",
          jobType: "discovery",
          status: "completed",
          errorMessage: null,
        }),
      ],
    })
  )
  assert.equal(state.discovery, "completed")
  assert.equal(state.connection, "untested")
})

test("1.4 H: Descubrir ahora reutiliza target y no pide password", () => {
  const service = read("lib/network/management/service.ts")
  assert.match(service, /input\.intent === "test" \|\| input\.intent === "discover"/)
  assert.match(service, /existingTarget\?\.hasSecret/)
  assert.match(service, /DISCOVERY_EXECUTABLE_JOB_TYPE/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /Descubrir ahora/)
  assert.match(screen, /postNetworkDeviceManage/)
  assert.match(screen, /password: ""/)
  const request = read("lib/network/topology/manage-request.ts")
  assert.match(request, /password: input\.password \?\? ""/)
  assert.match(request, /intent: input\.intent/)
})

test("1.4 I: reemplazar credenciales actualiza el target y no duplica", () => {
  const service = read("lib/network/management/service.ts")
  assert.match(service, /intent === "replace"/)
  assert.match(service, /upsertNetworkDiscoveryTarget/)
  assert.match(service, /findNetworkDiscoveryTargetByAgentHost/)
  assert.match(service, /job: null/)
  assert.match(service, /lockedAgentId/)
  const targets = read("lib/network/targets/queries.ts")
  assert.match(targets, /if \(existing\)/)
  assert.match(targets, /updateNetworkDiscoveryTarget/)
  const dialog = read("components/network/network-topology-manage-dialog.tsx")
  assert.match(dialog, /mode === "replace"/)
  assert.match(dialog, /No se crea un target duplicado/)
  const afterReplace = buildObservedDeviceManagementState(
    powerboxManagementInput({
      jobs: [
        topologyJob({
          errorMessage: NETWORK_TARGET_DECRYPT_ERROR,
          completedAt: "2026-10-03T19:14:51.000Z",
        }),
      ],
      targets: [
        {
          agentId: AGENT,
          host: "10.100.101.4",
          updatedAt: "2026-10-03T19:30:00.000Z",
          hasSecret: true,
        },
      ],
    })
  )
  assert.equal(afterReplace.credential, "available")
  assert.equal(afterReplace.decryptError, false)
  assert.equal(afterReplace.canDiscover, true)
})

test("1.4 J: Root/Managed de Topology 1.3 se conserva", () => {
  assert.deepEqual(
    selectTopologyRootIds(
      [MALAGUENO_CORE, POWERBOX],
      [{ fromDeviceId: MALAGUENO_CORE, toDeviceId: POWERBOX }]
    ),
    [MALAGUENO_CORE]
  )
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /selectTopologyRootIds\(managedIdList, directedLinks\)/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /selectedCoreId && cores.some/)
})

const PROD_CORE = "834ca12a-90f2-4b98-87cf-257fe9970c58"
const PROD_POWERBOX = "e03ef5fe-97c9-489d-9806-1cf136a438db"
const PROD_DUP = "c0ea013c-0276-4cd9-ac9a-976204629c38"

test("root: managed sin padre aparece como Core", () => {
  assert.deepEqual(selectTopologyRootIds([PROD_CORE], []), [PROD_CORE])
})

test("root: managed con padre managed no aparece como Core", () => {
  assert.deepEqual(
    selectTopologyRootIds(
      [PROD_CORE, PROD_POWERBOX],
      [{ fromDeviceId: PROD_CORE, toDeviceId: PROD_POWERBOX }]
    ),
    [PROD_CORE]
  )
})

test("root: Core + PowerBox, selector solamente Core", () => {
  const reverseAndForward = [
    { fromDeviceId: PROD_CORE, toDeviceId: PROD_POWERBOX },
    { fromDeviceId: PROD_POWERBOX, toDeviceId: PROD_CORE },
  ]
  assert.deepEqual(
    selectTopologyRootIds([PROD_CORE, PROD_POWERBOX], reverseAndForward),
    [PROD_CORE]
  )
})

test("root: segundo destino managed con padre no se convierte en Core", () => {
  const otherChild = "aaaaaaaa-0000-4000-8000-000000000010"
  assert.deepEqual(
    selectTopologyRootIds(
      [PROD_CORE, PROD_POWERBOX, otherChild],
      [
        { fromDeviceId: PROD_CORE, toDeviceId: PROD_POWERBOX },
        { fromDeviceId: PROD_CORE, toDeviceId: otherChild },
      ]
    ),
    [PROD_CORE]
  )
})

test("root: no usa hostname, origin ni device_type", () => {
  const localView = read("lib/network/topology/local-view.ts")
  const rootSrc = localView.slice(
    localView.indexOf("export function selectTopologyRootIds"),
    localView.indexOf("export function buildLocalCoreTopologyView")
  )
  assert.match(rootSrc, /listManagedParentIds/)
  assert.doesNotMatch(rootSrc, /hostname/)
  assert.doesNotMatch(rootSrc, /origin/)
  assert.doesNotMatch(rootSrc, /deviceType|device_type/)
  assert.doesNotMatch(rootSrc, /PowerBox|10\.100\.101\.4|177\.53/)
  assert.doesNotMatch(localView, /lib\/network\/alarms/)
  const parents = read("lib/network/topology/managed-parents.ts")
  assert.match(parents, /export function listManagedParentIds/)
  assert.match(parents, /countOutgoing/)
  const queries = read("lib/network/topology/queries.ts")
  assert.match(queries, /selectTopologyRootIds\(managedIdList, directedLinks\)/)
  assert.doesNotMatch(queries, /from_interface_name/)
  assert.doesNotMatch(queries, /lib\/network\/alarms/)
})

test("root: soft-delete del duplicado no rompe Core → PowerBox canónico", () => {
  assert.deepEqual(
    selectTopologyRootIds(
      [PROD_CORE, PROD_POWERBOX],
      [{ fromDeviceId: PROD_CORE, toDeviceId: PROD_POWERBOX }]
    ),
    [PROD_CORE]
  )
  assert.equal(
    selectTopologyRootIds(
      [PROD_CORE, PROD_POWERBOX, PROD_DUP],
      [{ fromDeviceId: PROD_CORE, toDeviceId: PROD_POWERBOX }]
    ).includes(PROD_POWERBOX),
    false
  )
  assert.equal(
    selectTopologyRootIds(
      [PROD_CORE, PROD_POWERBOX],
      [{ fromDeviceId: PROD_CORE, toDeviceId: PROD_DUP }]
    ).includes(PROD_POWERBOX),
    true
  )
})


