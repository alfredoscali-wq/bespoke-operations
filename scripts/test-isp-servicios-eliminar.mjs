/**
 * SERVICIOS — Eliminar catálogo comercial.
 * Unused rows are physically deleted. Referenced rows are removed from the
 * catalog via deleted_at so customers, contracted services and TV stay.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  canPhysicallyDeleteCatalogItem,
  ISP_CATALOG_DELETE_CONFIRM_BODY,
  ISP_CATALOG_DELETE_CONFIRM_TITLE,
  ISP_CATALOG_USED_CANNOT_DELETE_MESSAGE,
  isCatalogItemVisibleInNewOt,
  resolveCatalogDeleteDecision,
} from "../lib/isp/catalog-integrity.ts"
import { canAccessIspModule, canWriteIspModule } from "../lib/isp/permissions.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const originalCatalogSql = read(
  "supabase/migrations/20261129000100_isp_1_1_catalogo_servicios.sql"
)
const tvComponentSql = read(
  "supabase/migrations/20261204000100_servicios_1_0_tv_component.sql"
)
const deleteSql = read(
  "supabase/migrations/20261207000100_isp_servicios_catalog_delete.sql"
)
const danglingTvSql = read(
  "supabase/migrations/20261210000100_isp_catalog_delete_with_dangling_tv.sql"
)
const queries = read("lib/isp/catalog-queries.ts")
const integrity = read("lib/isp/catalog-integrity.ts")
const route = read("app/api/isp/catalog/[id]/route.ts")
const list = read("components/isp/isp-catalog-list-screen.tsx")
const detail = read("components/isp/isp-catalog-detail-screen.tsx")
const dialog = read("components/isp/isp-catalog-delete-dialog.tsx")
const customer360 = read("components/isp/isp-customer-detail-screen.tsx")
const importer = read("lib/isp/migration/tv-component.ts")
const subscriptions = read("components/subscriptions/subscriptions-module.tsx")

function deleteFnSource() {
  return queries.slice(queries.indexOf("export async function deleteIspCatalogItem"))
}

test("1. servicio sin uso puede eliminarse", () => {
  assert.equal(canPhysicallyDeleteCatalogItem({ usedCount: 0 }).allowed, true)
  const unused = resolveCatalogDeleteDecision()
  assert.equal(unused.mode, "delete")
  assert.equal(unused.title, ISP_CATALOG_DELETE_CONFIRM_TITLE)
  assert.equal(unused.description, ISP_CATALOG_DELETE_CONFIRM_BODY)
  assert.match(queries, /export async function deleteIspCatalogItem/)
  assert.match(queries, /\.from\("isp_service_catalog"\)[\s\S]*\.delete\(\)/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(route, /export async function DELETE/)
})

test("2. servicio utilizado no se borra en cascada; se quita del catálogo", () => {
  const used = canPhysicallyDeleteCatalogItem({ usedCount: 3 })
  assert.equal(used.allowed, false)
  assert.equal(used.message, ISP_CATALOG_USED_CANNOT_DELETE_MESSAGE)
  const decision = resolveCatalogDeleteDecision({
    blockingReferenceCount: 2,
    isActive: true,
  })
  assert.equal(decision.mode, "delete")
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /logicallyRemoveCatalogItem/)
  assert.match(deleteFn, /deleted_at:/)
  assert.doesNotMatch(deleteFn, /throw new IspCatalogInUseError/)
  assert.doesNotMatch(deleteFn, /is_active: false/)
})

test("3. Eliminar no desactiva el servicio", () => {
  assert.doesNotMatch(dialog, /Desactivar/)
  assert.doesNotMatch(dialog, /isActive: false/)
  assert.doesNotMatch(dialog, /ISP_CATALOG_DEACTIVATE_ACTION_LABEL/)
  assert.match(dialog, /ISP_CATALOG_DELETE_CONFIRM_TITLE/)
  assert.match(dialog, /method: "DELETE"/)
  const deleteFn = deleteFnSource()
  assert.doesNotMatch(deleteFn, /setIspCatalogActive/)
})

test("4. desactivar (acción aparte) no modifica clientes ni abonos existentes", () => {
  const setActiveFn = queries.slice(
    queries.indexOf("export async function setIspCatalogActive"),
    queries.indexOf("export async function deactivateIspCatalogItem")
  )
  assert.doesNotMatch(setActiveFn, /\.from\("isp_services"\)\.update/)
  assert.match(setActiveFn, /update\(\{ is_active: isActive \}\)/)
  assert.match(setActiveFn, /\.from\("isp_service_catalog"\)/)
})

test("la lista permite activar y desactivar el estado", () => {
  const toggle = read("components/isp/isp-catalog-active-toggle.tsx")
  assert.match(list, /IspCatalogActiveToggle/)
  assert.match(toggle, /method: "PATCH"/)
  assert.match(toggle, /isActive: !item.isActive/)
  assert.match(toggle, /ISP_CATALOG_DEACTIVATE_ACTION_LABEL/)
  assert.match(toggle, /ISP_CATALOG_ACTIVATE_ACTION_LABEL/)
  assert.match(toggle, /role="switch"/)
  assert.doesNotMatch(toggle, /isp_services/)
  assert.doesNotMatch(toggle, /method: "DELETE"/)
})

test("5. desactivar impide nuevas asignaciones en OT", () => {
  assert.equal(isCatalogItemVisibleInNewOt({ isActive: false }), false)
  assert.equal(isCatalogItemVisibleInNewOt({ isActive: true }), true)
  assert.equal(
    isCatalogItemVisibleInNewOt({ isActive: true, deletedAt: "2026-01-01" }),
    false
  )
  assert.match(queries, /listIspCatalogForOt/)
  assert.match(queries, /\.eq\("is_active", true\)/)
})

test("6. no se elimina el plan TV asociado", () => {
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /if \(current.category === "tv"\)/)
  assert.match(deleteFn, /update\(\{ tv_plan_catalog_id: null \}\)/)
  assert.doesNotMatch(deleteFn, /\.delete\(\)[\s\S]{0,120}tv_plan_catalog_id/)
  assert.match(deleteFn, /\.eq\("id", id\)/)
  assert.match(
    tvComponentSql,
    /REFERENCES public\.isp_service_catalog \(id\) ON DELETE SET NULL/
  )
  assert.match(
    deleteSql,
    /prevent_isp_catalog_delete_when_tv_component_referenced/
  )
  assert.match(deleteSql, /tv_plan_catalog_id = OLD\.id/)
})

test("7. company_id se respeta", () => {
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /getIspCatalogItem\(client, companyId, id\)/)
  assert.match(deleteFn, /\.eq\("company_id", companyId\)/)
  assert.match(deleteFn, /\.eq\("id", id\)/)
  assert.match(deleteSql, /company_id = public\.auth_user_company_id\(\)/)
})

test("8. RLS se respeta", () => {
  assert.match(originalCatalogSql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(deleteSql, /isp_service_catalog_delete_policy/)
  assert.match(deleteSql, /FOR DELETE/)
  assert.match(deleteSql, /auth_user_company_id\(\)/)
  assert.match(deleteSql, /auth_user_has_allowed_module\('clientes_360'\)/)
  assert.match(deleteSql, /GRANT DELETE ON public\.isp_service_catalog/)
  assert.doesNotMatch(originalCatalogSql, /FOR DELETE/)
})

test("9. un usuario sin permisos no puede eliminar ni desactivar", () => {
  assert.equal(
    canWriteIspModule({
      systemRole: "user",
      roleCode: "field",
      moduleVisibility: { work_orders: true },
    }),
    false
  )
  assert.equal(
    canAccessIspModule({
      systemRole: "user",
      roleCode: "field",
      moduleVisibility: { work_orders: true },
    }),
    false
  )
  assert.match(route, /requireIspWriteContext/)
  assert.match(route, /export async function DELETE/)
  assert.match(deleteSql, /NOT public\.auth_is_demo_platform_read_only\(\)/)
})

test("10. no se eliminan registros relacionados accidentalmente", () => {
  assert.match(originalCatalogSql, /isp_services[\s\S]*ON DELETE RESTRICT/)
  assert.match(originalCatalogSql, /service_catalog_id[\s\S]*ON DELETE RESTRICT/)
  assert.doesNotMatch(deleteSql, /ON DELETE CASCADE/)
  assert.doesNotMatch(queries, /\.from\("isp_services"\)\s*\n\s*\.delete\(/)
  assert.doesNotMatch(queries, /\.from\("customers"\)[\s\S]{0,80}\.delete\(/)
  assert.doesNotMatch(queries, /\.from\("tasks"\)[\s\S]{0,80}\.delete\(/)
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /countCatalogReferences/)
  assert.match(queries, /tv_plan_catalog_id/)
})

test("UX: Eliminar confirma y quita el servicio del catálogo", () => {
  const rowActions = read("components/isp/isp-catalog-row-actions.tsx")
  assert.match(list, /IspCatalogRowActions/)
  assert.doesNotMatch(list, />Ver</)
  assert.doesNotMatch(list, />Editar</)
  assert.doesNotMatch(rowActions, /MoreHorizontal/)
  assert.doesNotMatch(rowActions, /DropdownMenu/)
  assert.match(rowActions, /<Eye /)
  assert.match(rowActions, /<Pencil /)
  assert.match(rowActions, /<Trash2 /)
  assert.match(rowActions, /label="Ver"/)
  assert.match(rowActions, /label="Editar"/)
  assert.match(rowActions, /label="Eliminar"/)
  assert.match(detail, /IspCatalogDeleteButton/)
  assert.match(dialog, /Eliminar/)
  assert.match(dialog, /ISP_CATALOG_DELETE_CONFIRM_TITLE/)
  assert.match(dialog, /ISP_CATALOG_DELETE_CONFIRM_BODY/)
  assert.doesNotMatch(dialog, /forcedInUse/)
  assert.doesNotMatch(dialog, /canDeleteCatalogItemFromServicios/)
})

test("no modifica importador, Clientes 360 ni /subscriptions", () => {
  assert.doesNotMatch(customer360, /deleteIspCatalogItem/)
  assert.doesNotMatch(importer, /deleteIspCatalogItem/)
  assert.doesNotMatch(subscriptions, /deleteIspCatalogItem/)
  assert.doesNotMatch(integrity, /ON DELETE CASCADE/)
})

test("cualquier servicio del catálogo se puede eliminar y deja de aparecer en OT", () => {
  const deleteFn = deleteFnSource()
  assert.doesNotMatch(deleteFn, /canDeleteCatalogItemFromServicios/)
  assert.doesNotMatch(integrity, /ISP_OT_REQUIRED_CATALOG_CANNOT_DELETE_MESSAGE/)
  assert.equal(
    isCatalogItemVisibleInNewOt({ isActive: true, deletedAt: "2026-09-01" }),
    false
  )
  assert.equal(isCatalogItemVisibleInNewOt({ isActive: true }), true)
  assert.match(danglingTvSql, /IF NEW.deleted_at IS NOT NULL THEN/)
  assert.match(deleteFn, /tv_plan_catalog_id: null/)
})

test("si el DELETE físico no aplica filas, se quita del catálogo con deleted_at", () => {
  const deleteFn = deleteFnSource()
  assert.match(
    deleteFn,
    /if \(!data\?\.length\) \{\s*return logicallyRemoveCatalogItem/
  )
  assert.doesNotMatch(
    deleteFn,
    /if \(!data\?\.length\) \{\s*throw new Error\("Servicio no encontrado\."\)/
  )
  const rlsSql = read(
    "supabase/migrations/20261211000100_isp_catalog_delete_rls.sql"
  )
  assert.match(rlsSql, /isp_service_catalog_delete_policy/)
  assert.match(rlsSql, /GRANT DELETE ON public\.isp_service_catalog/)
})
