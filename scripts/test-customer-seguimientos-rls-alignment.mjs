import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260926000100_customer_seguimientos_sprint_2_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

const tenantIntegrityFunctionMatch = migrationSql.match(
  /CREATE OR REPLACE FUNCTION public\.enforce_customer_seguimientos_tenant_integrity\(\)[\s\S]*?\$\$;/
)

test("migración sprint 2.0 crea customer_seguimientos con RLS multi-tenant", () => {
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.customer_seguimientos/)
  assert.match(migrationSql, /customer_seguimientos_select_policy/)
  assert.match(migrationSql, /customer_seguimientos_insert_policy/)
  assert.match(migrationSql, /customer_seguimientos_update_policy/)
  assert.match(
    migrationSql,
    /auth_user_has_allowed_module\('atencion_cliente'\)/
  )
})

test("policy SELECT exige tenant, soft delete y acceso al módulo", () => {
  const selectPolicyMatch = migrationSql.match(
    /CREATE POLICY customer_seguimientos_select_policy[\s\S]*?;/
  )

  assert.ok(selectPolicyMatch, "No se encontró customer_seguimientos_select_policy")

  const selectPolicySql = selectPolicyMatch[0]

  assert.match(selectPolicySql, /FOR SELECT/)
  assert.match(selectPolicySql, /deleted_at IS NULL/)
  assert.match(selectPolicySql, /company_id = public\.auth_user_company_id\(\)/)
})

test("policies de escritura respetan demo read-only", () => {
  assert.match(migrationSql, /NOT public\.auth_is_demo_platform_read_only\(\)/)
})

test("estados iniciales limitados a pendiente y completado", () => {
  assert.match(migrationSql, /customer_seguimientos_status_check/)
  assert.match(migrationSql, /status IN \('pendiente', 'completado'\)/)
})

test("migración define función de integridad multi-tenant", () => {
  assert.ok(
    tenantIntegrityFunctionMatch,
    "No se encontró enforce_customer_seguimientos_tenant_integrity"
  )
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION public\.enforce_customer_seguimientos_tenant_integrity\(\)/
  )
})

test("migración define trigger BEFORE INSERT OR UPDATE de integridad tenant", () => {
  const triggerMatch = migrationSql.match(
    /CREATE TRIGGER customer_seguimientos_enforce_tenant_integrity[\s\S]*?;/
  )

  assert.ok(triggerMatch, "No se encontró customer_seguimientos_enforce_tenant_integrity")

  const triggerSql = triggerMatch[0]

  assert.match(triggerSql, /BEFORE INSERT OR UPDATE ON public\.customer_seguimientos/)
  assert.match(
    triggerSql,
    /EXECUTE FUNCTION public\.enforce_customer_seguimientos_tenant_integrity\(\)/
  )
})

test("función de integridad valida customer_id contra customers.company_id", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /FROM public\.customers c/)
  assert.match(functionSql, /c\.id = NEW\.customer_id/)
  assert.match(functionSql, /c\.company_id = NEW\.company_id/)
  assert.match(functionSql, /CUSTOMER_SEGUIMIENTO_CUSTOMER_TENANT_MISMATCH/)
})

test("función de integridad valida assigned_employee_id contra employees.company_id", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /NEW\.assigned_employee_id/)
  assert.match(functionSql, /e\.id = NEW\.assigned_employee_id/)
  assert.match(functionSql, /CUSTOMER_SEGUIMIENTO_ASSIGNED_EMPLOYEE_TENANT_MISMATCH/)
})

test("función de integridad valida completed_by_employee_id cuando no es NULL", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /IF NEW\.completed_by_employee_id IS NOT NULL/)
  assert.match(functionSql, /e\.id = NEW\.completed_by_employee_id/)
  assert.match(functionSql, /CUSTOMER_SEGUIMIENTO_COMPLETED_EMPLOYEE_TENANT_MISMATCH/)
})

test("función de integridad valida source_atencion_id cuando no es NULL", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /IF NEW\.source_atencion_id IS NOT NULL/)
  assert.match(functionSql, /FROM public\.customer_atenciones ca/)
  assert.match(functionSql, /ca\.id = NEW\.source_atencion_id/)
  assert.match(functionSql, /ca\.company_id = NEW\.company_id/)
  assert.match(functionSql, /CUSTOMER_SEGUIMIENTO_SOURCE_ATENCION_TENANT_MISMATCH/)
})

test("función de integridad valida previous_seguimiento_id cuando no es NULL", () => {
  const functionSql = tenantIntegrityFunctionMatch?.[0] ?? ""

  assert.match(functionSql, /IF NEW\.previous_seguimiento_id IS NOT NULL/)
  assert.match(functionSql, /FROM public\.customer_seguimientos cs/)
  assert.match(functionSql, /cs\.id = NEW\.previous_seguimiento_id/)
  assert.match(functionSql, /cs\.company_id = NEW\.company_id/)
  assert.match(functionSql, /CUSTOMER_SEGUIMIENTO_PREVIOUS_SEGUIMIENTO_TENANT_MISMATCH/)
})

test("RLS existentes permanecen sin cambios estructurales", () => {
  assert.match(
    migrationSql,
    /CREATE POLICY customer_seguimientos_select_policy[\s\S]*?FOR SELECT[\s\S]*?;/
  )
  assert.match(
    migrationSql,
    /CREATE POLICY customer_seguimientos_insert_policy[\s\S]*?FOR INSERT[\s\S]*?;/
  )
  assert.match(
    migrationSql,
    /CREATE POLICY customer_seguimientos_update_policy[\s\S]*?FOR UPDATE[\s\S]*?;/
  )
  assert.doesNotMatch(migrationSql, /DROP POLICY.*customer_seguimientos/)
})

test("trigger updated_at original permanece intacto", () => {
  assert.match(
    migrationSql,
    /CREATE TRIGGER customer_seguimientos_set_updated_at[\s\S]*?BEFORE UPDATE ON public\.customer_seguimientos/
  )
})
