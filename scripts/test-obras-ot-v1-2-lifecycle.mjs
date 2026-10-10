/**
 * OTs de Obra V1.2 — ciclo de vida de Obra, due_date opcional y despacho.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { mapCreatePayloadToInsert } from "../lib/supabase/tasks.mapper.ts"
import { getProjectActions } from "../lib/projects/utils.ts"
import {
  shouldAutoActivateProjectByStartDate,
} from "../lib/projects/project-auto-activate.ts"
import { activateDuePlannedProjects } from "../lib/supabase/projects.queries.ts"
import {
  buildFinalizeBlockedOpenTasksMessage,
  validateFinalizeProject,
} from "../lib/projects/project-finalize.ts"
import { PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE } from "../lib/operations/user-messages.ts"
import { resolveProjectTaskCreateStatus } from "../lib/projects/project-start-dispatch.ts"
import { validateObraTaskInsertIntegrity } from "../lib/projects/obra-task-insert-integrity.ts"
import { canReleaseProjectTaskToField } from "../lib/projects/project-task-field-release.ts"
import { isPendingProjectDesignOtProposalStatus } from "../lib/projects/design/ot-proposals.ts"

const root = process.cwd()

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8")
}

const LIFECYCLE_SQL = read(
  "supabase/migrations/20261224000600_obras_ot_v1_2_lifecycle.sql"
)
const FINALIZE_SERVER = read("lib/projects/finalize-project.server.ts")
const FINALIZE_API = read("app/api/projects/[projectId]/finalize/route.ts")
const TASKS_TAB = read("components/obras/project-tabs/tasks-tab.tsx")
const WORKSPACE = read("components/obras/design/project-design-workspace.tsx")
const DETAIL_VIEW = read("components/obras/project-detail-view.tsx")
const UTILS = read("lib/projects/utils.ts")
const PROJECTS_QUERIES = read("lib/supabase/projects.queries.ts")
const CRON_ROUTE = read("app/api/cron/activate-projects/route.ts")
const VERCEL = read("vercel.json")
const PROPOSAL_DIALOG = read(
  "components/obras/project-design-ot-proposal-dialog.tsx"
)

const PROJECT_A = "project-a"

test("30. no existe botón Iniciar Obra en planned", () => {
  const planned = getProjectActions("planned").map((action) => action.id)
  assert.equal(planned.includes("start"), false)
  assert.doesNotMatch(UTILS, /Iniciar obra/)
  assert.doesNotMatch(DETAIL_VIEW, /startProject/)
  assert.match(DETAIL_VIEW, /case "start":/)
})

test("31. Obra se activa al llegar la fecha de inicio", () => {
  assert.equal(
    shouldAutoActivateProjectByStartDate(
      { status: "planned", startDate: "2026-09-15" },
      "2026-09-15"
    ),
    true
  )
  assert.equal(
    shouldAutoActivateProjectByStartDate(
      { status: "planned", startDate: "2026-09-16" },
      "2026-09-15"
    ),
    false
  )
  assert.match(PROJECTS_QUERIES, /activateDuePlannedProjects/)
  assert.match(CRON_ROUTE, /activateDuePlannedProjects/)
  assert.match(CRON_ROUTE, /\.from\("companies"\)/)
  assert.match(CRON_ROUTE, /companyId: company\.id/)
  assert.match(PROJECTS_QUERIES, /\.eq\("company_id", companyId\)/)
  assert.match(VERCEL, /\/api\/cron\/activate-projects/)
  assert.doesNotMatch(CRON_ROUTE, /start_project_operational_dispatch/)
  assert.doesNotMatch(
    CRON_ROUTE,
    /activateDuePlannedProjects\(admin,\s*\{\s*today:/
  )
})

const COMPANY_A = "company-a"
const COMPANY_B = "company-b"
const TODAY = "2026-09-15"

function projectRow(partial) {
  return {
    id: partial.id,
    company_id: partial.company_id,
    code: partial.id,
    name: partial.id,
    client: "Cliente",
    type: "fiber",
    status: partial.status,
    progress: 0,
    start_date: partial.start_date ?? null,
    end_date: null,
    supervisor: "Supervisor",
    location: "Ubicación",
    latitude: null,
    longitude: null,
    description: "",
    pause_reason: null,
    pause_notes: null,
    paused_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  }
}

function createActivationClient(rows) {
  const projects = rows.map((row) => ({ ...row }))
  const history = []
  const selectFilters = []
  const updatedIds = []

  function matches(row, filters) {
    return filters.every((filter) => {
      if (filter.kind === "eq") return row[filter.column] === filter.value
      if (filter.kind === "is") return row[filter.column] === filter.value
      if (filter.kind === "lte") {
        return row[filter.column] != null && row[filter.column] <= filter.value
      }
      if (filter.kind === "not") return row[filter.column] != null
      return false
    })
  }

  function from(table) {
    const state = { table, op: "select", payload: null, filters: [] }
    const api = {
      select() {
        return api
      },
      insert(payload) {
        state.op = "insert"
        state.payload = payload
        return api
      },
      update(payload) {
        state.op = "update"
        state.payload = payload
        return api
      },
      eq(column, value) {
        state.filters.push({ kind: "eq", column, value })
        return api
      },
      is(column, value) {
        state.filters.push({ kind: "is", column, value })
        return api
      },
      not(column, operator, value) {
        state.filters.push({ kind: "not", column, operator, value })
        return api
      },
      lte(column, value) {
        state.filters.push({ kind: "lte", column, value })
        return api
      },
      order() {
        return api
      },
      maybeSingle() {
        return Promise.resolve(execute(true))
      },
      single() {
        return Promise.resolve(execute(true))
      },
      then(resolve, reject) {
        return Promise.resolve(execute(false)).then(resolve, reject)
      },
    }

    function execute(single) {
      if (state.table === "projects" && state.op === "select") {
        selectFilters.push(state.filters.map((filter) => ({ ...filter })))
        const data = projects.filter((row) => matches(row, state.filters))
        return { data: single ? (data[0] ?? null) : data, error: null }
      }

      if (state.table === "projects" && state.op === "update") {
        const found = projects.filter((row) => matches(row, state.filters))
        const row = found[0]
        if (!row) return { data: null, error: null }
        Object.assign(row, state.payload)
        updatedIds.push(row.id)
        return { data: { ...row }, error: null }
      }

      if (state.table === "project_history" && state.op === "insert") {
        const inserted = { id: `hist-${history.length + 1}`, ...state.payload }
        history.push(inserted)
        return { data: inserted, error: null }
      }

      return { data: single ? null : [], error: null }
    }

    return api
  }

  return {
    client: { from },
    projects,
    history,
    selectFilters,
    updatedIds,
  }
}

function activationFixture() {
  return createActivationClient([
    projectRow({
      id: "a-due",
      company_id: COMPANY_A,
      status: "planned",
      start_date: "2026-09-15",
    }),
    projectRow({
      id: "a-future",
      company_id: COMPANY_A,
      status: "planned",
      start_date: "2026-09-16",
    }),
    projectRow({
      id: "a-active",
      company_id: COMPANY_A,
      status: "active",
      start_date: "2026-09-01",
    }),
    projectRow({
      id: "b-due",
      company_id: COMPANY_B,
      status: "planned",
      start_date: "2026-09-01",
    }),
  ])
}

test("cron activa solo la empresa pedida y conserva fecha e historial", async () => {
  const store = activationFixture()
  const activated = await activateDuePlannedProjects(store.client, {
    companyId: COMPANY_A,
    today: TODAY,
  })

  assert.equal(activated, 1)
  assert.equal(store.projects.find((row) => row.id === "a-due").status, "active")
  assert.equal(
    store.projects.find((row) => row.id === "a-future").status,
    "planned"
  )
  assert.equal(
    store.projects.find((row) => row.id === "a-active").status,
    "active"
  )
  assert.equal(store.projects.find((row) => row.id === "b-due").status, "planned")
  assert.deepEqual(store.updatedIds, ["a-due"])
  assert.equal(store.selectFilters.length, 1)
  assert.equal(
    store.selectFilters[0].some(
      (filter) => filter.kind === "eq" && filter.column === "company_id" && filter.value === COMPANY_A
    ),
    true
  )
  assert.equal(
    store.selectFilters[0].some(
      (filter) => filter.column === "company_id" && filter.value === COMPANY_B
    ),
    false
  )
  assert.equal(store.history.length, 1)
  assert.equal(store.history[0].company_id, COMPANY_A)
  assert.equal(store.history[0].project_id, "a-due")
  assert.equal(
    shouldAutoActivateProjectByStartDate(
      { status: "planned", startDate: "2026-09-16" },
      TODAY
    ),
    false
  )
})

test("32. OT programada puede existir mientras Obra está planned", () => {
  assert.equal(resolveProjectTaskCreateStatus("planned"), "programada")
  const result = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: PROJECT_A,
      crewId: "c1",
      status: "programada",
    },
    project: {
      id: PROJECT_A,
      companyId: "co",
      status: "planned",
      deletedAt: null,
    },
    crew: { id: "c1", companyId: "co", deletedAt: null },
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "programada")
  assert.match(LIFECYCLE_SQL, /'planned'::public\.project_status/)
  assert.match(LIFECYCLE_SQL, /NEW\.status := 'programada'::public\.task_status/)
})

test("33. Finalizar Obra aparece para Obra activa", () => {
  assert.equal(
    getProjectActions("active").some((action) => action.id === "finalize"),
    true
  )
  assert.equal(
    getProjectActions("planned").some((action) => action.id === "finalize"),
    false
  )
})

test("34-39. Finalizar bloquea OTs no terminales y permite terminales", () => {
  const base = { projectStatus: "active", projectId: PROJECT_A }

  for (const status of ["programada", "asignada", "en-curso", "borrador"]) {
    const result = validateFinalizeProject({
      ...base,
      tasks: [{ id: "t1", status, projectId: PROJECT_A }],
    })
    assert.equal(result.ok, false, status)
  }

  const terminal = validateFinalizeProject({
    ...base,
    tasks: [
      { id: "t1", status: "finalizada", projectId: PROJECT_A },
      { id: "t2", status: "cancelada", projectId: PROJECT_A },
    ],
  })
  assert.equal(terminal.ok, true)
})

test("40. preliminares no bloquean finalización", () => {
  assert.equal(isPendingProjectDesignOtProposalStatus("draft"), true)
  assert.equal(isPendingProjectDesignOtProposalStatus("ready"), true)
  const result = validateFinalizeProject({
    projectStatus: "active",
    projectId: PROJECT_A,
    tasks: [],
  })
  assert.equal(result.ok, true)
})

test("41-42. validación de finalización existe server-side y no se bypassa", () => {
  assert.match(LIFECYCLE_SQL, /CREATE OR REPLACE FUNCTION public\.finalize_project_operational/)
  assert.match(LIFECYCLE_SQL, /p\.company_id = p_company_id/)
  assert.match(LIFECYCLE_SQL, /t\.project_id = p_project_id/)
  assert.match(LIFECYCLE_SQL, /'programada'::public\.task_status/)
  assert.match(LIFECYCLE_SQL, /'asignada'::public\.task_status/)
  assert.match(LIFECYCLE_SQL, /'en-curso'::public\.task_status/)
  assert.match(LIFECYCLE_SQL, /'borrador'::public\.task_status/)
  assert.match(
    LIFECYCLE_SQL,
    /No se puede finalizar la Obra porque todavía hay OTs pendientes de ejecución/
  )
  assert.match(LIFECYCLE_SQL, /Hay %s OTs pendientes de ejecución/)
  assert.match(FINALIZE_API, /finalizeProjectOperational/)
  assert.match(FINALIZE_SERVER, /finalize_project_operational/)
  assert.doesNotMatch(FINALIZE_SERVER, /from\("projects"\)[\s\S]*status: "closed"/)
})

test("due_date opcional en mapper y migración", () => {
  assert.match(LIFECYCLE_SQL, /ALTER COLUMN due_date DROP NOT NULL/)
  assert.match(LIFECYCLE_SQL, /due_date IS NULL/)
  const mapped = mapCreatePayloadToInsert({
    companyId: "co",
    code: "TSK-1",
    title: "Instalación NAP 1",
    description: "",
    projectId: PROJECT_A,
    projectCode: "OBR-1",
    projectName: "Obra",
    type: "fiber",
    status: "programada",
    priority: "media",
    supervisor: "Ana",
    crewId: "c1",
    crew: "Cuadrilla A",
    startDate: "2026-09-15",
    dueDate: "",
    estimatedDuration: "",
    observationsForCrew: "",
    checklist: [],
  })
  assert.equal(mapped.due_date, null)
})

test("Generar OTs preliminares vive en Obra → OTs, no en Diseño", () => {
  assert.match(TASKS_TAB, /Generar OTs preliminares/)
  assert.match(TASKS_TAB, /ProjectDesignGenerateOtDialog/)
  assert.doesNotMatch(WORKSPACE, /Generar OTs preliminares/)
  assert.doesNotMatch(WORKSPACE, /ProjectDesignGenerateOtDialog/)
})

test("checklist individual de preliminar no usa el catálogo global", () => {
  assert.match(PROPOSAL_DIALOG, /ProjectTaskChecklistEditor/)
  assert.doesNotMatch(PROPOSAL_DIALOG, /work-order-type-checklist/)
  assert.match(
    LIFECYCLE_SQL,
    /operational_checklist_template jsonb NOT NULL DEFAULT '\[\]'::jsonb/
  )
})

test("Enviar a Cuadrilla permanece disponible con Obra planned", () => {
  assert.equal(
    canReleaseProjectTaskToField({
      projectId: PROJECT_A,
      status: "programada",
      crewId: "c1",
      crew: "Cuadrilla A",
    }),
    true
  )
})

test("mensaje de bloqueo combina texto base y cantidad", () => {
  assert.equal(
    PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE,
    "No se puede finalizar la Obra porque todavía hay OTs pendientes de ejecución."
  )
  assert.equal(
    buildFinalizeBlockedOpenTasksMessage(3),
    `${PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE} Hay 3 OTs pendientes de ejecución.`
  )
})
