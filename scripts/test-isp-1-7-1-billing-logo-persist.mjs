import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  isAllowedBillingLogoFile,
  resolveBillingLogoMimeType,
} from "../lib/isp/billing-integrity.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261146000100_isp_1_7_1_billing_logo_persist.sql"
)
const sql16a = read(
  "supabase/migrations/20261139000100_isp_1_6a_billing_company_settings.sql"
)
const logoApi = read("app/api/isp/billing/logo/route.ts")
const queries = read("lib/isp/billing-queries.ts")
const screen = read("components/isp/isp-billing-settings-screen.tsx")
const preview = read("lib/isp/billing-document-template.ts")
const pdfApi = read("app/api/isp/billing/documents/[id]/pdf/route.ts")

test("el selector de archivo no es la fuente de verdad del logo", () => {
  assert.match(screen, /type="file"/)
  assert.match(screen, /draft\.logoUrl/)
  assert.match(screen, /alt="Logo de la empresa facturadora"/)
  assert.match(screen, /JSON\.stringify\(draftRef\.current\)/)
})

test("Windows puede enviar file.type vacío y se infiere por extensión", () => {
  assert.equal(
    resolveBillingLogoMimeType({ mimeType: "", fileName: "marca.png" }),
    "image/png"
  )
  assert.equal(
    resolveBillingLogoMimeType({ mimeType: "", fileName: "marca.JPG" }),
    "image/jpeg"
  )
  assert.equal(
    isAllowedBillingLogoFile({
      mimeType: "",
      fileName: "logo.webp",
      size: 1200,
    }),
    true
  )
  assert.equal(
    isAllowedBillingLogoFile({
      mimeType: "",
      fileName: "logo.gif",
      size: 1200,
    }),
    false
  )
  assert.match(logoApi, /resolveBillingLogoMimeType/)
  assert.match(logoApi, /file\.name/)
})

test("el upload persiste logo_url y usa Storage con cliente admin", () => {
  assert.match(logoApi, /createAdminClient/)
  assert.match(logoApi, /ISP_BILLING_LOGO_BUCKET/)
  assert.match(logoApi, /getPublicUrl/)
  assert.match(logoApi, /update\(\{ logo_url: url \}\)/)
  assert.match(queries, /!payload\.logo_url && current\?\.logoUrl/)
  assert.match(logoApi, /eq\("company_id", auth\.companyId\)/)
  assert.match(sql16a, /isp-billing-logos/)
  assert.match(sql, /isp_billing_logos_public_read/)
  assert.match(sql, /SET\s+public = true/)
})

test("guardar espera el upload y no pisa el draft con un File local", () => {
  assert.match(screen, /uploadingLogo/)
  assert.match(screen, /disabled=\{!canWrite \|\| saving \|\| uploadingLogo\}/)
  assert.match(screen, /Esperá a que termine de subirse el logo/)
  assert.match(screen, /patch\("logoUrl", body\.url\)/)
  assert.match(screen, /JSON\.stringify\(draftRef\.current\)/)
})

test("preview y PDF siguen leyendo logo_url de la empresa / snapshot", () => {
  assert.match(preview, /logoUrl: input\.draft\.logoUrl/)
  assert.match(pdfApi, /issuerLogoUrlSnapshot/)
  assert.doesNotMatch(logoApi, /issuer_logo_url_snapshot/)
  assert.doesNotMatch(sql, /isp_billing_documents/)
})
