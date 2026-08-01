import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import {
  ANALYSIS_EMPLOYEE_SELECT,
  ANALYSIS_REPORTES_CREW_SELECT,
  ANALYSIS_REPORTES_PROJECT_SELECT,
  ANALYSIS_REPORTES_TASK_SELECT,
} from "../lib/analysis/queries/index.ts"

const ROOT = join(process.cwd(), "lib", "analysis")

function listFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full)
  }
  return out
}

test("Sprint 16: analysis query selects never use SELECT *", () => {
  assert.equal(ANALYSIS_EMPLOYEE_SELECT.includes("*"), false)
  assert.equal(ANALYSIS_REPORTES_TASK_SELECT.includes("*"), false)
  assert.equal(ANALYSIS_REPORTES_PROJECT_SELECT.includes("*"), false)
  assert.equal(ANALYSIS_REPORTES_CREW_SELECT.includes("*"), false)

  for (const file of listFiles(ROOT)) {
    const source = readFileSync(file, "utf8")
    const starSelects = source.match(/\.select\(\s*[`'"]?\*[`'"]?/g) ?? []
    assert.equal(
      starSelects.length,
      0,
      `${file} still contains SELECT *`
    )
  }
})

test("Sprint 16: employee select is lean (no notes/email/national_id)", () => {
  assert.ok(ANALYSIS_EMPLOYEE_SELECT.includes("first_name"))
  assert.ok(ANALYSIS_EMPLOYEE_SELECT.includes("system_role"))
  assert.equal(ANALYSIS_EMPLOYEE_SELECT.includes("notes"), false)
  assert.equal(ANALYSIS_EMPLOYEE_SELECT.includes("email"), false)
  assert.equal(ANALYSIS_EMPLOYEE_SELECT.includes("national_id"), false)
  assert.equal(ANALYSIS_EMPLOYEE_SELECT.includes("employee_types"), false)
})

test("Sprint 16: reportes task select omits heavy JSON blobs", () => {
  assert.ok(ANALYSIS_REPORTES_TASK_SELECT.includes("task_metadata"))
  assert.equal(ANALYSIS_REPORTES_TASK_SELECT.includes("checklist"), false)
  assert.equal(
    ANALYSIS_REPORTES_TASK_SELECT.includes("operational_steps"),
    false
  )
  assert.equal(ANALYSIS_REPORTES_TASK_SELECT.includes("latitude"), false)
  assert.equal(ANALYSIS_REPORTES_CREW_SELECT.includes("crew_members"), false)
})

test("Sprint 16: reportes project select keeps status/end_date only essentials", () => {
  assert.ok(ANALYSIS_REPORTES_PROJECT_SELECT.includes("status"))
  assert.ok(ANALYSIS_REPORTES_PROJECT_SELECT.includes("end_date"))
  assert.equal(ANALYSIS_REPORTES_PROJECT_SELECT.includes("latitude"), false)
  assert.equal(ANALYSIS_REPORTES_PROJECT_SELECT.includes("pause_notes"), false)
})
