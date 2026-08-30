import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildNavGroupsFromModuleVisibility } from "../lib/navigation/build-nav-from-modules.ts"
import { buildNavGroupsForProfile } from "../lib/navigation/profile-navigation.ts"
import { customersNavItem } from "../lib/navigation/nav-items.ts"
import {
  SIDEBAR_AREA_IDS,
  SIDEBAR_SECTIONS_STORAGE_KEY,
  arrangeNavItemsIntoAreas,
  isNavItemActive,
  mergeSidebarSectionState,
  parseSidebarSectionState,
  resolveSidebarAreaId,
  serializeSidebarSectionState,
} from "../lib/navigation/sidebar-areas.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function hrefsByArea(visibility = createFullModuleVisibility()) {
  const groups = buildNavGroupsFromModuleVisibility(visibility)
  return Object.fromEntries(
    groups.map((group) => [group.id, group.items.map((item) => item.href)])
  )
}

test("todos los módulos actuales siguen disponibles", () => {
  const hrefs = buildNavGroupsFromModuleVisibility(
    createFullModuleVisibility()
  ).flatMap((group) => group.items.map((item) => item.href))

  for (const href of [
    "/",
    "/operations/calendar",
    "/operations/planificacion",
    "/obras",
    "/tareas",
    "/operations/archivo-ot",
    "/clientes",
    "/clientes-360",
    "/atencion-cliente",
    "/servicios",
    "/conexiones",
    "/network",
    "/network/agents",
    "/network/sites",
    "/network/devices",
    "/network/topology",
    "/network/discovery",
    "/cuadrillas",
    "/contratistas",
    "/materiales",
    "/evidencias",
    "/activity/executive-center",
    "/activity",
    "/activity/workforce-monitor",
    "/activity/jornada",
    "/reportes/operativos",
    "/activity/cuadrillas",
    "/tesoreria",
    "/facturacion",
    "/facturacion/comprobantes",
    "/facturacion/mensual",
    "/configuracion/facturacion",
    "/subscriptions",
    "/gestion-comercial/oportunidades",
    "/activity/timeline",
    "/mantenimiento",
    "/rrhh",
    "/novedades",
    "/configuracion",
    "/usuarios",
    "/dispositivos",
    "/historial",
  ]) {
    assert.ok(hrefs.includes(href), `falta ${href}`)
  }
})

test("el menú queda organizado por las áreas laterales", () => {
  const byArea = hrefsByArea()
  assert.deepEqual(Object.keys(byArea), [...SIDEBAR_AREA_IDS])
  assert.deepEqual(byArea.operations, [
    "/",
    "/operations/calendar",
    "/operations/planificacion",
    "/obras",
    "/tareas",
    "/operations/archivo-ot",
  ])
  assert.deepEqual(byArea.customers, [
    "/clientes",
    "/clientes-360",
    "/atencion-cliente",
  ])
  assert.deepEqual(byArea.isp, ["/servicios", "/conexiones"])
  assert.deepEqual(byArea.network, ["/network", "/network/agents", "/network/sites", "/network/devices", "/network/topology", "/network/discovery"])
  assert.deepEqual(byArea.field, [
    "/cuadrillas",
    "/contratistas",
    "/materiales",
    "/evidencias",
  ])
  assert.deepEqual(byArea.analysis.slice(0, 5), [
    "/activity/executive-center",
    "/activity",
    "/activity/workforce-monitor",
    "/activity/jornada",
    "/reportes/operativos",
  ])
  assert.ok(byArea.analysis.includes("/activity/cuadrillas"))
  assert.deepEqual(byArea.administration, [
    "/tesoreria",
    "/facturacion",
    "/facturacion/comprobantes",
    "/facturacion/mensual",
    "/subscriptions",
    "/gestion-comercial/oportunidades",
    "/activity/timeline",
    "/mantenimiento",
  ])
  assert.deepEqual(byArea.rrhh, ["/rrhh", "/novedades"])
  assert.deepEqual(byArea.system, [
    "/configuracion",
    "/configuracion/facturacion",
    "/usuarios",
    "/dispositivos",
    "/historial",
  ])
})

test("la ruta /clientes-360 abre CLIENTES y marca Clientes 360°", () => {
  assert.equal(resolveSidebarAreaId("/clientes-360/123"), "customers")
  assert.equal(
    isNavItemActive("/clientes-360/123", "/clientes-360", [
      "/clientes",
      "/clientes-360",
    ]),
    true
  )
  assert.equal(
    isNavItemActive("/clientes-360/123", "/clientes", [
      "/clientes",
      "/clientes-360",
    ]),
    false
  )
})

test("la misma lógica de área aplica a las demás rutas", () => {
  assert.equal(resolveSidebarAreaId("/tareas/abc"), "operations")
  assert.equal(resolveSidebarAreaId("/servicios/1"), "isp")
  assert.equal(resolveSidebarAreaId("/conexiones/1"), "isp")
  assert.equal(resolveSidebarAreaId("/network/agents"), "network")
  assert.equal(resolveSidebarAreaId("/cuadrillas"), "field")
  assert.equal(resolveSidebarAreaId("/activity/executive-center"), "analysis")
  assert.equal(resolveSidebarAreaId("/activity/timeline"), "administration")
  assert.equal(resolveSidebarAreaId("/tesoreria"), "administration")
  assert.equal(resolveSidebarAreaId("/facturacion"), "administration")
  assert.equal(
    resolveSidebarAreaId("/configuracion/facturacion"),
    "system"
  )
  assert.equal(resolveSidebarAreaId("/rrhh"), "rrhh")
  assert.equal(resolveSidebarAreaId("/configuracion/tipos-ot"), "system")
  assert.equal(
    isNavItemActive("/activity/cuadrillas", "/activity", [
      "/activity",
      "/activity/cuadrillas",
    ]),
    false
  )
  assert.equal(
    isNavItemActive("/activity/cuadrillas", "/activity/cuadrillas", [
      "/activity",
      "/activity/cuadrillas",
    ]),
    true
  )
})

test("persistencia de secciones usa localStorage bespoke-sidebar-sections", () => {
  assert.equal(SIDEBAR_SECTIONS_STORAGE_KEY, "bespoke-sidebar-sections")
  const stored = parseSidebarSectionState(
    serializeSidebarSectionState({ customers: false, operations: true })
  )
  assert.equal(stored.customers, false)
  assert.equal(stored.operations, true)
  assert.deepEqual(parseSidebarSectionState("no-json"), {})
  const merged = mergeSidebarSectionState({
    stored: { customers: false, operations: false },
    areaIds: ["operations", "customers"],
    activeAreaId: "customers",
  })
  assert.equal(merged.customers, true)
  assert.equal(merged.operations, false)
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(sidebar, /SIDEBAR_SECTIONS_STORAGE_KEY/)
  assert.match(sidebar, /localStorage/)
})

test("sidebar colapsado muestra áreas con tooltip y no cada módulo", () => {
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(sidebar, /compact/)
  assert.match(sidebar, /TooltipContent/)
  assert.match(sidebar, /onExpandSidebar/)
  assert.match(sidebar, /aria-label=\{meta\.label\}/)
  assert.match(sidebar, /grid-template-rows/)
  assert.match(sidebar, /duration-200/)
  const collapsedNav = sidebar.slice(
    sidebar.indexOf("{compact ? ("),
    sidebar.indexOf("<nav className=\"flex flex-col gap-1.5\">")
  )
  assert.match(collapsedNav, /navGroups\.map/)
  assert.doesNotMatch(collapsedNav, /item\.href/)
})

test("permisos y visibilidad actuales siguen gobernando el menú", () => {
  const hidden360 = createEmptyModuleVisibility()
  hidden360.customers = true
  const groups = buildNavGroupsFromModuleVisibility(hidden360)
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href))
  assert.deepEqual(hrefs, ["/clientes"])
  assert.equal(hrefs.includes("/clientes-360"), false)
  assert.equal(hrefs.includes("/servicios"), false)

  const with360 = createEmptyModuleVisibility()
  with360.clientes_360 = true
  const isp = buildNavGroupsFromModuleVisibility(with360)
    .find((group) => group.id === "isp")
    ?.items.map((item) => item.href)
  assert.deepEqual(isp, ["/servicios", "/conexiones"])

  const modules = read("lib/roles/app-modules.ts")
  assert.match(
    modules,
    /groupId: "operations" \| "analysis" \| "rrhh" \| "system" \| "administration"/
  )
})

test("el perfil fallback también se reorganiza por áreas", () => {
  const groups = buildNavGroupsForProfile("administrador")
  assert.ok(groups.some((group) => group.id === "customers"))
  assert.ok(groups.some((group) => group.id === "field"))
  assert.ok(
    groups
      .find((group) => group.id === "operations")
      ?.items.some((item) => item.href === "/")
  )
})

test("no se modifica lógica de negocio ni se agrega SQL", () => {
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.doesNotMatch(sidebar, /from\("isp_subscribers"\)|createClient/)
  assert.match(
    read("lib/navigation/build-nav-from-modules.ts"),
    /arrangeNavItemsIntoAreas/
  )
  assert.match(
    read("lib/navigation/build-nav-from-modules.ts"),
    /visibility\.history/
  )
})

test("íconos y estados activos del sidebar", () => {
  const items = read("lib/navigation/nav-items.ts")
  assert.match(items, /icon: CalendarDays/)
  assert.match(items, /icon: ContactRound/)
  assert.match(items, /icon: Headphones/)
  assert.match(items, /icon: WalletCards/)
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(sidebar, /font-semibold/)
  assert.match(sidebar, /--sidebar-area-/)
  assert.doesNotMatch(sidebar, /Perfil operativo/)
  assert.match(sidebar, /Bespoke Operations/)
  assert.match(read("app/globals.css"), /--sidebar-area-operations/)
  assert.match(read("app/globals.css"), /--sidebar-area-isp/)
})

test("arrange no duplica ítems", () => {
  const groups = arrangeNavItemsIntoAreas([
    customersNavItem,
    customersNavItem,
  ])
  assert.equal(groups[0].items.length, 1)
})
