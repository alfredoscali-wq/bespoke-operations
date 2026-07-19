/**
 * RC 3.2.5 — exclusive lock column + inactivity helpers.
 * Run: npx tsx --test scripts/test-customer-atenciones-rc-3-2-5-management-lock.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  buildLockedConsultationInfo,
  CONSULTATION_MANAGEMENT_LOCK_TIMEOUT_MINUTES,
  formatInboxManagingCell,
  isManagementLockExpired,
  parseLockedManagementFromError,
} from "../lib/customer-atenciones/consultation-management-lock.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("Gestionando column: empty / name / Vos", () => {
  assert.equal(
    formatInboxManagingCell({
      status: "para_resolver",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      currentEmployeeId: "me",
    }),
    ""
  )
  assert.equal(
    formatInboxManagingCell({
      status: "en_gestion",
      activeManagementEmployeeId: "other",
      activeManagementEmployeeName: "Juan Pérez",
      currentEmployeeId: "me",
    }),
    "Juan Pérez"
  )
  assert.equal(
    formatInboxManagingCell({
      status: "en_gestion",
      activeManagementEmployeeId: "me",
      activeManagementEmployeeName: "Alfredo",
      currentEmployeeId: "me",
    }),
    "🟢 Vos"
  )
})

test("parse lock metadata from RPC error", () => {
  const parsed = parseLockedManagementFromError(
    "CONSULTATION_ALREADY_IN_MANAGEMENT: …|manager_employee_id=11111111-1111-1111-1111-111111111111|started_at=2026-07-19T12:00:00Z"
  )
  assert.equal(
    parsed.managerEmployeeId,
    "11111111-1111-1111-1111-111111111111"
  )
  assert.equal(parsed.startedAt, "2026-07-19T12:00:00Z")
})

test("lock expiry uses configurable timeout", () => {
  assert.equal(CONSULTATION_MANAGEMENT_LOCK_TIMEOUT_MINUTES, 15)
  const started = new Date("2026-07-19T12:00:00.000Z")
  const now = new Date(started.getTime() + 16 * 60_000)
  assert.equal(
    isManagementLockExpired(
      { activeManagementStartedAt: started.toISOString() },
      now
    ),
    true
  )
  assert.equal(
    isManagementLockExpired(
      {
        activeManagementLastActivityAt: new Date(
          now.getTime() - 5 * 60_000
        ).toISOString(),
        activeManagementStartedAt: started.toISOString(),
      },
      now
    ),
    false
  )
})

test("locked dialog copy and inbox column exist in UI", () => {
  const dialog = fs.readFileSync(
    path.join(
      root,
      "components/atencion-cliente/locked-consultation-dialog.tsx"
    ),
    "utf8"
  )
  const inbox = fs.readFileSync(
    path.join(
      root,
      "components/atencion-cliente/consultation-inbox-section.tsx"
    ),
    "utf8"
  )
  assert.match(dialog, /Consulta en gestión/)
  assert.match(dialog, /Aceptar/)
  assert.doesNotMatch(dialog, /Tomar igualmente/)
  assert.match(inbox, /Gestionando/)
  assert.match(inbox, /formatInboxManagingCell/)
})

test("migration prepares timeout + expiry event", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "supabase/migrations/20261020000100_customer_atenciones_management_lock_rc_3_2_5.sql"
    ),
    "utf8"
  )
  assert.match(migration, /customer_atencion_management_lock_timeout_minutes/)
  assert.match(migration, /gestion_liberada_por_inactividad/)
  assert.match(migration, /active_management_last_activity_at/)
  assert.match(migration, /touch_customer_atencion_management_activity/)
})

test("locked info formatting", () => {
  const info = buildLockedConsultationInfo({
    managerName: "María Gómez",
    startedAt: "2026-07-19T12:00:00.000Z",
    now: new Date("2026-07-19T12:10:00.000Z"),
  })
  assert.equal(info.managerName, "María Gómez")
  assert.equal(info.relativeAge, "Hace 10 minutos")
})
