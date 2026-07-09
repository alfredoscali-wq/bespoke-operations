import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260928000100_customer_recuperaciones_sprint_5_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

const tenantIntegrityFunctionMatch = migrationSql.match(
  /CREATE OR REPLACE FUNCTION public\.enforce_customer_recuperaciones_tenant_integrity\(\)[\s\S]*?\$\$;/
)

test("migración sprint 5.0 crea customer_recuperaciones con RLS multi-tenant", () => {
  assert.match(
    migrationSql,
    /CREATE TABLE IF NOT EXISTS public\.customer_recuperaciones/
  )
  assert.match(migrationSql, /customer_recuperaciones_select_policy/)
  assert.match(migrationSql, /customer_recuperaciones_insert_policy/)
  assert.match(
    migrationSql,
    /auth_user_has_allowed_module\('atencion_cliente'\)/
  )
  assert.doesNotMatch(migrationSql, /customer_recuperaciones_update_policy/)
})

test("insert exige performed_by_employee_id del empleado autenticado", () => {
  const insertPolicyMatch = migrationSql.match(
    /CREATE POLICY customer_recuperaciones_insert_policy[\s\S]*?;/
  )

  assert.ok(insertPolicyMatch)
  assert.match(
    insertPolicyMatch[0],
    /performed_by_employee_id = public\.auth_user_employee_id\(\)/
  )
  assert.match(
    insertPolicyMatch[0],
    /NOT public\.auth_is_demo_platform_read_only\(\)/
  )
})

test("constraints validan modo cliente existente vs carga manual", () => {
  assert.match(migrationSql, /customer_recuperaciones_customer_mode_check/)
  assert.match(migrationSql, /customer_id IS NOT NULL/)
  assert.match(migrationSql, /manual_customer_name IS NOT NULL/)
  assert.match(migrationSql, /manual_zone IS NOT NULL/)
  assert.match(migrationSql, /manual_phone IS NOT NULL/)
})

test("función de integridad valida relaciones multi-tenant", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /NEW\.customer_id/)
  assert.match(functionSql, /NEW\.performed_by_employee_id/)
  assert.match(functionSql, /CUSTOMER_RECUPERACION_CUSTOMER_TENANT_MISMATCH/)
  assert.match(functionSql, /CUSTOMER_RECUPERACION_EMPLOYEE_TENANT_MISMATCH/)
})

test("canales y resultados limitados al catálogo operativo", () => {
  assert.match(migrationSql, /channel IN \('telefono', 'whatsapp', 'otro'\)/)
  assert.match(migrationSql, /resultado IN \(/)
  assert.match(migrationSql, /'recuperado'/)
  assert.match(migrationSql, /'volver_a_contactar'/)
})

test("trigger BEFORE INSERT OR UPDATE de integridad tenant", () => {
  assert.match(
    migrationSql,
    /CREATE TRIGGER customer_recuperaciones_enforce_tenant_integrity[\s\S]*BEFORE INSERT OR UPDATE ON public\.customer_recuperaciones/
  )
})
