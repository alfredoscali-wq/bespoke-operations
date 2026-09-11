import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { parseWebChangePasswordRequest } from "../lib/auth/validate-web-change-password-request.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migration = read(
  "supabase/migrations/20261220000100_employees_authorization_rls.sql"
)
const changeClient = read("lib/auth/change-password.ts")
const changeServer = read("lib/auth/change-password.server.ts")
const changeRoute = read("app/api/auth/change-password/route.ts")
const changeForm = read("components/auth/change-password-form.tsx")
const provision = read("lib/auth/auth-provisioning-service.ts")
const reset = read("lib/auth/reset-employee-password.ts")
const softDelete = read("lib/auth/soft-delete-employee-access.ts")
const mobileChange = read("lib/mobile/v1/auth/change-password-service.ts")
const demoSeed = read("lib/demo/ensure-demo-admin-account.ts")
const executeImport = read("lib/employees/employee-import/execute.ts")
const selectMigration = read(
  "supabase/migrations/20261024000100_fix_employees_soft_delete_select_rls_conflict.sql"
)
const previousUpdate = read(
  "supabase/migrations/20261024000100_fix_employees_soft_delete_select_rls_conflict.sql"
)

test("1. operario no puede UPDATE su role_id (policy + trigger)", () => {
  assert.match(migration, /auth_can_manage_employee_directory/)
  assert.match(migration, /auth_user_has_allowed_module\('employees'\)/)
  assert.match(
    migration,
    /IF NEW\.role_id IS DISTINCT FROM OLD\.role_id THEN/
  )
  assert.match(migration, /EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN/)
})

test("2. operario no puede UPDATE role_id de otro employee", () => {
  assert.match(
    migration,
    /employees_update_policy[\s\S]*auth_can_manage_employee_directory\(\)/
  )
  assert.doesNotMatch(
    migration,
    /auth_user_employee_id\(\)\s*=/
  )
})

test("3. operario no puede UPDATE system_role", () => {
  assert.match(
    migration,
    /IF NEW\.system_role IS DISTINCT FROM OLD\.system_role THEN/
  )
})

test("4. operario no puede UPDATE system_access", () => {
  assert.match(
    migration,
    /IF NEW\.system_access IS DISTINCT FROM OLD\.system_access THEN/
  )
})

test("5. operario no puede UPDATE must_change_password", () => {
  assert.match(
    migration,
    /IF NEW\.must_change_password IS DISTINCT FROM OLD\.must_change_password THEN/
  )
  assert.doesNotMatch(changeClient, /updateEmployee/)
  assert.doesNotMatch(changeClient, /mustChangePassword/)
})

test("6. operario no puede UPDATE app_user_id", () => {
  assert.match(
    migration,
    /IF NEW\.app_user_id IS DISTINCT FROM OLD\.app_user_id THEN/
  )
})

test("7. operario no puede UPDATE company_id", () => {
  assert.match(
    migration,
    /IF NEW\.company_id IS DISTINCT FROM OLD\.company_id THEN/
  )
})

test("8. operario no puede UPDATE employment_status (fila)", () => {
  assert.match(
    migration,
    /CREATE POLICY employees_update_policy[\s\S]*auth_can_manage_employee_directory\(\)/
  )
  assert.match(
    migration,
    /auth_user_has_allowed_module\('employees'\)/
  )
})

test("9. operario no puede UPDATE deleted_at (fila)", () => {
  assert.match(
    migration,
    /CREATE POLICY employees_update_policy[\s\S]*auth_can_manage_employee_directory\(\)/
  )
  assert.doesNotMatch(
    migration,
    /NEW\.deleted_at IS DISTINCT FROM OLD\.deleted_at/
  )
})

test("10. operario no puede INSERT employee con privilegios", () => {
  assert.match(
    migration,
    /CREATE POLICY employees_insert_policy[\s\S]*auth_can_manage_employee_directory\(\)/
  )
  assert.match(migration, /IF TG_OP = 'INSERT' THEN/)
  assert.match(migration, /IF NEW\.role_id IS NOT NULL THEN/)
  assert.match(
    migration,
    /NEW\.system_role IS DISTINCT FROM 'operario'::public\.system_role/
  )
  assert.match(migration, /NEW\.system_access IS DISTINCT FROM false/)
  assert.match(migration, /NEW\.must_change_password IS DISTINCT FROM false/)
  assert.match(migration, /IF NEW\.app_user_id IS NOT NULL THEN/)
})

test("11. RRHH puede INSERT employee normal", () => {
  assert.match(
    migration,
    /auth_is_administrador\(\)[\s\S]*OR public\.auth_user_has_allowed_module\('employees'\)/
  )
  assert.match(
    migration,
    /CREATE POLICY employees_insert_policy[\s\S]*auth_can_manage_employee_directory/
  )
})

test("12. RRHH puede UPDATE ficha HR", () => {
  assert.match(
    migration,
    /CREATE POLICY employees_update_policy[\s\S]*auth_can_manage_employee_directory/
  )
})

test("13. RRHH puede UPDATE deleted_at", () => {
  assert.match(
    migration,
    /deleted_at IS NULL OR deleted_at IS NOT NULL/
  )
  assert.doesNotMatch(
    migration,
    /NEW\.deleted_at IS DISTINCT FROM OLD\.deleted_at/
  )
})

test("14. RRHH no puede role_id", () => {
  assert.match(migration, /No tiene permiso para modificar role_id/)
  assert.match(migration, /IF public\.auth_is_administrador\(\) THEN[\s\S]*RETURN NEW/)
})

test("15. RRHH no puede system_role", () => {
  assert.match(migration, /No tiene permiso para modificar system_role/)
})

test("16. RRHH no puede system_access", () => {
  assert.match(migration, /No tiene permiso para modificar system_access/)
})

test("17. RRHH no puede must_change_password", () => {
  assert.match(
    migration,
    /No tiene permiso para modificar must_change_password/
  )
})

test("18. RRHH no puede app_user_id", () => {
  assert.match(migration, /No tiene permiso para modificar app_user_id/)
})

test("19. RRHH no puede company_id", () => {
  assert.match(migration, /No tiene permiso para modificar company_id/)
})

test("20. admin puede crear employee", () => {
  assert.match(migration, /IF public\.auth_is_administrador\(\) THEN/)
  assert.match(migration, /auth\.role\(\) = 'service_role'/)
})

test("21. admin puede editar ficha", () => {
  assert.match(
    migration,
    /employees_update_policy[\s\S]*auth_is_administrador/
  )
})

test("22-26. admin puede columnas privilegiadas y soft-delete", () => {
  const adminEarlyReturn = migration.indexOf(
    "IF public.auth_is_administrador() THEN"
  )
  const roleForbidden = migration.indexOf(
    "No tiene permiso para modificar role_id"
  )
  assert.ok(adminEarlyReturn >= 0)
  assert.ok(roleForbidden > adminEarlyReturn)
  assert.match(
    migration,
    /WITH CHECK \([\s\S]*deleted_at IS NULL OR deleted_at IS NOT NULL/
  )
})

test("27. admin no puede tocar tenant B", () => {
  assert.match(
    migration,
    /company_id = public\.auth_user_company_id\(\)/
  )
  const insertPolicy = migration.slice(
    migration.indexOf("CREATE POLICY employees_insert_policy")
  )
  assert.match(insertPolicy, /company_id = public\.auth_user_company_id\(\)/)
  const updatePolicy = migration.slice(
    migration.indexOf("CREATE POLICY employees_update_policy")
  )
  assert.match(updatePolicy, /company_id = public\.auth_user_company_id\(\)/)
  assert.match(updatePolicy, /WITH CHECK \([\s\S]*company_id = public\.auth_user_company_id\(\)/)
})

test("28. Web change-password baja flag solo del propio employee", () => {
  assert.match(changeRoute, /sessionUser\.employeeId/)
  assert.match(changeServer, /patchEmployee\(admin, employeeId/)
  assert.match(changeServer, /mustChangePassword: false/)
  assert.doesNotMatch(changeForm, /employeeId:/)
  assert.doesNotMatch(changeClient, /employeeId/)
})

test("29. no acepta employeeId arbitrario", () => {
  const parsed = parseWebChangePasswordRequest({
    newPassword: "abcdefgh",
    employeeId: "attacker-employee",
    userId: "attacker-user",
  })
  assert.deepEqual(parsed, { newPassword: "abcdefgh" })
  assert.doesNotMatch(changeRoute, /body\.employeeId/)
  assert.doesNotMatch(changeClient, /employeeId/)
  assert.match(changeOwnPasswordUsesSession(), /employeeId/)
})

function changeOwnPasswordUsesSession() {
  assert.match(changeRoute, /changeOwnPassword\(\{\s*employeeId,/)
  assert.match(changeRoute, /const employeeId = sessionUser\.employeeId/)
  return changeRoute
}

test("30. Auth password sigue siendo la del JWT propio", () => {
  const fn = changeServer.slice(
    changeServer.indexOf("export async function changeOwnPassword")
  )
  assert.match(fn, /supabase\.auth\.updateUser\(\{\s*password: input\.newPassword/)
  assert.doesNotMatch(fn, /updateUserById/)
  assert.doesNotMatch(fn, /admin\.auth/)
  assert.ok(fn.indexOf("updateUser") < fn.indexOf("patchEmployee"))
})

test("31. Provision funciona (service_role first)", () => {
  assert.match(migration, /IF auth\.role\(\) = 'service_role' THEN\s*RETURN NEW/)
  assert.match(provision, /createAdminClient/)
  assert.match(provision, /mustChangePassword: true/)
  assert.match(provision, /patchEmployee/)
})

test("32. Reset funciona", () => {
  assert.match(reset, /createAdminClient/)
  assert.match(reset, /mustChangePassword: true/)
  assert.match(reset, /patchEmployee\(admin, trimmedId/)
})

test("33. Soft-delete funciona", () => {
  assert.match(softDelete, /createAdminClient/)
  assert.match(softDelete, /mustChangePassword: false/)
  assert.match(softDelete, /softDeleteEmployee\(admin/)
})

test("34. Mobile change-password funciona", () => {
  assert.match(mobileChange, /patchEmployee\(admin, input\.auth\.employeeId/)
  assert.match(mobileChange, /mustChangePassword: false/)
  assert.match(mobileChange, /Authorization: `Bearer \$\{accessToken\}`/)
  assert.doesNotMatch(mobileChange, /updateUserById/)
})

test("35. Demo seed funciona (service_role)", () => {
  assert.match(demoSeed, /from\("employees"\)/)
  assert.match(migration, /auth\.role\(\) = 'service_role'/)
})

test("36. Demo PostgREST INSERT/UPDATE employees bloqueado", () => {
  assert.match(
    migration,
    /NOT public\.auth_is_demo_platform_read_only\(\)/
  )
  const insertIdx = migration.indexOf("CREATE POLICY employees_insert_policy")
  const updateIdx = migration.indexOf("CREATE POLICY employees_update_policy")
  const insert = migration.slice(insertIdx, updateIdx)
  const update = migration.slice(updateIdx)
  assert.match(insert, /auth_is_demo_platform_read_only/)
  assert.match(update, /auth_is_demo_platform_read_only/)
})

test("37. Tenant A no puede modificar employee Tenant B", () => {
  assert.match(
    migration,
    /company_id = public\.auth_user_company_id\(\)/
  )
  assert.match(
    selectMigration,
    /CREATE POLICY employees_select_policy[\s\S]*company_id = public\.auth_user_company_id\(\)/
  )
  assert.doesNotMatch(migration, /DROP POLICY IF EXISTS employees_select_policy/)
})

test("trigger fail-closed, no silent revert, search_path, no SECURITY DEFINER", () => {
  assert.match(migration, /RAISE EXCEPTION 'EMPLOYEES_PRIVILEGED_COLUMN_FORBIDDEN'/)
  assert.doesNotMatch(migration, /NEW\.role_id := OLD\.role_id/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.enforce_employees_authorization_columns\(\)[\s\S]*SET search_path = public/
  )
  assert.match(
    migration,
    /enforce_employees_authorization_columns\(\)[\s\S]*SECURITY INVOKER/
  )
  assert.doesNotMatch(
    migration,
    /enforce_employees_authorization_columns\(\)[\s\S]*SECURITY DEFINER/
  )
  assert.match(
    migration,
    /REVOKE EXECUTE ON FUNCTION public\.enforce_employees_authorization_columns\(\) FROM anon/
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.enforce_employees_authorization_columns\(\) TO authenticated/
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.enforce_employees_authorization_columns\(\) TO service_role/
  )
})

test("SELECT unchanged; no DELETE policy", () => {
  assert.doesNotMatch(migration, /CREATE POLICY employees_select_policy/)
  assert.doesNotMatch(migration, /FOR DELETE/)
  assert.match(previousUpdate, /CREATE POLICY employees_select_policy/)
})

test("Web client no usa PostgREST para el flag", () => {
  assert.match(changeClient, /\/api\/auth\/change-password/)
  assert.doesNotMatch(changeClient, /from\("employees"\)/)
  assert.doesNotMatch(changeClient, /createClient/)
})

test("import RRHH no escribe columnas privilegiadas", () => {
  assert.match(executeImport, /toDirectoryInsertPayload/)
  assert.doesNotMatch(executeImport, /systemAccess:/)
  assert.doesNotMatch(executeImport, /systemRole:/)
  assert.doesNotMatch(executeImport, /mustChangePassword:/)
  assert.doesNotMatch(executeImport, /appUserId:/)
  assert.doesNotMatch(executeImport, /roleId:/)
})
