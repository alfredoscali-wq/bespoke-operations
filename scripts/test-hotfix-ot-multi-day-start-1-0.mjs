/**
 * Hotfix OT multi-día Start 1.0 — align start date gate with agenda.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isOperationalDateRangeActive } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("Caso A: OT un día 08/08→08/08, hoy 08/08 — puede iniciar", () => {
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-08", dueDate: "2026-08-08" },
      "2026-08-08"
    ),
    true
  )
})

test("Caso B: OT multi-día 08/08→10/08, hoy 08/08 — puede iniciar", () => {
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-08", dueDate: "2026-08-10" },
      "2026-08-08"
    ),
    true
  )
})

test("Caso C: OT multi-día 08/08→10/08, hoy 09/08 — puede iniciar", () => {
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-08", dueDate: "2026-08-10" },
      "2026-08-09"
    ),
    true
  )
})

test("Caso D: OT multi-día 08/08→10/08, hoy 11/08 — no puede iniciar", () => {
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-08", dueDate: "2026-08-10" },
      "2026-08-11"
    ),
    false
  )
})

test("startMobileTask uses isOperationalDateRangeActive (not legacy dueDate-only)", () => {
  const source = read("lib/mobile/v1/tasks/task-start-service.ts")
  assert.match(source, /isOperationalDateRangeActive/)
  assert.match(
    source,
    /from ["']@\/lib\/mobile\/v1\/agenda\/agenda-task-visibility["']/
  )
  assert.doesNotMatch(
    source,
    /compareDateOnly\(task\.dueDate,\s*today\)\s*>\s*0/
  )
})
