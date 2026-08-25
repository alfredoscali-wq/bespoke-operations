import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { ISP_CATALOG_SEED_ITEMS } from "../lib/isp/catalog-constants.ts"
import {
  assertCatalogCompanyMatch,
  buildOtPlanOptionsFromCatalog,
  canPhysicallyDeleteCatalogItem,
  catalogItemToContractedPlanCode,
  catalogItemToOtLabel,
  didCopyCatalogMonthlyPriceToOtAmount,
  didCopyOtAmountToCatalogMonthlyPrice,
  emptyCatalogDraft,
  filterCatalogItemsForOt,
  findCatalogItemForWorkOrder,
  isCatalogItemVisibleInNewOt,
  snapshotServiceFromCatalog,
  suggestConnectionTypeFromCatalogAndOt,
  validateCatalogDraft,
} from "../lib/isp/catalog-integrity.ts"
import {
  didCopyOtChargeToMonthlyFee,
  didCopyOtPaymentMethodToMonthlyCollection,
  didInferPppoeUsernameFromDni,
} from "../lib/isp/integrity.ts"
import { buildIspPrefillFromWorkOrder } from "../lib/isp/ot-prefill.ts"
import { NEW_INSTALLATION_SERVICE_TYPE } from "../lib/isp/constants.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function validDraft(overrides = {}) {
  return {
    ...emptyCatalogDraft(),
    code: "FTTH-TEST",
    ...overrides,
  }
}

function sampleCatalogItem(overrides = {}) {
  return {
    id: "cat-300",
    companyId: "co-1",
    code: "FTTH-300",
    name: "FTTH 300 Mb",
    category: "internet",
    customerType: "residential",
    description: null,
    isActive: true,
    technology: "ftth",
    downloadSpeedMbps: 300,
    uploadSpeedMbps: null,
    speedUnit: "mbps",
    monthlyPrice: null,
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: ["pppoe", "static_ip"],
    technicalProfileId: null,
    otLabel: "300 Mb",
    legacyPlanCode: "300Mb",
    isSeed: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    usedCount: 0,
    ...overrides,
  }
}

function sampleTask(overrides = {}) {
  return {
    id: "t1",
    code: "TSK-OT-689",
    title: "Instalación",
    description: "",
    projectCode: "OT",
    projectName: "SERVICIO",
    customerName: "Juan Pérez",
    customerDni: "20.123.456",
    customerPhone: "351555",
    serviceAddress: "San Martín 100",
    locality: "Córdoba",
    type: "fiber",
    status: "finalizada",
    priority: "media",
    supervisor: "Ana",
    crew: "Cuadrilla 1",
    startDate: "2026-08-01",
    dueDate: "2026-08-01",
    estimatedDuration: "90 min",
    checklist: [],
    progress: 100,
    serviceType: NEW_INSTALLATION_SERVICE_TYPE,
    contractedPlan: "300Mb",
    serviceCatalogId: "cat-300",
    installationCost: 25000,
    amountToCollect: 50000,
    paymentMethod: "transferencia",
    taskMetadata: { email: "juan@test.com", technology: "fiber" },
    ...overrides,
  }
}

const catalog = [
  sampleCatalogItem({
    id: "cat-50",
    name: "FTTH 50 Mb",
    downloadSpeedMbps: 50,
    otLabel: "50 Mb",
    legacyPlanCode: "50Mb",
  }),
  sampleCatalogItem({
    id: "cat-100",
    name: "FTTH 100 Mb",
    downloadSpeedMbps: 100,
    otLabel: "100 Mb",
    legacyPlanCode: "100Mb",
  }),
  sampleCatalogItem(),
  sampleCatalogItem({
    id: "cat-w20",
    name: "Wireless 20 Mb",
    technology: "wireless",
    downloadSpeedMbps: 20,
    otLabel: "20 Mb Wireless",
    legacyPlanCode: "20Mb",
    allowedConnectionTypes: ["static_ip"],
  }),
]

test("1. crear servicio FTTH", () => {
  const draft = {
    ...validDraft(),
    name: "FTTH 300 Mb",
    category: "internet",
    customerType: "residential",
    technology: "ftth",
    downloadSpeedMbps: "300",
  }
  assert.equal(validateCatalogDraft(draft).valid, true)
})

test("2. crear servicio Wireless", () => {
  const draft = {
    ...validDraft(),
    name: "Wireless 20 Mb",
    technology: "wireless",
    downloadSpeedMbps: "20",
    allowedConnectionTypes: ["static_ip"],
  }
  assert.equal(validateCatalogDraft(draft).valid, true)
})

test("3. crear servicio sin velocidad", () => {
  const draft = {
    ...validDraft(),
    name: "IP Pública",
    category: "connectivity",
    downloadSpeedMbps: "",
    uploadSpeedMbps: "",
  }
  assert.equal(validateCatalogDraft(draft).valid, true)
})

test("4. crear servicio sin tecnología", () => {
  const draft = {
    ...validDraft(),
    name: "IP Pública",
    category: "connectivity",
    technology: "",
  }
  assert.equal(validateCatalogDraft(draft).valid, true)
})

test("5-7. crear servicio Particular, Empresa y Ambos", () => {
  for (const customerType of ["residential", "business", "both"]) {
    const draft = {
      ...validDraft(),
      name: `Servicio ${customerType}`,
      customerType,
    }
    assert.equal(validateCatalogDraft(draft).valid, true)
  }
})

test("8-9. activar y desactivar servicio", () => {
  const active = sampleCatalogItem({ isActive: true })
  const inactive = sampleCatalogItem({ isActive: false })
  assert.equal(isCatalogItemVisibleInNewOt(active), true)
  assert.equal(isCatalogItemVisibleInNewOt(inactive), false)
})

test("10. servicio inactivo no aparece en nueva OT", () => {
  const items = [
    ...catalog,
    sampleCatalogItem({ id: "cat-500", name: "FTTH 500 Mb", isActive: false, downloadSpeedMbps: 500, legacyPlanCode: "500Mb", otLabel: "500 Mb" }),
  ]
  const options = buildOtPlanOptionsFromCatalog(items, "fiber")
  assert.equal(options.some((option) => option.catalogId === "cat-500"), false)
  assert.deepEqual(
    options.map((option) => option.contractedPlanCode),
    ["50Mb", "100Mb", "300Mb"]
  )
})

test("11. servicio inactivo sigue disponible para históricos", () => {
  const inactive = sampleCatalogItem({
    id: "cat-500",
    name: "FTTH 500 Mb",
    isActive: false,
    downloadSpeedMbps: 500,
    legacyPlanCode: "500Mb",
    otLabel: "500 Mb",
  })
  const visible = filterCatalogItemsForOt([...catalog, inactive], "fiber", {
    includeId: "cat-500",
  })
  assert.equal(visible.some((item) => item.id === "cat-500"), true)
})

test("12-15. tipos de conexión válidos, PPPoE, IP estática y sin conexión", () => {
  assert.equal(
    validateCatalogDraft({
      ...validDraft(),
      name: "FTTH PPPoE",
      technology: "ftth",
      allowedConnectionTypes: ["pppoe"],
    }).valid,
    true
  )
  assert.equal(
    validateCatalogDraft({
      ...validDraft(),
      name: "Wireless IP",
      technology: "wireless",
      allowedConnectionTypes: ["static_ip"],
    }).valid,
    true
  )
  assert.equal(
    validateCatalogDraft({
      ...validDraft(),
      name: "TV",
      category: "tv",
      requiresConnection: false,
      allowedConnectionTypes: [],
    }).valid,
    true
  )
  assert.equal(
    validateCatalogDraft({
      ...emptyCatalogDraft(),
      name: "Inválido",
      allowedConnectionTypes: ["radius"],
    }).valid,
    false
  )
})

test("16-17. multi-tenant y RLS del catálogo", () => {
  assert.equal(
    assertCatalogCompanyMatch({ companyId: "co-a", catalogCompanyId: "co-a" }).ok,
    true
  )
  assert.equal(
    assertCatalogCompanyMatch({ companyId: "co-a", catalogCompanyId: "co-b" }).ok,
    false
  )

  const sql = read(
    "supabase/migrations/20261129000100_isp_1_1_catalogo_servicios.sql"
  )
  assert.match(sql, /CREATE TABLE public.isp_service_catalog/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
  assert.match(sql, /El servicio contratado no puede usar un catálogo de otra empresa/)
  assert.match(sql, /La OT no puede asociarse a un catálogo de otra empresa/)
  assert.doesNotMatch(sql, /FOR DELETE/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public.isp_service_catalog/)
  assert.doesNotMatch(sql, /GRANT DELETE ON public.isp_service_catalog/)
})

test("18. no eliminar servicio utilizado", () => {
  assert.equal(canPhysicallyDeleteCatalogItem({ usedCount: 2 }).allowed, false)
  assert.equal(canPhysicallyDeleteCatalogItem({ usedCount: 0 }).allowed, true)
  const queries = read("lib/isp/catalog-queries.ts")
  assert.doesNotMatch(queries, /\.delete\(/)
})

test("OT 1-6. Fibra y Wireless muestran planes activos del catálogo", () => {
  const fiber = buildOtPlanOptionsFromCatalog(catalog, "fiber")
  const wireless = buildOtPlanOptionsFromCatalog(catalog, "wireless")
  assert.deepEqual(
    fiber.map((option) => option.label),
    ["50 Mb", "100 Mb", "300 Mb"]
  )
  assert.deepEqual(
    wireless.map((option) => option.label),
    ["20 Mb Wireless"]
  )
  assert.equal(fiber.some((option) => option.catalogId === "cat-w20"), false)
})

test("OT 7. un plan nuevo activo aparece sin modificar el código de OT", () => {
  const with500 = [
    ...catalog,
    sampleCatalogItem({
      id: "cat-500",
      name: "FTTH 500 Mb",
      downloadSpeedMbps: 500,
      otLabel: "500 Mb",
      legacyPlanCode: "500Mb",
    }),
  ]
  const options = buildOtPlanOptionsFromCatalog(with500, "fiber")
  assert.equal(options.some((option) => option.label === "500 Mb"), true)

  const otUi = read("components/tareas/work-order-technology-plan-fields.tsx")
  const ftthUi = read("components/tareas/work-order-ftth-installation-fields.tsx")
  const hook = read("lib/isp/use-ot-catalog-plans.ts")
  assert.match(otUi, /useOtCatalogPlans/)
  assert.match(ftthUi, /useOtCatalogPlans/)
  assert.match(hook, /\/api\/isp\/catalog\/ot-plans/)
  assert.doesNotMatch(otUi, /FIBER_CONTRACTED_PLAN_OPTIONS/)
  assert.doesNotMatch(ftthUi, /FIBER_CONTRACTED_PLAN_OPTIONS/)
})

test("OT 8-9. plan inactivo desaparece de nuevas OT y la histórica sigue", () => {
  const inactive300 = sampleCatalogItem({ isActive: false })
  const rest = catalog.filter((item) => item.id !== "cat-300")
  const forNew = buildOtPlanOptionsFromCatalog([...rest, inactive300], "fiber")
  assert.equal(forNew.some((option) => option.catalogId === "cat-300"), false)

  const historical = filterCatalogItemsForOt([...rest, inactive300], "fiber", {
    includeId: "cat-300",
  })
  assert.equal(historical.some((item) => item.id === "cat-300"), true)

  const mapper = read("lib/supabase/tasks.mapper.ts")
  assert.match(mapper, /serviceCatalogId: row.service_catalog_id/)
  assert.match(mapper, /service_catalog_id: payload.serviceCatalogId/)
})

test("OT 10. seleccionar plan guarda referencia al catálogo", () => {
  const option = buildOtPlanOptionsFromCatalog(catalog, "fiber").find(
    (item) => item.contractedPlanCode === "300Mb"
  )
  assert.equal(option?.catalogId, "cat-300")
  const createPayload = read("lib/tasks/work-order.ts")
  assert.match(createPayload, /serviceCatalogId: form.serviceCatalogId.trim/)
  const otUi = read("components/tareas/work-order-technology-plan-fields.tsx")
  assert.match(otUi, /serviceCatalogId/)
})

test("OT 11-12 y 19-20. importe y medio de pago de OT permanecen independientes", () => {
  assert.equal(
    didCopyCatalogMonthlyPriceToOtAmount({
      otAmountToCollect: 50000,
      catalogMonthlyPrice: 30000,
      copiedAutomatically: false,
    }),
    false
  )
  assert.equal(
    didCopyOtAmountToCatalogMonthlyPrice({
      catalogMonthlyPrice: 30000,
      otAmountToCollect: 50000,
      copiedAutomatically: false,
    }),
    false
  )

  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask(),
    catalogItem: sampleCatalogItem({ monthlyPrice: 30000 }),
  })
  assert.equal(prefill.service.monthlyFee, "30000")
  assert.equal(prefill.otAmountToCollect, 50000)
  assert.equal(prefill.otPaymentMethod, "transferencia")
  assert.equal(prefill.service.monthlyCollectionMethod, "siro")
  assert.equal(
    didCopyOtChargeToMonthlyFee({
      monthlyFee: prefill.service.monthlyFee,
      otAmountToCollect: prefill.otAmountToCollect,
    }),
    false
  )
  assert.equal(
    didCopyOtPaymentMethodToMonthlyCollection({
      monthlyCollectionMethod: prefill.service.monthlyCollectionMethod ?? "",
      otPaymentMethod: prefill.otPaymentMethod,
    }),
    false
  )

  const otUi = read("components/tareas/work-order-technology-plan-fields.tsx")
  assert.doesNotMatch(otUi, /amountToCollect/)
  assert.doesNotMatch(otUi, /monthlyPrice/)
})

test("OT 13-14. tecnología filtra y no muestra servicios incompatibles", () => {
  const fiber = buildOtPlanOptionsFromCatalog(catalog, "fiber")
  const wireless = buildOtPlanOptionsFromCatalog(catalog, "wireless")
  assert.equal(fiber.every((option) => option.technology === "fiber"), true)
  assert.equal(wireless.every((option) => option.technology === "wireless"), true)
  assert.equal(
    findCatalogItemForWorkOrder(catalog, {
      otTechnology: "fiber",
      contractedPlan: "20Mb",
    }),
    null
  )
})

test("OT 15-18. Wireless con IP precarga estática y no inventa PPPoE", () => {
  const wireless = sampleCatalogItem({
    id: "cat-w20",
    name: "Wireless 20 Mb",
    technology: "wireless",
    allowedConnectionTypes: ["static_ip"],
    legacyPlanCode: "20Mb",
    otLabel: "20 Mb Wireless",
    downloadSpeedMbps: 20,
  })
  assert.equal(
    suggestConnectionTypeFromCatalogAndOt({
      technology: "wireless",
      installationIp: "10.40.12.88",
      allowedConnectionTypes: ["static_ip"],
    }),
    "static_ip"
  )
  assert.notEqual(
    suggestConnectionTypeFromCatalogAndOt({
      technology: "wireless",
      installationIp: "10.40.12.88",
      allowedConnectionTypes: ["static_ip"],
    }),
    "pppoe"
  )

  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      type: "wireless",
      contractedPlan: "20Mb",
      serviceCatalogId: "cat-w20",
      customerDni: "27.890.123",
      taskMetadata: {
        technology: "wireless",
        installationIp: "10.40.12.88",
      },
    }),
    catalogItem: wireless,
  })
  assert.equal(prefill.connection.connectionType, "static_ip")
  assert.equal(prefill.connection.ipAddress, "10.40.12.88")
  assert.equal(prefill.connection.pppoeUsername, "")
  assert.equal(prefill.connection.pppoePassword, "")
  assert.equal(
    didInferPppoeUsernameFromDni({
      pppoeUsername: prefill.connection.pppoeUsername,
      dni: prefill.customer.dni,
    }),
    false
  )

  const wizard = read("components/isp/isp-onboarding-wizard.tsx")
  assert.doesNotMatch(wizard, /pppoeUsername:\s*customer\.dni/)
  assert.doesNotMatch(wizard, /Math.random|nanoid|crypto\.random/)
  assert.match(wizard, /Servicio del catálogo/)
})

test("360. alta desde OT reutiliza catálogo y conserva snapshot de precio", () => {
  const item = sampleCatalogItem({ monthlyPrice: 30000 })
  const snapshot = snapshotServiceFromCatalog(item)
  assert.equal(snapshot.catalogId, "cat-300")
  assert.equal(snapshot.planName, "FTTH 300 Mb")
  assert.equal(snapshot.monthlyFee, "30000")
  assert.equal(snapshot.monthlyCollectionMethod, "siro")

  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [
      { id: "cust-1", name: "Juan", dni: "20123456", phone: "351" },
    ],
    task: sampleTask(),
    catalogItem: item,
  })
  assert.equal(prefill.customer.existingCustomer?.id, "cust-1")
  assert.equal(prefill.service.catalogId, "cat-300")
  assert.equal(prefill.service.planName, "FTTH 300 Mb")
  assert.equal(prefill.service.monthlyFee, "30000")
  assert.notEqual(prefill.service.monthlyFee, String(prefill.otAmountToCollect))
  assert.notEqual(prefill.service.monthlyCollectionMethod, prefill.otPaymentMethod)

  const rpc = read(
    "supabase/migrations/20261129000100_isp_1_1_catalogo_servicios.sql"
  )
  assert.match(rpc, /v_service ->> 'catalogId'/)
  assert.match(rpc, /catalog_id/)
  assert.match(rpc, /OT amount is never used as monthly fee/)
  assert.match(rpc, /is_seed/)
  assert.match(rpc, /FTTH 50 Mb/)
  assert.match(rpc, /FTTH 100 Mb/)
  assert.match(rpc, /FTTH 300 Mb/)
  assert.match(rpc, /Wireless 20 Mb/)
})

test("seeds iniciales no inventan precios ni subida", () => {
  for (const seed of ISP_CATALOG_SEED_ITEMS) {
    assert.equal("monthlyPrice" in seed, false)
    assert.equal("uploadSpeedMbps" in seed, false)
  }
  const sql = read(
    "supabase/migrations/20261129000100_isp_1_1_catalogo_servicios.sql"
  )
  assert.match(sql, /upload_speed_mbps,\s*\r?\n\s*monthly_price,\s*\r?\n[\s\S]*NULL,\s*\r?\n\s*NULL,/)
})

test("pantallas y navegación del catálogo", () => {
  const list = read("components/isp/isp-catalog-list-screen.tsx")
  const form = read("components/isp/isp-catalog-form-screen.tsx")
  const detail = read("components/isp/isp-catalog-detail-screen.tsx")
  const nav = read("lib/navigation/nav-items.ts")
  const modules = read("lib/roles/app-modules.ts")
  assert.match(list, /Catálogo de servicios y planes comerciales del ISP/)
  assert.match(list, /Nuevo Servicio/)
  assert.match(form, /1. Información comercial/)
  assert.match(form, /2. Características/)
  assert.match(form, /3. Tipos de conexión/)
  assert.match(form, /4. Perfil técnico/)
  assert.match(detail, /usedCount/)
  assert.match(nav, /href: "\/servicios"/)
  assert.match(modules, /"\/servicios"/)
  assert.equal(catalogItemToOtLabel(sampleCatalogItem()), "300 Mb")
  assert.equal(catalogItemToContractedPlanCode(sampleCatalogItem()), "300Mb")
})
