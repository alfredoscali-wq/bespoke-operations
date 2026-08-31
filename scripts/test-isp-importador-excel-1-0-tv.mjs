/**
 * IMPORTADOR EXCEL 1.0 — commercial service + TV component.
 * TV is resolved from isp_service_catalog.tv_plan_catalog_id only.
 * The Excel keeps a single contracted-service column. No plan_tv column.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { didCopyCatalogPriceToContractedService } from "../lib/isp/migration/integrity.ts"
import { validateIspMigration } from "../lib/isp/migration/integrity.ts"
import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_SERVICE_HEADERS,
  ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE,
  ispMigrationInvalidTvRefMessage,
} from "../lib/isp/migration/constants.ts"
import { parseIspMigrationWorkbook } from "../lib/isp/migration/parse.ts"
import {
  buildIspMigrationTemplateWorkbook,
  buildIspMigrationWorkbook,
} from "../lib/isp/migration/template.ts"
import {
  buildIspMigrationCatalogIndex,
  commercialServiceNamesForMigrationTemplate,
  resolveIspMigrationCommercialCatalog,
  resolveIspMigrationTvComponent,
} from "../lib/isp/migration/tv-component.ts"
import { isCountableTvService, summarizeTvPlans } from "../lib/subscriptions/tv-plans.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function emptyExisting() {
  return {
    customers: [],
    catalog: [],
    services: [],
    connections: [],
    equipmentExternalCodes: [],
    completedFileHashes: [],
  }
}

function customerRow(overrides = {}) {
  return {
    cliente_id_externo: "CLI-001",
    nombre_razon_social: "Juan Pérez",
    tipo_cliente: "Particular",
    dni_cuit: "20123456",
    telefono: "351555",
    whatsapp: "",
    email: "juan@test.com",
    localidad: "Córdoba",
    domicilio: "San Martín 100",
    observaciones: "",
    estado_cliente: "Activo",
    ...overrides,
  }
}

function catalogRow(overrides = {}) {
  return {
    catalogo_id_externo: "CAT-001",
    nombre_servicio: "Plan 300 Megas",
    categoria: "Internet",
    tipo_cliente: "Particular",
    tecnologia: "FTTH",
    velocidad_bajada: "300",
    velocidad_subida: "300",
    precio_mensual: "35000",
    periodicidad: "Mensual",
    medio_cobranza: "SIRO",
    requiere_conexion: "Sí",
    tipos_conexion: "PPPoE",
    descripcion: "",
    activo: "Sí",
    ...overrides,
  }
}

function serviceRow(overrides = {}) {
  return {
    servicio_id_externo: "SER-001",
    cliente_id_externo: "CLI-001",
    catalogo_id_externo: "CAT-001",
    nombre_servicio: "Plan 300 Megas",
    tecnologia: "FTTH",
    velocidad_bajada: "300",
    velocidad_subida: "300",
    precio_mensual: "25000",
    fecha_alta: "2024-03-01",
    estado_comercial: "Activo",
    medio_cobranza: "SIRO",
    observaciones: "",
    ...overrides,
  }
}

function catalogItem(overrides = {}) {
  return {
    id: "cat-internet",
    companyId: "co-1",
    externalCode: "CAT-001",
    code: "FTTH-300",
    name: "Plan 300 Megas",
    category: "internet",
    isActive: true,
    monthlyPrice: 35000,
    tvPlanCatalogId: null,
    ...overrides,
  }
}

function tvPlan(overrides = {}) {
  return catalogItem({
    id: "tv-full",
    externalCode: "TV-FULL",
    code: "TV-FULL",
    name: "TV Full",
    category: "tv",
    monthlyPrice: 9900,
    tvPlanCatalogId: null,
    ...overrides,
  })
}

function rowToArray(headers, values) {
  return headers.map((header) => values[header] ?? "")
}

function workbookFrom(sheets) {
  return parseIspMigrationWorkbook(
    buildIspMigrationWorkbook({
      CLIENTES: (sheets.CLIENTES ?? []).map((row) =>
        rowToArray(ISP_MIGRATION_CUSTOMER_HEADERS, row)
      ),
      CATALOGO: (sheets.CATALOGO ?? []).map((row) =>
        rowToArray(ISP_MIGRATION_CATALOG_HEADERS, row)
      ),
      SERVICIOS: (sheets.SERVICIOS ?? []).map((row) =>
        rowToArray(ISP_MIGRATION_SERVICE_HEADERS, row)
      ),
      CONEXIONES: (sheets.CONEXIONES ?? []).map((row) =>
        rowToArray(ISP_MIGRATION_CONNECTION_HEADERS, row)
      ),
    })
  )
}

function validateWithCatalog(catalog, serviceOverrides = {}) {
  return validateIspMigration(
    workbookFrom({
      CLIENTES: [customerRow()],
      CATALOGO: [],
      SERVICIOS: [serviceRow(serviceOverrides)],
      CONEXIONES: [],
    }),
    { ...emptyExisting(), catalog }
  )
}

function servicePayload(result) {
  return result.stagingRows.find((row) => row.sheet === "SERVICIOS")?.payload
}

const TV_BASICO = tvPlan({
  id: "tv-basico",
  externalCode: "TV-BASICO",
  code: "TV-BASICO",
  name: "TV Básico",
  monthlyPrice: 4500,
})
const TV_FUTBOL = tvPlan({
  id: "tv-futbol",
  externalCode: "TV-BASICO-FUTBOL",
  code: "TV-BASICO-FUTBOL",
  name: "TV Básico + Pack Fútbol",
  monthlyPrice: 7500,
})
const TV_FULL = tvPlan()

test("1. servicio sin TV se importa y no genera componente TV", () => {
  const result = validateWithCatalog([catalogItem(), TV_FULL], {
    nombre_servicio: "Plan 300 Megas",
  })
  assert.equal(result.canImport, true)
  const service = servicePayload(result)
  assert.equal(service?.has_tv_component, false)
  assert.equal(service?.tv_plan_catalog_id, null)
  assert.equal(service?.monthly_price, 25000)
})

test("2. Plan 300 Megas + TV Básico detecta TV Básico", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        id: "cat-basico",
        name: "Plan 300 Megas + TV Básico",
        tvPlanCatalogId: "tv-basico",
      }),
      TV_BASICO,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Básico" }
  )
  const service = servicePayload(result)
  assert.equal(result.canImport, true)
  assert.equal(service?.tv_plan_name, "TV Básico")
  assert.equal(service?.tv_monthly_price, 4500)
  assert.equal(service?.has_tv_component, true)
})

test("3. Plan 300 Megas + TV Básico + Pack Fútbol detecta el pack", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        id: "cat-futbol",
        name: "Plan 300 Megas + TV Básico + Pack Fútbol",
        tvPlanCatalogId: "tv-futbol",
      }),
      TV_FUTBOL,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Básico + Pack Fútbol" }
  )
  const service = servicePayload(result)
  assert.equal(service?.tv_plan_name, "TV Básico + Pack Fútbol")
  assert.equal(service?.tv_monthly_price, 7500)
})

test("4. Plan 300 Megas + TV Full detecta TV Full", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        id: "cat-full",
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  const service = servicePayload(result)
  assert.equal(result.canImport, true)
  assert.equal(service?.nombre_servicio, "Plan 300 Megas + TV Full")
  assert.equal(service?.tv_plan_name, "TV Full")
  assert.equal(service?.tv_plan_code, "TV-FULL")
  assert.equal(service?.tv_monthly_price, 9900)
  assert.equal(service?.resolved_catalog_id, "cat-full")
})

test("5. el Excel no tiene columna plan_tv", () => {
  assert.equal(ISP_MIGRATION_SERVICE_HEADERS.includes("plan_tv"), false)
  assert.equal(ISP_MIGRATION_SERVICE_HEADERS.includes("tipo_tv"), false)
  assert.equal(ISP_MIGRATION_SERVICE_HEADERS.includes("tv_plan"), false)
  assert.doesNotMatch(read("lib/isp/migration/constants.ts"), /"plan_tv"/)
  assert.doesNotMatch(read("lib/isp/migration/parse.ts"), /plan_tv/)
  const template = read("lib/isp/migration/template.ts")
  assert.doesNotMatch(template, /plan_tv/)
  assert.match(template, /No agregue una columna de plan TV/)
})

test("6 y 7. no interpreta el nombre; usa tv_plan_catalog_id", () => {
  const tvModule = read("lib/isp/migration/tv-component.ts")
  assert.doesNotMatch(tvModule, /includes\(["']TV["']\)/)
  assert.doesNotMatch(tvModule, /includes\(["']Full["']\)/)
  assert.doesNotMatch(tvModule, /includes\(["']Fútbol["']\)/)
  assert.doesNotMatch(tvModule, /new RegExp/)
  assert.match(tvModule, /tvPlanCatalogId/)
  assert.match(tvModule, /resolveCommercialTvComponent/)

  const namedLikeTv = validateWithCatalog(
    [
      catalogItem({
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: null,
      }),
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  const service = servicePayload(namedLikeTv)
  assert.equal(namedLikeTv.canImport, true)
  assert.equal(service?.has_tv_component, false)
  assert.equal(service?.tv_plan_catalog_id, null)
})

test("8 y 9. precio TV del catálogo TV; el precio comercial no se modifica", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        id: "cat-full",
        name: "Plan 300 Megas + TV Full",
        monthlyPrice: 35000,
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    {
      nombre_servicio: "Plan 300 Megas + TV Full",
      precio_mensual: "25000",
    }
  )
  const service = servicePayload(result)
  assert.equal(service?.monthly_price, 25000)
  assert.equal(service?.tv_monthly_price, 9900)
  assert.equal(
    didCopyCatalogPriceToContractedService({
      catalogPrice: 9900,
      contractedPrice: 25000,
      copiedAutomatically: false,
    }),
    false
  )
  assert.notEqual(service?.monthly_price, service?.tv_monthly_price)
})

test("10. un servicio sin TV no genera componente TV", () => {
  const result = validateWithCatalog([catalogItem(), TV_FULL])
  const services = result.stagingRows.filter((row) => row.sheet === "SERVICIOS")
  assert.equal(services.length, 1)
  assert.equal(services[0].payload.has_tv_component, false)
})

test("11. un servicio inexistente genera error claro", () => {
  const result = validateWithCatalog([], {
    catalogo_id_externo: "CAT-NO",
    nombre_servicio: "Plan 300 Megas + TV Premium",
  })
  assert.equal(result.canImport, false)
  assert.ok(
    result.issues.some(
      (issue) => issue.message === ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE
    )
  )
})

test("12. un servicio de otra empresa no se resuelve", () => {
  const result = validateWithCatalog([], {
    catalogo_id_externo: "CAT-001",
    nombre_servicio: "Plan 300 Megas + TV Full",
  })
  assert.equal(result.canImport, false)
  assert.ok(
    result.issues.some(
      (issue) => issue.message === ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE
    )
  )
  const queries = read("lib/isp/migration/queries.ts")
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(queries, /tv_plan_catalog_id/)
  const helper = read(
    "supabase/migrations/20261206000100_isp_migration_excel_tv_component.sql"
  )
  assert.match(helper, /company_id = p_company_id/)
  assert.match(helper, /company_id = v_company_id/)

  const index = buildIspMigrationCatalogIndex([
    catalogItem({
      companyId: "co-1",
      name: "Plan 300 Megas + TV Full",
      tvPlanCatalogId: "tv-full",
    }),
    tvPlan({ companyId: "co-2" }),
  ])
  const tv = resolveIspMigrationTvComponent(
    catalogItem({
      companyId: "co-1",
      name: "Plan 300 Megas + TV Full",
      tvPlanCatalogId: "tv-full",
    }),
    index.byId
  )
  assert.equal(tv.ok, false)
})

test("13. referencia TV inválida genera error de configuración", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-missing",
      }),
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  assert.equal(result.canImport, false)
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.message ===
        ispMigrationInvalidTvRefMessage("Plan 300 Megas + TV Full")
    )
  )
})

test("plan TV inactivo no bloquea si el servicio comercial es válido", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      tvPlan({ isActive: false }),
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  assert.equal(result.canImport, true)
  assert.equal(servicePayload(result)?.tv_plan_name, "TV Full")
})

test("14 y 15. reimportar no duplica clientes ni relaciones; no hay historial de upgrade", () => {
  const first = validateWithCatalog(
    [
      catalogItem({
        name: "Plan 300 Megas + TV Básico",
        tvPlanCatalogId: "tv-basico",
      }),
      TV_BASICO,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Básico" }
  )
  assert.equal(first.canImport, true)

  const second = validateIspMigration(
    workbookFrom({
      CLIENTES: [customerRow()],
      CATALOGO: [],
      SERVICIOS: [
        serviceRow({
          nombre_servicio: "Plan 300 Megas + TV Full",
          catalogo_id_externo: "CAT-001",
        }),
      ],
      CONEXIONES: [],
    }),
    {
      ...emptyExisting(),
      customers: [{ id: "c1", externalCode: "CLI-001", dniDigits: "20123456" }],
      catalog: [
        catalogItem({
          name: "Plan 300 Megas + TV Full",
          tvPlanCatalogId: "tv-full",
        }),
        TV_FULL,
      ],
      services: [{ id: "s1", externalCode: "SER-001", hasConnection: false }],
    }
  )
  const serviceRows = second.stagingRows.filter((row) => row.sheet === "SERVICIOS")
  assert.equal(serviceRows.length, 1)
  assert.ok(
    second.issues.some((issue) =>
      issue.message.includes("Ya existe un servicio con este identificador")
    )
  )
  const sql = read(
    "supabase/migrations/20261131000100_isp_1_2_1_migracion_abonados.sql"
  )
  assert.match(sql, /skippedServices/)
  assert.doesNotMatch(sql, /upgrade/)
})

test("16. Clientes 360 sigue mostrando el nombre comercial", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  assert.equal(
    servicePayload(result)?.nombre_servicio,
    "Plan 300 Megas + TV Full"
  )
  const detail = read("components/isp/isp-customer-detail-screen.tsx")
  assert.match(detail, /service\.planName/)
  assert.doesNotMatch(detail, /Internet:\s*300/)
})

test("17. /subscriptions puede resolver el componente TV", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        id: "cat-full",
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  const service = servicePayload(result)
  assert.equal(
    isCountableTvService({
      companyId: "co-1",
      actorCompanyId: "co-1",
      tvPlanCatalogId: String(service?.tv_plan_catalog_id),
      commercialStatus: "active",
    }),
    true
  )
  const summary = summarizeTvPlans([
    {
      code: "TV-FULL",
      catalogId: "tv-full",
      name: "TV Full",
      monthlyPrice: Number(service?.tv_monthly_price),
      activeCount: 1,
    },
  ])
  assert.equal(summary.totalActiveCustomers, 1)
  assert.equal(summary.totalMonthlyRevenue, 9900)
})

test("18. Internet no aparece como TV", () => {
  const result = validateWithCatalog([catalogItem(), TV_FULL])
  const service = servicePayload(result)
  assert.equal(
    isCountableTvService({
      companyId: "co-1",
      actorCompanyId: "co-1",
      tvPlanCatalogId: service?.tv_plan_catalog_id,
      commercialStatus: "active",
    }),
    false
  )
})

test("19. no utiliza tablas subscription_*", () => {
  const integrity = read("lib/isp/migration/integrity.ts")
  const queries = read("lib/isp/migration/queries.ts")
  const sql = read(
    "supabase/migrations/20261206000100_isp_migration_excel_tv_component.sql"
  )
  assert.doesNotMatch(integrity, /subscription_customers/)
  assert.doesNotMatch(queries, /subscription_services/)
  assert.doesNotMatch(sql, /subscription_sales/)
  assert.doesNotMatch(sql, /subscription_commissions/)
  assert.match(sql, /Does not use subscription_\*/)
})

test("20 y 21. facturación y SIRO no cambian", () => {
  const sql = read(
    "supabase/migrations/20261206000100_isp_migration_excel_tv_component.sql"
  )
  assert.match(sql, /Does not change billing or SIRO/)
  assert.doesNotMatch(sql, /siro_/)
  assert.doesNotMatch(sql, /isp_billing/)
  const service = servicePayload(
    validateWithCatalog(
      [
        catalogItem({
          name: "Plan 300 Megas + TV Full",
          tvPlanCatalogId: "tv-full",
        }),
        TV_FULL,
      ],
      {
        nombre_servicio: "Plan 300 Megas + TV Full",
        medio_cobranza: "SIRO",
        precio_mensual: "25000",
      }
    )
  )
  assert.equal(service?.billing_method, "siro")
  assert.equal(service?.monthly_price, 25000)
})

test("un único abono comercial: no crea un segundo isp_services de TV", () => {
  const result = validateWithCatalog(
    [
      catalogItem({
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  const services = result.stagingRows.filter((row) => row.sheet === "SERVICIOS")
  assert.equal(services.length, 1)
  assert.equal(services[0].payload.resolved_catalog_id, "cat-internet")
  const sql = read(
    "supabase/migrations/20261206000100_isp_migration_excel_tv_component.sql"
  )
  assert.doesNotMatch(sql, /INSERT INTO public\.isp_services/)
  assert.match(sql, /One commercial isp_services row/)
})

test("matching por código Bespoke y por nombre comercial", () => {
  const byCode = validateWithCatalog(
    [
      catalogItem({
        externalCode: "OTHER",
        code: "CAT-001",
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    { nombre_servicio: "Plan 300 Megas + TV Full" }
  )
  assert.equal(byCode.canImport, true)
  assert.equal(servicePayload(byCode)?.tv_plan_name, "TV Full")

  const byName = validateWithCatalog(
    [
      catalogItem({
        externalCode: "OTHER",
        code: "OTHER",
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      }),
      TV_FULL,
    ],
    {
      catalogo_id_externo: "NO-MATCH",
      nombre_servicio: "Plan 300 Megas + TV Full",
    }
  )
  assert.equal(byName.canImport, true)
  assert.equal(servicePayload(byName)?.tv_plan_name, "TV Full")
})

test("el archivo CATALOGO sigue permitiendo importar sin TV", () => {
  const result = validateIspMigration(
    workbookFrom({
      CLIENTES: [customerRow()],
      CATALOGO: [catalogRow()],
      SERVICIOS: [serviceRow()],
      CONEXIONES: [],
    }),
    emptyExisting()
  )
  assert.equal(result.canImport, true)
  assert.equal(servicePayload(result)?.has_tv_component, false)
})

test("plantilla lista servicios comerciales y no agrega TV", () => {
  const names = commercialServiceNamesForMigrationTemplate([
    catalogItem({ name: "Plan 300 Megas + TV Full" }),
    TV_FULL,
    catalogItem({ id: "cat-2", name: "Plan 300 Megas" }),
  ])
  assert.deepEqual(names, ["Plan 300 Megas", "Plan 300 Megas + TV Full"])
  const bytes = buildIspMigrationTemplateWorkbook({
    commercialServiceNames: names,
  })
  const parsed = parseIspMigrationWorkbook(Buffer.from(bytes))
  const firstService = parsed.sheets.SERVICIOS?.[0]?.values ?? {}
  assert.equal("plan_tv" in firstService, false)
})

test("el catálogo de la empresa se carga una vez y se resuelve en memoria", () => {
  const index = buildIspMigrationCatalogIndex([
    catalogItem({
      name: "Plan 300 Megas + TV Full",
      tvPlanCatalogId: "tv-full",
    }),
    TV_FULL,
  ])
  const match = resolveIspMigrationCommercialCatalog({
    catalogoIdExterno: "CAT-001",
    nombreServicio: "Plan 300 Megas + TV Full",
    fileCatalogIds: new Set(),
    index,
  })
  assert.equal(match.ok, true)
  assert.equal(match.ok ? match.source : null, "existing")
  const tv =
    match.ok && match.source === "existing"
      ? resolveIspMigrationTvComponent(match.catalog, index.byId)
      : { ok: false }
  assert.equal(tv.ok, true)
  assert.equal(tv.ok ? tv.component?.tvPlanName : null, "TV Full")
  const queries = read("lib/isp/migration/queries.ts")
  assert.match(queries, /loadIspMigrationExistingState/)
  assert.match(
    queries,
    /select\(\s*"id, company_id, external_code, code, name, category, is_active, monthly_price, tv_plan_catalog_id"/
  )
})

test("alta manual usa el catálogo comercial, no una lista paralela de TV", () => {
  const wizard = read("components/isp/isp-onboarding-wizard.tsx")
  assert.match(wizard, /Servicio del catálogo/)
  assert.match(wizard, /catalogItems\.map/)
  assert.doesNotMatch(wizard, /plan_tv/)
  assert.doesNotMatch(wizard, /Seleccionar plan TV/)
})
