import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  canDeleteCustomerAtencionConsultation,
  CONSULTATION_HARD_DELETE_ADMIN_ONLY_MESSAGE,
  CONSULTATION_HARD_DELETE_SUCCESS_MESSAGE,
  mapConsultationHardDeleteRpcError,
  parseConsultationHardDeleteRpcResult,
} from "../lib/customer-atenciones/consultation-hard-delete.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261014000100_customer_atenciones_admin_hard_delete.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

test("solo Administrador puede ver/eliminar consultas", () => {
  assert.equal(canDeleteCustomerAtencionConsultation("administrador"), true)
  assert.equal(canDeleteCustomerAtencionConsultation("supervisor"), false)
  assert.equal(canDeleteCustomerAtencionConsultation("operario"), false)
  assert.equal(canDeleteCustomerAtencionConsultation("administrativo"), false)
  assert.equal(canDeleteCustomerAtencionConsultation(null), false)
})

test("mensaje de éxito y denegación admin", () => {
  assert.equal(
    CONSULTATION_HARD_DELETE_SUCCESS_MESSAGE,
    "Consulta eliminada correctamente."
  )
  assert.equal(
    mapConsultationHardDeleteRpcError(
      "CONSULTATION_DELETE_ADMIN_REQUIRED: Solo un Administrador puede eliminar consultas."
    ).message,
    CONSULTATION_HARD_DELETE_ADMIN_ONLY_MESSAGE
  )
})

test("parser del resultado RPC", () => {
  const parsed = parseConsultationHardDeleteRpcResult({
    atencion_id: "a1",
    deleted_events: 4,
    cleared_seguimientos: 1,
  })

  assert.deepEqual(parsed, {
    atencionId: "a1",
    deletedEvents: 4,
    clearedSeguimientos: 1,
  })
})

test("migración crea RPC admin-only con cascade de eventos", () => {
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION public\.hard_delete_customer_atencion_consultation/
  )
  assert.match(
    migrationSql,
    /e\.system_role = 'administrador'::public\.system_role/
  )
  assert.match(
    migrationSql,
    /DELETE FROM public\.customer_atencion_events/
  )
  assert.match(
    migrationSql,
    /UPDATE public\.customer_seguimientos/
  )
  assert.match(
    migrationSql,
    /DELETE FROM public\.customer_atenciones/
  )
  assert.match(
    migrationSql,
    /GRANT EXECUTE ON FUNCTION public\.hard_delete_customer_atencion_consultation\(uuid, uuid, uuid\)\s+TO service_role/
  )
  assert.match(
    migrationSql,
    /REVOKE EXECUTE ON FUNCTION public\.hard_delete_customer_atencion_consultation\(uuid, uuid, uuid\)\s+FROM authenticated/
  )
  assert.match(migrationSql, /CONSULTATION_DELETE_ADMIN_REQUIRED/)
})
