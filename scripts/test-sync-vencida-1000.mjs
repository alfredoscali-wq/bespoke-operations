import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildTaskVencidaAuditMetadata } from "../lib/audit/tasks-audit-shared.ts"
import { PLANNING_RETURN_METADATA_KEYS } from "../lib/tasks/planning-return.ts"
import { buildVencidaExecutionOrderReleasePatch } from "../lib/tasks/execution-order-create.ts"
import {
  chunkVencidaSyncTaskIds,
  VENCIDA_SYNC_TASK_ID_PAGE_SIZE,
} from "../lib/supabase/tasks.queries.ts"
import { shouldAutoTransitionToVencida } from "../lib/tasks/vencida-status.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"
const PAST_DUE = "2026-01-01"
const FUTURE_DUE = "2099-12-31"

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function task(overrides = {}) {
  return {
    id: overrides.id ?? "ot-1",
    status: overrides.status ?? "programada",
    dueDate: overrides.dueDate ?? PAST_DUE,
    startDate: overrides.startDate ?? PAST_DUE,
    companyId: overrides.companyId ?? COMPANY,
    deletedAt: overrides.deletedAt ?? null,
    taskMetadata: overrides.taskMetadata ?? {},
    executionOrder: overrides.executionOrder ?? 1,
    crewId: overrides.crewId ?? "crew-a",
    crew: overrides.crew ?? "Cuadrilla A",
    scheduledTime: overrides.scheduledTime ?? "09:00",
    code: overrides.code ?? "TSK-1",
  }
}

function matchesVencidaSyncByIdQuery(row, companyId, requestedIds) {
  if (row.deletedAt) {
    return false
  }
  if (row.companyId !== companyId) {
    return false
  }
  return requestedIds.has(row.id)
}

function selectByFetchTasksCap(rows, maxRows = 1000) {
  return [...rows]
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, maxRows)
}

function selectByRequestedIds(rows, companyId, taskIds) {
  const requestedIds = new Set(taskIds)
  return rows.filter((row) =>
    matchesVencidaSyncByIdQuery(row, companyId, requestedIds)
  )
}

test("el endpoint ya no llama fetchTasks() y consulta por taskIds + company_id + deleted_at", () => {
  const route = read("app/api/tasks/sync-vencida/route.ts")
  assert.equal(route.includes("fetchTasks("), false)
  assert.equal(route.includes("listTasks("), false)
  assert.match(route, /fetchTasksByIdsForVencidaSync/)
  assert.match(route, /resolveTenantCompanyId/)
  assert.match(route, /shouldAutoTransitionToVencida/)
  assert.match(route, /syncVencidaTasksWithAudit/)
  assert.match(
    route,
    /if \(taskIds\.length === 0\) \{[\s\S]*updatedTaskIds: \[\]/
  )

  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.match(
    fetchTasksBlock,
    /\.order\("due_date", \{ ascending: true \}\)/
  )
  assert.equal(fetchTasksBlock.includes("fetchTasksByIdsForVencidaSync"), false)

  const byIdBlock = queries.slice(
    queries.indexOf("export async function fetchTasksByIdsForVencidaSync("),
    queries.indexOf("export async function fetchTaskById(")
  )
  assert.match(byIdBlock, /\.eq\("company_id", companyId\)/)
  assert.match(byIdBlock, /\.is\("deleted_at", null\)/)
  assert.match(byIdBlock, /\.in\("id", chunk\)/)
  assert.equal(byIdBlock.includes("fetchTasks("), false)
  assert.equal(byIdBlock.includes('.order("due_date"'), false)
  assert.match(queries, /export const VENCIDA_SYNC_TASK_ID_PAGE_SIZE = 1000/)
  assert.match(queries, /chunkVencidaSyncTaskIds\(taskIds\)/)
})

test("una OT fuera de las primeras 1000 por due_date se puede actualizar si su ID fue solicitado", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    task({
      id: `old-${index}`,
      status: "finalizada",
      dueDate: "2025-01-01",
    })
  )
  const overdue = task({
    id: "ot-overdue-recent",
    status: "programada",
    dueDate: PAST_DUE,
  })
  const all = [...historical, overdue]
  const requested = [overdue.id]

  const capped = selectByFetchTasksCap(all, 1000)
  assert.equal(
    capped.some((row) => row.id === overdue.id),
    false,
    "fetchTasks cap would hide the overdue OT"
  )

  const byId = selectByRequestedIds(all, COMPANY, requested)
  assert.equal(byId.length, 1)
  assert.equal(byId[0].id, overdue.id)
  assert.equal(shouldAutoTransitionToVencida(byId[0]), true)
})

test("programada y asignada vencidas pasan; futura/finalizada/cancelada/devuelta no", () => {
  const programada = task({ id: "prog", status: "programada" })
  const asignada = task({ id: "asig", status: "asignada" })
  const futura = task({ id: "fut", status: "programada", dueDate: FUTURE_DUE })
  const finalizada = task({ id: "fin", status: "finalizada" })
  const cancelada = task({ id: "can", status: "cancelada" })
  const returned = task({
    id: "ret",
    status: "programada",
    taskMetadata: {
      [PLANNING_RETURN_METADATA_KEYS.reason]: "Material",
      [PLANNING_RETURN_METADATA_KEYS.at]: "2026-09-17T12:00:00.000Z",
      [PLANNING_RETURN_METADATA_KEYS.by]: "Supervisor",
    },
  })
  const otherTenant = task({
    id: "foreign",
    status: "programada",
    companyId: OTHER_COMPANY,
  })
  const deleted = task({
    id: "deleted",
    status: "programada",
    deletedAt: "2026-09-16T00:00:00Z",
  })

  const rows = [
    programada,
    asignada,
    futura,
    finalizada,
    cancelada,
    returned,
    otherTenant,
    deleted,
  ]
  const requested = rows.map((row) => row.id)
  const loaded = selectByRequestedIds(rows, COMPANY, requested)
  const candidates = loaded.filter(shouldAutoTransitionToVencida)
  const candidateIds = new Set(candidates.map((row) => row.id))

  assert.equal(candidateIds.has("prog"), true)
  assert.equal(candidateIds.has("asig"), true)
  assert.equal(candidateIds.has("fut"), false)
  assert.equal(candidateIds.has("fin"), false)
  assert.equal(candidateIds.has("can"), false)
  assert.equal(candidateIds.has("ret"), false)
  assert.equal(candidateIds.has("foreign"), false)
  assert.equal(candidateIds.has("deleted"), false)
  assert.equal(shouldAutoTransitionToVencida(returned), false)
})

test("taskIds vacío no consulta ni modifica DB", () => {
  const route = read("app/api/tasks/sync-vencida/route.ts")
  const afterEmpty = route.slice(route.indexOf("if (taskIds.length === 0)"))
  const emptyBranch = afterEmpty.slice(0, afterEmpty.indexOf("try {"))
  assert.match(emptyBranch, /updatedTaskIds: \[\]/)
  assert.equal(emptyBranch.includes("createAdminClient"), false)
  assert.equal(emptyBranch.includes("fetchTasksByIdsForVencidaSync"), false)
  assert.equal(emptyBranch.includes("syncVencidaTasksWithAudit"), false)
  assert.deepEqual(chunkVencidaSyncTaskIds([]), [])
})

test("se mantiene executionOrder = null y auditoría de vencimiento", () => {
  const patch = buildVencidaExecutionOrderReleasePatch()
  assert.equal(patch.status, "vencida")
  assert.equal(patch.executionOrder, null)

  const server = read("lib/supabase/tasks-vencida-sync.server.ts")
  assert.match(server, /buildVencidaExecutionOrderReleasePatch/)
  assert.match(server, /AUDIT_ACTIONS\.TASK_STATUS_VENCIDA/)
  assert.match(server, /SYSTEM_AUDIT_ACTOR/)
  assert.match(server, /workflowAction: "auto-vencida"/)

  const metadata = buildTaskVencidaAuditMetadata(
    task({ status: "programada", executionOrder: 4 })
  )
  assert.equal(metadata.automatic, true)
  assert.equal(metadata.estado_nuevo, "vencida")
  assert.equal(metadata.orden_ejecucion_anterior, 4)
})

test("más de 1000 taskIds se parten en chunks y no se pierden IDs", () => {
  assert.equal(VENCIDA_SYNC_TASK_ID_PAGE_SIZE, 1000)
  const ids = Array.from({ length: 1100 }, (_, index) => `id-${index}`)
  ids.push("id-0", "  ", "")
  const chunks = chunkVencidaSyncTaskIds(ids)

  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].length, 1000)
  assert.equal(chunks[1].length, 100)
  assert.equal(chunks.flat().length, 1100)
  assert.equal(new Set(chunks.flat()).size, 1100)
  assert.equal(chunks.flat()[0], "id-0")
  assert.equal(chunks.flat()[1099], "id-1099")

  const overduePastCap = task({
    id: "id-1099",
    status: "asignada",
    dueDate: PAST_DUE,
  })
  const loaded = selectByRequestedIds(
    [overduePastCap],
    COMPANY,
    chunks.flat()
  )
  assert.equal(loaded[0]?.id, "id-1099")
  assert.equal(shouldAutoTransitionToVencida(loaded[0]), true)
})
