import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildNavGroupsFromModuleVisibility } from "../lib/navigation/build-nav-from-modules.ts"
import { buildNavGroupsForProfile } from "../lib/navigation/profile-navigation.ts"
import {
  facturacionConfigNavItem,
  facturacionNavItem,
  settingsNavItem,
} from "../lib/navigation/nav-items.ts"
import {
  isNavItemActive,
  mergeSidebarSectionState,
  nestSidebarNavItems,
  resolveSidebarAreaId,
} from "../lib/navigation/sidebar-areas.ts"
import { getPageMetaForProfile } from "../lib/navigation/profile-navigation.ts"
import {
  canAccessPathWithModules,
  createEmptyModuleVisibility,
  createFullModuleVisibility,
  resolveModuleKeyFromPathname,
} from "../lib/roles/app-modules.ts"
import { canAccessIspBilling } from "../lib/isp/permissions.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const SYSTEM_SIBLINGS = [
  "/configuracion",
  "/configuracion/facturacion",
  "/usuarios",
  "/dispositivos",
  "/historial",
]

test("la configuración fiscal vive en Sistema → Configuración → Facturación", () => {
  assert.equal(facturacionConfigNavItem.href, "/configuracion/facturacion")
  assert.equal(facturacionConfigNavItem.parentHref, "/configuracion")
  assert.equal(
    facturacionConfigNavItem.pageTitle,
    "Configuración de facturación"
  )
  assert.match(
    facturacionConfigNavItem.description ?? "",
    /empresa emisora, punto de venta/
  )
  assert.equal(facturacionNavItem.href, "/facturacion")
  assert.notEqual(facturacionNavItem.href, facturacionConfigNavItem.href)

  const byArea = Object.fromEntries(
    buildNavGroupsFromModuleVisibility(createFullModuleVisibility()).map(
      (group) => [group.id, group.items.map((item) => item.href)]
    )
  )
  assert.ok(byArea.system.includes("/configuracion/facturacion"))
  assert.ok(byArea.system.includes("/configuracion"))
  assert.equal(byArea.administration.includes("/configuracion/facturacion"), false)
  assert.ok(byArea.administration.includes("/facturacion"))
  assert.ok(byArea.administration.includes("/facturacion/comprobantes"))
  assert.equal(byArea.administration.includes("/facturacion/configuracion"), false)
})

test("Administración → Facturación no apunta a la configuración fiscal", () => {
  const admin = buildNavGroupsFromModuleVisibility(
    createFullModuleVisibility()
  ).find((group) => group.id === "administration")
  const facturacion = admin?.items.find((item) => item.title === "Facturación")
  assert.equal(facturacion?.href, "/facturacion")
  assert.doesNotMatch(
    read("app/(dashboard)/facturacion/page.tsx"),
    /IspBillingSettingsScreen/
  )
  assert.match(
    read("app/(dashboard)/facturacion/page.tsx"),
    /redirect\("\/facturacion\/comprobantes"\)/
  )
  assert.ok(
    admin?.items.some((item) => item.href === "/facturacion/comprobantes")
  )
})

test("la ruta anterior redirige y la nueva renderiza la misma pantalla", () => {
  assert.match(
    read("app/(dashboard)/configuracion/facturacion/page.tsx"),
    /IspBillingSettingsScreen/
  )
  assert.match(
    read("app/(dashboard)/facturacion/configuracion/page.tsx"),
    /redirect\("\/configuracion\/facturacion"\)/
  )
  const hub = read("components/configuracion/configuration-hub-panel.tsx")
  assert.match(hub, /href: "\/configuracion\/facturacion"/)
  assert.match(hub, /canAccessIspBilling/)
})

test("el sidebar abre Sistema, anida Facturación bajo Configuración y la marca activa", () => {
  assert.equal(resolveSidebarAreaId("/configuracion/facturacion"), "system")
  assert.equal(resolveSidebarAreaId("/facturacion/configuracion"), "system")
  assert.equal(resolveSidebarAreaId("/facturacion"), "administration")

  assert.equal(
    isNavItemActive(
      "/configuracion/facturacion",
      "/configuracion/facturacion",
      SYSTEM_SIBLINGS
    ),
    true
  )
  assert.equal(
    isNavItemActive("/configuracion/facturacion", "/configuracion", SYSTEM_SIBLINGS),
    false
  )
  assert.equal(
    isNavItemActive("/configuracion/facturacion", "/facturacion", [
      "/facturacion",
      "/tesoreria",
    ]),
    false
  )

  const nested = nestSidebarNavItems([
    settingsNavItem,
    facturacionConfigNavItem,
  ])
  assert.equal(nested.length, 1)
  assert.equal(nested[0].item.href, "/configuracion")
  assert.equal(nested[0].children[0]?.href, "/configuracion/facturacion")

  const withoutHub = nestSidebarNavItems([facturacionConfigNavItem])
  assert.equal(withoutHub.length, 1)
  assert.equal(withoutHub[0].item.href, "/configuracion/facturacion")
  assert.equal(withoutHub[0].children.length, 0)

  const merged = mergeSidebarSectionState({
    stored: { system: false, administration: true },
    areaIds: ["administration", "system"],
    activeAreaId: "system",
  })
  assert.equal(merged.system, true)

  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(sidebar, /nestSidebarNavItems/)
  assert.match(sidebar, /nested/)
})

test("el permiso de facturación no se abre a otros roles por el cambio de ruta", () => {
  const empty = createEmptyModuleVisibility()
  const settingsOnly = { ...empty, settings: true }
  const billingOnly = { ...empty, facturacion: true }
  const operator = {
    systemRole: "operario",
    roleCode: "operario",
    moduleVisibility: empty,
  }

  assert.equal(resolveModuleKeyFromPathname("/configuracion/facturacion"), "facturacion")
  assert.equal(resolveModuleKeyFromPathname("/configuracion"), "settings")
  assert.equal(resolveModuleKeyFromPathname("/facturacion"), "facturacion")
  assert.equal(canAccessPathWithModules("/configuracion/facturacion", empty), false)
  assert.equal(
    canAccessPathWithModules("/configuracion/facturacion", settingsOnly),
    false
  )
  assert.equal(
    canAccessPathWithModules("/configuracion/facturacion", billingOnly),
    true
  )
  assert.equal(canAccessPathWithModules("/configuracion", billingOnly), false)
  assert.equal(canAccessIspBilling(operator), false)

  const billingNav = buildNavGroupsFromModuleVisibility(billingOnly)
  const billingHrefs = billingNav.flatMap((group) =>
    group.items.map((item) => item.href)
  )
  assert.ok(billingHrefs.includes("/configuracion/facturacion"))
  assert.ok(billingHrefs.includes("/facturacion"))
  assert.ok(billingHrefs.includes("/facturacion/comprobantes"))
  assert.ok(billingHrefs.includes("/facturacion/mensual"))
  assert.equal(billingHrefs.includes("/configuracion"), false)
})

test("título, breadcrumb y APIs fiscales no cambian de comportamiento", () => {
  const screen = read("components/isp/isp-billing-settings-screen.tsx")
  assert.match(screen, /Sistema → Configuración → Facturación/)
  assert.match(screen, /Configuración de facturación/)
  assert.match(
    screen,
    /Configurá la empresa emisora, punto de venta, comprobantes e/
  )
  assert.match(screen, /Guardar configuración/)
  assert.match(screen, /\/api\/isp\/billing\/settings/)
  assert.doesNotMatch(screen, /Facturación → Configuración/)

  const meta = getPageMetaForProfile("/configuracion/facturacion", "administrador")
  assert.equal(meta.title, "Configuración de facturación")

  const profileGroups = buildNavGroupsForProfile("administrador")
  const systemHrefs =
    profileGroups.find((group) => group.id === "system")?.items.map((item) => item.href) ??
    []
  const adminHrefs =
    profileGroups
      .find((group) => group.id === "administration")
      ?.items.map((item) => item.href) ?? []
  assert.ok(systemHrefs.includes("/configuracion/facturacion"))
  assert.ok(adminHrefs.includes("/facturacion"))
  assert.ok(adminHrefs.includes("/facturacion/comprobantes"))
  assert.equal(adminHrefs.includes("/configuracion/facturacion"), false)

  assert.match(
    read("app/api/isp/billing/settings/route.ts"),
    /requireIspBillingWriteContext/
  )
  assert.doesNotMatch(
    read("supabase/migrations/20261139000100_isp_1_6a_billing_company_settings.sql"),
    /UX 2\.3/
  )
})
