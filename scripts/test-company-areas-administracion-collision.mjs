import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260923000100_company_areas_1_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

function resolveAdministracionCollision(roles, employees) {
  const administrativo = roles.find((role) => role.code === "administrativo")
  const administracion = roles.find((role) => role.code === "administracion")

  if (!administrativo || !administracion || administrativo.id === administracion.id) {
    if (administrativo && !administracion) {
      administrativo.code = "administracion"
      administrativo.name = "Administración"
      administrativo.is_system = true
      administrativo.sort_order = 2
    }

    if (!administrativo && administracion) {
      administracion.name = "Administración"
      administracion.is_system = true
      administracion.sort_order = 2
    }

    return roles
  }

  const countEmployees = (roleId) =>
    employees.filter(
      (employee) => employee.role_id === roleId && !employee.deleted_at
    ).length

  const administrativoEmployees = countEmployees(administrativo.id)
  const administracionEmployees = countEmployees(administracion.id)
  const nextRoles = roles.map((role) => ({ ...role }))

  if (administrativoEmployees >= administracionEmployees) {
    const legacy = nextRoles.find((role) => role.id === administracion.id)
    legacy.code = `legacy_administracion_${administracion.id.replaceAll("-", "")}`

    const canonical = nextRoles.find((role) => role.id === administrativo.id)
    canonical.code = "administracion"
    canonical.name = "Administración"
    canonical.is_system = true
    canonical.sort_order = 2
  } else {
    const legacy = nextRoles.find((role) => role.id === administrativo.id)
    legacy.code = `legacy_administrativo_${administrativo.id.replaceAll("-", "")}`

    const canonical = nextRoles.find((role) => role.id === administracion.id)
    canonical.code = "administracion"
    canonical.name = "Administración"
    canonical.is_system = true
    canonical.sort_order = 2
  }

  return nextRoles
}

test("migración 1.0 incluye resolución segura de colisión administracion", () => {
  assert.match(migrationSql, /role_administrativo_id uuid/)
  assert.match(migrationSql, /legacy_administracion_/)
  assert.match(migrationSql, /role_administrativo_emps >= role_administracion_emps/)
  assert.doesNotMatch(
    migrationSql,
    /UPDATE public\.company_roles[\s\S]*code = 'administracion'[\s\S]*WHERE company_id = company\.id[\s\S]*AND code = 'administrativo'/
  )
})

test("coexistencia administrativo + administracion archiva el rol custom vacío", () => {
  const roles = resolveAdministracionCollision(
    [
      {
        id: "f5b63e75-990d-4c56-ad33-045e30fa3b3e",
        code: "administrativo",
        name: "Administrativo",
        is_system: true,
        sort_order: 3,
        module_visibility: { work_orders: true, projects: true },
      },
      {
        id: "7620c6a1-4992-4281-a2c3-0e7ee89d52a8",
        code: "administracion",
        name: "Administracion",
        is_system: false,
        sort_order: 8,
        module_visibility: { work_orders: true, projects: true },
      },
      {
        id: "3848d99c-469c-4c3e-b176-3b547fae9351",
        code: "ventas",
        name: "Ventas",
        is_system: false,
        sort_order: 7,
        module_visibility: { customers: true },
      },
    ],
    Array.from({ length: 7 }, (_, index) => ({
      role_id: "f5b63e75-990d-4c56-ad33-045e30fa3b3e",
      deleted_at: null,
      id: `emp-${index}`,
    }))
  )

  const canonical = roles.find((role) => role.id === "f5b63e75-990d-4c56-ad33-045e30fa3b3e")
  const archived = roles.find((role) => role.id === "7620c6a1-4992-4281-a2c3-0e7ee89d52a8")
  const ventas = roles.find((role) => role.code === "ventas")

  assert.equal(canonical.code, "administracion")
  assert.equal(canonical.is_system, true)
  assert.equal(canonical.module_visibility.work_orders, true)
  assert.match(archived.code, /^legacy_administracion_/)
  assert.equal(ventas.code, "ventas")
  assert.equal(roles.filter((role) => role.code === "administracion").length, 1)
})

test("preserva role_id de empleados al canonicalizar administracion", () => {
  const employees = [
    {
      id: "emp-1",
      role_id: "f5b63e75-990d-4c56-ad33-045e30fa3b3e",
      deleted_at: null,
    },
  ]

  const roles = resolveAdministracionCollision(
    [
      {
        id: "f5b63e75-990d-4c56-ad33-045e30fa3b3e",
        code: "administrativo",
        is_system: true,
        module_visibility: { settings: false },
      },
      {
        id: "7620c6a1-4992-4281-a2c3-0e7ee89d52a8",
        code: "administracion",
        is_system: false,
        module_visibility: { settings: true },
      },
    ],
    employees
  )

  const canonical = roles.find((role) => role.code === "administracion")

  assert.equal(canonical.id, "f5b63e75-990d-4c56-ad33-045e30fa3b3e")
  assert.equal(employees[0].role_id, canonical.id)
  assert.equal(canonical.module_visibility.settings, false)
})

test("si administracion custom tiene empleados, canonicaliza ese role_id", () => {
  const roles = resolveAdministracionCollision(
    [
      {
        id: "administrativo-id",
        code: "administrativo",
        is_system: true,
        module_visibility: {},
      },
      {
        id: "administracion-id",
        code: "administracion",
        is_system: false,
        module_visibility: { customers: true },
      },
    ],
    [
      { id: "emp-1", role_id: "administracion-id", deleted_at: null },
      { id: "emp-2", role_id: "administracion-id", deleted_at: null },
    ]
  )

  const canonical = roles.find((role) => role.code === "administracion")
  const archived = roles.find((role) => role.id === "administrativo-id")

  assert.equal(canonical.id, "administracion-id")
  assert.match(archived.code, /^legacy_administrativo_/)
  assert.equal(canonical.module_visibility.customers, true)
})

test("solo administrativo existente se renombra sin crear duplicados", () => {
  const roles = resolveAdministracionCollision(
    [
      {
        id: "administrativo-id",
        code: "administrativo",
        is_system: true,
        module_visibility: { reports: true },
      },
    ],
    []
  )

  assert.deepEqual(
    roles.map((role) => role.code),
    ["administracion"]
  )
})
