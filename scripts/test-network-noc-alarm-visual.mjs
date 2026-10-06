/**
 * NOC alarm overlay: paint nodes by deviceId, keep Monitoring independent.
 * Does not invent nodes, filter the forest, or touch Topology.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildNocAlarmOverlayByDeviceId,
  collectNocForestDeviceIds,
  countNocAlarmKpis,
  highestAlarmSeverityForDevice,
} from "../lib/network/noc/alarm-visual.ts"

const ROOT = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function node(deviceId, label, health, children = []) {
  return { deviceId, label, ipAddress: null, health, children }
}

const AS5 = "as5"
const AS6 = "as6"
const AS7 = "as7"
const POWERBOX = "powerbox"
const MALAGUENO = "core-malagueno"
const RIO = "core-rio"
const OUTSIDE = "test-fcm-device"

function forest() {
  return {
    roots: [
      node(MALAGUENO, "RB3011 - Core Malagueño", "online", [
        node(POWERBOX, "PowerBox Malagueño", "online", [
          node(AS5, "AS5", "online"),
          node(AS6, "AS6", "online"),
          node(AS7, "AS7", "offline"),
        ]),
      ]),
      node(RIO, "RB3011 - Core Río Segundo", "online"),
    ],
  }
}

function alarm(input) {
  return {
    id: input.id,
    deviceId: input.deviceId,
    severity: input.severity,
    status: input.status ?? "open",
    title: input.title ?? "Alarma",
    message: "",
    createdAt: "2026-10-06T00:00:00.000Z",
  }
}

test("1: nodo sin alarma conserva su estado Monitoring", () => {
  const overlay = buildNocAlarmOverlayByDeviceId(forest(), [
    alarm({ id: "a1", deviceId: AS5, severity: "critical" }),
  ])
  assert.equal(overlay.has(AS6), false)
  assert.equal(highestAlarmSeverityForDevice([], AS6), null)
  const tree = read("components/network/noc-topology-tree.tsx")
  assert.match(tree, /healthDotClass\(node\.health\)/)
  assert.match(tree, /healthLabel\(node\.health\)/)
  assert.match(tree, /overlayClass\(overlay\) \?\? healthClass\(node\.health\)/)
})

test("2: nodo con WARNING se muestra amarillo", () => {
  const overlay = buildNocAlarmOverlayByDeviceId(forest(), [
    alarm({ id: "w1", deviceId: AS6, severity: "warning" }),
  ])
  assert.equal(overlay.get(AS6)?.severity, "warning")
  assert.match(
    read("components/network/noc-topology-tree.tsx"),
    /border-amber-500 bg-amber-400\/20/
  )
  assert.match(
    read("components/network/noc-topology-tree.tsx"),
    /ADVERTENCIA/
  )
})

test("3: nodo con CRITICAL se muestra rojo", () => {
  const overlay = buildNocAlarmOverlayByDeviceId(forest(), [
    alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
  ])
  assert.equal(overlay.get(AS5)?.severity, "critical")
  const tree = read("components/network/noc-topology-tree.tsx")
  assert.match(tree, /border-red-600 bg-red-600\/20/)
  assert.match(tree, /ALARMA CRÍTICA/)
})

test("4: CRITICAL tiene prioridad sobre WARNING", () => {
  const severity = highestAlarmSeverityForDevice(
    [
      alarm({ id: "w1", deviceId: AS5, severity: "warning" }),
      alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
    ],
    AS5
  )
  assert.equal(severity, "critical")
  const overlay = buildNocAlarmOverlayByDeviceId(forest(), [
    alarm({ id: "w1", deviceId: AS5, severity: "warning" }),
    alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
  ])
  assert.equal(overlay.get(AS5)?.severity, "critical")
})

test("5: alarma fuera del forest no genera nodo artificial", () => {
  const tree = forest()
  const before = [...collectNocForestDeviceIds(tree)]
  const overlay = buildNocAlarmOverlayByDeviceId(tree, [
    alarm({
      id: "test-fcm",
      deviceId: OUTSIDE,
      severity: "critical",
      title: "TEST-FCM-ALARM",
    }),
  ])
  assert.equal(overlay.has(OUTSIDE), false)
  assert.deepEqual([...collectNocForestDeviceIds(tree)], before)
  assert.equal(tree.roots.length, 2)
})

test("6: KPI de críticas cuenta correctamente", () => {
  const kpis = countNocAlarmKpis([
    alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
    alarm({ id: "c2", deviceId: OUTSIDE, severity: "critical" }),
    alarm({ id: "w1", deviceId: AS6, severity: "warning" }),
    alarm({
      id: "r1",
      deviceId: AS7,
      severity: "critical",
      status: "resolved",
    }),
  ])
  assert.equal(kpis.critical, 2)
})

test("7: KPI de warnings cuenta correctamente", () => {
  const kpis = countNocAlarmKpis([
    alarm({ id: "w1", deviceId: AS6, severity: "warning" }),
    alarm({ id: "w2", deviceId: AS7, severity: "warning" }),
    alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
  ])
  assert.equal(kpis.warning, 2)
  assert.equal(kpis.critical, 1)
})

test("8: alarmas de otros dispositivos no afectan un nodo", () => {
  const overlay = buildNocAlarmOverlayByDeviceId(forest(), [
    alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
  ])
  assert.equal(overlay.has(AS6), false)
  assert.equal(overlay.has(AS7), false)
  assert.equal(overlay.has(POWERBOX), false)
  assert.equal(highestAlarmSeverityForDevice([
    alarm({ id: "c1", deviceId: AS5, severity: "critical" }),
  ], AS6), null)
})

test("9: NOC sigue mostrando todos los roots", () => {
  const tree = read("components/network/noc-topology-tree.tsx")
  const screen = read("components/network/noc-monitor-screen.tsx")
  assert.match(tree, /RED \/ EMPRESA/)
  assert.match(tree, /nodes=\{forest\.roots\}/)
  assert.doesNotMatch(screen, /selectCuratedForestForCore/)
  assert.doesNotMatch(screen, /selectedCoreId/)
  assert.doesNotMatch(tree, /showEmpresaAnchor/)
})

test("10: el selector de Core de Topología no se modifica", () => {
  const topology = read("components/network/network-topology-screen.tsx")
  assert.match(topology, /selectCuratedForestForCore\(curated, activeCoreId\)/)
  assert.match(topology, /forest=\{visibleCurated\}/)
})

test("11: los cambios no afectan Monitoring", () => {
  const visual = read("lib/network/noc/alarm-visual.ts")
  const screen = read("components/network/noc-monitor-screen.tsx")
  assert.doesNotMatch(visual, /listNetworkDeviceOperationalStatuses/)
  assert.doesNotMatch(visual, /nocHealthFromMonitoring/)
  assert.doesNotMatch(screen, /nocHealthFromMonitoring/)
})

test("12: los cambios no afectan Topología curada", () => {
  const visual = read("lib/network/noc/alarm-visual.ts")
  const screen = read("components/network/noc-monitor-screen.tsx")
  const tree = read("components/network/noc-topology-tree.tsx")
  assert.doesNotMatch(visual, /network_topology_placements/)
  assert.doesNotMatch(visual, /selectCuratedForestForCore/)
  assert.doesNotMatch(screen, /\/api\/network\/topology\/placements/)
  assert.doesNotMatch(tree, /selectCuratedForestForCore/)
})

test("KPIs compactos reemplazan el banner grande", () => {
  const screen = read("components/network/noc-monitor-screen.tsx")
  assert.match(screen, /xl:grid-cols-6/)
  assert.match(screen, /🔴 Crítica/)
  assert.match(screen, /🟡 Advertencias/)
  assert.doesNotMatch(screen, /text-4xl/)
  assert.doesNotMatch(screen, /Red operativa/)
  assert.doesNotMatch(screen, /críticas más en Alarmas/)
})

test("detalle del nodo reutiliza la alarma sin acknowledge\/resolve", () => {
  const screen = read("components/network/noc-monitor-screen.tsx")
  assert.match(screen, /onSelectDevice=\{setSelectedDeviceId\}/)
  assert.match(screen, /nocActiveAlarmsForDevice/)
  assert.match(screen, /Ver en Alarmas/)
  assert.doesNotMatch(screen, /acknowledgeNetworkAlarm/)
  assert.doesNotMatch(screen, /resolveNetworkAlarm/)
})
