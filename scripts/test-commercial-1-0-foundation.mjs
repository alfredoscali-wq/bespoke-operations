import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

import {
  COMMERCIAL_OPPORTUNITY_CODE_PREFIX,
  COMMERCIAL_PRIORITY_CODES,
  COMMERCIAL_SOURCE_CODES,
  COMMERCIAL_STATUS_CODES,
  formatCommercialOpportunityCode,
} from "../lib/commercial/catalogs.ts"
import {
  APP_MODULE_KEYS,
  resolveModuleKeyFromPathname,
} from "../lib/roles/app-modules.ts"
import { DEFAULT_COMPANY_AREA_MODULE_VISIBILITY } from "../lib/roles/company-areas.ts"

test("gestion_comercial is registered as app module", () => {
  assert.ok(APP_MODULE_KEYS.includes("gestion_comercial"))
  assert.equal(
    resolveModuleKeyFromPathname("/gestion-comercial"),
    "gestion_comercial"
  )
  assert.equal(
    resolveModuleKeyFromPathname("/gestion-comercial/op-1"),
    "gestion_comercial"
  )
})

test("ventas and administracion default visibility includes comercial", () => {
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.ventas.gestion_comercial,
    true
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.administracion.gestion_comercial,
    true
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.operario.gestion_comercial,
    false
  )
})

test("catalog seeds match sprint 1.0 labels", () => {
  assert.deepEqual([...COMMERCIAL_STATUS_CODES], [
    "nueva",
    "contactada",
    "calificada",
    "propuesta_enviada",
    "negociacion",
    "ganada",
    "perdida",
  ])
  assert.deepEqual([...COMMERCIAL_PRIORITY_CODES], ["alta", "media", "baja"])
  assert.deepEqual([...COMMERCIAL_SOURCE_CODES], [
    "whatsapp",
    "llamada",
    "web",
    "facebook",
    "instagram",
    "referido",
    "sucursal",
    "otro",
  ])
})

test("OP codes pad to six digits and never reuse format", () => {
  assert.equal(formatCommercialOpportunityCode(1), "OP-000001")
  assert.equal(formatCommercialOpportunityCode(12), "OP-000012")
  assert.equal(formatCommercialOpportunityCode(100000), "OP-100000")
  assert.equal(COMMERCIAL_OPPORTUNITY_CODE_PREFIX, "OP-")
})

test("foundation migration seeds catalogs, counters and RLS", async () => {
  const sql = await readFile(
    "supabase/migrations/20261106000100_commercial_1_0_foundation.sql",
    "utf8"
  )

  assert.match(sql, /CREATE TABLE public\.commercial_people/)
  assert.match(sql, /CREATE TABLE public\.commercial_opportunities/)
  assert.match(sql, /CREATE TABLE public\.commercial_statuses/)
  assert.match(sql, /CREATE TABLE public\.commercial_priorities/)
  assert.match(sql, /CREATE TABLE public\.commercial_sources/)
  assert.match(sql, /commercial_opportunity_counters/)
  assert.match(sql, /assign_commercial_opportunity_code/)
  assert.match(sql, /OP-' \|\| lpad/)
  assert.match(sql, /auth_user_has_allowed_module\('gestion_comercial'\)/)
  assert.match(sql, /"gestion_comercial": true/)
  assert.match(sql, /deleted_at/)
  assert.match(sql, /created_by/)
  assert.match(sql, /deleted_by/)
})

test("nav and page surface exist", async () => {
  const nav = await readFile("lib/navigation/nav-items.ts", "utf8")
  const page = await readFile(
    "app/(dashboard)/gestion-comercial/page.tsx",
    "utf8"
  )
  const moduleFile = await readFile(
    "components/gestion-comercial/commercial-module.tsx",
    "utf8"
  )

  assert.match(nav, /gestionComercialNavItem/)
  assert.match(nav, /\/gestion-comercial/)
  assert.match(page, /CommercialModule/)
  assert.match(moduleFile, /Gestión Comercial/)
  assert.match(moduleFile, /Nueva Oportunidad/)
  assert.match(
    moduleFile,
    /Todavía no existen oportunidades comerciales\./
  )
})

test("API CRUD routes and domain services exist", async () => {
  const peopleRoute = await readFile(
    "app/api/gestion-comercial/people/route.ts",
    "utf8"
  )
  const opportunityRoute = await readFile(
    "app/api/gestion-comercial/opportunities/route.ts",
    "utf8"
  )
  const services = await readFile("lib/commercial/services.ts", "utf8")
  const repositories = await readFile(
    "lib/commercial/repositories.ts",
    "utf8"
  )
  const provider = await readFile(
    "components/gestion-comercial/commercial-provider.tsx",
    "utf8"
  )

  assert.match(peopleRoute, /CommercialPeopleService/)
  assert.match(opportunityRoute, /CommercialOpportunityService/)
  assert.match(services, /class CommercialPeopleService/)
  assert.match(services, /class CommercialOpportunityService/)
  assert.match(repositories, /class CommercialPeopleRepository/)
  assert.match(repositories, /class CommercialOpportunityRepository/)
  assert.match(provider, /export function useCommercialPeople/)
  assert.match(provider, /export function useCommercialOpportunities/)
  assert.match(provider, /export function useCreateOpportunity/)
  assert.match(provider, /export function useDeleteOpportunity/)
})
