import assert from "node:assert/strict"
import test from "node:test"

import {
  buildEmployeeFormAreaOptions,
  EMPLOYEE_FORM_AREA_OPTIONS,
  resolveEmployeeFormDepartmentDefault,
} from "../lib/employees/employee-form-catalog.ts"

test("Área organizacional usa el catálogo esperado", () => {
  assert.deepEqual(EMPLOYEE_FORM_AREA_OPTIONS, [
    "Administración",
    "Atención al Cliente",
    "Ventas",
    "RRHH",
    "Técnica",
    "Operario",
  ])
})

test("edición preserva departamentos legacy fuera del catálogo nuevo", () => {
  assert.deepEqual(buildEmployeeFormAreaOptions("Operaciones de campo"), [
    "Operaciones de campo",
    ...EMPLOYEE_FORM_AREA_OPTIONS,
  ])
  assert.deepEqual(
    buildEmployeeFormAreaOptions("Administración"),
    [...EMPLOYEE_FORM_AREA_OPTIONS]
  )
})

test("resolveEmployeeFormDepartmentDefault mantiene valor existente o usa Administración", () => {
  assert.equal(resolveEmployeeFormDepartmentDefault("Ventas"), "Ventas")
  assert.equal(resolveEmployeeFormDepartmentDefault(""), "Administración")
  assert.equal(resolveEmployeeFormDepartmentDefault(undefined), "Administración")
})
