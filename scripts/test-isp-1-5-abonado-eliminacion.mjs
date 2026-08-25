import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { belongsToIspUniverse } from "../lib/isp/integrity.ts"
import { canRemoveIspSubscriber } from "../lib/isp/permissions.ts"
import {
  ISP_SUBSCRIBER_REMOVED_MESSAGE,
  ISP_SUBSCRIBER_REMOVAL_CONFIRMATION,
  ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE,
  ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE,
  ISP_SUBSCRIBER_REMOVAL_HISTORY_NOTE,
  hasActiveIspSubscriberMembership,
  isIspSubscriberRemovalConfirmation,
  isIspSubscriberRemovalResolved,
  ispSubscriberRemovalLead,
  ispSubscriberRemovalUserMessage,
  resolveIspSubscriberRemovalResult,
} from "../lib/isp/subscriber-removal.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261138000100_isp_1_5_abonado_eliminacion_admin.sql"
)
const sqlPrevious = read(
  "supabase/migrations/20261137000100_isp_1_4_1_fecha_alta_estado_comercial.sql"
)
const queries = read("lib/isp/queries.ts")
const api = read("app/api/isp/customers/[id]/subscriber/route.ts")
const routeContext = read("lib/isp/route-context.ts")
const permissions = read("lib/isp/permissions.ts")
const list = [
  read("components/isp/isp-customer-list-screen.tsx"),
  read("components/isp/isp-customer-list-ui.tsx"),
].join("\n")
const customersModule = read("components/clientes/customers-module.tsx")
const listFn = queries.slice(
  queries.indexOf("export async function listIspCustomers"),
  queries.indexOf("export async function getIspCustomerDetail")
)
const detailFn = queries.slice(
  queries.indexOf("export async function getIspCustomerDetail")
)

const adminUser = {
  systemRole: "administrador",
  roleCode: "administrador",
  moduleVisibility: {},
}
const operatorUser = {
  systemRole: "operario",
  roleCode: "operario",
  moduleVisibility: { clientes_360: true },
}

test("1. Administrador puede eliminar abonado", () => {
  assert.equal(canRemoveIspSubscriber(adminUser), true)
  assert.match(permissions, /canRemoveIspSubscriber/)
  assert.match(permissions, /isAdministradorSessionUser/)
  assert.match(sql, /auth_is_administrador\(\)/)
  assert.match(sql, /remove_isp_subscriber_membership/)
  assert.match(sql, /SET deleted_at = now\(\)/)
  assert.match(api, /requireIspSubscriberRemovalContext/)
  assert.match(routeContext, /canRemoveIspSubscriber/)
  assert.match(list, /canRemoveIspSubscriber/)
  assert.match(list, /aria-label=\{label\}/)
  assert.match(list, /Eliminar abonado/)
})

test("2. Usuario sin permiso no puede eliminarlo", () => {
  assert.equal(canRemoveIspSubscriber(operatorUser), false)
  assert.equal(
    resolveIspSubscriberRemovalResult({
      isAdmin: false,
      confirmation: "ELIMINAR",
      sessionCompanyId: "co-1",
      membership: { companyId: "co-1", deletedAt: null },
    }).ok,
    false
  )
  assert.match(sql, /Solo un administrador puede eliminar un abonado ISP/)
  assert.match(routeContext, /status: 403/)
  assert.match(routeContext, /ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE/)
  assert.match(list, /canRemove \? \(/)
  assert.equal(
    ispSubscriberRemovalUserMessage(
      new Error("Solo un administrador puede eliminar un abonado ISP.")
    ).status,
    403
  )
})

test("3. isp_subscribers queda soft deleted", () => {
  assert.match(sql, /UPDATE public\.isp_subscribers/)
  assert.match(sql, /SET deleted_at = now\(\)/)
  assert.doesNotMatch(sql, /DELETE FROM public\.isp_subscribers/)
  assert.equal(hasActiveIspSubscriberMembership(null), true)
  assert.equal(hasActiveIspSubscriberMembership("2026-08-25T12:00:00.000Z"), false)
})

test("4. customers continúa existiendo", () => {
  assert.doesNotMatch(sql, /DELETE FROM public\.customers/)
  assert.doesNotMatch(sql, /UPDATE public\.customers/)
  assert.doesNotMatch(sql, /DROP TABLE public\.customers/)
  assert.match(customersModule, /CustomersModule/)
})

test("5. Servicios continúan existiendo", () => {
  assert.doesNotMatch(sql, /DELETE FROM public\.isp_services/)
  assert.doesNotMatch(sql, /UPDATE public\.isp_services/)
})

test("6. Conexiones continúan existiendo", () => {
  assert.doesNotMatch(sql, /DELETE FROM public\.isp_connections/)
  assert.doesNotMatch(sql, /UPDATE public\.isp_connections/)
})

test("7. El abonado eliminado no aparece en Clientes 360°", () => {
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: false,
      serviceCount: 2,
      connectionCount: 1,
    }),
    false
  )
  assert.match(listFn, /from\("isp_subscribers"\)/)
  assert.match(listFn, /\.is\("deleted_at", null\)/)
  assert.match(detailFn, /from\("isp_subscribers"\)/)
  assert.match(detailFn, /\.is\("deleted_at", null\)/)
})

test("8. El abonado eliminado no aparece en búsquedas", () => {
  assert.match(listFn, /input\.search/)
  assert.match(listFn, /escapeCustomerSearchPattern/)
  assert.match(listFn, /\.is\("deleted_at", null\)/)
  assert.match(list, /debouncedSearch/)
})

test("9. No aparece en contadores", () => {
  assert.match(list, /items\.length/)
  assert.match(list, /abonado/)
  assert.match(listFn, /memberIds\.length === 0/)
  assert.match(listFn, /return \{ customers: \[\], localities: \[\] \}/)
})

test("10. No aparece en filtros", () => {
  assert.match(listFn, /input\.status/)
  assert.match(listFn, /input\.locality/)
  assert.match(listFn, /minServices/)
  assert.match(listFn, /minConnections/)
  assert.match(listFn, /\.is\("deleted_at", null\)/)
  assert.match(list, /setStatus/)
  assert.match(list, /setLocality/)
})

test("11. Confirmación requiere escribir exactamente ELIMINAR", () => {
  assert.equal(ISP_SUBSCRIBER_REMOVAL_CONFIRMATION, "ELIMINAR")
  assert.equal(isIspSubscriberRemovalConfirmation("ELIMINAR"), true)
  assert.equal(isIspSubscriberRemovalConfirmation("eliminar"), false)
  assert.equal(isIspSubscriberRemovalConfirmation("ELIMINAR "), false)
  assert.equal(isIspSubscriberRemovalConfirmation(""), false)
  assert.equal(
    resolveIspSubscriberRemovalResult({
      isAdmin: true,
      confirmation: "eliminar",
      sessionCompanyId: "co-1",
      membership: { companyId: "co-1", deletedAt: null },
    }).ok,
    false
  )
  assert.match(list, /Escribí \{ISP_SUBSCRIBER_REMOVAL_CONFIRMATION\} para confirmar/)
  assert.match(api, /isIspSubscriberRemovalConfirmation/)
  assert.match(list, /disabled=\{!canSubmit\}/)
})

test("12. Cancelar no modifica nada", () => {
  const ui = read("components/isp/isp-customer-list-ui.tsx")
  const start = ui.indexOf("export function CustomerRemoveSubscriberDialog")
  const end = ui.indexOf("export function CustomerBulkAtencionConfirmDialog")
  const dialog = ui.slice(start, end)
  assert.match(dialog, /function handleCancel/)
  assert.match(dialog, /Cancelar/)
  assert.match(dialog, /onClick=\{handleCancel\}/)
  const cancelFn = dialog.slice(
    dialog.indexOf("function handleCancel"),
    dialog.indexOf("return (")
  )
  assert.doesNotMatch(cancelFn, /onConfirm/)
  assert.match(read("components/isp/isp-customer-list-screen.tsx"), /setRemoveTarget\(null\)/)
})

test("13. No existe eliminación masiva", () => {
  assert.doesNotMatch(list, /Eliminar seleccionados/)
  assert.match(list, /Nueva atención/)
  assert.match(list, /Exportar seleccionados/)
  assert.match(list, /Ver seleccionados/)
  assert.match(list, /Limpiar selección/)
  assert.doesNotMatch(list, /onRemoveSelected|bulkRemove|removeSelected/)
})

test("14. La operación respeta company_id", () => {
  assert.match(sql, /v_company_id uuid := public\.auth_user_company_id\(\)/)
  assert.match(sql, /WHERE company_id = v_company_id/)
  assert.doesNotMatch(sql, /p_company_id/)
  assert.doesNotMatch(api, /body\.companyId|body\.company_id/)
  assert.equal(
    resolveIspSubscriberRemovalResult({
      isAdmin: true,
      confirmation: "ELIMINAR",
      sessionCompanyId: "co-1",
      membership: { companyId: "co-2", deletedAt: null },
    }).ok,
    false
  )
})

test("15. Reintento\/estado ya eliminado se maneja correctamente", () => {
  const already = resolveIspSubscriberRemovalResult({
    isAdmin: true,
    confirmation: "ELIMINAR",
    sessionCompanyId: "co-1",
    membership: { companyId: "co-1", deletedAt: "2026-08-25T12:00:00.000Z" },
  })
  assert.equal(already.ok, true)
  if (already.ok) assert.equal(already.alreadyRemoved, true)
  assert.match(sql, /alreadyRemoved/)
  assert.equal(isIspSubscriberRemovalResolved(200, { success: true }), true)
  assert.equal(
    isIspSubscriberRemovalResolved(200, { success: true, alreadyRemoved: true }),
    true
  )
  assert.equal(isIspSubscriberRemovalResolved(404, { success: false }), true)
  assert.equal(
    isIspSubscriberRemovalResolved(403, { success: false }),
    false
  )
  assert.match(list, /isIspSubscriberRemovalResolved/)
  assert.match(list, /setReloadKey/)
  assert.match(list, /ISP_SUBSCRIBER_REMOVED_MESSAGE/)
})

test("acciones visibles por icono y confirmación", () => {
  assert.match(list, /Ver abonado/)
  assert.match(list, /Editar cliente/)
  assert.match(list, /Agregar servicio/)
  assert.match(list, /Nueva atención/)
  assert.match(list, /Eliminar abonado/)
  assert.doesNotMatch(list, /MoreHorizontal/)
  assert.match(list, /size="icon-sm"/)
  assert.match(list, /ispSubscriberRemovalLead/)
  assert.match(list, /ISP_SUBSCRIBER_REMOVAL_HISTORY_NOTE/)
  assert.equal(
    ispSubscriberRemovalLead("Diego Pérez"),
    "Vas a quitar a Diego Pérez del directorio de abonados ISP."
  )
  assert.equal(
    ISP_SUBSCRIBER_REMOVAL_HISTORY_NOTE,
    "Sus datos históricos no serán eliminados."
  )
  assert.equal(ISP_SUBSCRIBER_REMOVED_MESSAGE, "Abonado eliminado")
  assert.equal(
    ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE,
    "No se pudo eliminar el abonado. Intentá nuevamente."
  )
  assert.equal(
    ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE,
    "Solo un administrador puede eliminar un abonado ISP."
  )
})

test("no expone errores técnicos ni borra historial", () => {
  assert.equal(
    ispSubscriberRemovalUserMessage(new Error("PGRST116: column")).message,
    ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE
  )
  assert.doesNotMatch(list, /PostgREST|PGRST|TypeError/)
  assert.match(list, /ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE/)
  assert.doesNotMatch(sql, /DELETE FROM public\.activity/)
  assert.doesNotMatch(sql, /DELETE FROM public\.customer_atenciones/)
  assert.doesNotMatch(api, /company_id: body/)
})

test("no modifica migraciones anteriores ni \/clientes", () => {
  assert.match(sqlPrevious, /isp_commercial_status_from_activation/)
  assert.doesNotMatch(sqlPrevious, /remove_isp_subscriber_membership/)
  assert.match(customersModule, /CustomersModule/)
  assert.doesNotMatch(list, /href: "\/clientes"/)
})
