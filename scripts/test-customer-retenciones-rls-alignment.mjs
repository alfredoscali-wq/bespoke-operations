import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260927000100_customer_retenciones_sprint_3_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

const tenantIntegrityFunctionMatch = migrationSql.match(
  /CREATE OR REPLACE FUNCTION public\.enforce_customer_retenciones_tenant_integrity\(\)[\s\S]*?\$\$;/
)

const assignmentImmutabilityFunctionMatch = migrationSql.match(
  /CREATE OR REPLACE FUNCTION public\.enforce_customer_retenciones_assignment_immutability\(\)[\s\S]*?\$\$;/
)

test("migración sprint 3.0 crea customer_retenciones con RLS multi-tenant", () => {
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.customer_retenciones/)
  assert.match(migrationSql, /customer_retenciones_select_policy/)
  assert.match(migrationSql, /customer_retenciones_insert_policy/)
  assert.match(migrationSql, /customer_retenciones_update_policy/)
  assert.match(
    migrationSql,
    /auth_user_has_allowed_module\('atencion_cliente'\)/
  )
})

test("insert exige creación autoasignada por Atención al Cliente", () => {
  const sprint6Path = join(
    __dirname,
    "../supabase/migrations/20260929000100_customer_retenciones_sprint_6_0.sql"
  )
  const sprint6Sql = readFileSync(sprint6Path, "utf8")
  const insertPolicyMatch = sprint6Sql.match(
    /CREATE POLICY customer_retenciones_insert_policy[\s\S]*?;/
  )

  assert.ok(insertPolicyMatch)
  assert.match(insertPolicyMatch[0], /auth_can_create_customer_retencion\(\)/)
  assert.match(insertPolicyMatch[0], /assigned_employee_id = public\.auth_user_employee_id\(\)/)
})

test("función de integridad valida relaciones multi-tenant", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /NEW\.customer_id/)
  assert.match(functionSql, /NEW\.assigned_employee_id/)
  assert.match(functionSql, /NEW\.assigned_by_employee_id/)
  assert.match(functionSql, /NEW\.completed_by_employee_id IS NOT NULL/)
  assert.match(functionSql, /cr\.code = 'atencion_cliente'/)
})

test("trigger BEFORE INSERT OR UPDATE de integridad tenant", () => {
  assert.match(
    migrationSql,
    /CREATE TRIGGER customer_retenciones_enforce_tenant_integrity[\s\S]*BEFORE INSERT OR UPDATE ON public\.customer_retenciones/
  )
})

test("estados y resultados limitados al catálogo operativo", () => {
  assert.match(migrationSql, /status IN \('pendiente', 'finalizada'\)/)
  assert.match(migrationSql, /resultado IN \('retenido', 'no_retenido'\)/)
})

test("update protege inmutabilidad de datos originales de asignación", () => {
  const functionSql = assignmentImmutabilityFunctionMatch?.[0] ?? ""

  assert.ok(
    assignmentImmutabilityFunctionMatch,
    "No se encontró enforce_customer_retenciones_assignment_immutability"
  )
  assert.match(functionSql, /NEW\.company_id IS DISTINCT FROM OLD\.company_id/)
  assert.match(functionSql, /NEW\.customer_id IS DISTINCT FROM OLD\.customer_id/)
  assert.match(
    functionSql,
    /NEW\.assigned_employee_id IS DISTINCT FROM OLD\.assigned_employee_id/
  )
  assert.match(
    functionSql,
    /NEW\.assigned_by_employee_id IS DISTINCT FROM OLD\.assigned_by_employee_id/
  )
  assert.match(functionSql, /NEW\.motivo_baja IS DISTINCT FROM OLD\.motivo_baja/)
  assert.match(functionSql, /NEW\.detail IS DISTINCT FROM OLD\.detail/)
  assert.match(functionSql, /NEW\.created_at IS DISTINCT FROM OLD\.created_at/)
})

test("trigger BEFORE UPDATE de inmutabilidad de asignación", () => {
  assert.match(
    migrationSql,
    /CREATE TRIGGER customer_retenciones_enforce_assignment_immutability[\s\S]*BEFORE UPDATE ON public\.customer_retenciones/
  )
})
