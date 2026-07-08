import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260925000100_customer_atenciones_sprint_1_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

test("migración sprint 1.0 crea customer_atenciones con RLS y módulo atencion_cliente", () => {
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.customer_atenciones/)
  assert.match(migrationSql, /customer_atenciones_select_policy/)
  assert.match(migrationSql, /customer_atenciones_insert_policy/)
  assert.match(migrationSql, /customer_atenciones_update_policy/)
  assert.match(
    migrationSql,
    /auth_user_has_allowed_module\('atencion_cliente'\)/
  )
  assert.match(migrationSql, /"atencion_cliente": true/)
})

test("policy SELECT exige acceso al módulo atencion_cliente", () => {
  const selectPolicyMatch = migrationSql.match(
    /CREATE POLICY customer_atenciones_select_policy[\s\S]*?;/
  )

  assert.ok(selectPolicyMatch, "No se encontró customer_atenciones_select_policy")

  const selectPolicySql = selectPolicyMatch[0]

  assert.match(selectPolicySql, /FOR SELECT/)
  assert.match(selectPolicySql, /deleted_at IS NULL/)
  assert.match(selectPolicySql, /company_id = public\.auth_user_company_id\(\)/)
  assert.match(
    selectPolicySql,
    /public\.auth_user_has_allowed_module\('atencion_cliente'\)/
  )
})

test("migración restringe resultado a valores del catálogo", () => {
  assert.match(migrationSql, /customer_atenciones_resultado_check/)
  assert.match(migrationSql, /resultado IN \('resuelta', 'requiere_seguimiento', 'ot_creada'\)/)
})
