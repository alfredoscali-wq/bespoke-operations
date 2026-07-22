import assert from "node:assert/strict"
import test from "node:test"

import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
  resolveModuleKeyFromPathname,
} from "../lib/roles/app-modules.ts"
import { hasWebModuleAccess } from "../lib/roles/web-module-access.ts"
import {
  filterExternalCrews,
  filterInternalCrews,
  formatCrewOptionLabel,
  isExternalCrew,
  resolveCrewOrigin,
} from "../lib/crews/origin.ts"
import {
  buildNextExternalEmployeeCode,
  filterContractorEmployees,
  isContractorEmployee,
  isEmployeeNationalIdLocked,
  resolveExternalUserAccessLabel,
} from "../lib/contractors/employees.ts"
import {
  assertAuthEmailMatchesEmployeeDni,
  buildAuthEmail,
} from "../lib/auth/auth-identity.ts"
import {
  partitionTasksByCrewOrigin,
  resolveTaskCrewExecutionOrigin,
} from "../lib/dashboard/crew-execution-origin.ts"
import { getCrewsForTaskSelection } from "../lib/crews/status-workflow.ts"

function buildSessionUser(overrides) {
  const moduleVisibility =
    overrides.moduleVisibility ?? createEmptyModuleVisibility()

  return {
    authUserId: "auth-1",
    employeeId: "emp-1",
    companyId: "company-1",
    displayName: "Test User",
    initials: "TU",
    systemRole: overrides.systemRole,
    roleId: overrides.roleId ?? "role-1",
    roleCode: overrides.roleCode ?? "administrador",
    roleName: overrides.roleName ?? "Administrador",
    moduleVisibility,
    visibleModuleKeys: [],
    nationalId: null,
    mustChangePassword: false,
    email: "test@example.com",
    ...overrides,
  }
}

test("módulo contractors resuelve pathname /contratistas", () => {
  assert.equal(resolveModuleKeyFromPathname("/contratistas"), "contractors")
  assert.equal(
    resolveModuleKeyFromPathname("/contratistas/abc"),
    "contractors"
  )
})

test("administrador tiene acceso web a contractors", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrador",
    roleCode: "administrador",
    moduleVisibility: createEmptyModuleVisibility(),
  })
  assert.equal(hasWebModuleAccess(sessionUser, "contractors"), true)
})

test("operario no ve módulo contractors", () => {
  const sessionUser = buildSessionUser({
    systemRole: "operario",
    roleCode: "operario",
    moduleVisibility: createEmptyModuleVisibility(),
  })
  assert.equal(hasWebModuleAccess(sessionUser, "contractors"), false)
})

test("createFullModuleVisibility incluye contractors", () => {
  const full = createFullModuleVisibility()
  assert.equal(full.contractors, true)
})

test("origin helpers distinguen cuadrillas internas y externas", () => {
  const internal = {
    id: "c1",
    name: "Norte",
    origin: "internal",
    contractorId: null,
    status: "activa",
  }
  const external = {
    id: "c2",
    name: "Fibra Sur",
    origin: "external",
    contractorId: "ctr-1",
    status: "activa",
  }

  assert.equal(isExternalCrew(internal), false)
  assert.equal(isExternalCrew(external), true)
  assert.equal(resolveCrewOrigin(external), "external")
  assert.equal(formatCrewOptionLabel(external), "Fibra Sur (Externa)")
  assert.equal(formatCrewOptionLabel(internal), "Norte")
  assert.equal(filterInternalCrews([internal, external]).length, 1)
  assert.equal(filterExternalCrews([internal, external], "ctr-1").length, 1)
})

test("asignación OT incluye cuadrillas externas activas indistintamente", () => {
  const crews = [
    {
      id: "int",
      name: "Interna",
      origin: "internal",
      contractorId: null,
      status: "activa",
      description: "",
      supervisor: "A",
      notes: "",
      members: [],
    },
    {
      id: "ext",
      name: "Externa",
      origin: "external",
      contractorId: "ctr-1",
      status: "activa",
      description: "",
      supervisor: "B",
      notes: "",
      members: [],
    },
    {
      id: "off",
      name: "Inactiva Ext",
      origin: "external",
      contractorId: "ctr-1",
      status: "inactiva",
      description: "",
      supervisor: "C",
      notes: "",
      members: [],
    },
  ]

  const selectable = getCrewsForTaskSelection(crews)
  assert.equal(selectable.length, 2)
  assert.ok(selectable.some((crew) => crew.id === "ext"))
  assert.ok(selectable.some((crew) => crew.id === "int"))
})

test("empleados externos se filtran por contractorId", () => {
  const employees = [
    { id: "1", contractorId: null },
    { id: "2", contractorId: "ctr-1" },
    { id: "3", contractorId: "ctr-2" },
  ]

  assert.equal(isContractorEmployee(employees[0]), false)
  assert.equal(isContractorEmployee(employees[1]), true)
  assert.equal(filterContractorEmployees(employees, "ctr-1").length, 1)
  assert.equal(buildNextExternalEmployeeCode(["EXT-0001", "EMP-0002"]), "EXT-0002")
})

test("DNI queda bloqueado solo tras provisión Auth", () => {
  assert.equal(isEmployeeNationalIdLocked({ appUserId: null }), false)
  assert.equal(
    isEmployeeNationalIdLocked({ appUserId: "auth-user-1" }),
    true
  )
})

test("etiqueta de acceso externo refleja systemAccess y provisión", () => {
  assert.equal(
    resolveExternalUserAccessLabel({
      appUserId: null,
      systemAccess: false,
    }),
    "Acceso desactivado"
  )
  assert.equal(
    resolveExternalUserAccessLabel({
      appUserId: null,
      systemAccess: true,
    }),
    "Pendiente de provisión"
  )
  assert.equal(
    resolveExternalUserAccessLabel({
      appUserId: "auth-1",
      systemAccess: true,
    }),
    "Provisionado"
  )
})

test("provisión exige consistencia DNI ↔ Auth email", () => {
  const companyId = "00000000-0000-4000-8000-000000000002"
  const dni = "30651518"
  const expected = buildAuthEmail(dni, companyId)

  assert.equal(
    assertAuthEmailMatchesEmployeeDni({
      authEmail: expected,
      nationalId: dni,
      expectedAuthEmail: expected,
    }).ok,
    true
  )

  const mismatch = assertAuthEmailMatchesEmployeeDni({
    authEmail: buildAuthEmail("30651517", companyId),
    nationalId: dni,
    expectedAuthEmail: expected,
  })
  assert.equal(mismatch.ok, false)
  if (!mismatch.ok) {
    assert.match(mismatch.error, /Inconsistencia entre DNI/)
  }
})

test("dashboard model prep clasifica OT por origen de cuadrilla", () => {
  const crews = [
    {
      id: "int",
      name: "Interna",
      origin: "internal",
      contractorId: null,
    },
    {
      id: "ext",
      name: "Externa",
      origin: "external",
      contractorId: "ctr-1",
    },
  ]
  const tasks = [
    { crewId: "int", crew: "Interna" },
    { crewId: "ext", crew: "Externa" },
    { crewId: null, crew: "" },
  ]

  assert.equal(resolveTaskCrewExecutionOrigin(tasks[0], crews), "internal")
  assert.equal(resolveTaskCrewExecutionOrigin(tasks[1], crews), "external")
  assert.equal(resolveTaskCrewExecutionOrigin(tasks[2], crews), "unassigned")

  const partitioned = partitionTasksByCrewOrigin(tasks, crews)
  assert.equal(partitioned.internal.length, 1)
  assert.equal(partitioned.external.length, 1)
  assert.equal(partitioned.unassigned.length, 1)
})
