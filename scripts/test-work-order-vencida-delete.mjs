import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { canShowForceDeleteAction } from "../lib/admin/force-delete-policy.ts"
import { AUDIT_ACTIONS } from "../lib/audit/types.ts"
import { isServerOnlyAuditAction } from "../lib/audit/client-policy.ts"
import { ACTIVITY_ACTIONS } from "../lib/activity/types.ts"
import { isServerOnlyActivityAction } from "../lib/activity/client-policy.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"
import { canCreateWorkOrdersWeb } from "../lib/roles/web-module-access.ts"
import { PLANNING_RETURN_METADATA_KEYS } from "../lib/tasks/planning-return.ts"
import { matchesActiveWorkOrderListQuery } from "../lib/tasks/task-list-scope.ts"
import {
  authorizeWorkOrderSoftDelete,
  canAdminSoftDeleteWorkOrder,
  canPermanentlyDeleteWorkOrder,
  canSoftDeleteVencidaWorkOrder,
  canSoftDeleteWorkOrder,
  WORK_ORDER_VENCIDA_DELETE_FORBIDDEN_MESSAGE,
} from "../lib/tasks/work-order-deletion-policy.ts"
import { matchesDashboardKpiDrilldownQuery } from "../lib/tasks/dashboard-kpi-drilldown.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function buildSessionUser(overrides = {}) {
  return {
    authUserId: "auth-1",
    employeeId: "emp-1",
    companyId: COMPANY,
    displayName: "Test User",
    initials: "TU",
    systemRole: overrides.systemRole ?? "administrativo",
    roleId: overrides.roleId ?? "role-1",
    roleCode: overrides.roleCode ?? "administracion",
    roleName: overrides.roleName ?? "Administración",
    moduleVisibility:
      overrides.moduleVisibility ??
      ({
        ...createEmptyModuleVisibility(),
        work_orders: true,
      }),
    visibleModuleKeys: [],
    nationalId: null,
    mustChangePassword: false,
    email: "test@example.com",
    ...overrides,
  }
}

const creator = () => buildSessionUser()
const withoutCreate = () =>
  buildSessionUser({
    roleCode: "rrhh",
    moduleVisibility: createEmptyModuleVisibility(),
  })
const admin = () =>
  buildSessionUser({
    systemRole: "administrador",
    roleCode: "administrador",
    moduleVisibility: createFullModuleVisibility(),
  })
const operario = () =>
  buildSessionUser({
    systemRole: "operario",
    roleCode: "operario",
    moduleVisibility: createEmptyModuleVisibility(),
  })

test("quien puede cargar OT puede eliminar una OT vencida (soft delete)", () => {
  const vencida = { status: "vencida" }
  assert.equal(canCreateWorkOrdersWeb(creator()), true)
  assert.equal(canSoftDeleteVencidaWorkOrder(vencida, creator()), true)
  assert.equal(canSoftDeleteWorkOrder(vencida), false)

  const authz = authorizeWorkOrderSoftDelete({
    task: vencida,
    sessionUser: creator(),
    taskCompanyId: COMPANY,
  })
  assert.equal(authz.allowed, true)
  assert.equal(authz.mode, "vencida-creator")
})

test("quien puede cargar OT no puede eliminar OT en otros estados por esta regla", () => {
  for (const status of ["asignada", "programada", "en-curso", "incidencia"]) {
    assert.equal(
      canSoftDeleteVencidaWorkOrder({ status }, creator()),
      false,
      status
    )
  }

  const asignada = authorizeWorkOrderSoftDelete({
    task: { status: "asignada" },
    sessionUser: creator(),
    taskCompanyId: COMPANY,
  })
  assert.equal(asignada.allowed, false)
  assert.equal(asignada.httpStatus, 409)

  const enCurso = authorizeWorkOrderSoftDelete({
    task: { status: "en-curso" },
    sessionUser: creator(),
    taskCompanyId: COMPANY,
  })
  assert.equal(enCurso.allowed, false)
})

test("usuario sin permiso de carga no puede eliminar OT vencida", () => {
  const vencida = { status: "vencida" }
  assert.equal(canCreateWorkOrdersWeb(withoutCreate()), false)
  assert.equal(canSoftDeleteVencidaWorkOrder(vencida, withoutCreate()), false)

  const authz = authorizeWorkOrderSoftDelete({
    task: vencida,
    sessionUser: withoutCreate(),
    taskCompanyId: COMPANY,
  })
  assert.equal(authz.allowed, false)
  assert.equal(authz.httpStatus, 403)
  assert.equal(authz.message, WORK_ORDER_VENCIDA_DELETE_FORBIDDEN_MESSAGE)

  const operarioAuthz = authorizeWorkOrderSoftDelete({
    task: vencida,
    sessionUser: operario(),
    taskCompanyId: COMPANY,
  })
  assert.equal(operarioAuthz.allowed, false)
  assert.equal(operarioAuthz.httpStatus, 403)
})

test("admin conserva soft delete previo y no gana un permiso nuevo de creación", () => {
  assert.equal(canCreateWorkOrdersWeb(admin()), true)
  assert.equal(canSoftDeleteWorkOrder("programada"), true)
  assert.equal(canAdminSoftDeleteWorkOrder("programada"), true)

  const programada = authorizeWorkOrderSoftDelete({
    task: { status: "programada" },
    sessionUser: admin(),
    taskCompanyId: COMPANY,
  })
  assert.equal(programada.allowed, true)
  assert.equal(programada.mode, "admin")

  const vencida = authorizeWorkOrderSoftDelete({
    task: { status: "vencida" },
    sessionUser: admin(),
    taskCompanyId: COMPANY,
  })
  assert.equal(vencida.allowed, true)
  assert.equal(vencida.mode, "vencida-creator")
})

test("force delete y borrado permanente siguen restringidos al administrador", () => {
  assert.equal(canShowForceDeleteAction("administrador"), true)
  assert.equal(canShowForceDeleteAction("supervisor"), false)
  assert.equal(canShowForceDeleteAction("administrativo"), false)
  assert.equal(canPermanentlyDeleteWorkOrder("administrador", "finalizada"), true)
  assert.equal(canPermanentlyDeleteWorkOrder("administrativo", "finalizada"), false)
  assert.equal(canPermanentlyDeleteWorkOrder("supervisor", "vencida"), false)
  assert.equal(isServerOnlyActivityAction(ACTIVITY_ACTIONS.TASK_FORCE_DELETE), true)
  assert.equal(isServerOnlyAuditAction(AUDIT_ACTIONS.FORCE_DELETE), true)
})

test("la eliminación de vencida usa TASK_DELETE existente, no force delete", () => {
  const deletion = read("components/tareas/tasks-provider/hooks/use-tasks-deletion.ts")
  const audit = read("lib/audit/tasks-audit.ts")
  const server = read("lib/tasks/work-order-admin-mutation.server.ts")
  const queries = read("lib/supabase/tasks.queries.ts")

  assert.match(deletion, /isVencidaStatus\(existing.status\)/)
  assert.match(deletion, /recordTaskDeleteAudit\(existing\)/)
  assert.match(audit, /AUDIT_ACTIONS.TASK_DELETE/)
  assert.match(server, /persistTaskSoftDelete/)
  assert.match(queries, /persistTaskSoftDelete/)
  assert.equal(server.includes("forceDelete"), false)
  assert.equal(server.includes("TASK_FORCE_DELETE"), false)
  assert.equal(isServerOnlyActivityAction(ACTIVITY_ACTIONS.TASK_DELETE), false)
})

test("después del soft delete la OT no entra en listados operativos ni en el KPI", () => {
  const live = {
    id: "ot-1",
    status: "vencida",
    companyId: COMPANY,
    deletedAt: null,
    projectId: null,
  }
  const deleted = { ...live, deletedAt: "2026-09-29T12:00:00.000Z" }
  const spec = { statuses: ["vencida"], excludePlanningReturn: true }

  assert.equal(matchesDashboardKpiDrilldownQuery(live, spec, COMPANY), true)
  assert.equal(matchesDashboardKpiDrilldownQuery(deleted, spec, COMPANY), false)
  assert.equal(matchesActiveWorkOrderListQuery(deleted), false)
})

test("no puede eliminar una OT de otra company", () => {
  const authz = authorizeWorkOrderSoftDelete({
    task: { status: "vencida" },
    sessionUser: creator(),
    taskCompanyId: OTHER_COMPANY,
  })
  assert.equal(authz.allowed, false)
  assert.equal(authz.httpStatus, 404)

  const persist = read("lib/supabase/tasks.queries.ts")
  const persistBlock = persist.slice(
    persist.indexOf("export async function persistTaskSoftDelete("),
    persist.indexOf("export async function fetchOccupiedTaskCodesByPrefix(")
  )
  assert.match(persistBlock, /\.eq\("company_id", companyId\)/)
  assert.match(persistBlock, /\.is\("deleted_at", null\)/)
})

test("OT vencida con devolución de planificación no usa esta regla", () => {
  const returned = {
    status: "vencida",
    taskMetadata: {
      [PLANNING_RETURN_METADATA_KEYS.reason]: "Cliente ausente",
      [PLANNING_RETURN_METADATA_KEYS.at]: "2026-09-17T12:00:00.000Z",
      [PLANNING_RETURN_METADATA_KEYS.by]: "Planificación",
    },
  }
  assert.equal(canSoftDeleteVencidaWorkOrder(returned, creator()), false)
})

test("canSoftDeleteWorkOrder no se amplió a vencida", () => {
  assert.equal(canSoftDeleteWorkOrder("vencida"), false)
  assert.equal(canSoftDeleteWorkOrder({ status: "vencida" }), false)
  assert.equal(canAdminSoftDeleteWorkOrder("vencida"), false)
})

test("la UI de vencida usa el modal específico y el backend autoriza", () => {
  const rowActions = read("components/tareas/task-admin-row-actions.tsx")
  const detail = read("components/tareas/task-admin-soft-delete-action.tsx")
  const dialog = read("components/tareas/work-order-vencida-delete-dialog.tsx")
  const api = read("app/api/tasks/[taskId]/route.ts")

  assert.match(rowActions, /canSoftDeleteVencidaWorkOrder/)
  assert.match(rowActions, /WorkOrderVencidaDeleteDialog/)
  assert.match(detail, /Eliminar OT/)
  assert.match(dialog, /¿Eliminar esta OT\?/)
  assert.match(dialog, /Esta OT está vencida y dejará de aparecer en los listados operativos/)
  assert.match(dialog, /Eliminar OT/)
  assert.match(api, /deleteWorkOrderFromAdmin/)
  assert.match(api, /requireWritablePlatformSession/)
})
