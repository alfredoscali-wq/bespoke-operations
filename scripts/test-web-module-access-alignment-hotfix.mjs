import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPathWithMetadata,
  getMetadataAllowedModules,
} from "../lib/auth/module-access.ts"
import {
  isAdministradorAuthMetadata,
  resolveEffectiveModuleVisibility,
  ADMINISTRATOR_ROLE_CODE,
} from "../lib/roles/role-utils.ts"
import {
  canAccessPathWithModules,
  createEmptyModuleVisibility,
  getVisibleModuleKeys,
  normalizeModuleVisibility,
} from "../lib/roles/app-modules.ts"
import { hasWebModuleAccessFromMetadata } from "../lib/roles/web-module-access.ts"
import { serializeModuleVisibilityForMetadata } from "../lib/roles/session-role.ts"

test("canAccessPathWithMetadata permite administrador con allowed_modules parcial en atencion_cliente", () => {
  const metadata = {
    system_role: "administrador",
    role_code: ADMINISTRATOR_ROLE_CODE,
    allowed_modules: ["dashboard", "calendar"],
  }

  assert.equal(canAccessPathWithMetadata("/atencion-cliente", metadata), true)
})

test("canAccessPathWithMetadata permite administrador por role_code aunque system_role no sea administrador", () => {
  const metadata = {
    system_role: "administrativo",
    role_code: ADMINISTRATOR_ROLE_CODE,
    allowed_modules: ["dashboard"],
  }

  assert.equal(canAccessPathWithMetadata("/atencion-cliente", metadata), true)
  assert.equal(canAccessPathWithMetadata("/cuadrillas", metadata), true)
})

test("usuario no administrador sigue dependiendo de allowed_modules", () => {
  const metadata = {
    system_role: "supervisor",
    role_code: "tecnica",
    allowed_modules: ["calendar", "work_orders", "planificacion"],
  }

  assert.equal(canAccessPathWithMetadata("/cuadrillas", metadata), false)
  assert.equal(canAccessPathWithMetadata("/operations/calendar", metadata), true)
})

test("tecnica sin crews en allowed_modules no accede a cuadrillas", () => {
  const metadata = {
    system_role: "supervisor",
    role_code: "tecnica",
    allowed_modules: ["calendar", "work_orders", "planificacion", "customers"],
  }

  assert.equal(canAccessPathWithMetadata("/cuadrillas", metadata), false)
})

test("tecnica con crews en allowed_modules accede a cuadrillas", () => {
  const metadata = {
    system_role: "supervisor",
    role_code: "tecnica",
    allowed_modules: [
      "calendar",
      "work_orders",
      "planificacion",
      "customers",
      "crews",
    ],
  }

  assert.equal(canAccessPathWithMetadata("/cuadrillas", metadata), true)
})

test("isAdministradorAuthMetadata reconoce system_role y role_code", () => {
  assert.equal(
    isAdministradorAuthMetadata({ system_role: "administrador" }, null),
    true
  )
  assert.equal(
    isAdministradorAuthMetadata({ role_code: ADMINISTRATOR_ROLE_CODE }, null),
    true
  )
  assert.equal(
    isAdministradorAuthMetadata(
      { system_role: "supervisor", role_code: "tecnica" },
      null
    ),
    false
  )
})

test("hasWebModuleAccessFromMetadata mantiene bypass administrador alineado con middleware", () => {
  const metadata = {
    system_role: "administrador",
    allowed_modules: ["dashboard"],
  }

  assert.equal(
    hasWebModuleAccessFromMetadata(metadata, "atencion_cliente", "administrador"),
    true
  )
  assert.equal(
    hasWebModuleAccessFromMetadata(metadata, "crews", "administrador"),
    true
  )
})

test("coherencia sidebar y middleware tras sync simulado de crews", () => {
  const dbVisibility = normalizeModuleVisibility({
    ...createEmptyModuleVisibility(),
    calendar: true,
    work_orders: true,
    planificacion: true,
    customers: true,
    crews: true,
  })

  const metadataAfterSync = {
    system_role: "supervisor",
    role_code: "tecnica",
    allowed_modules: [
      "calendar",
      "work_orders",
      "planificacion",
      "customers",
      "crews",
    ],
  }

  assert.equal(canAccessPathWithModules("/cuadrillas", dbVisibility), true)
  assert.equal(canAccessPathWithMetadata("/cuadrillas", metadataAfterSync), true)
})

test("legacy sin allowed_modules conserva acceso permisivo en middleware", () => {
  assert.equal(canAccessPathWithMetadata("/cuadrillas", {}), true)
  assert.equal(getMetadataAllowedModules({}), null)
})

test("serializeModuleVisibilityForMetadata refleja module_visibility para sync de JWT", () => {
  const dbVisibility = normalizeModuleVisibility({
    ...createEmptyModuleVisibility(),
    calendar: true,
    crews: true,
    work_orders: true,
  })

  const allowedModules = serializeModuleVisibilityForMetadata(dbVisibility)

  assert.deepEqual(allowedModules.sort(), ["calendar", "crews", "work_orders"].sort())
  assert.equal(getVisibleModuleKeys(dbVisibility).sort().join(","), allowedModules.sort().join(","))
})

test("administrador en DB produce allowed_modules completos tras sync simulado", () => {
  const visibility = resolveEffectiveModuleVisibility({
    code: ADMINISTRATOR_ROLE_CODE,
    moduleVisibility: createEmptyModuleVisibility(),
  })

  const allowedModules = serializeModuleVisibilityForMetadata(visibility)
  const metadata = {
    system_role: "administrador",
    role_code: ADMINISTRATOR_ROLE_CODE,
    allowed_modules: allowedModules,
  }

  assert.ok(allowedModules.includes("atencion_cliente"))
  assert.ok(allowedModules.includes("crews"))
  assert.equal(canAccessPathWithMetadata("/atencion-cliente", metadata), true)
  assert.equal(canAccessPathWithMetadata("/cuadrillas", metadata), true)
})

test("syncRoleMetadataClient expone resultado tipado para propagar errores al UI", async () => {
  const module = await import("../lib/auth/sync-employee-metadata.client.ts")
  assert.equal(typeof module.syncRoleMetadataClient, "function")
  assert.equal(typeof module.syncEmployeeMetadataClient, "function")
})

test("fetchActiveEmployeeIdsByRoleId filtra por role_id, company_id y deleted_at nulo", async () => {
  const module = await import("../lib/supabase/employees.queries.ts")
  const source = module.fetchActiveEmployeeIdsByRoleId.toString()

  assert.match(source, /role_id/)
  assert.match(source, /company_id/)
  assert.match(source, /deleted_at/)
})
