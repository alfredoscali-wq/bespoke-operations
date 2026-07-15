/**
 * Smoke checks for SPRINT CONTROL OPERATIVO 1.0 (source contracts).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  existsSync(
    resolve(
      root,
      "supabase/migrations/20261016000100_control_operativo_motivos_historial.sql"
    )
  ),
  "migration exists"
)

const overdue = read("lib/tasks/operational-overdue.ts")
assert(overdue.includes('"en-curso"'), "overdue includes en-curso")
assert(overdue.includes('"pendiente-cierre"'), "excludes pendiente-cierre")

const scope = read("lib/tasks/task-list-scope.ts")
assert(scope.includes('"cancelada"'), "archive includes cancelada")
assert(scope.includes("ARCHIVE_OT_STATUS_FILTER_OPTIONS"), "archive filters")

const summary = read("components/planificacion/planning-operational-summary.tsx")
assert(summary.includes("OT Vencidas"), "planning overdue KPI")
assert(summary.includes("onSelectOverdue"), "overdue click handler")

const planning = read("components/planificacion/planning-module.tsx")
assert(planning.includes("overdueFilterActive"), "planning overdue filter state")

assert(
  read("components/configuracion/configuration-hub-panel.tsx").includes(
    "/configuracion/motivos"
  ),
  "config hub motivos link"
)
assert(
  existsSync(resolve(root, "app/(dashboard)/configuracion/motivos/page.tsx")),
  "motivos page"
)
assert(
  read("lib/tasks/record-operational-event.server.ts").includes(
    "recordOperationalEventSafe"
  ),
  "server operational event recorder"
)
assert(
  read("lib/mobile/v1/tasks/task-start-service.ts").includes(
    "buildStartedOperationalEvent"
  ),
  "mobile start records operational event"
)
assert(
  read("lib/mobile/v1/tasks/task-submit-service.ts").includes(
    "buildPendingClosureOperationalEvent"
  ),
  "mobile submit records operational event"
)
assert(
  read("lib/mobile/v1/tasks/task-incident-report-service.ts").includes(
    "buildIncidentOperationalEvent"
  ),
  "mobile incident records operational event"
)
assert(
  read("components/tareas/tasks-provider/hooks/use-tasks-planning.ts").includes(
    "buildPlanningConfirmedOperationalEvent"
  ),
  "planning confirm records operational event"
)
assert(
  read("lib/tasks/operational-events.ts").includes("checklist_completed"),
  "checklist completed event builder"
)
assert(
  read("lib/tasks/operational-motivos.ts").includes("buildCancelOperationalEvent"),
  "cancel event builder"
)
assert(
  read("lib/tasks/operational-motivos.ts").includes("applyOperationalEventActor"),
  "cancel/reschedule apply authenticated actor"
)
assert(
  read("components/tareas/task-operational-timeline.tsx").includes(
    "readOperationalEventActor"
  ),
  "timeline reads actor snapshot"
)
assert(
  !read("components/tareas/task-operational-timeline.tsx").includes(
    "sessionHistory"
  ),
  "timeline does not mix session history actors"
)
assert(
  read("components/tareas/task-operational-timeline.tsx").includes(
    "Historial operativo"
  ),
  "timeline component"
)
assert(
  read("components/tareas/task-admin-detail-view.tsx").includes(
    "TaskOperationalTimeline"
  ),
  "timeline wired in detail"
)

console.log("OK: control operativo sprint contracts")
