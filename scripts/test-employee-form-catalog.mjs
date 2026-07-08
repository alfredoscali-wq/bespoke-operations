import assert from "node:assert/strict"
import test from "node:test"

import {
  buildEmployeeFormAreaOptions,
  buildEmployeeFormTypeOptions,
  EMPLOYEE_FORM_AREA_OPTIONS,
  isLegacyEmployeeFormType,
  resolveEmployeeFormDepartmentDefault,
} from "../lib/employees/employee-form-catalog.ts"

test("Área usa el catálogo organizacional esperado", () => {
  assert.deepEqual(EMPLOYEE_FORM_AREA_OPTIONS, [
    "Administración",
    "Atención al Cliente",
    "Ventas",
    "RRHH",
    "Técnica",
    "Operario",
  ])
})

test("nuevas selecciones de Tipo de empleado solo muestran Administrativo y Operario", () => {
  assert.deepEqual(
    buildEmployeeFormTypeOptions().map((option) => option.value),
    ["administrativo", "operario"]
  )
})

test("edición preserva tipos legacy en el selector", () => {
  const supervisorOptions = buildEmployeeFormTypeOptions("supervisor")
  const gerenteOptions = buildEmployeeFormTypeOptions("gerente")

  assert.equal(supervisorOptions[0]?.value, "supervisor")
  assert.equal(supervisorOptions[0]?.label, "Supervisor")
  assert.deepEqual(
    supervisorOptions.slice(1).map((option) => option.value),
    ["administrativo", "operario"]
  )
  assert.equal(gerenteOptions[0]?.value, "gerente")
  assert.equal(isLegacyEmployeeFormType("supervisor"), true)
  assert.equal(isLegacyEmployeeFormType("administrativo"), false)
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
