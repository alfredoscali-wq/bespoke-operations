import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  applyTechnicalProfileToCatalogDraft,
  buildOtPlanOptionsFromCatalog,
  catalogItemToDraft,
  didCopyDownloadSpeedToUpload,
  emptyCatalogDraft,
  formatCatalogSpeed,
  formatCatalogSpeedLabel,
  formatCatalogSpeedValue,
  looksLikeAutoCopiedSymmetricUpload,
  snapshotServiceFromCatalog,
  validateCatalogDraft,
  withIndependentDownloadSpeed,
  withIndependentUploadSpeed,
} from "../lib/isp/catalog-integrity.ts"
import { mapCatalogDraftToInsert } from "../lib/isp/catalog-mapper.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function sampleProfile(overrides = {}) {
  return {
    id: "prof-100",
    companyId: "co-1",
    code: "FTTH-100",
    name: "Perfil FTTH 100 Mb",
    description: null,
    technology: "ftth",
    connectionType: "pppoe",
    downloadSpeed: 100,
    uploadSpeed: 25,
    speedUnit: "mbps",
    coreName: "MikroTik",
    coreProfileId: "FTTH-100",
    isActive: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  }
}

function sampleItem(overrides = {}) {
  return {
    id: "cat-100",
    companyId: "co-1",
    code: "FTTH-100",
    name: "Internet Fibra 100 Mb",
    category: "internet",
    customerType: "residential",
    description: null,
    isActive: true,
    technology: "ftth",
    downloadSpeedMbps: 100,
    uploadSpeedMbps: 25,
    speedUnit: "mbps",
    monthlyPrice: 25000,
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: ["pppoe"],
    technicalProfileId: "prof-100",
    technicalProfile: sampleProfile(),
    otLabel: "100 Mb",
    legacyPlanCode: "100Mb",
    isSeed: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    usedCount: 1,
    ...overrides,
  }
}

function draft(overrides = {}) {
  return {
    ...emptyCatalogDraft(),
    code: "FTTH-100",
    name: "Internet Fibra 100 Mb",
    technology: "ftth",
    downloadSpeedMbps: "100",
    uploadSpeedMbps: "25",
    monthlyPrice: "25000",
    allowedConnectionTypes: ["pppoe"],
    technicalProfileId: "prof-100",
    ...overrides,
  }
}

test("1. guardar 100/25", () => {
  const saved = draft({ downloadSpeedMbps: "100", uploadSpeedMbps: "25" })
  assert.equal(validateCatalogDraft(saved).valid, true)
  const insert = mapCatalogDraftToInsert("co-1", saved, "prof-100")
  assert.equal(insert.download_speed_mbps, 100)
  assert.equal(insert.upload_speed_mbps, 25)
  assert.equal(
    didCopyDownloadSpeedToUpload({
      download: insert.download_speed_mbps,
      upload: insert.upload_speed_mbps,
      copiedAutomatically: false,
    }),
    false
  )
})

test("2. mostrar 100/25", () => {
  assert.equal(formatCatalogSpeed(100, 25, "mbps"), "100/25 Mbps")
  assert.equal(formatCatalogSpeedLabel(sampleItem()), "100/25 Mbps")
})

test("3. editar bajada sin modificar subida", () => {
  const edited = withIndependentDownloadSpeed(draft(), "300")
  assert.equal(edited.downloadSpeedMbps, "300")
  assert.equal(edited.uploadSpeedMbps, "25")
  const insert = mapCatalogDraftToInsert("co-1", edited, "prof-100")
  assert.equal(insert.download_speed_mbps, 300)
  assert.equal(insert.upload_speed_mbps, 25)
})

test("4. editar subida sin modificar bajada", () => {
  const afterDownload = withIndependentDownloadSpeed(draft(), "300")
  const edited = withIndependentUploadSpeed(afterDownload, "50")
  assert.equal(edited.downloadSpeedMbps, "300")
  assert.equal(edited.uploadSpeedMbps, "50")
  const insert = mapCatalogDraftToInsert("co-1", edited, "prof-100")
  assert.equal(insert.download_speed_mbps, 300)
  assert.equal(insert.upload_speed_mbps, 50)
})

test("5. guardar velocidades simétricas", () => {
  const saved = draft({ downloadSpeedMbps: "100", uploadSpeedMbps: "100" })
  assert.equal(validateCatalogDraft(saved).valid, true)
  const insert = mapCatalogDraftToInsert("co-1", saved, "prof-100")
  assert.equal(insert.download_speed_mbps, 100)
  assert.equal(insert.upload_speed_mbps, 100)
})

test("6. guardar velocidades asimétricas", () => {
  const saved = draft({ downloadSpeedMbps: "20", uploadSpeedMbps: "5" })
  assert.equal(validateCatalogDraft(saved).valid, true)
  const insert = mapCatalogDraftToInsert("co-1", saved, "prof-100")
  assert.equal(insert.download_speed_mbps, 20)
  assert.equal(insert.upload_speed_mbps, 5)
  assert.notEqual(insert.upload_speed_mbps, insert.download_speed_mbps)
})

test("7. perfil técnico conserva 100/25", () => {
  const profile = sampleProfile({ downloadSpeed: 100, uploadSpeed: 25 })
  const next = applyTechnicalProfileToCatalogDraft(
    draft({
      downloadSpeedMbps: "",
      uploadSpeedMbps: "",
      allowedConnectionTypes: [],
    }),
    profile
  )
  assert.equal(next.downloadSpeedMbps, "100")
  assert.equal(next.uploadSpeedMbps, "25")
  assert.equal(next.technicalProfile.downloadSpeed, "100")
  assert.equal(next.technicalProfile.uploadSpeed, "25")
  assert.equal(
    didCopyDownloadSpeedToUpload({
      download: 100,
      upload: 25,
      copiedAutomatically: true,
    }),
    false
  )
})

test("8. listado muestra 100/25", () => {
  assert.equal(formatCatalogSpeedLabel(sampleItem()), "100/25 Mbps")
  const list = read("components/isp/isp-catalog-list-screen.tsx")
  assert.match(list, /formatCatalogSpeedLabel/)
  assert.match(list, />Velocidad</)
})

test("9. detalle muestra 100/25", () => {
  const item = sampleItem()
  assert.equal(
    formatCatalogSpeedValue(item.downloadSpeedMbps, item.speedUnit),
    "100 Mbps"
  )
  assert.equal(
    formatCatalogSpeedValue(item.uploadSpeedMbps, item.speedUnit),
    "25 Mbps"
  )
  const detail = read("components/isp/isp-catalog-detail-screen.tsx")
  assert.match(detail, /Velocidad de bajada/)
  assert.match(detail, /Velocidad de subida/)
  assert.match(detail, /label="Bajada"/)
  assert.match(detail, /label="Subida"/)
  assert.match(detail, /profile\.downloadSpeed/)
  assert.match(detail, /profile\.uploadSpeed/)
})

test("10. OT continúa utilizando el servicio correctamente", () => {
  const options = buildOtPlanOptionsFromCatalog([sampleItem()], "fiber")
  assert.equal(options.length, 1)
  assert.equal(options[0].catalogId, "cat-100")
  assert.equal(options[0].downloadSpeedMbps, 100)
  const snapshot = snapshotServiceFromCatalog(sampleItem())
  assert.equal(snapshot.catalogId, "cat-100")
  assert.equal(snapshot.contractedSpeed, "100/25 Mbps")
  const otPlans = read("app/api/isp/catalog/ot-plans/route.ts")
  assert.match(otPlans, /listIspCatalogForOt/)
  assert.doesNotMatch(otPlans, /upload_speed_mbps/)
})

test("no copia bajada en subida al guardar un campo vacío", () => {
  const saved = draft({ downloadSpeedMbps: "100", uploadSpeedMbps: "" })
  assert.equal(validateCatalogDraft(saved).valid, true)
  const insert = mapCatalogDraftToInsert("co-1", saved, "prof-100")
  assert.equal(insert.download_speed_mbps, 100)
  assert.equal(insert.upload_speed_mbps, null)
  assert.notEqual(insert.upload_speed_mbps, insert.download_speed_mbps)
})

test("un perfil sin subida no inventa subida = bajada", () => {
  const next = applyTechnicalProfileToCatalogDraft(
    draft({ downloadSpeedMbps: "100", uploadSpeedMbps: "" }),
    sampleProfile({ downloadSpeed: 100, uploadSpeed: null })
  )
  assert.equal(next.downloadSpeedMbps, "100")
  assert.equal(next.uploadSpeedMbps, "")
})

test("editar el catálogo no pierde la subida del draft", () => {
  const current = catalogItemToDraft(sampleItem())
  assert.equal(current.downloadSpeedMbps, "100")
  assert.equal(current.uploadSpeedMbps, "25")
  const edited = withIndependentDownloadSpeed(current, "300")
  assert.equal(edited.uploadSpeedMbps, "25")
})

test("listado no muestra solo la bajada cuando falta la subida", () => {
  assert.equal(
    formatCatalogSpeedLabel(
      sampleItem({ uploadSpeedMbps: null, technicalProfile: sampleProfile({ uploadSpeed: null }) })
    ),
    "100/— Mbps"
  )
})

test("simetría auto-copiada queda identificable y no se asume correcta", () => {
  assert.equal(
    looksLikeAutoCopiedSymmetricUpload({ download: 100, upload: 100 }),
    true
  )
  assert.equal(
    looksLikeAutoCopiedSymmetricUpload({ download: 100, upload: 25 }),
    false
  )
  const sql = read(
    "supabase/migrations/20261135000100_isp_1_3_1_hotfix_velocidades.sql"
  )
  assert.match(sql, /upload_speed_mbps = NULL/)
  assert.match(sql, /upload_speed = NULL/)
  assert.match(sql, /FTTH-50/)
  assert.match(sql, /FTTH-100/)
  assert.match(sql, /FTTH-300/)
  assert.doesNotMatch(sql, /SET upload_speed_mbps = download_speed_mbps/)
  assert.doesNotMatch(sql, /SET upload_speed = download_speed/)
  assert.doesNotMatch(sql, /monthly_price\s*=/)
  assert.doesNotMatch(sql, /50\/10|100\/25|300\/50/)
  assert.doesNotMatch(sql, /technology\s*=/)
  assert.doesNotMatch(sql, /allowed_connection_types/)
})

test("el formulario no sincroniza bajada con subida", () => {
  const form = read("components/isp/isp-catalog-form-screen.tsx")
  assert.match(form, /update\("downloadSpeedMbps"/)
  assert.match(form, /update\("uploadSpeedMbps"/)
  assert.doesNotMatch(
    form,
    /uploadSpeedMbps:\s*(current\.)?downloadSpeedMbps/
  )
  assert.doesNotMatch(
    form,
    /technicalProfile\.uploadSpeed:\s*(current\.)?downloadSpeedMbps/
  )
})
