import assert from "node:assert/strict"
import test from "node:test"

import {
  ALLOWS_CUSTOM_COMPANY_ROLE_CREATION,
  COMPANY_AREA_LABELS,
  DEFAULT_COMPANY_AREA_MODULE_VISIBILITY,
  FIXED_COMPANY_AREA_CODES,
  LEGACY_ROLE_CODE_TO_AREA_CODE,
  listFixedCompanyAreas,
  mapAreaCodeToSystemRole,
  resolveDefaultAreaCodeForSystemRole,
  resolveFixedAreaCode,
} from "../lib/roles/company-areas.ts"
import {
  APP_MODULE_KEYS,
  createFullModuleVisibility,
  getVisibleModuleKeys,
} from "../lib/roles/app-modules.ts"

test("catálogo fijo incluye las siete áreas del modelo", () => {
  assert.deepEqual(FIXED_COMPANY_AREA_CODES, [
    "administrador",
    "administracion",
    "atencion_cliente",
    "ventas",
    "rrhh",
    "tecnica",
    "operario",
  ])
  assert.equal(COMPANY_AREA_LABELS.tecnica, "Técnica")
  assert.equal(COMPANY_AREA_LABELS.atencion_cliente, "Atención al Cliente")
})

test("mapping Área → systemRole mantiene compatibilidad legacy", () => {
  assert.equal(mapAreaCodeToSystemRole("administrador"), "administrador")
  assert.equal(mapAreaCodeToSystemRole("administracion"), "administrativo")
  assert.equal(mapAreaCodeToSystemRole("atencion_cliente"), "administrativo")
  assert.equal(mapAreaCodeToSystemRole("ventas"), "administrativo")
  assert.equal(mapAreaCodeToSystemRole("rrhh"), "administrativo")
  assert.equal(mapAreaCodeToSystemRole("tecnica"), "supervisor")
  assert.equal(mapAreaCodeToSystemRole("operario"), "operario")
  assert.equal(mapAreaCodeToSystemRole("supervisor"), "supervisor")
  assert.equal(mapAreaCodeToSystemRole("administrativo"), "administrativo")
})

test("roles legacy se resuelven a códigos de área fijos", () => {
  assert.equal(resolveFixedAreaCode("supervisor"), "tecnica")
  assert.equal(resolveFixedAreaCode("administrativo"), "administracion")
  assert.equal(LEGACY_ROLE_CODE_TO_AREA_CODE.supervisor, "tecnica")
})

test("Administrador mantiene acceso total por catálogo de módulos", () => {
  assert.equal(
    getVisibleModuleKeys(createFullModuleVisibility()).length,
    APP_MODULE_KEYS.length
  )
})

test("Operario no tiene módulos administrativos habilitados por defecto", () => {
  const visibility = DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.operario

  assert.deepEqual(getVisibleModuleKeys(visibility), [])
})

test("asignación de Área resuelve systemRole interno desde código", () => {
  assert.equal(
    mapAreaCodeToSystemRole(resolveDefaultAreaCodeForSystemRole("supervisor")),
    "supervisor"
  )
  assert.equal(
    mapAreaCodeToSystemRole(
      resolveDefaultAreaCodeForSystemRole("administrativo")
    ),
    "administrativo"
  )
  assert.equal(
    resolveDefaultAreaCodeForSystemRole("operario"),
    "operario"
  )
})

test("module_visibility por área se define en catálogo central", () => {
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.ventas.work_orders,
    true
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.atencion_cliente.customers,
    true
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.tecnica.planificacion,
    true
  )
})

test("UI no permite crear roles custom en Áreas y Accesos 1.0", () => {
  assert.equal(ALLOWS_CUSTOM_COMPANY_ROLE_CREATION, false)
})

test("listFixedCompanyAreas ordena el catálogo fijo", () => {
  const areas = listFixedCompanyAreas([
    { id: "3", code: "operario", sortOrder: 7 },
    { id: "1", code: "administrador", sortOrder: 1 },
    { id: "2", code: "tecnica", sortOrder: 6 },
    { id: "4", code: "custom-ventas", sortOrder: 99 },
  ])

  assert.deepEqual(
    areas.map((area) => area.code),
    ["administrador", "tecnica", "operario"]
  )
})
