/**
 * CONEXIONES 1.0 — Eliminar conexión técnica (isp_connections).
 * Soft delete via deleted_at. Does not touch customers, isp_services,
 * catalog, TV or other connections.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_CONNECTION_DELETE_BODY,
  ISP_CONNECTION_DELETE_CONFIRM_LABEL,
  ISP_CONNECTION_DELETE_TITLE,
  ISP_CUSTOMER_DELETE_BLOCKED_BY_SERVICES_CONSTRAINT,
  ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER,
} from "../lib/isp/connection-delete.ts"
import { canAccessIspModule, canWriteIspModule } from "../lib/isp/permissions.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const originalSql = read(
  "supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"
)
const equipmentSql = read(
  "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
)
const deleteSql = read(
  "supabase/migrations/20261208000100_isp_conexiones_1_0_delete.sql"
)
const queries = read("lib/isp/subscriber-service-queries.ts")
const listQueries = read("lib/isp/queries.ts")
const route = read("app/api/isp/connections/[id]/route.ts")
const list = read("components/isp/isp-connections-list-screen.tsx")
const detail = read("components/isp/isp-connection-detail-screen.tsx")
const dialog = read("components/isp/isp-connection-delete-dialog.tsx")
const catalogQueries = read("lib/isp/catalog-queries.ts")
const customer360 = read("components/isp/isp-customer-detail-screen.tsx")
const importer = read("lib/isp/migration/tv-component.ts")
const subscriptions = read("components/subscriptions/subscriptions-module.tsx")

function deleteFnSource() {
  const start = queries.indexOf("export async function deleteIspConnection")
  const end = queries.indexOf(
    "export async function getIspContractedService",
    start
  )
  return queries.slice(start, end)
}

test("1. una conexión puede eliminarse", () => {
  const deleteFn = deleteFnSource()
  assert.match(queries, /export async function deleteIspConnection/)
  assert.match(deleteFn, /\.from\("isp_connections"\)/)
  assert.match(deleteFn, /deleted_at: now/)
  assert.match(route, /export async function DELETE/)
  assert.match(route, /deleteIspConnection/)
  assert.match(dialog, /ISP_CONNECTION_DELETE_TITLE/)
  assert.equal(ISP_CONNECTION_DELETE_TITLE, "Eliminar conexión")
  assert.equal(
    ISP_CONNECTION_DELETE_BODY,
    "Está a punto de eliminar esta conexión. Esta acción no podrá deshacerse."
  )
  assert.equal(
    ISP_CONNECTION_DELETE_CONFIRM_LABEL,
    "Eliminar definitivamente"
  )
})

test("2. eliminar una conexión no elimina el cliente", () => {
  const deleteFn = deleteFnSource()
  assert.doesNotMatch(deleteFn, /\.from\("customers"\)/)
  assert.doesNotMatch(deleteFn, /from\("isp_subscribers"\)/)
})

test("3. eliminar una conexión no elimina isp_services", () => {
  const deleteFn = deleteFnSource()
  assert.doesNotMatch(deleteFn, /\.from\("isp_services"\)/)
  assert.match(
    originalSql,
    /service_id uuid NOT NULL REFERENCES public.isp_services/
  )
  assert.doesNotMatch(
    originalSql,
    /service_id uuid NOT NULL REFERENCES public.isp_services \(id\) ON DELETE CASCADE/
  )
})

test("4. no elimina el catálogo comercial", () => {
  const deleteFn = deleteFnSource()
  assert.doesNotMatch(deleteFn, /isp_service_catalog/)
  assert.doesNotMatch(deleteFn, /deleteIspCatalogItem/)
})

test("5. no elimina el plan TV", () => {
  const deleteFn = deleteFnSource()
  assert.doesNotMatch(deleteFn, /tv_plan_catalog_id/)
  assert.doesNotMatch(deleteFn, /subscriptions/)
})

test("6. no elimina otras conexiones del mismo cliente", () => {
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /\.eq\("id", connectionId\)/)
  assert.doesNotMatch(deleteFn, /\.eq\("service_id"/)
  assert.doesNotMatch(deleteFn, /customer_id/)
})

test("7. no permite eliminar una conexión de otro company_id", () => {
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /\.eq\("company_id", companyId\)/)
  assert.match(deleteFn, /\.eq\("id", connectionId\)/)
})

test("8. un usuario sin permiso no puede eliminar", () => {
  assert.equal(
    canWriteIspModule({
      systemRole: "user",
      roleCode: "operario",
      moduleVisibility: { work_orders: true },
    }),
    false
  )
  assert.equal(
    canAccessIspModule({
      systemRole: "user",
      roleCode: "operario",
      moduleVisibility: { work_orders: true },
    }),
    false
  )
  assert.match(route, /requireIspWriteContext/)
  assert.match(route, /export async function DELETE/)
})

test("9. se respetan RLS", () => {
  assert.match(originalSql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(originalSql, /isp_connections_update_policy/)
  assert.match(originalSql, /company_id = public.auth_user_company_id\(\)/)
  assert.match(originalSql, /auth_user_has_allowed_module\('clientes_360'\)/)
  assert.match(
    originalSql,
    /GRANT SELECT, INSERT, UPDATE ON public.isp_connections/
  )
  assert.doesNotMatch(originalSql, /isp_connections_delete_policy/)
  assert.doesNotMatch(deleteSql, /FOR DELETE/)
})

test("10. las FK dependientes se manejan correctamente", () => {
  assert.match(
    equipmentSql,
    /connection_id uuid NOT NULL REFERENCES public.isp_connections \(id\)/
  )
  assert.doesNotMatch(
    equipmentSql,
    /connection_id uuid NOT NULL REFERENCES public.isp_connections \(id\) ON DELETE CASCADE/
  )
  const deleteFn = deleteFnSource()
  assert.match(deleteFn, /\.from\("isp_connection_equipment"\)/)
  assert.match(deleteFn, /\.eq\("connection_id", connectionId\)/)
  const equipmentUpdate = deleteFn.indexOf("isp_connection_equipment")
  const connectionUpdate = deleteFn.lastIndexOf('.from("isp_connections")')
  assert.ok(equipmentUpdate > 0 && connectionUpdate > equipmentUpdate)
  assert.doesNotMatch(deleteSql, /ON DELETE CASCADE/)
  assert.match(deleteSql, /DROP CONSTRAINT IF EXISTS isp_connections_service_unique/)
  assert.match(deleteSql, /WHERE deleted_at IS NULL/)
  assert.match(listQueries, /\.is\("deleted_at", null\)/)
})

test("UX: Ver, Editar y Eliminar en el listado y confirmación clara", () => {
  assert.match(list, />Ver</)
  assert.match(list, /openEditConnection/)
  assert.match(list, />\s*Editar\s*</)
  assert.match(list, /IspConnectionDeleteButton/)
  assert.match(detail, /IspConnectionDeleteButton/)
  assert.match(dialog, /Cliente/)
  assert.match(dialog, /Servicio/)
  assert.match(dialog, /Tecnología/)
  assert.match(dialog, /Plan/)
  assert.match(dialog, /Cancelar/)
  assert.match(dialog, /ISP_CONNECTION_DELETE_CONFIRM_LABEL/)
})

test("documenta el orden de dependencias ISP al borrar un cliente", () => {
  assert.deepEqual([...ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER], [
    "isp_connection_equipment",
    "isp_connections",
    "isp_services",
    "isp_subscribers",
    "customers",
  ])
  assert.equal(
    ISP_CUSTOMER_DELETE_BLOCKED_BY_SERVICES_CONSTRAINT,
    "isp_services_customer_id_fkey"
  )
  assert.match(deleteSql, /isp_services_customer_id_fkey/)
})

test("no modifica importador, Clientes 360, Servicios ni /subscriptions", () => {
  assert.doesNotMatch(customer360, /deleteIspConnection/)
  assert.doesNotMatch(importer, /deleteIspConnection/)
  assert.doesNotMatch(subscriptions, /deleteIspConnection/)
  assert.doesNotMatch(catalogQueries, /deleteIspConnection/)
})
