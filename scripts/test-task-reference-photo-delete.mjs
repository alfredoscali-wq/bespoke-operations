import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { canAdminModifyWorkOrder } from "../lib/tasks/work-order-admin-mutation.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const queriesPath = join(__dirname, "../lib/supabase/task-photos.queries.ts")
const browserPath = join(__dirname, "../lib/supabase/task-photos.browser.ts")
const referencePhotosPath = join(
  __dirname,
  "../components/tareas/task-admin-reference-photos.tsx"
)
const viewerPath = join(
  __dirname,
  "../components/tareas/task-photo-viewer-dialog.tsx"
)
const sidebarPath = join(
  __dirname,
  "../components/tareas/task-admin-sidebar-panel.tsx"
)
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261008000100_task_photos_soft_delete_rls.sql"
)
const rpcMigrationPath = join(
  __dirname,
  "../supabase/migrations/20261009000100_task_reference_photo_soft_delete_rpc.sql"
)
const apiRoutePath = join(
  __dirname,
  "../app/api/tasks/[taskId]/reference-photos/[photoId]/route.ts"
)
const serverPath = join(
  __dirname,
  "../lib/tasks/task-reference-photo-delete.server.ts"
)

test("solo OT programada permite borrar fotos de referencia", () => {
  assert.equal(canAdminModifyWorkOrder("programada"), true)
  assert.equal(canAdminModifyWorkOrder("asignada"), false)
  assert.equal(canAdminModifyWorkOrder("en-curso"), false)
  assert.equal(canAdminModifyWorkOrder("finalizada"), false)
})

test("repositorio expone soft delete de referencia", () => {
  const source = readFileSync(queriesPath, "utf8")
  assert.match(source, /softDeleteTaskReferencePhoto/)
  assert.match(source, /photo_type !== "reference"/)
  assert.match(source, /task\.status !== "programada"/)
  assert.match(source, /deleted_at: new Date\(\)\.toISOString\(\)/)
})

test("browser elimina via API admin", () => {
  const source = readFileSync(browserPath, "utf8")
  assert.match(source, /deleteTaskReferencePhoto/)
  assert.match(source, /\/api\/tasks\//)
  assert.match(source, /reference-photos/)
  assert.doesNotMatch(source, /softDeleteTaskReferencePhotoQuery/)
})

test("API y server usan RPC autoritativa", () => {
  const apiSource = readFileSync(apiRoutePath, "utf8")
  const serverSource = readFileSync(serverPath, "utf8")
  const rpcMigrationSource = readFileSync(rpcMigrationPath, "utf8")

  assert.match(apiSource, /deleteTaskReferencePhotoFromAdmin/)
  assert.match(serverSource, /soft_delete_task_reference_photo/)
  assert.match(rpcMigrationSource, /photo_type = 'reference'/)
  assert.match(rpcMigrationSource, /status = 'programada'/)
  assert.match(rpcMigrationSource, /GRANT EXECUTE.*service_role/)
})

test("detalle OT habilita borrado solo con canAdminModifyWorkOrder", () => {
  const sidebarSource = readFileSync(sidebarPath, "utf8")
  assert.match(sidebarSource, /canDeleteReferencePhotos=\{canAdminModifyWorkOrder\(liveTask\.status\)\}/)
})

test("UI de referencia y visor exponen eliminar foto", () => {
  const referenceSource = readFileSync(referencePhotosPath, "utf8")
  const viewerSource = readFileSync(viewerPath, "utf8")

  assert.match(referenceSource, /deleteTaskReferencePhoto/)
  assert.match(referenceSource, /canDeleteReferencePhotos/)
  assert.match(viewerSource, /Eliminar foto/)
  assert.match(viewerSource, /Confirmar eliminacion/)
})

test("migracion RLS permite soft delete de task_photos", () => {
  const migrationSource = readFileSync(migrationPath, "utf8")
  assert.match(migrationSource, /task_photos_update_policy/)
  assert.match(migrationSource, /deleted_at IS NULL OR deleted_at IS NOT NULL/)
  assert.match(migrationSource, /auth_user_company_id\(\)/)
})
