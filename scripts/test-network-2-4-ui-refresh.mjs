import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { NETWORK_UI_REFETCH_INTERVAL_MS } from "../lib/network/react-query/defaults.ts"
import { networkQueryKeys } from "../lib/network/react-query/keys.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

test("NETWORK_UI_REFETCH_INTERVAL_MS es 15000", () => {
  assert.equal(NETWORK_UI_REFETCH_INTERVAL_MS, 15_000)
})

test("query keys de list, detail y summary están separadas", () => {
  assert.deepEqual(networkQueryKeys.devices(), ["network", "devices"])
  assert.deepEqual(networkQueryKeys.device("dev-1"), ["network", "devices", "dev-1"])
  assert.deepEqual(networkQueryKeys.summary(), ["network", "summary"])
  assert.notDeepEqual(networkQueryKeys.devices(), networkQueryKeys.device("dev-1"))
})

test("las tres queries usan refetchInterval 15000, mount true y background false", () => {
  const defaults = read("lib/network/react-query/defaults.ts")
  assert.match(defaults, /refetchInterval: NETWORK_UI_REFETCH_INTERVAL_MS/)
  assert.match(defaults, /refetchIntervalInBackground: false/)
  assert.match(defaults, /refetchOnMount: true/)
  assert.match(defaults, /placeholderData: keepPreviousData/)
  assert.match(defaults, /staleTime: 0/)

  const devicesHook = read("lib/network/react-query/use-network-devices-query.ts")
  const deviceHook = read("lib/network/react-query/use-network-device-query.ts")
  const summaryHook = read("lib/network/react-query/use-network-summary-query.ts")
  assert.match(devicesHook, /networkQueryKeys\.devices\(\)/)
  assert.match(deviceHook, /networkQueryKeys\.device\(deviceId\)/)
  assert.match(summaryHook, /networkQueryKeys\.summary\(\)/)
  for (const source of [devicesHook, deviceHook, summaryHook]) {
    assert.match(source, /\.\.\.NETWORK_QUERY_OPTIONS/)
    assert.doesNotMatch(source, /refetchIntervalInBackground:\s*true/)
  }
})

test("devices ya no carga con useEffect fetch-once", () => {
  const screen = read("components/network/network-devices-screen.tsx")
  assert.match(screen, /useNetworkDevicesQuery/)
  assert.doesNotMatch(screen, /useEffect/)
  assert.doesNotMatch(screen, /fetch\("\/api\/network\/devices"\)/)
})

test("detail no usa setTimeout 8000 como refresh principal", () => {
  const screen = read("components/network/network-device-detail-screen.tsx")
  assert.match(screen, /useNetworkDeviceQuery/)
  assert.match(screen, /invalidateNetworkOperationalQueries/)
  assert.doesNotMatch(screen, /setTimeout/)
  assert.doesNotMatch(screen, /8000/)
})

test("Polling ahora invalida device, devices list y summary", () => {
  const invalidate = read("lib/network/react-query/invalidate.ts")
  assert.match(invalidate, /networkQueryKeys\.device\(deviceId\)/)
  assert.match(invalidate, /networkQueryKeys\.devices\(\)/)
  assert.match(invalidate, /networkQueryKeys\.summary\(\)/)
  assert.match(invalidate, /exact:\s*true/)
  assert.doesNotMatch(invalidate, /invalidateQueries\(\s*\{\s*\}\s*\)/)
})

test("home usa summary query con el mismo intervalo", () => {
  const screen = read("components/network/network-home-screen.tsx")
  assert.match(screen, /useNetworkSummaryQuery/)
  assert.doesNotMatch(screen, /useEffect/)
  assert.doesNotMatch(screen, /fetch\("\/api\/network\/summary"\)/)
})

test("Discovery no fue modificado", () => {
  const mikrotik = read("network-agent/src/connectors/mikrotik/index.ts")
  assert.match(mikrotik, /async function discoverViaApi/)
  assert.match(mikrotik, /async discover\(/)
  assert.doesNotMatch(mikrotik, /useQuery/)
  assert.doesNotMatch(read("lib/network/discovery/parse-snapshot.ts"), /useQuery/)
})

test("Agent no fue modificado", () => {
  assert.doesNotMatch(read("network-agent/src/index.ts"), /useQuery/)
  assert.doesNotMatch(read("network-agent/src/cloud-client.ts"), /useQuery/)
})

test("no se modificaron migrations ni analysis query defaults", () => {
  assert.match(
    read("supabase/migrations/20261201000100_network_2_monitoring.sql"),
    /CREATE TABLE public.network_device_status/
  )
  const analysisDefaults = read("lib/analysis/react-query/defaults.ts")
  assert.match(analysisDefaults, /refetchOnMount: false/)
  assert.doesNotMatch(analysisDefaults, /NETWORK_UI_REFETCH_INTERVAL_MS/)
})
