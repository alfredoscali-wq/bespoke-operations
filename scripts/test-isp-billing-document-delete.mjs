import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_BILLING_DOCUMENT_DELETE_CONFIRM_DESCRIPTION,
  ISP_BILLING_DOCUMENT_DELETE_CONFIRM_TITLE,
  ISP_BILLING_DOCUMENT_DELETE_FORBIDDEN,
  ISP_BILLING_DOCUMENT_DELETED_MESSAGE,
} from "../lib/isp/billing-constants.ts"
import {
  canAccessIspBilling,
  canDeleteIspBillingDocument,
} from "../lib/isp/permissions.ts"
import {
  canAccessPathWithModules,
  createEmptyModuleVisibility,
} from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261148000100_isp_billing_document_soft_delete.sql"
)
const queries = read("lib/isp/billing-document-queries.ts")
const api = read("app/api/isp/billing/documents/[id]/route.ts")
const routeContext = read("lib/isp/route-context.ts")
const permissions = read("lib/isp/permissions.ts")
const listScreen = read("components/isp/isp-billing-documents-list-screen.tsx")
const typesFile = read("lib/isp/billing-document-types.ts")
const databaseTypes = read("lib/supabase/database.types.ts")

const listFn = queries.slice(
  queries.indexOf("export async function listIspBillingDocuments"),
  queries.indexOf("export async function createIspBillingDocument")
)

const adminUser = {
  systemRole: "administrador",
  roleCode: "administrador",
  moduleVisibility: {},
}
const operatorUser = {
  systemRole: "operario",
  roleCode: "operario",
  moduleVisibility: createEmptyModuleVisibility(),
}
const billingOperator = {
  systemRole: "operario",
  roleCode: "operario",
  moduleVisibility: {
    ...createEmptyModuleVisibility(),
    facturacion: true,
  },
}

test("1. Administrador puede eliminar comprobante", () => {
  assert.equal(canDeleteIspBillingDocument(adminUser), true)
  assert.match(permissions, /canDeleteIspBillingDocument/)
  assert.match(permissions, /isAdministradorSessionUser/)
  assert.match(sql, /auth_is_administrador\(\)/)
  assert.match(sql, /soft_delete_isp_billing_document/)
  assert.match(sql, /SET\s+deleted_at = now\(\)/)
  assert.match(api, /requireIspBillingAdminContext/)
  assert.match(api, /deleteIspBillingDocument/)
  assert.match(api, /export async function DELETE/)
  assert.match(routeContext, /requireIspBillingAdminContext/)
  assert.match(listScreen, /canDeleteIspBillingDocument/)
  assert.match(listScreen, /Trash2/)
  assert.match(listScreen, /Eliminar/)
  assert.match(listScreen, /ISP_BILLING_DOCUMENT_DELETE_CONFIRM_TITLE/)
  assert.match(listScreen, /method: "DELETE"/)
})

test("2. Usuario no administrador no puede eliminar", () => {
  assert.equal(canDeleteIspBillingDocument(operatorUser), false)
  assert.equal(canDeleteIspBillingDocument(billingOperator), false)
  assert.equal(canAccessIspBilling(billingOperator), true)
  assert.match(sql, /Solo un administrador puede eliminar comprobantes/)
  assert.match(routeContext, /ISP_BILLING_DOCUMENT_DELETE_FORBIDDEN/)
  assert.match(routeContext, /status: 403/)
  assert.match(listScreen, /canDelete \? \(/)
  assert.equal(
    ISP_BILLING_DOCUMENT_DELETE_FORBIDDEN,
    "Solo un administrador puede eliminar comprobantes."
  )
})

test("3. Comprobante eliminado no aparece en el listado", () => {
  assert.match(sql, /deleted_at IS NULL/)
  assert.match(listFn, /\.is\("deleted_at", null\)/)
  assert.doesNotMatch(sql, /DELETE FROM public\.isp_billing_documents/)
  assert.match(typesFile, /"deleted"/)
  assert.match(sql, /event_type.*deleted/)
})

test("4. No puede eliminarse un comprobante de otra empresa", () => {
  assert.match(sql, /company_id = v_company_id/)
  assert.match(sql, /AND company_id = v_company_id/)
  assert.match(sql, /public\.auth_user_company_id\(\)/)
  assert.match(queries, /soft_delete_isp_billing_document/)
  assert.match(databaseTypes, /soft_delete_isp_billing_document/)
})

test("confirmación y mensajes de eliminación", () => {
  assert.equal(
    ISP_BILLING_DOCUMENT_DELETE_CONFIRM_TITLE,
    "¿Eliminar comprobante?"
  )
  assert.equal(
    ISP_BILLING_DOCUMENT_DELETE_CONFIRM_DESCRIPTION,
    "El comprobante quedará eliminado y no aparecerá en el listado."
  )
  assert.equal(
    ISP_BILLING_DOCUMENT_DELETED_MESSAGE,
    "El comprobante fue eliminado."
  )
  assert.match(listScreen, /Cancelar/)
  assert.match(listScreen, /variant="destructive"/)
})

test("facturación accesible sin permiso de eliminar", () => {
  const billingOnly = {
    ...createEmptyModuleVisibility(),
    facturacion: true,
  }
  assert.equal(canAccessPathWithModules("/facturacion/comprobantes", billingOnly), true)
  assert.equal(canDeleteIspBillingDocument(billingOperator), false)
})
