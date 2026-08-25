import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { ISP_CATALOG_SEED_ITEMS } from "../lib/isp/catalog-constants.ts"
import {
  applyTechnicalProfileToCatalogDraft,
  assertCatalogCodeUnique,
  assertTechnicalProfileForCatalog,
  buildOtPlanOptionsFromCatalog,
  canPhysicallyDeleteCatalogItem,
  catalogItemToDraft,
  emptyCatalogDraft,
  filterCatalogItemsForOt,
  findCatalogItemByCommercialCode,
  isCatalogItemVisibleInNewOt,
  mapCatalogWriteError,
  objectHasSubscriberNetworkFields,
  snapshotServiceFromCatalog,
  validateCatalogDraft,
  validateTechnicalProfileDraft,
} from "../lib/isp/catalog-integrity.ts"
import { mapCatalogDraftToInsert } from "../lib/isp/catalog-mapper.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read("supabase/migrations/20261134000100_isp_1_3_perfiles_tecnicos.sql")

function sampleProfile(overrides = {}) {
  return {
    id: "prof-100",
    companyId: "co-1",
    code: "FTTH-100",
    name: "Perfil FTTH 100 Mb",
    description: "Referencia",
    technology: "ftth",
    connectionType: "pppoe",
    downloadSpeed: 100,
    uploadSpeed: 100,
    speedUnit: "mbps",
    coreName: "MikroTik",
    coreProfileId: "FTTH-100",
    isActive: true,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
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
    uploadSpeedMbps: 100,
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
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
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
    uploadSpeedMbps: "100",
    monthlyPrice: "25000",
    allowedConnectionTypes: ["pppoe"],
    technicalProfileId: "prof-100",
    ...overrides,
  }
}

test("1. crear servicio", () => {
  assert.equal(validateCatalogDraft(draft()).valid, true)
  const insert = mapCatalogDraftToInsert("co-1", draft(), "prof-100")
  assert.equal(insert.code, "FTTH-100")
  assert.equal(insert.name, "Internet Fibra 100 Mb")
  assert.equal(insert.technical_profile_id, "prof-100")
})

test("2. editar servicio", () => {
  const edited = catalogItemToDraft(
    sampleItem({ name: "Internet Fibra 100 Mb simétrico", monthlyPrice: 28000 })
  )
  edited.name = "Internet Fibra 100 Mb simétrico"
  edited.monthlyPrice = "28000"
  assert.equal(validateCatalogDraft(edited).valid, true)
  assert.equal(edited.code, "FTTH-100")
})

test("3. activar servicio", () => {
  const active = sampleItem({ isActive: true })
  assert.equal(isCatalogItemVisibleInNewOt(active), true)
})

test("4. desactivar servicio", () => {
  const inactive = sampleItem({ isActive: false })
  assert.equal(isCatalogItemVisibleInNewOt(inactive), false)
})

test("5. código único por empresa", () => {
  const existing = [
    { id: "cat-100", companyId: "co-1", code: "FTTH-100" },
    { id: "cat-50", companyId: "co-1", code: "FTTH-50" },
  ]
  assert.equal(
    assertCatalogCodeUnique({
      companyId: "co-1",
      code: "FTTH-100",
      existing,
    }).ok,
    false
  )
  assert.equal(
    assertCatalogCodeUnique({
      companyId: "co-2",
      code: "FTTH-100",
      existing,
    }).ok,
    true
  )
  assert.equal(
    mapCatalogWriteError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "isp_service_catalog_company_code_idx"',
    }),
    "Ya existe un servicio con este código."
  )
  assert.match(sql, /isp_service_catalog_company_code_idx/)
})

test("6. precio no negativo", () => {
  assert.equal(
    validateCatalogDraft(draft({ monthlyPrice: "-1" })).valid,
    false
  )
  assert.equal(
    validateCatalogDraft(draft({ monthlyPrice: "0" })).valid,
    true
  )
})

test("7. velocidades válidas", () => {
  assert.equal(
    validateCatalogDraft(draft({ downloadSpeedMbps: "-10" })).valid,
    false
  )
  assert.equal(
    validateCatalogDraft(draft({ uploadSpeedMbps: "-1" })).valid,
    false
  )
  assert.equal(
    validateCatalogDraft(draft({ downloadSpeedMbps: "50", uploadSpeedMbps: "50" }))
      .valid,
    true
  )
})

test("8. tecnología válida", () => {
  assert.equal(validateCatalogDraft(draft({ technology: "ftth" })).valid, true)
  assert.equal(validateCatalogDraft(draft({ technology: "adsl" })).valid, false)
  assert.equal(validateCatalogDraft(draft({ technology: "" })).valid, true)
})

test("9. tipos de conexión válidos", () => {
  assert.equal(
    validateCatalogDraft(draft({ allowedConnectionTypes: ["pppoe", "l2l"] }))
      .valid,
    true
  )
  assert.equal(
    validateCatalogDraft(draft({ allowedConnectionTypes: ["radius"] })).valid,
    false
  )
})

test("10. servicio con PPPoE", () => {
  const item = sampleItem({ allowedConnectionTypes: ["pppoe"] })
  assert.deepEqual(item.allowedConnectionTypes, ["pppoe"])
  assert.equal(item.allowedConnectionTypes.includes("static_ip"), false)
})

test("11. servicio con IP estática", () => {
  const wireless = sampleItem({
    id: "cat-w20",
    code: "WIRELESS-20",
    name: "Internet Wireless 20 Mb",
    technology: "wireless",
    downloadSpeedMbps: 20,
    uploadSpeedMbps: null,
    allowedConnectionTypes: ["static_ip"],
    technicalProfileId: "prof-w20",
    technicalProfile: sampleProfile({
      id: "prof-w20",
      code: "WIRELESS-20-IP",
      name: "Perfil Wireless 20 Mb IP",
      technology: "wireless",
      connectionType: "static_ip",
      downloadSpeed: 20,
      uploadSpeed: null,
      coreProfileId: "WIRELESS-20-IP",
    }),
  })
  assert.deepEqual(wireless.allowedConnectionTypes, ["static_ip"])
  assert.equal(wireless.technicalProfile.code, "WIRELESS-20-IP")
  assert.equal("pppoeUsername" in wireless, false)
  assert.equal("ipAddress" in wireless, false)
})

test("12. servicio con múltiples tipos de conexión", () => {
  const item = draft({
    allowedConnectionTypes: ["pppoe", "static_ip"],
  })
  assert.equal(validateCatalogDraft(item).valid, true)
  assert.equal(item.allowedConnectionTypes.length, 2)
})

test("13. perfil técnico válido", () => {
  const profile = sampleProfile()
  assert.equal(
    assertTechnicalProfileForCatalog({
      companyId: "co-1",
      selectedProfileId: profile.id,
      profile,
    }).ok,
    true
  )
  assert.equal(
    validateTechnicalProfileDraft({
      code: "FTTH-100",
      name: "Perfil FTTH 100 Mb",
      description: "",
      technology: "ftth",
      connectionType: "pppoe",
      downloadSpeed: "100",
      uploadSpeed: "100",
      speedUnit: "mbps",
      coreName: "MikroTik",
      coreProfileId: "FTTH-100",
      isActive: true,
    }).valid,
    true
  )
})

test("14. perfil técnico de otra empresa rechazado", () => {
  assert.equal(
    assertTechnicalProfileForCatalog({
      companyId: "co-1",
      selectedProfileId: "prof-100",
      profile: sampleProfile({ companyId: "co-2" }),
    }).ok,
    false
  )
  assert.match(sql, /El servicio no puede usar un perfil técnico de otra empresa/)
})

test("15. servicio inactivo no aparece para nuevas contrataciones", () => {
  const items = [
    sampleItem(),
    sampleItem({ id: "cat-old", code: "FTTH-OLD", isActive: false }),
  ]
  const options = buildOtPlanOptionsFromCatalog(items, "fiber")
  assert.equal(options.some((option) => option.catalogId === "cat-old"), false)
  assert.equal(options.some((option) => option.catalogId === "cat-100"), true)
})

test("16. servicio histórico no se elimina", () => {
  assert.equal(
    canPhysicallyDeleteCatalogItem({ usedCount: 1 }).allowed,
    false
  )
  const queries = read("lib/isp/catalog-queries.ts")
  assert.doesNotMatch(queries, /\.delete\(/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public.isp_technical_profiles/)
  assert.doesNotMatch(sql, /GRANT DELETE ON public.isp_technical_profiles/)
})

test("17. OT puede utilizar servicios activos", () => {
  const options = buildOtPlanOptionsFromCatalog([sampleItem()], "fiber")
  assert.equal(options.length, 1)
  assert.equal(options[0].catalogId, "cat-100")
  const otPlans = read("app/api/isp/catalog/ot-plans/route.ts")
  const queries = read("lib/isp/catalog-queries.ts")
  assert.match(otPlans, /listIspCatalogForOt/)
  assert.match(queries, /listIspCatalogForOt/)
  assert.match(queries, /query = query.eq\("is_active", true\)/)
})

test("18. Clientes 360° puede utilizar servicios del catálogo", () => {
  const snapshot = snapshotServiceFromCatalog(sampleItem())
  assert.equal(snapshot.catalogId, "cat-100")
  assert.equal(snapshot.planName, "Internet Fibra 100 Mb")
  assert.equal(snapshot.monthlyFee, "25000")
  assert.equal(snapshot.technology, "ftth")
  assert.deepEqual(snapshot.allowedConnectionTypes, ["pppoe"])
})

test("19. no se almacena IP específica en el catálogo", () => {
  const insert = mapCatalogDraftToInsert("co-1", draft(), "prof-100")
  assert.equal(objectHasSubscriberNetworkFields(insert), false)
  assert.equal("ip_address" in insert, false)
  assert.doesNotMatch(sql, /isp_service_catalog[\s\S]{0,400}ip_address/)
  assert.doesNotMatch(
    sql,
    /CREATE TABLE IF NOT EXISTS public.isp_technical_profiles \([\s\S]*?ip_address/
  )
})

test("20. no se almacena usuario PPPoE específico en el catálogo", () => {
  const insert = mapCatalogDraftToInsert("co-1", draft(), "prof-100")
  assert.equal("pppoe_username" in insert, false)
  assert.equal("pppoe_password" in insert, false)
  assert.doesNotMatch(sql, /pppoe_username/)
  assert.doesNotMatch(sql, /pppoe_password/)
  const mapper = read("lib/isp/catalog-mapper.ts")
  assert.doesNotMatch(mapper, /pppoe_username/)
  assert.doesNotMatch(mapper, /ip_address/)
})

test("perfil inactivo no se selecciona en configuraciones nuevas", () => {
  assert.equal(
    assertTechnicalProfileForCatalog({
      companyId: "co-1",
      selectedProfileId: "prof-100",
      profile: sampleProfile({ isActive: false }),
    }).ok,
    false
  )
  assert.equal(
    assertTechnicalProfileForCatalog({
      companyId: "co-1",
      selectedProfileId: "prof-100",
      profile: sampleProfile({ isActive: false }),
      currentlyLinkedProfileId: "prof-100",
    }).ok,
    true
  )
})

test("catálogo preparado para mapear planes del ISP por código", () => {
  const items = ISP_CATALOG_SEED_ITEMS.map((seed) => ({
    id: seed.code,
    code: seed.code,
  }))
  assert.equal(findCatalogItemByCommercialCode(items, "FTTH-100")?.code, "FTTH-100")
  assert.equal(findCatalogItemByCommercialCode(items, "WIRELESS-20")?.code, "WIRELESS-20")
  assert.equal(findCatalogItemByCommercialCode(items, "Plan 100"), null)
  for (const seed of ISP_CATALOG_SEED_ITEMS) {
    assert.ok(seed.code)
    assert.ok(seed.technicalProfileCode)
  }
})

test("heredar características del perfil no inventa datos de abonado", () => {
  const next = applyTechnicalProfileToCatalogDraft(draft({
    allowedConnectionTypes: [],
    technology: "",
    downloadSpeedMbps: "",
    uploadSpeedMbps: "",
  }), sampleProfile())
  assert.equal(next.technology, "ftth")
  assert.equal(next.downloadSpeedMbps, "100")
  assert.equal(next.uploadSpeedMbps, "100")
  assert.deepEqual(next.allowedConnectionTypes, ["pppoe"])
  assert.equal("ipAddress" in next, false)
  assert.equal("pppoeUsername" in next, false)
})

test("migración 1.3 es aditiva y no toca precios ni MikroTik", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public.isp_technical_profiles/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS code text/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS technical_profile_id/)
  assert.match(sql, /DROP CONSTRAINT IF EXISTS isp_service_catalog_category_check/)
  assert.match(sql, /'l2l', 'dedicated', 'other'/)
  assert.doesNotMatch(sql, /monthly_price\s*=/)
  assert.doesNotMatch(sql, /DELETE FROM public.isp_service_catalog/)
  assert.match(sql, /FTTH-50/)
  assert.match(sql, /FTTH-100/)
  assert.match(sql, /FTTH-300/)
  assert.match(sql, /WIRELESS-20-IP/)
  assert.match(sql, /WIRELESS-20/)
  assert.match(sql, /Not a live connection/)
  assert.doesNotMatch(sql, /\/interface|\/ppp|\/ip firewall|routeros/i)
})

test("UI de servicios muestra código, tipos, perfil y secciones de detalle", () => {
  const list = read("components/isp/isp-catalog-list-screen.tsx")
  const form = read("components/isp/isp-catalog-form-screen.tsx")
  const detail = read("components/isp/isp-catalog-detail-screen.tsx")
  assert.match(list, />Código</)
  assert.match(list, />Perfil técnico</)
  assert.match(list, /catalogConnectionTypeLabel/)
  assert.match(form, /1. Información comercial/)
  assert.match(form, /3. Tipos de conexión/)
  assert.match(form, /4. Perfil técnico/)
  assert.match(form, /5. Confirmación/)
  assert.match(form, /ISP_CATALOG_CONNECTION_TYPES/)
  assert.match(detail, /Información comercial/)
  assert.match(detail, /Características/)
  assert.match(detail, /Perfil técnico/)
  assert.match(detail, /Perfil en Core/)
  assert.doesNotMatch(detail, /pppoeUsername|ipAddress/)
  assert.doesNotMatch(form, /fetch\(`https?:\/\/.*mikrotik/i)
})

test("no hay integración real con MikroTik en este sprint", () => {
  const queries = read("lib/isp/technical-profile-queries.ts")
  const api = read("app/api/isp/catalog/technical-profiles/route.ts")
  assert.doesNotMatch(queries, /mikrotik|routeros|\/ppp \/secret/i)
  assert.doesNotMatch(api, /mikrotik|provision/i)
  assert.match(
    read("lib/isp/catalog-constants.ts"),
    /SIRO · Pendiente de integración/
  )
})
