import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { NETWORK_MONITORING_STATUS_TTL_MS } from "../lib/network/constants.ts"
import { displayMonitoringStatus } from "../lib/network/monitoring/status.ts"

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

const now = Date.parse("2026-08-30T16:00:00.000Z")
const recent = new Date(now - 60_000).toISOString()
const atTtl = new Date(now - NETWORK_MONITORING_STATUS_TTL_MS).toISOString()
const stale = new Date(now - NETWORK_MONITORING_STATUS_TTL_MS - 1).toISOString()

test("TTL de estado operativo es 5 minutos", () => {
  assert.equal(NETWORK_MONITORING_STATUS_TTL_MS, 300_000)
})

test("1: online reciente → online", () => {
  assert.equal(displayMonitoringStatus("online", recent, now), "online")
})

test("2: online exactamente en límite TTL → unknown", () => {
  assert.equal(displayMonitoringStatus("online", atTtl, now), "unknown")
})

test("3: online stale → unknown", () => {
  assert.equal(displayMonitoringStatus("online", stale, now), "unknown")
})

test("4: offline reciente → offline", () => {
  assert.equal(displayMonitoringStatus("offline", recent, now), "offline")
})

test("5: offline exactamente en límite TTL → unknown", () => {
  assert.equal(displayMonitoringStatus("offline", atTtl, now), "unknown")
})

test("6: offline stale → unknown", () => {
  assert.equal(displayMonitoringStatus("offline", stale, now), "unknown")
})

test("7: degraded reciente → degraded", () => {
  assert.equal(displayMonitoringStatus("degraded", recent, now), "degraded")
})

test("8: degraded stale → unknown", () => {
  assert.equal(displayMonitoringStatus("degraded", stale, now), "unknown")
})

test("9: unknown → unknown", () => {
  assert.equal(displayMonitoringStatus("unknown", recent, now), "unknown")
  assert.equal(displayMonitoringStatus("unknown", stale, now), "unknown")
})

test("10: null last_poll_at → unknown", () => {
  assert.equal(displayMonitoringStatus("online", null, now), "unknown")
  assert.equal(displayMonitoringStatus("offline", undefined, now), "unknown")
})

test("11: timestamp inválido → unknown", () => {
  assert.equal(displayMonitoringStatus("online", "not-a-date", now), "unknown")
  assert.equal(displayMonitoringStatus("online", "", now), "unknown")
})

test("12: offline con last_success_at viejo pero last_poll_at fresco → offline", () => {
  assert.equal(displayMonitoringStatus("offline", recent, now), "offline")
  const statusSource = read("lib/network/monitoring/status.ts")
  const displayFn = functionSource(statusSource, "displayMonitoringStatus")
  assert.doesNotMatch(displayFn, /last_success_at/)
  assert.doesNotMatch(displayFn, /lastSuccessAt/)
})

test("13: no se modifica ni persiste unknown por TTL", () => {
  const persist = functionSource(
    read("lib/network/monitoring/queries.ts"),
    "persistMonitoringSnapshot"
  )
  assert.doesNotMatch(persist, /displayMonitoringStatus/)
  assert.match(persist, /nextMonitoringOperationalState/)
  assert.doesNotMatch(persist, /NETWORK_MONITORING_STATUS_TTL_MS/)
})

test("14-16: list, detail y summary usan la misma semántica de display", () => {
  const queries = read("lib/network/monitoring/queries.ts")
  const list = functionSource(queries, "listNetworkDeviceOperationalStatuses")
  const get = functionSource(queries, "getNetworkDeviceMonitoring")
  const map = functionSource(queries, "mapDeviceStatusRow")
  const count = functionSource(queries, "countNetworkMonitoringSummary")

  assert.match(list, /last_poll_at/)
  assert.match(list, /displayMonitoringStatus\(row\.status, row\.last_poll_at\)/)
  assert.match(map, /displayMonitoringStatus\(row\.status, row\.last_poll_at\)/)
  assert.match(get, /mapDeviceStatusRow/)
  assert.match(count, /last_poll_at/)
  assert.match(count, /displayMonitoringStatus\(row\.status, row\.last_poll_at\)/)
  assert.match(count, /displayed === "online"/)
  assert.match(count, /displayed === "offline"/)
  assert.doesNotMatch(count, /if \(row\.status === "online"\)/)
  assert.doesNotMatch(count, /if \(row\.status === "offline"\)/)

  const devices = read("lib/network/devices/queries.ts")
  assert.match(devices, /listNetworkDeviceOperationalStatuses/)
  assert.match(devices, /getNetworkDeviceMonitoring/)
  assert.match(devices, /operationalStatus: monitoring\?\.status \?\? "unknown"/)
})
