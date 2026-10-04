/**
 * Curated topology placements: operator-defined parent → child.
 * Independent from Discovery network_links.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  TopologyPlacementError,
  createTopologyPlacement,
  findActiveTopologyPlacementForDevice,
  listActiveTopologyPlacements,
  listChildTopologyPlacements,
  listRootTopologyPlacements,
  softDeleteTopologyPlacement,
  topologyPlacementWouldCreateCycle,
  updateTopologyPlacementParent,
} from "../lib/network/topology/placements.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "co-1"
const OTHER = "co-2"
const CORE = "dev-core"
const POWERBOX = "dev-powerbox"
const AS5 = "dev-as5"
const AS6 = "dev-as6"
const AS7 = "dev-as7"
const CORE_B = "dev-core-b"
const ORPHAN = "dev-orphan"

const devices = [
  { id: CORE, companyId: COMPANY },
  { id: POWERBOX, companyId: COMPANY },
  { id: AS5, companyId: COMPANY },
  { id: AS6, companyId: COMPANY },
  { id: AS7, companyId: COMPANY },
  { id: CORE_B, companyId: COMPANY },
  { id: ORPHAN, companyId: COMPANY },
  { id: "dev-foreign", companyId: OTHER },
]

function context(placements = []) {
  return { placements, devices }
}

function add(placements, input) {
  return [
    ...placements,
    createTopologyPlacement(input, context(placements)),
  ]
}

function replace(placements, next) {
  return placements.map((item) => (item.id === next.id ? next : item))
}

test("1: crear root", () => {
  const placements = add([], {
    companyId: COMPANY,
    deviceId: CORE,
  })
  const roots = listRootTopologyPlacements(placements)
  assert.equal(roots.length, 1)
  assert.equal(roots[0].deviceId, CORE)
  assert.equal(roots[0].parentDeviceId, null)
})

test("2: crear child", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: POWERBOX,
    parentDeviceId: CORE,
  })
  const children = listChildTopologyPlacements(placements, CORE)
  assert.equal(children.length, 1)
  assert.equal(children[0].deviceId, POWERBOX)
  assert.equal(children[0].parentDeviceId, CORE)
})

test("3: device sin placement puede existir", () => {
  const placements = add([], { companyId: COMPANY, deviceId: CORE })
  assert.equal(findActiveTopologyPlacementForDevice(placements, ORPHAN), null)
  assert.equal(
    devices.some((device) => device.id === ORPHAN),
    true
  )
  assert.equal(listActiveTopologyPlacements(placements).length, 1)
})

test("4: un device no puede tener dos placements activos", () => {
  const placements = add([], { companyId: COMPANY, deviceId: CORE })
  assert.throws(
    () =>
      createTopologyPlacement(
        { companyId: COMPANY, deviceId: CORE },
        context(placements)
      ),
    (error) =>
      error instanceof TopologyPlacementError && error.code === "DUPLICATE_ACTIVE"
  )
})

test("5: placement soft-deleted permite uno nuevo del mismo device", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  const deleted = softDeleteTopologyPlacement(placements[0], placements)
  placements = replace(placements, deleted)
  placements = add(placements, { companyId: COMPANY, deviceId: CORE })
  const active = listActiveTopologyPlacements(placements)
  assert.equal(active.length, 1)
  assert.equal(active[0].deviceId, CORE)
  assert.equal(placements.filter((item) => item.deviceId === CORE).length, 2)
})

test("6: device no puede ser su propio parent", () => {
  assert.throws(
    () =>
      createTopologyPlacement(
        { companyId: COMPANY, deviceId: CORE, parentDeviceId: CORE },
        context([])
      ),
    (error) =>
      error instanceof TopologyPlacementError && error.code === "SELF_PARENT"
  )
})

test("7: parent debe tener placement activo", () => {
  assert.throws(
    () =>
      createTopologyPlacement(
        {
          companyId: COMPANY,
          deviceId: POWERBOX,
          parentDeviceId: CORE,
        },
        context([])
      ),
    (error) =>
      error instanceof TopologyPlacementError && error.code === "PARENT_NOT_PLACED"
  )
})

test("8: no permitir parent de otra company", () => {
  const placements = add([], { companyId: COMPANY, deviceId: CORE })
  assert.throws(
    () =>
      createTopologyPlacement(
        {
          companyId: COMPANY,
          deviceId: POWERBOX,
          parentDeviceId: "dev-foreign",
        },
        context(placements)
      ),
    (error) =>
      error instanceof TopologyPlacementError &&
      (error.code === "CROSS_COMPANY" || error.code === "PARENT_NOT_FOUND")
  )
})

test("9: detectar ciclo directo", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: POWERBOX,
    parentDeviceId: CORE,
  })
  const core = findActiveTopologyPlacementForDevice(placements, CORE)
  assert.throws(
    () =>
      updateTopologyPlacementParent(
        core,
        { parentDeviceId: POWERBOX },
        context(placements)
      ),
    (error) => error instanceof TopologyPlacementError && error.code === "CYCLE"
  )
  assert.equal(
    topologyPlacementWouldCreateCycle(placements, CORE, POWERBOX),
    true
  )
})

test("10: detectar ciclo indirecto Core → PowerBox → AS5 → Core", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: POWERBOX,
    parentDeviceId: CORE,
  })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: AS5,
    parentDeviceId: POWERBOX,
  })
  const core = findActiveTopologyPlacementForDevice(placements, CORE)
  assert.throws(
    () =>
      updateTopologyPlacementParent(
        core,
        { parentDeviceId: AS5 },
        context(placements)
      ),
    (error) => error instanceof TopologyPlacementError && error.code === "CYCLE"
  )
})

test("11: no permitir eliminar parent con hijos", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: POWERBOX,
    parentDeviceId: CORE,
  })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: AS5,
    parentDeviceId: POWERBOX,
  })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: AS6,
    parentDeviceId: POWERBOX,
  })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: AS7,
    parentDeviceId: POWERBOX,
  })
  const powerbox = findActiveTopologyPlacementForDevice(placements, POWERBOX)
  assert.throws(
    () => softDeleteTopologyPlacement(powerbox, placements),
    (error) =>
      error instanceof TopologyPlacementError && error.code === "HAS_CHILDREN"
  )
})

test("12: permitir eliminar leaf", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: POWERBOX,
    parentDeviceId: CORE,
  })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: AS5,
    parentDeviceId: POWERBOX,
  })
  const as5 = findActiveTopologyPlacementForDevice(placements, AS5)
  const deleted = softDeleteTopologyPlacement(as5, placements)
  placements = replace(placements, deleted)
  assert.ok(deleted.deletedAt)
  assert.equal(findActiveTopologyPlacementForDevice(placements, AS5), null)
  assert.equal(listChildTopologyPlacements(placements, POWERBOX).length, 0)
})

test("13: eliminar placement NO elimina network_devices", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  const deleted = softDeleteTopologyPlacement(placements[0], placements)
  placements = replace(placements, deleted)
  assert.equal(
    devices.some((device) => device.id === CORE),
    true
  )
  assert.equal(listActiveTopologyPlacements(placements).length, 0)
})

test("14: roots múltiples permitidos dentro de una company", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, { companyId: COMPANY, deviceId: CORE_B })
  const roots = listRootTopologyPlacements(placements)
  assert.equal(roots.length, 2)
  assert.deepEqual(
    roots.map((item) => item.deviceId).sort(),
    [CORE_B, CORE].sort()
  )
})

test("mover respeta parent colocado y sort_order", () => {
  let placements = add([], { companyId: COMPANY, deviceId: CORE })
  placements = add(placements, { companyId: COMPANY, deviceId: CORE_B })
  placements = add(placements, {
    companyId: COMPANY,
    deviceId: POWERBOX,
    parentDeviceId: CORE,
  })
  const powerbox = findActiveTopologyPlacementForDevice(placements, POWERBOX)
  const moved = updateTopologyPlacementParent(
    powerbox,
    { parentDeviceId: CORE_B, sortOrder: 3 },
    context(placements)
  )
  assert.equal(moved.parentDeviceId, CORE_B)
  assert.equal(moved.sortOrder, 3)
})

test("migración y módulo no tocan Discovery ni network_links", () => {
  const migration = read(
    "supabase/migrations/20261231000200_network_topology_placements.sql"
  )
  const moduleSrc = read("lib/network/topology/placements.ts")
  assert.match(migration, /CREATE TABLE public\.network_topology_placements/)
  assert.match(
    migration,
    /UNIQUE INDEX network_topology_placements_active_device_idx/
  )
  assert.match(migration, /device_id <> parent_device_id/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /auth_user_company_id\(\)/)
  assert.match(migration, /auth_user_has_allowed_module\('network'\)/)
  assert.match(migration, /auth_is_demo_platform_read_only\(\)/)
  assert.doesNotMatch(migration, /ON DELETE CASCADE/)
  assert.doesNotMatch(migration, /ALTER TABLE public\.network_links/)
  assert.doesNotMatch(migration, /INSERT INTO public\.network_links/)
  assert.doesNotMatch(migration, /UPDATE public\.network_links/)
  assert.doesNotMatch(migration, /FROM public\.network_links/)
  assert.doesNotMatch(moduleSrc, /latest-run/)
  assert.doesNotMatch(moduleSrc, /observation-queries/)
  assert.doesNotMatch(moduleSrc, /persist-snapshot/)
  assert.doesNotMatch(moduleSrc, /from\("network_links"\)/)
  assert.match(moduleSrc, /loadActiveTopologyPlacements/)
  assert.match(moduleSrc, /persistCreateTopologyPlacement/)
  assert.match(moduleSrc, /persistUpdateTopologyPlacementParent/)
  assert.match(moduleSrc, /persistSoftDeleteTopologyPlacement/)
  assert.match(moduleSrc, /parentInterfaceId/)
  assert.match(moduleSrc, /childInterfaceId/)
})

test("API de placements reutiliza persistencia y no toca Discovery ni network_links", () => {
  const route = read("app/api/network/topology/placements/route.ts")
  assert.match(route, /export async function POST/)
  assert.match(route, /export async function PATCH/)
  assert.match(route, /export async function DELETE/)
  assert.match(route, /requireNetworkWriteContext/)
  assert.match(route, /persistCreateTopologyPlacement/)
  assert.match(route, /persistUpdateTopologyPlacementParent/)
  assert.match(route, /persistSoftDeleteTopologyPlacement/)
  assert.match(route, /TopologyPlacementError/)
  assert.doesNotMatch(route, /from\("network_links"\)/)
  assert.doesNotMatch(route, /from\("network_devices"\)/)
  assert.doesNotMatch(route, /latest-run/)
  assert.doesNotMatch(route, /observation-queries/)
  assert.doesNotMatch(route, /persist-snapshot/)
  assert.doesNotMatch(route, /selectTopologyRootIds/)
  assert.doesNotMatch(route, /buildLocalCoreTopologyView/)
})
