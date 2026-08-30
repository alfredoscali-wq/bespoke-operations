import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"
import { displayMonitoringStatus } from "../lib/network/monitoring/status.ts"
import {
  formatTopologyLinkLabel,
  mergeTopologyEdges,
} from "../lib/network/topology/graph.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
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
  assert.match(queries, /nodes/)
  assert.match(queries, /edges: mergeTopologyEdges/)
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
  assert.doesNotMatch(query, /origin/)
  assert.match(query, /kind: managed \? "managed" : "neighbor"/)
})

test("6-8: no se inventan ni duplican enlaces; se conservan interfaces", () => {
  const query = read("lib/network/topology/queries.ts")
  assert.match(query, /from\("network_links"\)/)
  assert.doesNotMatch(query, /agent_id === .*agent_id/)
  assert.match(query, /mergeTopologyEdges\(rawLinks\)/)

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

test("16-17: no hay polling periódico ni Realtime en topology", () => {
  const hook = read("lib/network/react-query/use-network-topology-query.ts")
  assert.doesNotMatch(hook, /refetchInterval/)
  assert.doesNotMatch(hook, /NETWORK_QUERY_OPTIONS/)
  assert.match(hook, /staleTime: Infinity/)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.doesNotMatch(screen, /refetchInterval/)
  assert.doesNotMatch(screen, /realtime|channel\(|supabase\.channel/i)
  assert.doesNotMatch(hook, /realtime|channel\(/i)
})
