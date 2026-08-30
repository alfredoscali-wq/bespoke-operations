import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { ACTIVITY_ACTIONS, isActivityAction } from "../lib/activity-engine/activity-actions.ts"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../lib/audit/types.ts"
import { resolveTrustedCompanyId } from "../lib/network/integrity.ts"
import { parseMonitoringSnapshot } from "../lib/network/monitoring/parse-snapshot.ts"
import { nextMonitoringOperationalState } from "../lib/network/monitoring/status.ts"
import {
  MONITORING_OFFLINE_FAILURE_THRESHOLD,
  MONITORING_POLL_INTERVAL_MS,
} from "../lib/network/monitoring/contract.ts"
import { compactMonitoringResult, stripNetworkSecrets } from "../lib/network/secrets.ts"
import { mapMikrotikFactsToMonitoring } from "../network-agent/src/connectors/mikrotik/map-monitoring.ts"
import { getNetworkConnector } from "../network-agent/src/connectors/registry.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

test("monitoring no altera inventario de discovery ni isp_connections", () => {
  const sql = read("supabase/migrations/20261201000100_network_2_monitoring.sql")
  assert.match(sql, /CREATE TABLE public.network_device_status/)
  assert.match(sql, /CREATE TABLE public.network_interface_status/)
  assert.match(sql, /REFERENCES public.network_devices/)
  assert.match(sql, /REFERENCES public.network_interfaces/)
  assert.match(sql, /auth_user_has_allowed_module\('network'\)/)
  assert.match(sql, /auth_is_demo_platform_read_only\(\)/)
  assert.doesNotMatch(sql, /ALTER TABLE public.isp_connections/)
  assert.doesNotMatch(sql, /ALTER TABLE public.network_devices/)
  assert.doesNotMatch(sql, /ALTER TABLE public.network_interfaces /)
  assert.doesNotMatch(sql, /ALTER TABLE public.network_links/)
})

test("Cloud no habla RouterOS; el poll vive en el Agent", () => {
  const persist = read("lib/network/jobs/agent-execution.ts")
  assert.match(persist, /persistMonitoringSnapshot/)
  assert.match(persist, /submitNetworkDiscoveryJobResult/)
  assert.doesNotMatch(persist, /\/system\/resource|8728|RouterOS/)
  assert.match(read("network-agent/src/connectors/mikrotik/index.ts"), /async poll\(/)
  assert.match(read("network-agent/src/connectors/mikrotik/index.ts"), /async discover\(/)
  assert.match(read("network-agent/src/index.ts"), /executeDiscoveryJob/)
  assert.match(read("network-agent/src/index.ts"), /executeMonitoringJob/)
})

test("claim admite discovery y monitoring; auto-poll 60s; 3 fallos", () => {
  const claim = read("lib/network/jobs/queries.ts")
  assert.match(claim, /\.in\("job_type", \["discovery", "monitoring"\]\)/)
  assert.equal(MONITORING_POLL_INTERVAL_MS, 60_000)
  assert.equal(MONITORING_OFFLINE_FAILURE_THRESHOLD, 3)
  const execution = read("lib/network/jobs/agent-execution.ts")
  assert.match(execution, /findDueMonitoringDevice/)
  assert.match(execution, /MONITORING_EXECUTABLE_JOB_TYPE/)
  assert.match(execution, /El job ya fue finalizado/)
})

test("POST jobs: deviceId es monitoring, targetId sigue siendo discovery, sin password", () => {
  const jobsRoute = read("app/api/network/jobs/route.ts")
  assert.match(jobsRoute, /deviceId/)
  assert.match(jobsRoute, /jobType: "monitoring"/)
  assert.match(jobsRoute, /jobType: "discovery"/)
  assert.doesNotMatch(jobsRoute, /password/)
  assert.doesNotMatch(jobsRoute, /username/)
  assert.match(read("app/api/network/v1/jobs/[jobId]/result/route.ts"), /submitNetworkAgentJobResult/)
})

test("el tenant autenticado ignora company_id del resultado de monitoring", () => {
  const trusted = "00000000-0000-4000-8000-000000000002"
  assert.equal(
    resolveTrustedCompanyId(trusted, "00000000-0000-4000-8000-000000000001"),
    trusted
  )
})

test("payload de monitoring se valida y no incluye secretos", () => {
  const invalid = parseMonitoringSnapshot({ vendor: "mikrotik" })
  assert.equal(invalid.ok, false)

  const parsed = parseMonitoringSnapshot({
    vendor: "mikrotik",
    deviceId: "dev-1",
    targetId: "tgt-1",
    host: "192.168.56.2",
    hostname: "CORE-LAB",
    routerosVersion: "7.16",
    uptime: "1d2h",
    cpuLoad: 12,
    memoryTotal: 1024,
    memoryAvailable: 512,
    temperature: null,
    interfaces: [
      {
        name: "ether2",
        status: "up",
        speedMbps: 1000,
        rxBytes: 10,
        txBytes: 20,
        rxPackets: 1,
        txPackets: 2,
        rxErrors: 0,
        txErrors: 0,
        rxDrops: 0,
        txDrops: 0,
      },
    ],
    warnings: [],
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.snapshot.interfaces[0].name, "ether2")
    assert.equal(parsed.snapshot.temperature, null)
  }

  const stripped = stripNetworkSecrets({
    deviceId: "dev-1",
    host: "10.10.1.2",
    password: "secret",
  })
  assert.deepEqual(stripped, { deviceId: "dev-1", host: "10.10.1.2" })

  const compact = compactMonitoringResult({
    vendor: "mikrotik",
    deviceId: "dev-1",
    targetId: "tgt-1",
    host: "10.10.1.2",
    status: "online",
    consecutiveFailures: 0,
    hostname: "NODO-NORTE",
    warnings: [],
  })
  assert.equal("password" in compact, false)
})

test("UNKNOWN permanece hasta 3 fallos; éxito vuelve a ONLINE", () => {
  const firstFail = nextMonitoringOperationalState({
    previousStatus: "unknown",
    consecutiveFailures: 0,
    success: false,
  })
  assert.equal(firstFail.status, "unknown")
  assert.equal(firstFail.consecutiveFailures, 1)

  const secondFail = nextMonitoringOperationalState({
    previousStatus: "online",
    consecutiveFailures: 1,
    success: false,
  })
  assert.equal(secondFail.status, "online")
  assert.equal(secondFail.consecutiveFailures, 2)

  const thirdFail = nextMonitoringOperationalState({
    previousStatus: "online",
    consecutiveFailures: 2,
    success: false,
  })
  assert.equal(thirdFail.status, "offline")
  assert.equal(thirdFail.consecutiveFailures, 3)

  const recovered = nextMonitoringOperationalState({
    previousStatus: "offline",
    consecutiveFailures: 3,
    success: true,
  })
  assert.equal(recovered.status, "online")
  assert.equal(recovered.consecutiveFailures, 0)

  const firstSuccess = nextMonitoringOperationalState({
    previousStatus: "unknown",
    consecutiveFailures: 0,
    success: true,
  })
  assert.equal(firstSuccess.status, "online")
  assert.equal(firstSuccess.consecutiveFailures, 0)
})

test("mapper MikroTik de polling arma métricas e interfaces nullable", () => {
  const snapshot = mapMikrotikFactsToMonitoring({
    host: "192.168.56.2",
    deviceId: "dev-1",
    targetId: "tgt-1",
    identity: { name: "CORE-LAB" },
    resource: {
      version: "7.16.1",
      uptime: "1w2d",
      "cpu-load": "8",
      "total-memory": "1048576",
      "free-memory": "524288",
    },
    health: [],
    interfaces: [
      {
        name: "ether2",
        running: "true",
        disabled: "false",
        speed: "1Gbps",
        "rx-byte": "1000",
        "tx-byte": "2000",
        "rx-packet": "10",
        "tx-packet": "20",
        "rx-error": "0",
        "tx-error": "1",
        "rx-drop": "0",
        "tx-drop": "2",
      },
    ],
  })

  assert.equal(snapshot.hostname, "CORE-LAB")
  assert.equal(snapshot.cpuLoad, 8)
  assert.equal(snapshot.temperature, null)
  assert.equal(snapshot.interfaces[0].status, "up")
  assert.equal(snapshot.interfaces[0].speedMbps, 1000)
  assert.equal(snapshot.interfaces[0].txErrors, 1)
  assert.equal(snapshot.interfaces[0].txDrops, 2)
})

test("Activity y Audit de cambio de estado operativo", () => {
  assert.equal(isActivityAction(ACTIVITY_ACTIONS.DEVICE_STATUS_CHANGED), true)
  assert.equal(AUDIT_ACTIONS.NETWORK_DEVICE_STATUS_CHANGED, "NETWORK_DEVICE_STATUS_CHANGED")
  assert.equal(AUDIT_ENTITY_TYPES.NETWORK_DEVICE, "network_device")
  const mikrotik = getNetworkConnector({
    vendor: "mikrotik",
    targetId: "t",
    siteId: null,
  })
  assert.equal(typeof mikrotik.poll, "function")
  assert.equal(typeof mikrotik.discover, "function")
})

function functionSource(source, name) {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `no se encontró ${name}`)
  const next = source.indexOf("\nexport async function ", start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}

test("auto-poll solo considera targets cuyo host coincide con management_ip", () => {
  const queries = read("lib/network/monitoring/queries.ts")
  const due = functionSource(queries, "findDueMonitoringDevice")
  const manual = functionSource(queries, "resolveMonitoringTargetForDevice")

  assert.doesNotMatch(due, /exact \?\? targets\[0\]/)
  assert.doesNotMatch(due, /targets\[0\]/)
  assert.match(due, /item\.host\.trim\(\) === device\.management_ip\?\.trim\(\)/)
  assert.match(due, /if \(!target\) continue/)
  assert.match(due, /\.eq\("company_id", input\.companyId\)/)
  assert.match(due, /\.eq\("agent_id", input\.agentId\)/)
  assert.doesNotMatch(due, /origin/)

  assert.match(manual, /exact \?\? targets\[0\]/)

  const unauthorizedNeighbors = ["10.10.1.1", "10.10.2.1"]
  for (const ip of unauthorizedNeighbors) {
    assert.equal(
      ip === "192.168.56.2",
      false,
      `${ip} no es el host del target CORE-LAB y no debe auto-pollarse`
    )
  }
})
