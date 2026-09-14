/**
 * Bespoke Mobile — POST /api/mobile/v1/bootstrap contract.
 * Source-contract + in-memory lookup. Does not hit a live database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { mapMobileBootstrapResponse } from "../lib/mobile/v1/bootstrap/map-bootstrap-response.ts"
import { validateMobileBootstrapRequest } from "../lib/mobile/v1/bootstrap/validate-bootstrap-request.ts"
import { MobileApiError } from "../lib/mobile/v1/errors.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const route = read("app/api/mobile/v1/bootstrap/route.ts")
const service = read("lib/mobile/v1/bootstrap/bootstrap-service.ts")
const validate = read("lib/mobile/v1/bootstrap/validate-bootstrap-request.ts")
const errors = read("lib/mobile/v1/errors.ts")
const routing = read("lib/mobile/v1/routing.ts")
const types = read("lib/supabase/database.types.ts")
const migration = read("supabase/migrations/20261222000100_company_branding.sql")
const docs = read("docs/mobile-api.md")

function findActiveCompanyByMobileCode(companies, rawCode) {
  const normalized =
    typeof rawCode === "string" ? rawCode.trim().toLowerCase() : ""
  if (!normalized) {
    return null
  }
  return (
    companies.find((company) => {
      if (company.deleted_at != null) {
        return false
      }
      const stored =
        typeof company.mobile_code === "string"
          ? company.mobile_code.trim().toLowerCase()
          : ""
      return stored !== "" && stored === normalized
    }) ?? null
  )
}

function findBrandingForCompany(brandingRows, companyId) {
  return brandingRows.find((row) => row.company_id === companyId) ?? null
}

function findSettingsForCompany(settingsRows, companyId) {
  return settingsRows.find((row) => row.company_id === companyId) ?? null
}

function bootstrapForCode(companies, brandingRows, rawCode, settingsRows = []) {
  const company = findActiveCompanyByMobileCode(companies, rawCode)
  if (!company) {
    return null
  }
  return mapMobileBootstrapResponse({
    companyId: company.id,
    companyName: company.name,
    branding: findBrandingForCompany(brandingRows, company.id),
    operations: findSettingsForCompany(settingsRows, company.id),
  })
}

const ABNET = {
  id: "co-abnet",
  name: "ABNet",
  mobile_code: "abnet",
  deleted_at: null,
}

const OTHER = {
  id: "co-other",
  name: "Otra",
  mobile_code: "otra",
  deleted_at: null,
}

const ABNET_BRANDING = {
  company_id: "co-abnet",
  logo_url: "https://cdn.example.com/abnet.png",
  primary_color: "#023166",
  secondary_color: "#0694DA",
}

const OTHER_BRANDING = {
  company_id: "co-other",
  logo_url: "https://cdn.example.com/otra.png",
  primary_color: "#111111",
  secondary_color: "#222222",
}

test("ruta pública POST bootstrap, sin Bearer/JWT", () => {
  assert.match(route, /handlePublicMobileRoute/)
  assert.doesNotMatch(route, /handleProtectedMobileRoute/)
  assert.doesNotMatch(route, /Authorization/)
  assert.doesNotMatch(route, /getUser/)
  assert.doesNotMatch(service, /resolveMobileAuthFromAccessToken/)
  assert.match(routing, /\/bootstrap/)
})

test("A. empresa válida devuelve companyId y companyName", () => {
  const data = bootstrapForCode([ABNET], [], "ABNET")
  assert.equal(data.companyId, "co-abnet")
  assert.equal(data.companyName, "ABNet")
  assert.match(service, /\.select\("id, name"\)/)
  assert.match(service, /companyId: data\.id/)
  assert.match(service, /companyName: data\.name/)
})

test("B. empresa con branding devuelve logoUrl, primaryColor y secondaryColor", () => {
  const data = bootstrapForCode([ABNET], [ABNET_BRANDING], "ABNET")
  assert.deepEqual(data.branding, {
    logoUrl: "https://cdn.example.com/abnet.png",
    primaryColor: "#023166",
    secondaryColor: "#0694DA",
  })
  assert.match(service, /from\("company_branding"\)/)
  assert.match(service, /\.select\("logo_url, primary_color, secondary_color"\)/)
  assert.match(docs, /"logoUrl"/)
  assert.match(docs, /"primaryColor"/)
  assert.match(docs, /"secondaryColor"/)
})

test("C. empresa sin branding devuelve nulls", () => {
  const data = bootstrapForCode([ABNET], [], "ABNET")
  assert.deepEqual(data.branding, {
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
  })
  assert.deepEqual(
    mapMobileBootstrapResponse({
      companyId: "co-abnet",
      companyName: "ABNet",
      branding: null,
    }).branding,
    { logoUrl: null, primaryColor: null, secondaryColor: null }
  )
  assert.doesNotMatch(service, /getAppLogoSrc/)
  assert.doesNotMatch(service, /resolveAppBrandId/)
  assert.doesNotMatch(service, /ABNET_LOGO/)
  assert.doesNotMatch(service, /#023166/)
})

test("D. branding pertenece exactamente al tenant resuelto", () => {
  const data = bootstrapForCode(
    [ABNET, OTHER],
    [ABNET_BRANDING, OTHER_BRANDING],
    "ABNET"
  )
  assert.equal(data.companyId, "co-abnet")
  assert.equal(data.branding.logoUrl, "https://cdn.example.com/abnet.png")
  assert.notEqual(data.branding.logoUrl, OTHER_BRANDING.logo_url)
  assert.match(service, /\.eq\("company_id", data\.id\)/)
  assert.doesNotMatch(service, /isp_billing_company_settings/)
  assert.doesNotMatch(service, /from\("employees"\)/)
})

test("E. empresa soft-deleted → 404 COMPANY_NOT_FOUND", () => {
  const data = bootstrapForCode(
    [
      {
        ...ABNET,
        deleted_at: "2026-01-01T00:00:00Z",
      },
    ],
    [ABNET_BRANDING],
    "ABNET"
  )
  assert.equal(data, null)
  assert.match(service, /\.is\("deleted_at", null\)/)
  assert.match(service, /COMPANY_NOT_FOUND/)
  assert.match(errors, /Empresa no encontrada/)
})

test("F. código inválido → 404 COMPANY_NOT_FOUND", () => {
  const data = bootstrapForCode([ABNET], [ABNET_BRANDING], "OTRA")
  assert.equal(data, null)
  assert.match(service, /COMPANY_NOT_FOUND/)
  assert.match(service, /,\s*404/)
  assert.match(errors, /"COMPANY_NOT_FOUND"/)
})

test("G. case-insensitive y trim siguen funcionando", () => {
  assert.equal(validateMobileBootstrapRequest({ companyCode: "ABNET" }).companyCode, "abnet")
  assert.equal(validateMobileBootstrapRequest({ companyCode: "abnet" }).companyCode, "abnet")
  assert.equal(
    validateMobileBootstrapRequest({ companyCode: "  ABNET  " }).companyCode,
    "abnet"
  )
  assert.match(validate, /trim\(\)\.toLowerCase\(\)/)
  assert.match(service, /\.eq\("mobile_code", companyCode\)/)
})

test("H. companyId del cliente no selecciona tenant", () => {
  const parsed = validateMobileBootstrapRequest({
    companyCode: "ABNET",
    companyId: "00000000-0000-4000-8000-000000000002",
    slug: "bespoke-operations",
  })
  assert.deepEqual(parsed, { companyCode: "abnet" })
  const mixed = bootstrapForCode(
    [ABNET, OTHER],
    [ABNET_BRANDING, OTHER_BRANDING],
    "ABNET"
  )
  assert.equal(mixed.companyId, "co-abnet")
  assert.notEqual(mixed.companyId, "00000000-0000-4000-8000-000000000002")
  assert.doesNotMatch(service, /record\.companyId/)
  assert.doesNotMatch(service, /body\.companyId/)
  assert.doesNotMatch(service, /\.eq\("id"/)
  assert.doesNotMatch(service, /\.eq\("slug"/)
  assert.doesNotMatch(validate, /companyId/)
  assert.doesNotMatch(validate, /slug/)
})

test("I. no hay fallback a BESPOKE_PRODUCTION_COMPANY_ID", () => {
  assert.doesNotMatch(service, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(service, /resolveTenantCompanyId/)
  assert.doesNotMatch(route, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(validate, /BESPOKE_PRODUCTION_COMPANY_ID/)
})

test("bootstrap no expone fiscal, empleados, módulos ni select *", () => {
  assert.doesNotMatch(service, /\.select\(\s*"\*"/)
  assert.match(service, /\.maybeSingle\(\)/)
  assert.doesNotMatch(service, /module/)
  assert.doesNotMatch(service, /employees/)
  assert.doesNotMatch(service, /cuit/)
  assert.doesNotMatch(service, /tax_id/)
  assert.doesNotMatch(service, /isp_billing/)
  assert.doesNotMatch(service, /presence_engine_settings/)
  assert.doesNotMatch(service, /TASK_START_/)
  assert.doesNotMatch(service, /shift-service/)
  assert.doesNotMatch(service, /\.insert\(/)
  assert.doesNotMatch(service, /\.upsert\(/)
})

test("operations se consulta solo tras resolver el tenant y sin mutar DB", () => {
  const notFoundAt = service.indexOf("COMPANY_NOT_FOUND")
  const settingsAt = service.indexOf('from("company_mobile_settings")')
  const deletedAt = service.indexOf('.is("deleted_at", null)')
  assert.ok(notFoundAt > 0 && settingsAt > notFoundAt)
  assert.ok(deletedAt > 0 && deletedAt < settingsAt)
  assert.match(service, /\.eq\("company_id", data\.id\)/)
  const data = bootstrapForCode([ABNET], [], "ABNET")
  assert.deepEqual(data.operations, {
    shiftLocationValidationEnabled: false,
    shiftRadiusMeters: 150,
    taskLocationValidationEnabled: false,
    taskRadiusMeters: 150,
    gpsHeartbeatEnabled: true,
    gpsHeartbeatIntervalSeconds: 60,
  })
})

test("migración company_branding: 1:1, nullable, sin binarios, sin billing", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.company_branding/)
  assert.match(migration, /company_id uuid PRIMARY KEY REFERENCES public\.companies/)
  assert.match(migration, /logo_url text/)
  assert.match(migration, /primary_color text/)
  assert.match(migration, /secondary_color text/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /auth_user_company_id\(\)/)
  assert.match(migration, /\^#\[0-9A-Fa-f\]\{6\}\$/)
  assert.doesNotMatch(migration, /bytea/)
  assert.doesNotMatch(migration, /ALTER TABLE public\.isp_billing/)
  assert.doesNotMatch(migration, /FROM public\.isp_billing/)
  assert.doesNotMatch(migration, /ALTER COLUMN logo_url SET NOT NULL/)
  assert.doesNotMatch(migration, /ALTER COLUMN primary_color SET NOT NULL/)
  assert.match(types, /company_branding:/)
  assert.match(types, /logo_url: string \| null/)
})

test("sin companyCode → INVALID_REQUEST", () => {
  assert.throws(
    () => validateMobileBootstrapRequest({}),
    (error) =>
      error instanceof MobileApiError &&
      error.code === "INVALID_REQUEST" &&
      error.status === 400
  )
})

test("companyCode vacío → INVALID_REQUEST", () => {
  assert.throws(
    () => validateMobileBootstrapRequest({ companyCode: "   " }),
    (error) =>
      error instanceof MobileApiError &&
      error.code === "INVALID_REQUEST" &&
      error.status === 400
  )
  assert.throws(
    () => validateMobileBootstrapRequest({ companyCode: "" }),
    (error) => error instanceof MobileApiError && error.status === 400
  )
})

test("envelope y métodos: POST 200 / GET 405", () => {
  assert.match(route, /mobileApiSuccessResponse\(context, data\)/)
  assert.match(route, /Método no permitido/)
  assert.match(route, /,\s*405/)
})
