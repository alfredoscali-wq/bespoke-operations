import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260924000100_areas_access_rls_alignment_1_2.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

function authUserHasAllowedModule({ systemRole, allowedModules, moduleKey }) {
  if (systemRole === "administrador") {
    return true
  }

  if (systemRole === "operario") {
    return false
  }

  if (!moduleKey || !String(moduleKey).trim()) {
    return false
  }

  return (
    Array.isArray(allowedModules) &&
    allowedModules.includes(String(moduleKey).trim())
  )
}

function canUpdateTaskIncidents({ systemRole, allowedModules, demoReadOnly = false }) {
  if (demoReadOnly) {
    return false
  }

  return (
    systemRole === "administrador" ||
    systemRole === "supervisor" ||
    authUserHasAllowedModule({
      systemRole,
      allowedModules,
      moduleKey: "planificacion",
    })
  )
}

function canManageIncidentTypes({ systemRole, allowedModules, demoReadOnly = false }) {
  if (demoReadOnly) {
    return false
  }

  return (
    systemRole === "supervisor" ||
    authUserHasAllowedModule({
      systemRole,
      allowedModules,
      moduleKey: "settings",
    })
  )
}

function canManageWorkOrderChecklist({ systemRole, allowedModules, demoReadOnly = false }) {
  return canManageIncidentTypes({ systemRole, allowedModules, demoReadOnly })
}

test("migración 1.2 define helper allowed_modules y actualiza los 3 bloqueos", () => {
  assert.match(migrationSql, /auth_user_has_allowed_module\(p_module_key text\)/)
  assert.match(migrationSql, /auth_can_manage_incident_types\(\)/)
  assert.match(migrationSql, /auth_can_manage_work_order_type_checklist\(\)/)
  assert.match(migrationSql, /auth_can_manage_task_incident\(p_incident_id uuid\)/)
  assert.match(migrationSql, /task_incidents_update_policy/)
  assert.match(migrationSql, /auth_user_has_allowed_module\('planificacion'\)/)
  assert.match(migrationSql, /auth_user_has_allowed_module\('settings'\)/)
})

test("administrativo + planificacion puede operar incidencias", () => {
  assert.equal(
    canUpdateTaskIncidents({
      systemRole: "administrativo",
      allowedModules: ["planificacion"],
    }),
    true
  )
})

test("usuario sin planificacion sigue bloqueado para task_incidents", () => {
  assert.equal(
    canUpdateTaskIncidents({
      systemRole: "administrativo",
      allowedModules: ["work_orders"],
    }),
    false
  )
})

test("administrativo + settings puede gestionar Tipos de Incidencia", () => {
  assert.equal(
    canManageIncidentTypes({
      systemRole: "administrativo",
      allowedModules: ["settings"],
    }),
    true
  )
})

test("usuario sin settings sigue bloqueado para Tipos de Incidencia", () => {
  assert.equal(
    canManageIncidentTypes({
      systemRole: "administrativo",
      allowedModules: ["planificacion"],
    }),
    false
  )
})

test("administrativo + settings puede gestionar checklist de Tipos de OT", () => {
  assert.equal(
    canManageWorkOrderChecklist({
      systemRole: "administrativo",
      allowedModules: ["settings"],
    }),
    true
  )
})

test("Operario no obtiene acceso administrativo por allowed_modules", () => {
  assert.equal(
    authUserHasAllowedModule({
      systemRole: "operario",
      allowedModules: ["planificacion", "settings"],
      moduleKey: "planificacion",
    }),
    false
  )
  assert.equal(
    canUpdateTaskIncidents({
      systemRole: "operario",
      allowedModules: ["planificacion"],
    }),
    false
  )
  assert.equal(
    canManageIncidentTypes({
      systemRole: "operario",
      allowedModules: ["settings"],
    }),
    false
  )
})

test("Administrador mantiene bypass", () => {
  assert.equal(
    canUpdateTaskIncidents({
      systemRole: "administrador",
      allowedModules: [],
    }),
    true
  )
  assert.equal(
    canManageIncidentTypes({
      systemRole: "administrador",
      allowedModules: [],
    }),
    true
  )
})

test("Técnica/supervisor preserva acceso existente", () => {
  assert.equal(
    canUpdateTaskIncidents({
      systemRole: "supervisor",
      allowedModules: [],
    }),
    true
  )
  assert.equal(
    canManageIncidentTypes({
      systemRole: "supervisor",
      allowedModules: [],
    }),
    true
  )
})

test("policies mantienen aislamiento multi-tenant por company_id", () => {
  assert.match(migrationSql, /company_id = public\.auth_user_company_id\(\)/)
  assert.match(
    migrationSql,
    /ti\.company_id = public\.auth_user_company_id\(\)/
  )
})
