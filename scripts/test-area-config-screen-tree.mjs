import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  applySidebarGroupSelection,
  buildAreaConfigSidebarGroups,
  getSidebarGroupSelectionState,
  uniqueModuleKeysForScreens,
} from "../lib/navigation/area-config-screen-tree.ts"
import { SIDEBAR_AREA_IDS } from "../lib/navigation/sidebar-areas.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const roleEditSheet = read("components/configuracion/role-edit-sheet.tsx")
const areaPicker = read("components/configuracion/area-module-picker.tsx")
const treeSource = read("lib/navigation/area-config-screen-tree.ts")

test("usa la definición centralizada del menú lateral", () => {
  assert.match(treeSource, /getAllNavItemsFromModuleVisibility/)
  assert.match(treeSource, /arrangeNavItemsIntoAreas/)
  assert.match(treeSource, /SIDEBAR_AREA_META/)
  assert.doesNotMatch(treeSource, /APP_MODULE_DEFINITIONS\.map/)
  assert.match(roleEditSheet, /AreaModulePicker/)
  assert.match(areaPicker, /buildAreaConfigSidebarGroups/)
})

test("agrupa pantallas como el sidebar", () => {
  const groups = buildAreaConfigSidebarGroups()
  const ids = groups.map((group) => group.id)
  assert.ok(ids.includes("operations"))
  assert.ok(ids.includes("customers"))
  assert.ok(ids.includes("isp"))
  assert.ok(ids.includes("field"))
  assert.ok(ids.includes("analysis"))
  assert.ok(ids.includes("administration"))
  assert.ok(ids.includes("rrhh"))
  assert.ok(ids.includes("system"))

  const operations = groups.find((group) => group.id === "operations")
  assert.ok(operations)
  assert.ok(
    operations.screens.some((screen) => screen.title === "Dashboard Operativo")
  )
  assert.ok(
    operations.screens.some((screen) => screen.title === "Órdenes de Trabajo")
  )

  const customers = groups.find((group) => group.id === "customers")
  assert.ok(customers)
  assert.ok(customers.screens.some((screen) => screen.title === "Clientes"))
  assert.ok(
    customers.screens.some((screen) => screen.title === "Clientes 360°")
  )
  assert.ok(
    customers.screens.some((screen) => screen.title === "TV & Suscripciones")
  )

  const administration = groups.find((group) => group.id === "administration")
  assert.ok(administration)
  assert.equal(
    administration.screens.some(
      (screen) => screen.title === "TV & Suscripciones"
    ),
    false
  )

  const isp = groups.find((group) => group.id === "isp")
  assert.ok(isp)
  assert.ok(isp.screens.some((screen) => screen.title === "Servicios"))
  assert.ok(isp.screens.some((screen) => screen.title === "Conexiones"))
})

test("checkbox de grupo: seleccionar y deseleccionar todo", () => {
  const groups = buildAreaConfigSidebarGroups()
  const operations = groups.find((group) => group.id === "operations")
  assert.ok(operations)

  const empty = createEmptyModuleVisibility()
  assert.equal(getSidebarGroupSelectionState(operations.screens, empty), "none")

  const all = applySidebarGroupSelection(empty, operations.screens, true)
  assert.equal(
    getSidebarGroupSelectionState(operations.screens, all),
    "all"
  )

  const cleared = applySidebarGroupSelection(all, operations.screens, false)
  assert.equal(
    getSidebarGroupSelectionState(operations.screens, cleared),
    "none"
  )
})

test("checkbox de grupo: estado indeterminado con selección parcial", () => {
  const groups = buildAreaConfigSidebarGroups()
  const operations = groups.find((group) => group.id === "operations")
  assert.ok(operations)

  const keys = uniqueModuleKeysForScreens(operations.screens)
  assert.ok(keys.length >= 2)

  const partial = createEmptyModuleVisibility()
  partial[keys[0]] = true
  assert.equal(
    getSidebarGroupSelectionState(operations.screens, partial),
    "some"
  )
})

test("UI expone checkbox de grupo con indeterminate", () => {
  assert.match(areaPicker, /indeterminate/)
  assert.match(areaPicker, /getSidebarGroupSelectionState/)
  assert.match(areaPicker, /applySidebarGroupSelection/)
  assert.match(areaPicker, /area-config-group/)
})

test("administrador mantiene acceso total sin edición manual", () => {
  assert.match(roleEditSheet, /ADMINISTRATOR_ROLE_CODE/)
  assert.match(roleEditSheet, /isAdministratorRole/)
  assert.match(roleEditSheet, /acceso completo/)
  assert.match(roleEditSheet, /disabled={isSubmitting || isAdministratorRole}/)
})

test("cubre todos los sidebar areas definidos con pantallas", () => {
  const groups = buildAreaConfigSidebarGroups()
  const covered = new Set(groups.map((group) => group.id))
  for (const areaId of SIDEBAR_AREA_IDS) {
    if (areaId === "field" || areaId === "customers" || areaId === "isp" || areaId === "network") {
      assert.ok(covered.has(areaId), `falta área ${areaId}`)
    }
  }
})

test("visibilidad completa marca todos los grupos como seleccionados", () => {
  const full = createFullModuleVisibility()
  const groups = buildAreaConfigSidebarGroups()
  for (const group of groups) {
    assert.equal(getSidebarGroupSelectionState(group.screens, full), "all")
  }
})
