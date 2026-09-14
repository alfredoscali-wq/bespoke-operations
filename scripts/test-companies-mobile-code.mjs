/**
 * Bespoke Mobile — companies.mobile_code contract.
 *
 * Source-contract + in-memory lookup semantics matching the migration.
 * Does not hit a live database and does not create a production helper.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migration = read(
  "supabase/migrations/20261221000100_companies_mobile_code.sql"
)
const types = read("lib/supabase/database.types.ts")

function normalizeMobileCode(raw) {
  if (typeof raw !== "string") {
    return null
  }
  const trimmed = raw.trim().toLowerCase()
  return trimmed === "" ? null : trimmed
}

function findActiveCompanyByMobileCode(companies, rawCode) {
  const normalized = normalizeMobileCode(rawCode)
  if (!normalized) {
    return null
  }
  const needle = normalized.toLowerCase()
  return (
    companies.find((company) => {
      if (company.deleted_at != null) {
        return false
      }
      const stored = normalizeMobileCode(company.mobile_code)
      return stored != null && stored.toLowerCase() === needle
    }) ?? null
  )
}

function uniqueLowerMobileCodes(companies) {
  const seen = new Set()
  for (const company of companies) {
    const stored = normalizeMobileCode(company.mobile_code)
    if (stored == null) {
      continue
    }
    const key = stored.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
  }
  return true
}

test("migración: agrega mobile_code nullable sin backfill", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS mobile_code text/)
  assert.doesNotMatch(migration, /SET mobile_code\s*=/)
  assert.doesNotMatch(migration, /UPDATE public\.companies/)
  assert.doesNotMatch(migration, /ALTER COLUMN mobile_code SET NOT NULL/)
  assert.doesNotMatch(migration, /\bslug\b.*=/)
  assert.doesNotMatch(migration, /DROP COLUMN/)
})

test("migración: unique case-insensitive y múltiples NULL permitidos", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX companies_mobile_code_lower_uidx/
  )
  assert.match(migration, /lower\(mobile_code\)/)
  assert.match(migration, /WHERE mobile_code IS NOT NULL/)
})

test("migración: no es UUID, recorta espacios y guarda lowercase", () => {
  assert.match(migration, /normalize_companies_mobile_code/)
  assert.match(migration, /NULLIF\(lower\(BTRIM\(NEW\.mobile_code\)\), ''\)/)
  assert.match(migration, /mobile_code !~\* '\^\[0-9a-f\]\{8\}-/)
  assert.match(migration, /mobile_code !~ '\\s'/)
})

test("tipos: companies.mobile_code es string | null", () => {
  const companiesBlockStart = types.indexOf("      companies: {")
  assert.notEqual(companiesBlockStart, -1)
  const companiesBlock = types.slice(
    companiesBlockStart,
    types.indexOf("      company_roles: {", companiesBlockStart)
  )
  assert.match(companiesBlock, /mobile_code: string \| null/)
  assert.match(companiesBlock, /mobile_code\?: string \| null/)
})

test("A. dos empresas no pueden tener el mismo mobile_code", () => {
  const companies = [
    { id: "a", mobile_code: "ACME", deleted_at: null },
    { id: "b", mobile_code: "acme", deleted_at: null },
  ]
  assert.equal(uniqueLowerMobileCodes(companies), false)
  assert.match(migration, /CREATE UNIQUE INDEX companies_mobile_code_lower_uidx/)
})

test("B. el lookup es case-insensitive", () => {
  const companies = [
    { id: "a", mobile_code: "AcMe", deleted_at: null },
  ]
  assert.equal(findActiveCompanyByMobileCode(companies, "acme")?.id, "a")
  assert.equal(findActiveCompanyByMobileCode(companies, " ACME ")?.id, "a")
})

test("C. un código inexistente no encuentra empresa", () => {
  const companies = [
    { id: "a", mobile_code: "ACME", deleted_at: null },
  ]
  assert.equal(findActiveCompanyByMobileCode(companies, "OTRA"), null)
  assert.equal(findActiveCompanyByMobileCode(companies, ""), null)
  assert.equal(findActiveCompanyByMobileCode(companies, "   "), null)
})

test("D. deleted_at != NULL no es válida para bootstrap", () => {
  const companies = [
    {
      id: "a",
      mobile_code: "ACME",
      deleted_at: "2026-01-01T00:00:00Z",
    },
  ]
  assert.equal(findActiveCompanyByMobileCode(companies, "ACME"), null)
})

test("E. NULL puede existir para empresas todavía no configuradas", () => {
  const companies = [
    { id: "a", mobile_code: null, deleted_at: null },
    { id: "b", mobile_code: null, deleted_at: null },
    { id: "c", mobile_code: "ACME", deleted_at: null },
  ]
  assert.equal(uniqueLowerMobileCodes(companies), true)
  assert.equal(findActiveCompanyByMobileCode(companies, "ACME")?.id, "c")
})

test("lookup no acepta companyId ni fallback de tenant", () => {
  assert.doesNotMatch(migration, /resolveTenantCompanyId/)
  assert.doesNotMatch(migration, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(types, /mobile_code[\s\S]{0,80}BESPOKE_PRODUCTION_COMPANY_ID/)
  const companies = [
    {
      id: "00000000-0000-4000-8000-000000000002",
      mobile_code: "ACME",
      deleted_at: null,
    },
  ]
  assert.equal(
    findActiveCompanyByMobileCode(
      companies,
      "00000000-0000-4000-8000-000000000002"
    ),
    null
  )
})

test("migración sprint 1 no incluye bootstrap", () => {
  assert.doesNotMatch(migration, /\/api\/mobile\/v1\/bootstrap/)
  assert.doesNotMatch(types, /findActiveCompanyByMobileCode/)
})
