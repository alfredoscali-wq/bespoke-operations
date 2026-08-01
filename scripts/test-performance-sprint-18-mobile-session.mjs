import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  MOBILE_SESSION_GC_TIME_MS,
  MOBILE_SESSION_STALE_TIME_MS,
  clearMobileAgendaTaskCache,
  clearMobileSessionStore,
  getCachedAgendaTasks,
  getMobileAgendaTaskCacheSize,
  getMobileSessionSnapshot,
  isMobileSessionFresh,
  setCachedAgendaTasks,
  setMobileSessionSnapshot,
} from "../lib/mobile/session/index.ts"
import {
  MOBILE_AGENDA_TASK_OMITTED_COLUMNS,
  MOBILE_AGENDA_TASK_SELECT,
} from "../lib/mobile/v1/agenda/agenda-task-select.ts"

function sampleSnapshot(fetchedAt = Date.now()) {
  return {
    fetchedAt,
    company: { id: "co-1" },
    employee: {
      id: "emp-1",
      firstName: "Ana",
      lastName: "Perez",
      jobTitle: "Operario",
      department: "Campo",
      systemRole: "operario",
    },
    crews: [{ id: "crew-1", name: "Cuadrilla A" }],
    jornada: {
      date: "2026-07-31",
      crewId: "crew-1",
      crewName: "Cuadrilla A",
      crewStatus: /** @type {const} */ ("resolved"),
      assignedCrewNames: ["Cuadrilla A"],
    },
    dayTasks: [{ id: "t1", status: "asignada", dueDate: "2026-07-31" }],
    permissions: {
      systemRole: "operario",
      systemAccess: true,
      modules: ["operario"],
    },
  }
}

test("Sprint 18: session store reuses snapshot while fresh", () => {
  clearMobileSessionStore()
  const snapshot = sampleSnapshot()
  setMobileSessionSnapshot(snapshot)

  assert.equal(getMobileSessionSnapshot()?.employee?.id, "emp-1")
  assert.equal(isMobileSessionFresh(), true)
  assert.equal(getMobileSessionSnapshot()?.crews.length, 1)
  assert.equal(getMobileSessionSnapshot()?.dayTasks[0]?.id, "t1")
  assert.ok(MOBILE_SESSION_STALE_TIME_MS > 0)
  assert.ok(MOBILE_SESSION_GC_TIME_MS >= MOBILE_SESSION_STALE_TIME_MS)
})

test("Sprint 18: logout clears session store (cache invalidation)", () => {
  clearMobileSessionStore()
  setMobileSessionSnapshot(sampleSnapshot())
  assert.ok(getMobileSessionSnapshot())

  clearMobileSessionStore()
  assert.equal(getMobileSessionSnapshot(), null)
  assert.equal(isMobileSessionFresh(), false)
})

test("Sprint 18: agenda task cache avoids duplicate fetch while fresh", () => {
  clearMobileAgendaTaskCache()
  const tasks = /** @type {any[]} */ ([{ id: "t1" }, { id: "t2" }])
  setCachedAgendaTasks("co-1", "crew-1", "2026-07-31", tasks)

  assert.equal(getMobileAgendaTaskCacheSize(), 1)
  const hit = getCachedAgendaTasks("co-1", "crew-1", "2026-07-31")
  assert.ok(hit)
  assert.equal(hit.length, 2)
  assert.equal(hit[0].id, "t1")

  // Same key → same reference reuse (no second network download)
  const hitAgain = getCachedAgendaTasks("co-1", "crew-1", "2026-07-31")
  assert.equal(hitAgain, hit)

  clearMobileAgendaTaskCache()
  assert.equal(getCachedAgendaTasks("co-1", "crew-1", "2026-07-31"), null)
  assert.equal(getMobileAgendaTaskCacheSize(), 0)
})

test("Sprint 18: agenda cache misses after staleTime", () => {
  clearMobileAgendaTaskCache()
  const now = Date.now()
  setCachedAgendaTasks(
    "co-1",
    "crew-1",
    "2026-07-31",
    /** @type {any[]} */ ([{ id: "t1" }]),
    now
  )

  const staleAt = now + MOBILE_SESSION_STALE_TIME_MS + 1
  assert.equal(
    getCachedAgendaTasks("co-1", "crew-1", "2026-07-31", staleAt),
    null
  )
})

test("Sprint 18: lean agenda select omits unused heavy columns", () => {
  assert.equal(MOBILE_AGENDA_TASK_SELECT.includes("*"), false)
  assert.ok(MOBILE_AGENDA_TASK_SELECT.includes("id"))
  assert.ok(MOBILE_AGENDA_TASK_SELECT.includes("crew_id"))
  assert.ok(MOBILE_AGENDA_TASK_SELECT.includes("task_metadata"))

  for (const column of MOBILE_AGENDA_TASK_OMITTED_COLUMNS) {
    assert.equal(
      MOBILE_AGENDA_TASK_SELECT.includes(column),
      false,
      `lean select should omit ${column}`
    )
  }

  const agendaQueries = readFileSync(
    join(process.cwd(), "lib/mobile/v1/agenda/agenda-queries.ts"),
    "utf8"
  )
  assert.equal(agendaQueries.includes('.select("*")'), false)
  assert.ok(agendaQueries.includes("MOBILE_AGENDA_TASK_SELECT"))
  assert.ok(agendaQueries.includes("getCachedAgendaTasks"))
})

test("Sprint 18: operario shell no longer mounts Evidence/Employees/Crews providers", () => {
  const shell = readFileSync(
    join(process.cwd(), "components/operario/operario-shell.tsx"),
    "utf8"
  )
  assert.equal(shell.includes("EvidenceProvider"), false)
  assert.equal(shell.includes("EmployeesProvider"), false)
  assert.equal(shell.includes("CrewsProvider"), false)
  assert.ok(shell.includes("OperarioSessionProvider"))
  assert.ok(shell.includes("TasksProvider"))
})

test("Sprint 18: signOut clears mobile session caches", () => {
  const auth = readFileSync(
    join(process.cwd(), "components/auth/auth-provider.tsx"),
    "utf8"
  )
  assert.ok(auth.includes("clearMobileSessionStore"))
  assert.ok(auth.includes("clearMobileAgendaTaskCache"))
})
