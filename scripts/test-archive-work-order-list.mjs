import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE,
  ARCHIVE_WORK_ORDER_SEARCH_COLUMNS,
  buildArchivedWorkOrderSearchOrFilter,
  formatArchivedWorkOrderRangeLabel,
  paginateArchivedWorkOrderListRows,
  paginateArchivedWorkOrderListRowsByPriority,
  resolveArchivedWorkOrderListRange,
  resolveArchivedWorkOrderPriorityBucketSlices,
  resolveArchivedWorkOrderPrioritySequence,
} from "../lib/tasks/archived-work-order-list.ts"
import {
  filterArchivedWorkOrders,
  matchesActiveWorkOrderListQuery,
  matchesArchivedWorkOrderListQuery,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "finalizada",
    priority: overrides.priority ?? "media",
    projectId: overrides.projectId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    dueDate: overrides.dueDate ?? "2026-01-01",
  }
}

test("A. finalizada sin proyecto aparece en Archivo", () => {
  const task = row({ status: "finalizada", code: "TSK-FIN-1" })
  assert.equal(matchesArchivedWorkOrderListQuery(task), true)
  assert.deepEqual(filterArchivedWorkOrders([task]).map((item) => item.code), [
    "TSK-FIN-1",
  ])
})

test("A. finalizada con proyecto NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(
      row({ status: "finalizada", projectId: "project-1" })
    ),
    false
  )
})

test("A. cancelada NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "cancelada" })),
    false
  )
})

test("A. pendiente-cierre NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "pendiente-cierre" })),
    false
  )
})

test("A. programada NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "programada" })),
    false
  )
})

test("A. asignada NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "asignada" })),
    false
  )
})

test("A. en-curso NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "en-curso" })),
    false
  )
})

test("A. vencida NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(row({ status: "vencida" })),
    false
  )
})

test("A. soft-deleted NO aparece", () => {
  assert.equal(
    matchesArchivedWorkOrderListQuery(
      row({ status: "finalizada", deletedAt: "2026-09-16T20:00:00Z" })
    ),
    false
  )
})

test("B. query de Archivo filtra status, project_id, deleted_at y company_id", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const archiveBlock = queries.slice(
    queries.indexOf("export async function fetchArchivedWorkOrderListTasks("),
    queries.indexOf("function quotePostgrestFilterValue(")
  )

  assert.match(archiveBlock, /\.eq\("status", ARCHIVE_WORK_ORDER_LIST_STATUS\)/)
  assert.match(archiveBlock, /\.is\("project_id", null\)/)
  assert.match(archiveBlock, /\.is\("deleted_at", null\)/)
  assert.match(archiveBlock, /\.eq\("company_id", companyId\)/)
  assert.match(archiveBlock, /\.select\("\*", \{ count: "exact" \}\)/)
  assert.match(archiveBlock, /\.range\(range\.from, range\.to\)/)
  assert.equal(archiveBlock.includes('.in("status"'), false)
})

test("C. page 1 devuelve como máximo 50", () => {
  const rows = Array.from({ length: 80 }, (_, index) =>
    row({
      id: `fin-${index}`,
      code: `TSK-FIN-${String(index).padStart(4, "0")}`,
      dueDate: "2026-01-01",
    })
  )
  const page1 = paginateArchivedWorkOrderListRows(rows, 1, 50)
  assert.equal(page1.items.length, 50)
  assert.ok(page1.items.length <= ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE)
  assert.equal(page1.total, 80)
  assert.equal(page1.pageSize, 50)
})

test("C. page 2 solicita el offset correcto", () => {
  const range = resolveArchivedWorkOrderListRange(2, 50)
  assert.equal(range.from, 50)
  assert.equal(range.to, 99)
  assert.equal(range.pageSize, 50)

  const rows = Array.from({ length: 120 }, (_, index) =>
    row({
      id: `fin-${index}`,
      code: `TSK-FIN-${String(index).padStart(4, "0")}`,
      dueDate: "2026-01-01",
    })
  )
  const page2 = paginateArchivedWorkOrderListRows(rows, 2, 50)
  assert.equal(page2.items[0].code, "TSK-FIN-0050")
  assert.equal(page2.items.length, 50)
})

test("C. total count se obtiene del universo filtrado", () => {
  const rows = [
    ...Array.from({ length: 791 }, (_, index) =>
      row({
        id: `fin-${index}`,
        code: `TSK-FIN-${String(index).padStart(4, "0")}`,
      })
    ),
    row({ status: "cancelada", code: "TSK-CAN" }),
    row({ status: "finalizada", projectId: "obra-1", code: "TSK-OBRA" }),
  ]
  const page = paginateArchivedWorkOrderListRows(rows, 1, 50)
  assert.equal(page.total, 791)
  assert.equal(page.items.length, 50)
  assert.equal(
    formatArchivedWorkOrderRangeLabel(1, 50, page.total),
    "Mostrando 1–50 de 791"
  )
})

test("C. más de 1000 finalizadas se recorren por páginas de 50", () => {
  const rows = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `fin-${index}`,
      code: `TSK-FIN-${String(index).padStart(4, "0")}`,
      dueDate: "2026-01-01",
    })
  )

  const totalPages = Math.ceil(rows.length / ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE)
  assert.equal(totalPages, 22)

  const seen = new Set()
  for (let page = 1; page <= totalPages; page += 1) {
    const result = paginateArchivedWorkOrderListRows(rows, page, 50)
    assert.ok(result.items.length <= 50)
    assert.ok(result.items.length <= 1000)
    const range = resolveArchivedWorkOrderListRange(page, 50)
    assert.ok(range.to - range.from + 1 <= 50)
    for (const item of result.items) {
      assert.equal(seen.has(item.code), false)
      seen.add(item.code)
    }
  }

  assert.equal(seen.size, 1100)
  assert.equal(seen.has("TSK-FIN-1000"), true)
  assert.equal(seen.has("TSK-FIN-1099"), true)

  const pageAfterCap = paginateArchivedWorkOrderListRows(rows, 21, 50)
  assert.equal(pageAfterCap.items[0].code, "TSK-FIN-1000")
  assert.equal(resolveArchivedWorkOrderListRange(21, 50).from, 1000)
})

test("C. pageSize nunca supera 50 aunque se pida más", () => {
  const range = resolveArchivedWorkOrderListRange(1, 5000)
  assert.equal(range.pageSize, 50)
  assert.equal(range.to - range.from + 1, 50)
})

test("prioridad: ranking alta > media > baja, no lexicográfico", () => {
  assert.deepEqual(resolveArchivedWorkOrderPrioritySequence("desc"), [
    "alta",
    "media",
    "baja",
  ])
  assert.deepEqual(resolveArchivedWorkOrderPrioritySequence("asc"), [
    "baja",
    "media",
    "alta",
  ])

  const rows = [
    row({ code: "TSK-B", priority: "baja" }),
    row({ code: "TSK-A", priority: "alta" }),
    row({ code: "TSK-M", priority: "media" }),
  ]
  const desc = paginateArchivedWorkOrderListRowsByPriority(rows, 1, 50, "desc")
  assert.deepEqual(
    desc.items.map((item) => item.priority),
    ["alta", "media", "baja"]
  )
  const asc = paginateArchivedWorkOrderListRowsByPriority(rows, 1, 50, "asc")
  assert.deepEqual(
    asc.items.map((item) => item.priority),
    ["baja", "media", "alta"]
  )
})

test("prioridad: paginación por buckets sin pedir más de 50 filas", () => {
  const counts = { alta: 60, media: 60, baja: 60 }
  const page1 = resolveArchivedWorkOrderPriorityBucketSlices(1, 50, counts, "desc")
  assert.deepEqual(page1, [{ priority: "alta", from: 0, to: 49 }])
  assert.equal(page1.reduce((sum, slice) => sum + (slice.to - slice.from + 1), 0), 50)

  const page2 = resolveArchivedWorkOrderPriorityBucketSlices(2, 50, counts, "desc")
  assert.deepEqual(page2, [
    { priority: "alta", from: 50, to: 59 },
    { priority: "media", from: 0, to: 39 },
  ])
  assert.equal(page2.reduce((sum, slice) => sum + (slice.to - slice.from + 1), 0), 50)

  const mixed = [
    ...Array.from({ length: 60 }, (_, index) =>
      row({
        id: `alta-${index}`,
        code: `A-${String(index).padStart(3, "0")}`,
        priority: "alta",
      })
    ),
    ...Array.from({ length: 60 }, (_, index) =>
      row({
        id: `media-${index}`,
        code: `M-${String(index).padStart(3, "0")}`,
        priority: "media",
      })
    ),
  ]
  const page2Rows = paginateArchivedWorkOrderListRowsByPriority(
    mixed,
    2,
    50,
    "desc"
  )
  assert.equal(page2Rows.items.length, 50)
  assert.equal(page2Rows.items.filter((item) => item.priority === "alta").length, 10)
  assert.equal(page2Rows.items.filter((item) => item.priority === "media").length, 40)
  assert.equal(page2Rows.items[0].priority, "alta")
  assert.equal(page2Rows.items[10].priority, "media")

  const queries = read("lib/supabase/tasks.queries.ts")
  const archiveBlock = queries.slice(
    queries.indexOf("export async function fetchArchivedWorkOrderListTasks("),
    queries.indexOf("function quotePostgrestFilterValue(")
  )
  assert.match(archiveBlock, /fetchArchivedWorkOrderListTasksByPriorityRank/)
  assert.match(archiveBlock, /resolveArchivedWorkOrderPriorityBucketSlices/)
  assert.equal(archiveBlock.includes('.order("priority"'), false)
})

test("B. búsqueda de Archivo se arma en Supabase, no en el cliente", () => {
  const filter = buildArchivedWorkOrderSearchOrFilter("TSK-OT-100")
  assert.ok(filter)
  for (const column of ARCHIVE_WORK_ORDER_SEARCH_COLUMNS) {
    assert.match(filter, new RegExp(`${column}\\.ilike\\.`))
  }

  const moduleSource = read("components/tareas/tasks-module.tsx")
  assert.doesNotMatch(moduleSource, /filterArchivedWorkOrders/)
  assert.match(moduleSource, /archiveList\?\.setFilters/)
  assert.match(moduleSource, /if \(isArchiveView\) \{\s*return scopedTasks/)
})

test("D. activeWorkOrders sigue funcionando y fetchTasks no se modificó", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  const fetchTasksBlock = queries.slice(
    queries.indexOf("export async function fetchTasks("),
    queries.indexOf("export async function fetchActiveWorkOrderListTasks(")
  )
  assert.equal(fetchTasksBlock.includes('.in("status"'), false)
  assert.equal(fetchTasksBlock.includes('.is("project_id", null)'), false)
  assert.equal(fetchTasksBlock.includes('.eq("status"'), false)
  assert.match(fetchTasksBlock, /\.eq\("company_id", companyId\)/)
  assert.match(fetchTasksBlock, /\.is\("deleted_at", null\)/)

  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "programada" })),
    true
  )
  assert.equal(
    matchesActiveWorkOrderListQuery(row({ status: "finalizada" })),
    false
  )

  const tareasLayout = read("app/(dashboard)/tareas/layout.tsx")
  assert.match(tareasLayout, /listScope="activeWorkOrders"/)

  const archivoLayout = read("app/(dashboard)/operations/archivo-ot/layout.tsx")
  assert.match(archivoLayout, /listScope="archiveWorkOrders"/)
  assert.equal(archivoLayout.includes("activeWorkOrders"), false)

  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  assert.match(load, /listActiveWorkOrderTasks/)
  assert.match(load, /listArchivedWorkOrderTasks/)
  assert.match(load, /listTasks\(/)

  const moduleSource = read("components/tareas/tasks-module.tsx")
  assert.doesNotMatch(moduleSource, /ARCHIVE_OT_STATUS_FILTER_OPTIONS/)
  assert.doesNotMatch(moduleSource, /setArchiveStatusFilter/)
  assert.match(moduleSource, /Historial operativo de OT finalizadas/)
})
