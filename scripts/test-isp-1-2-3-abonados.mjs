import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { belongsToIspUniverse } from "../lib/isp/integrity.ts"
import { ISP_SUBSCRIBER_NOT_FOUND_MESSAGE } from "../lib/isp/constants.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read("supabase/migrations/20261133000100_isp_1_2_3_abonados_isp.sql")
const queries = read("lib/isp/queries.ts")
const list = [
  read("components/isp/isp-customer-list-screen.tsx"),
  read("components/isp/isp-customer-list-ui.tsx"),
].join("\n")
const detailApi = read("app/api/isp/customers/[id]/route.ts")
const customersModule = read("components/clientes/customers-module.tsx")

test("1. un customer general no aparece en Clientes 360°", () => {
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: false,
      serviceCount: 0,
      connectionCount: 0,
    }),
    false
  )
  assert.match(queries, /from\("isp_subscribers"\)/)
  assert.match(queries, /memberIds\.length === 0/)
  assert.doesNotMatch(
    queries,
    /from\("customers"\)[\s\S]{0,200}order\("name"[\s\S]{0,80}limit\(400\)/
  )
})

test("2. un abonado ISP sin servicios sí aparece", () => {
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: true,
      serviceCount: 0,
      connectionCount: 0,
    }),
    true
  )
  assert.match(queries, /serviceCount: customerServices\.length/)
  assert.doesNotMatch(queries, /if \(customerServices\.length === 0\) continue/)
  assert.doesNotMatch(list, /serviceCount === 0 \? null/)
})

test("3. un abonado ISP con servicio sí aparece", () => {
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: true,
      serviceCount: 1,
      connectionCount: 0,
    }),
    true
  )
})

test("4. un abonado ISP con servicio y conexión sí aparece", () => {
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: true,
      serviceCount: 1,
      connectionCount: 1,
    }),
    true
  )
})

test("5. un cliente general con OT pero sin incorporación ISP no aparece", () => {
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: false,
      hasWorkOrder: true,
      serviceCount: 0,
    }),
    false
  )
  const listFn = queries.slice(
    queries.indexOf("export async function listIspCustomers"),
    queries.indexOf("export async function getIspCustomerDetail")
  )
  assert.doesNotMatch(listFn, /from\("tasks"\)/)
  assert.doesNotMatch(listFn, /work_orders/)
})

test("6. una migración ISP confirmada crea la pertenencia ISP", () => {
  assert.match(sql, /ALTER FUNCTION public\.import_isp_migration\(uuid, boolean\)/)
  assert.match(sql, /RENAME TO import_isp_migration_core/)
  assert.match(sql, /source\)[\s\S]*'migration'/)
  assert.match(sql, /sheet = 'CLIENTES'/)
  assert.match(sql, /ensure_isp_subscriber/)
})

test("7. una migración con solamente ejemplos no crea pertenencias ISP", () => {
  assert.doesNotMatch(sql, /no_real_data[\s\S]{0,200}isp_subscribers/)
  const importWrapper = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.import_isp_migration"))
  assert.match(importWrapper, /import_isp_migration_core/)
  assert.doesNotMatch(sql, /FROM public\.customers[\s\S]{0,120}INSERT INTO public\.isp_subscribers/)
})

test("8. Nuevo Cliente desde Clientes 360° crea pertenencia ISP", () => {
  assert.match(sql, /create_isp_onboarding_core/)
  assert.match(sql, /ensure_isp_subscriber\(v_company_id, v_customer_id, 'onboarding'\)/)
  assert.match(sql, /requiresConfirmation/)
  const wizard = read("components/isp/isp-onboarding-wizard.tsx")
  assert.match(wizard, /\/api\/isp\/onboarding/)
})

test("9. el contador refleja únicamente abonados ISP", () => {
  assert.match(list, /items\.length/)
  assert.match(list, /abonado/)
  assert.match(queries, /from\("isp_subscribers"\)/)
  assert.match(queries, /return \{ customers: \[\], localities: \[\] \}/)
})

test("10. el estado vacío funciona correctamente", () => {
  assert.match(list, /ISP_CUSTOMER_LIST_EMPTY_MESSAGE/)
  assert.match(read("lib/isp/customer-list-load.ts"), /No hay abonados para mostrar/)
  assert.match(queries, /memberIds\.length === 0/)
})

test("11. el detalle no permite un cliente que no pertenece al universo ISP", () => {
  const detailFn = queries.slice(
    queries.indexOf("export async function getIspCustomerDetail")
  )
  assert.match(detailFn, /from\("isp_subscribers"\)/)
  assert.match(detailFn, /if \(!member\) return null/)
  assert.match(detailApi, /ISP_SUBSCRIBER_NOT_FOUND_MESSAGE/)
  assert.equal(ISP_SUBSCRIBER_NOT_FOUND_MESSAGE, "Abonado no encontrado.")
})

test("12. RLS y multi-tenant de isp_subscribers", () => {
  assert.match(sql, /customer_id uuid NOT NULL REFERENCES public\.customers/)
  assert.match(sql, /company_id uuid NOT NULL REFERENCES public\.companies/)
  assert.match(sql, /CONSTRAINT isp_subscribers_company_customer_unique UNIQUE/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /auth_user_company_id\(\)/)
  assert.match(sql, /No se puede incorporar un cliente de otra empresa al universo ISP/)
  assert.match(sql, /auth_can_manage_isp_migration\(\)/)
  assert.doesNotMatch(sql, /DELETE FROM public\.customers/)
  assert.doesNotMatch(sql, /UPDATE public\.customers SET/)
})

test("no infiere pertenencia por DNI, nombre ni OT", () => {
  assert.match(sql, /Never infers membership from name, DNI, phone or address/)
  assert.doesNotMatch(sql, /INSERT INTO public\.isp_subscribers[\s\S]{0,200}FROM public\.customers/)
  assert.match(
    sql,
    /FROM public\.isp_services services/
  )
})

test("no modifica el directorio \/clientes", () => {
  assert.match(customersModule, /CustomersModule/)
  assert.doesNotMatch(sql, /DROP TABLE public\.customers/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.customers/)
})
