import assert from "node:assert/strict"
import test from "node:test"

import { canShowForceDeleteAction } from "../lib/admin/force-delete-policy.ts"
import {
  FORCE_DELETE_CONFIRM_TEXT,
  isForceDeleteEntityType,
} from "../lib/admin/force-delete-types.ts"
import { AUDIT_ACTIONS } from "../lib/audit/types.ts"
import { isServerOnlyAuditAction } from "../lib/audit/client-policy.ts"
import { canSoftDeleteWorkOrder } from "../lib/tasks/work-order-deletion-policy.ts"

test("force delete solo visible para administrador", () => {
  assert.equal(canShowForceDeleteAction("administrador"), true)
  assert.equal(canShowForceDeleteAction("supervisor"), false)
  assert.equal(canShowForceDeleteAction("operario"), false)
  assert.equal(canShowForceDeleteAction(null), false)
})

test("force delete entity types soportados", () => {
  assert.equal(isForceDeleteEntityType("task"), true)
  assert.equal(isForceDeleteEntityType("project"), true)
  assert.equal(isForceDeleteEntityType("customer"), false)
})

test("confirmación reforzada exige ELIMINAR exacto", () => {
  assert.equal(FORCE_DELETE_CONFIRM_TEXT, "ELIMINAR")
})

test("FORCE_DELETE es auditoría server-only", () => {
  assert.equal(AUDIT_ACTIONS.FORCE_DELETE, "FORCE_DELETE")
  assert.equal(isServerOnlyAuditAction(AUDIT_ACTIONS.FORCE_DELETE), true)
})

test("reglas normales de soft delete no cambian para usuarios", () => {
  assert.equal(canSoftDeleteWorkOrder("programada"), true)
  assert.equal(canSoftDeleteWorkOrder("en-curso"), false)
  assert.equal(canSoftDeleteWorkOrder("finalizada"), false)
  assert.equal(
    canSoftDeleteWorkOrder({ status: "asignada", projectId: "p1" }),
    true
  )
  assert.equal(canSoftDeleteWorkOrder({ status: "asignada" }), false)
})
