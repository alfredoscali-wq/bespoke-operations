/**
 * Obra → Órdenes de trabajo: list by project_id, not fetchTasks() / global 1000.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  matchesProjectWorkOrderListQuery,
  selectProjectWorkOrderListRows,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const CORTADEROS_ID = "35e36f76-7dcc-4d8a-b8d2-284692149401"
const SAINT_GEORGE_ID = "323110cd-7a6b-4c90-8218-8773f130df9a"
const COMPANY_ID = "00000000-0000-4000-8000-000000000002"

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "programada",
    projectId: overrides.projectId ?? null,
    companyId: overrides.companyId ?? COMPANY_ID,
    deletedAt: overrides.deletedAt ?? null,
    dueDate: overrides.dueDate ?? "2026-09-18",
  }
}

test("project query matches company + project and excludes deleted", () => {
  const live = row({
    code: "TSK-FOCORT2026-090",
    projectId: CORTADEROS_ID,
    status: "borrador",
  })
  const otherProject = row({
    code: "TSK-FOSGABNET-002",
    projectId: SAINT_GEORGE_ID,
  })
  const otherCompany = row({
    code: "TSK-FOCORT2026-090",
    projectId: CORTADEROS_ID,
    companyId: "other",
  })
  const deleted = row({
    code: "TSK-FOCORT2026-089",
    projectId: CORTADEROS_ID,
    deletedAt: "2026-09-19T00:00:00Z",
  })

  assert.equal(
    matchesProjectWorkOrderListQuery(live, COMPANY_ID, CORTADEROS_ID),
    true
  )
  assert.equal(
    matchesProjectWorkOrderListQuery(otherProject, COMPANY_ID, CORTADEROS_ID),
    false
  )
  assert.equal(
    matchesProjectWorkOrderListQuery(otherCompany, COMPANY_ID, CORTADEROS_ID),
    false
  )
  assert.equal(
    matchesProjectWorkOrderListQuery(deleted, COMPANY_ID, CORTADEROS_ID),
    false
  )
})

test("Cortaderos and Saint George OTs survive company-wide max_rows=1000", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      status: "finalizada",
      projectId: null,
      dueDate: "2026-01-01",
    })
  )
  const cortaderos = [
    row({
      id: "b2b48705-83e8-418c-93a0-a198d8112093",
      code: "TSK-FOCORT2026-089",
      status: "borrador",
      projectId: CORTADEROS_ID,
      dueDate: null,
    }),
    row({
      id: "0b919efb-eb4d-4903-853c-6b8500876c22",
      code: "TSK-FOCORT2026-090",
      status: "borrador",
      projectId: CORTADEROS_ID,
      dueDate: "2026-09-18",
    }),
    row({
      id: "8b2703ef-0da2-4191-9b20-ce3970e53990",
      code: "TSK-FOCORT2026-091",
      status: "programada",
      projectId: CORTADEROS_ID,
      dueDate: null,
    }),
  ]
  const saintGeorge = row({
    id: "775fa2e0-4267-4618-aaff-789f8b103ed1",
    code: "TSK-FOSGABNET-002",
    status: "programada",
    projectId: SAINT_GEORGE_ID,
    dueDate: "2026-09-21",
  })
  const all = [...historical, ...cortaderos, saintGeorge]

  const unfilteredCap = [...all]
    .sort((left, right) => {
      const leftDue = left.dueDate || "9999-99-99"
      const rightDue = right.dueDate || "9999-99-99"
      return leftDue.localeCompare(rightDue)
    })
    .slice(0, 1000)
  const unfilteredCodes = new Set(unfilteredCap.map((task) => task.code))
  assert.equal(unfilteredCodes.has("TSK-FOCORT2026-089"), false)
  assert.equal(unfilteredCodes.has("TSK-FOCORT2026-090"), false)
  assert.equal(unfilteredCodes.has("TSK-FOCORT2026-091"), false)
  assert.equal(unfilteredCodes.has("TSK-FOSGABNET-002"), false)

  const cortaderosRows = selectProjectWorkOrderListRows(
    all,
    COMPANY_ID,
    CORTADEROS_ID
  )
  assert.deepEqual(
    cortaderosRows.map((task) => task.code).sort(),
    ["TSK-FOCORT2026-089", "TSK-FOCORT2026-090", "TSK-FOCORT2026-091"]
  )

  const saintGeorgeRows = selectProjectWorkOrderListRows(
    all,
    COMPANY_ID,
    SAINT_GEORGE_ID
  )
  assert.deepEqual(
    saintGeorgeRows.map((task) => task.code),
    ["TSK-FOSGABNET-002"]
  )
})

test("project query pages past 1000 OTs of the same project", () => {
  const many = Array.from({ length: 1005 }, (_, index) =>
    row({
      id: `p-${index}`,
      code: `TSK-P-${String(index).padStart(4, "0")}`,
      projectId: CORTADEROS_ID,
      dueDate: "2026-09-01",
    })
  )
  const selected = selectProjectWorkOrderListRows(
    many,
    COMPANY_ID,
    CORTADEROS_ID,
    1000
  )
  assert.equal(selected.length, 1005)
})

test("fetchProjectWorkOrderListTasks is scoped and does not call fetchTasks", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.equal(fetchTasksBlock.includes('.eq("project_id"'), false)
  assert.match(fetchTasksBlock, /\.order\("due_date", \{ ascending: true \}\)/)
  assert.equal(fetchTasksBlock.includes(".range("), false)

  const start = queries.indexOf(
    "export async function fetchProjectWorkOrderListTasks("
  )
  const end = queries.indexOf("export type DashboardWorkOrderListData")
  assert.ok(start > 0)
  assert.ok(end > start)
  const block = queries.slice(start, end)
  assert.equal(block.includes("fetchTasks("), false)
  assert.match(block, /\.eq\("company_id", companyId\)/)
  assert.match(block, /\.eq\("project_id", projectId\)/)
  assert.match(block, /\.is\("deleted_at", null\)/)
  assert.match(block, /\.range\(/)
  assert.match(block, /PROJECT_WORK_ORDER_LIST_PAGE_SIZE/)
  assert.equal(block.includes('.in("status"'), false)
})

test("ProjectTasksTab loads by project_id instead of fetchTasks/provider scope all", () => {
  const tab = read("components/obras/project-tabs/tasks-tab.tsx")
  assert.match(tab, /listProjectWorkOrderTasks\(companyId, project\.id\)/)
  assert.doesNotMatch(tab, /getTasksForProject\(/)
  assert.doesNotMatch(tab, /refreshTasksFromServer/)
  assert.doesNotMatch(tab, /fetchTasks\(/)
  assert.doesNotMatch(tab, /listTasks\(/)
  assert.doesNotMatch(tab, /listScope/)
  assert.match(tab, /async function handleCreateTendidoOt/)
  const tendidoBlock = tab.slice(
    tab.indexOf("async function handleCreateTendidoOt"),
    tab.indexOf("function openCreateDialog")
  )
  assert.match(tendidoBlock, /loadProjectTasks\(\{ silent: true \}\)/)
  assert.doesNotMatch(tendidoBlock, /refreshTasksFromServer/)

  const browser = read("lib/supabase/tasks.browser.ts")
  assert.match(browser, /export async function listProjectWorkOrderTasks/)
  assert.match(browser, /fetchProjectWorkOrderListTasks/)

  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  assert.doesNotMatch(load, /listProjectWorkOrderTasks/)
  assert.match(load, /listTasks\(/)
})
