/**
 * Smoke: HOTFIX CONTROL OPERATIVO 1.1 — admin soft-delete confirm.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const dialog = read(
  "components/tareas/work-order-admin-soft-delete-dialog.tsx"
)
assert(
  dialog.includes("Eliminar definitivamente la Orden de Trabajo"),
  "dialog title"
)
assert(dialog.includes('WORK_ORDER_ADMIN_SOFT_DELETE_CONFIRM_TEXT = "ELIMINAR"'), "confirm text")
assert(dialog.includes("No podrá recuperarse"), "warning copy")

const row = read("components/tareas/task-row-actions.tsx")
assert(row.includes("WorkOrderAdminSoftDeleteDialog"), "row uses soft-delete dialog")
assert(row.includes("administration: true"), "calls soft delete with administration")
assert(!row.includes("WorkOrderPermanentDeleteDialog"), "hard-delete dialog removed from row")
assert(row.includes("canAdminSoftDelete"), "admin-only gate")
assert(row.includes("showCancel"), "cancel action preserved")

console.log("OK: control operativo 1.1 admin soft-delete hotfix")
