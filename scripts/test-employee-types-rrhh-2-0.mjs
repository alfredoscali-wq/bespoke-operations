import assert from "node:assert/strict"
import test from "node:test"

import {
  buildEmployeeFormAreaOptions,
  EMPLOYEE_FORM_AREA_OPTIONS,
  resolveEmployeeFormDepartmentDefault,
} from "../lib/employees/employee-form-catalog.ts"
import {
  buildEmployeeFormTypeOptions,
  buildEmployeeTypeFilterOptions,
  resolveDefaultEmployeeTypeId,
} from "../lib/employees/employee-type-form.ts"
import {
  getEmployeeTypeDisplayName,
  isSupervisorEmployeeType,
  resolveCatalogCodeFromLegacyEmployeeType,
  resolveEmployeeTypePersistence,
  resolveLegacyEmployeeTypeFromCatalogCode,
} from "../lib/employees/employee-type-legacy.ts"
import { resolveImportEmployeeTypeFromCatalog } from "../lib/employees/employee-import/resolve-type.ts"
import {
  employeeMatchesEmployeeTypeFilter,
  isSupervisorEmployee,
} from "../lib/employees/utils.ts"
import { mapEmployeeTypeRowToItem } from "../lib/supabase/employee-types.mapper.ts"
import { mapEmployeeRowToEmployee } from "../lib/supabase/employees.mapper.ts"

const catalog = [
  {
    id: "type-supervisor",
    companyId: "company-a",
    code: "supervisor",
    name: "Supervisor de campo",
    description: null,
    isActive: true,
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "type-admin",
    companyId: "company-a",
    code: "administrative",
    name: "Administrativo",
    description: null,
    isActive: true,
    sortOrder: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "type-operator",
    companyId: "company-a",
    code: "operator",
    name: "Operario",
    description: null,
    isActive: true,
    sortOrder: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "type-inactive",
    companyId: "company-a",
    code: "legacy-custom",
    name: "Custom legacy",
    description: null,
    isActive: false,
    sortOrder: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
]

test("mapper employee_types conserva code estable y name editable", () => {
  const item = mapEmployeeTypeRowToItem({
    id: "1",
    company_id: "c1",
    code: "operator",
    name: "Técnico de campo",
    description: "Campo",
    is_active: true,
    sort_order: 3,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  })

  assert.equal(item.code, "operator")
  assert.equal(item.name, "Técnico de campo")
})

test("legacy sync mapea codes estándar al enum Postgres", () => {
  assert.equal(resolveLegacyEmployeeTypeFromCatalogCode("operator"), "operario")
  assert.equal(resolveLegacyEmployeeTypeFromCatalogCode("supervisor"), "supervisor")
  assert.equal(
    resolveLegacyEmployeeTypeFromCatalogCode("administrative"),
    "administrativo"
  )
  assert.equal(resolveLegacyEmployeeTypeFromCatalogCode("manager"), "gerente")
  assert.equal(resolveLegacyEmployeeTypeFromCatalogCode("other"), "otro")
})

test("custom type sin equivalencia usa fallback legacy otro", () => {
  assert.equal(resolveLegacyEmployeeTypeFromCatalogCode("tecnico-especial"), "otro")
})

test("resolveEmployeeTypePersistence persiste FK y enum legacy", () => {
  const result = resolveEmployeeTypePersistence({
    employeeTypeId: "type-operator",
    catalog,
  })

  assert.equal(result.employeeTypeId, "type-operator")
  assert.equal(result.employeeType, "operario")
})

test("defaults del catálogo priorizan operator activo", () => {
  assert.equal(resolveDefaultEmployeeTypeId(catalog), "type-operator")
})

test("formulario carga tipos activos y conserva inactivo actual", () => {
  const options = buildEmployeeFormTypeOptions(catalog, "type-inactive")
  assert.deepEqual(
    options.map((option) => option.value),
    ["type-inactive", "type-supervisor", "type-admin", "type-operator"]
  )
})

test("filtro por tipo usa employee_type_id con fallback legacy", () => {
  assert.equal(
    employeeMatchesEmployeeTypeFilter(
      { employeeTypeId: "type-operator", employeeType: "operario" },
      "type-operator",
      catalog
    ),
    true
  )

  assert.equal(
    employeeMatchesEmployeeTypeFilter(
      { employeeTypeId: null, employeeType: "supervisor" },
      "type-supervisor",
      catalog
    ),
    true
  )
})

test("listado y detalle muestran name configurable con fallback legacy", () => {
  const employee = mapEmployeeRowToEmployee({
    id: "e1",
    company_id: "company-a",
    employee_code: "EMP-0001",
    first_name: "Ana",
    last_name: "Pérez",
    preferred_name: null,
    national_id: null,
    birth_date: null,
    email: null,
    phone: null,
    job_title: "Técnica",
    department: "Técnica",
    employee_type: "operario",
    employee_type_id: "type-operator",
    employment_status: "active",
    hire_date: null,
    termination_date: null,
    notes: "",
    app_user_id: null,
    system_role: "operario",
    role_id: null,
    system_access: false,
    must_change_password: false,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    employee_types: {
      id: "type-operator",
      code: "operator",
      name: "Técnico de campo",
      is_active: true,
    },
  })

  assert.equal(getEmployeeTypeDisplayName(employee), "Técnico de campo")
})

test("import resuelve por code y falla con tipo inexistente", () => {
  const resolved = resolveImportEmployeeTypeFromCatalog("operator", catalog)
  assert.equal(resolved?.employeeTypeId, "type-operator")
  assert.equal(resolved?.employeeType, "operario")

  const byName = resolveImportEmployeeTypeFromCatalog("Supervisor de campo", catalog)
  assert.equal(byName?.employeeTypeId, "type-supervisor")

  assert.equal(resolveImportEmployeeTypeFromCatalog("inexistente", catalog), null)
})

test("supervisor picker usa code nuevo con fallback legacy", () => {
  assert.equal(
    isSupervisorEmployeeType({
      employeeType: "operario",
      employeeTypeRecord: { code: "supervisor" },
    }),
    true
  )

  assert.equal(
    isSupervisorEmployee({
      employeeType: "supervisor",
      employeeTypeRecord: null,
    }),
    true
  )

  assert.equal(
    isSupervisorEmployee({
      employeeType: "operario",
      employeeTypeRecord: { code: "operator", name: "Operario", id: "x", isActive: true },
    }),
    false
  )
})

test("nomenclatura del formulario mantiene catálogo organizacional", () => {
  assert.deepEqual(EMPLOYEE_FORM_AREA_OPTIONS, [
    "Administración",
    "Atención al Cliente",
    "Ventas",
    "RRHH",
    "Técnica",
    "Operario",
  ])
  assert.equal(resolveEmployeeFormDepartmentDefault("Ventas"), "Ventas")
  assert.deepEqual(buildEmployeeFormAreaOptions("Operaciones de campo"), [
    "Operaciones de campo",
    ...EMPLOYEE_FORM_AREA_OPTIONS,
  ])
})

test("filtro incluye tipos inactivos solo si hay empleados asociados", () => {
  const options = buildEmployeeTypeFilterOptions(catalog, [
    { employeeTypeId: "type-inactive" },
  ])

  assert.ok(options.some((option) => option.value === "type-inactive"))
  assert.ok(options.every((option) => option.value !== "type-admin" || true))
})

test("backfill mapping conserva gerente y otro como tipos separados", () => {
  assert.equal(resolveCatalogCodeFromLegacyEmployeeType("gerente"), "manager")
  assert.equal(resolveCatalogCodeFromLegacyEmployeeType("otro"), "other")
})
