import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  formatNetworkHistoryChangedAt,
  formatNetworkHistoryDuration,
  NETWORK_DEVICE_STATUS_LABELS,
} from "../lib/network/labels.ts"
import { networkQueryKeys } from "../lib/network/react-query/keys.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function functionSource(source, name) {
  const patterns = [
    `export function ${name}`,
    `function ${name}`,
    `export async function ${name}`,
  ]
  let start = -1
  for (const pattern of patterns) {
    start = source.indexOf(pattern)
    if (start !== -1) break
  }
  assert.notEqual(start, -1, `no se encontró ${name}`)
  const from = source.slice(start)
  const cuts = [
    from.indexOf("\nexport function ", 1),
    from.indexOf("\nfunction ", 1),
    from.indexOf("\nexport async function ", 1),
  ].filter((index) => index !== -1)
  const next = cuts.length === 0 ? -1 : Math.min(...cuts)
  return next === -1 ? from : from.slice(0, next)
}

test("1: Device Detail carga el histórico", () => {
  const screen = read("components/network/network-device-detail-screen.tsx")
  const page = read("app/(dashboard)/network/devices/[deviceId]/page.tsx")
  assert.match(screen, /useNetworkDeviceHistoryQuery\(deviceId\)/)
  assert.match(screen, /Historial de estado/)
  assert.match(page, /NetworkDeviceDetailScreen/)
  assert.doesNotMatch(page, /history/)
})

test("2: renderiza previousStatus → newStatus con estados persistidos", () => {
  const screen = read("components/network/network-device-detail-screen.tsx")
  const item = functionSource(screen, "StatusHistoryEventItem")
  assert.match(item, /event\.previousStatus/)
  assert.match(item, /event\.newStatus/)
  assert.match(item, /NETWORK_DEVICE_STATUS_LABELS\[event\.previousStatus\]/)
  assert.match(item, /NETWORK_DEVICE_STATUS_LABELS\[event\.newStatus\]/)
  assert.match(item, /→/)
  assert.equal(NETWORK_DEVICE_STATUS_LABELS.online, "Online")
  assert.equal(NETWORK_DEVICE_STATUS_LABELS.offline, "Offline")
  assert.equal(NETWORK_DEVICE_STATUS_LABELS.unknown, "Desconocido")
  assert.equal(NETWORK_DEVICE_STATUS_LABELS.degraded, "Degradado")
})

test("3: renderiza changedAt", () => {
  const item = functionSource(
    read("components/network/network-device-detail-screen.tsx"),
    "StatusHistoryEventItem"
  )
  assert.match(item, /formatNetworkHistoryChangedAt\(event\.changedAt\)/)
  const formatted = formatNetworkHistoryChangedAt("2026-08-30T17:32:00.000Z")
  assert.match(formatted, /·/)
})

test("4: renderiza durationSeconds cuando existe", () => {
  const item = functionSource(
    read("components/network/network-device-detail-screen.tsx"),
    "StatusHistoryEventItem"
  )
  assert.match(
    item,
    /Duración: \{formatNetworkHistoryDuration\(event\.durationSeconds\)\}/
  )
  assert.equal(formatNetworkHistoryDuration(480), "8 min")
  assert.equal(formatNetworkHistoryDuration(15), "15 s")
})

test("5: último evento con durationSeconds null se muestra como período abierto", () => {
  assert.equal(formatNetworkHistoryDuration(null), "abierta")
  const item = functionSource(
    read("components/network/network-device-detail-screen.tsx"),
    "StatusHistoryEventItem"
  )
  assert.doesNotMatch(item, /changedAt.*durationSeconds/)
  assert.doesNotMatch(item, /Date\.now/)
  assert.doesNotMatch(item, /NETWORK_MONITORING_STATUS_TTL_MS/)
})

test("6: renderiza message cuando existe", () => {
  const item = functionSource(
    read("components/network/network-device-detail-screen.tsx"),
    "StatusHistoryEventItem"
  )
  assert.match(item, /event\.message \?/)
  assert.match(item, /\{event\.message\}/)
})

test("7: sin eventos muestra estado vacío", () => {
  const section = functionSource(
    read("components/network/network-device-detail-screen.tsx"),
    "DeviceStatusHistorySection"
  )
  assert.match(section, /events\.length === 0/)
  assert.match(section, /Sin cambios de estado registrados/)
  assert.doesNotMatch(section, /throw/)
})

test("8: error del histórico no rompe el resto del Device Detail", () => {
  const screen = read("components/network/network-device-detail-screen.tsx")
  const section = functionSource(screen, "DeviceStatusHistorySection")
  assert.match(section, /historyError/)
  assert.match(section, /text-destructive/)
  assert.match(screen, /loadError && !device/)
  assert.match(screen, /Interfaces/)
  assert.match(screen, /Relaciones descubiertas/)
  assert.match(screen, /DeviceStatusHistorySection/)
})

test("9: no se agrega polling al histórico", () => {
  const hook = read("lib/network/react-query/use-network-device-history-query.ts")
  assert.doesNotMatch(hook, /refetchInterval/)
  assert.doesNotMatch(hook, /NETWORK_QUERY_OPTIONS/)
  assert.doesNotMatch(hook, /Realtime/)
  const screen = read("components/network/network-device-detail-screen.tsx")
  const section = functionSource(screen, "DeviceStatusHistorySection")
  assert.doesNotMatch(section, /refetchInterval/)
  assert.doesNotMatch(
    read("lib/network/react-query/invalidate.ts"),
    /deviceHistory/
  )
})

test("10: query key utiliza deviceId", () => {
  assert.deepEqual(networkQueryKeys.deviceHistory("dev-1"), [
    "network",
    "devices",
    "dev-1",
    "history",
  ])
  const hook = read("lib/network/react-query/use-network-device-history-query.ts")
  assert.match(hook, /networkQueryKeys\.deviceHistory\(deviceId\)/)
  assert.match(hook, /\/api\/network\/devices\/\$\{deviceId\}\/history/)
  assert.doesNotMatch(hook, /hostname/)
  assert.doesNotMatch(hook, /managementIp/)
})

test("11: vecino con events=[] no inventa histórico", () => {
  const section = functionSource(
    read("components/network/network-device-detail-screen.tsx"),
    "DeviceStatusHistorySection"
  )
  assert.match(section, /history\?\.events \?\? \[\]/)
  assert.doesNotMatch(section, /unknown → online/)
  assert.doesNotMatch(section, /origin/)
  assert.doesNotMatch(section, /isManagedNetworkDevice/)
  const hook = read("lib/network/react-query/use-network-device-history-query.ts")
  assert.match(hook, /events: body\.events \?\? \[\]/)
})

test("12: freshness no modifica eventos históricos", () => {
  const screen = read("components/network/network-device-detail-screen.tsx")
  const item = functionSource(screen, "StatusHistoryEventItem")
  const section = functionSource(screen, "DeviceStatusHistorySection")
  const hook = read("lib/network/react-query/use-network-device-history-query.ts")
  for (const source of [item, section, hook]) {
    assert.doesNotMatch(source, /displayMonitoringStatus/)
    assert.doesNotMatch(source, /NETWORK_MONITORING_STATUS_TTL_MS/)
  }
  assert.match(screen, /device\?\.monitoring\?\.status/)
})
