import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { snapshotServiceFromCatalog } from "../lib/isp/catalog-integrity.ts"
import { connectionFieldsForType, canCreateIspGraph, validateConnectionFields } from "../lib/isp/integrity.ts"
import { mapIspConnectionRow, mapIspServiceRow } from "../lib/isp/mapper.ts"
import {
  canCreateConnectionForContractedService,
  canCreateOrphanConnection,
  compatibleTechnicalProfiles,
  contractedPriceDiffersFromList,
  defaultCommercialStatusOnCreate,
  defaultTechnicalStatusOnCreate,
  didModifyCatalogPriceWhenEditingSubscriber,
  emptyConnectionDraft,
  formatContractedSpeedLabel,
  graphAllowsMultipleServicesPerSubscriber,
  isConnectionTypeAllowedForCatalog,
  isTechnicalProfileCompatible,
  isTransactionalServiceAndConnectionCreate,
  planChangeKeepsPreviousService,
  prefillConnectionFromCatalog,
  stripConnectionSecrets,
  submitLabelForIncludeConnection,
  validateSubscriberServiceCreate,
} from "../lib/isp/subscriber-service-integrity.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261136000100_isp_1_4_servicios_conexiones_abonado.sql"
)
const detail = read("components/isp/isp-customer-detail-screen.tsx")
const serviceCard = read("components/isp/isp-service-card.tsx")
const detailUi = `${detail}\n${serviceCard}`
const sheet = read("components/isp/isp-subscriber-service-sheet.tsx")
const fields = read("components/isp/isp-connection-fields.tsx")
const connectionsList = read("components/isp/isp-connections-list-screen.tsx")
const connectionsApi = read("app/api/isp/connections/route.ts")
const mapper = read("lib/isp/mapper.ts")

function sampleCatalog(overrides = {}) {
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
    monthlyPrice: 30000,
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: ["pppoe", "static_ip"],
    technicalProfileId: "prof-100",
    technicalProfile: {
      id: "prof-100",
      companyId: "co-1",
      code: "FTTH-100",
      name: "Perfil FTTH 100",
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
    },
    otLabel: "100 Mb",
    legacyPlanCode: "100Mb",
    isSeed: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  }
}

function serviceRow(overrides = {}) {
  return {
    id: "svc-1",
    company_id: "co-1",
    customer_id: "cust-1",
    catalog_id: "cat-100",
    catalog_code: "FTTH-100",
    external_code: null,
    technology: "ftth",
    plan_name: "Internet Fibra 100 Mb",
    contracted_speed: "100/25 Mbps",
    download_speed: 100,
    upload_speed: 25,
    speed_unit: "mbps",
    list_price: 30000,
    monthly_fee: 27000,
    activation_date: "2026-08-25",
    commercial_status: "pending_activation",
    monthly_collection_method: "siro",
    source_task_id: null,
    notes: null,
    replaced_service_id: null,
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  }
}

function connectionRow(overrides = {}) {
  return {
    id: "cn-1",
    company_id: "co-1",
    service_id: "svc-1",
    connection_type: "pppoe",
    pppoe_username: "30512345",
    pppoe_password: "secret",
    technical_profile: "FTTH-100",
    technical_profile_id: "prof-100",
    ip_address: null,
    prefix_length: null,
    gateway: null,
    vlan: "20",
    core_name: "MikroTik",
    core_profile_id: "FTTH-100",
    technical_status: "pending_provision",
    last_sync_at: null,
    provision_error: null,
    source_task_id: null,
    external_code: null,
    notes: null,
    provisioned_at: null,
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  }
}

test("1. abonado sin servicios", () => {
  assert.match(detail, /ISP_EMPTY_SERVICES_MESSAGE/)
  assert.match(detail, /\+ Agregar servicio/)
  assert.equal(
    validateSubscriberServiceCreate({
      customerId: "cust-1",
      actorCompanyId: "co-1",
      subscriberExists: true,
      catalog: sampleCatalog(),
      catalogId: "cat-100",
      includeConnection: false,
    }).valid,
    true
  )
})

test("2. crear servicio sin conexión", () => {
  const result = validateSubscriberServiceCreate({
    customerId: "cust-1",
    actorCompanyId: "co-1",
    catalog: sampleCatalog(),
    catalogId: "cat-100",
    includeConnection: false,
  })
  assert.equal(result.valid, true)
  assert.match(sql, /v_include_connection boolean/)
  assert.match(sheet, /ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE/)
  assert.equal(
    isTransactionalServiceAndConnectionCreate({
      includeConnection: false,
      serviceCreated: true,
      connectionCreated: false,
    }),
    true
  )
})

test("3. crear servicio + conexión", () => {
  const result = validateSubscriberServiceCreate({
    customerId: "cust-1",
    actorCompanyId: "co-1",
    catalog: sampleCatalog(),
    catalogId: "cat-100",
    includeConnection: true,
    connection: {
      connectionType: "pppoe",
      pppoeUsername: "30512345",
      pppoePassword: "secret",
    },
  })
  assert.equal(result.valid, true)
  assert.match(sql, /create_isp_subscriber_service/)
  assert.match(sql, /isp_create_connection_on_service/)
  assert.equal(
    submitLabelForIncludeConnection(true),
    "Guardar servicio y conexión"
  )
})

test("4-5. segundo servicio y segunda conexión", () => {
  assert.equal(graphAllowsMultipleServicesPerSubscriber(), true)
  assert.doesNotMatch(sql, /UNIQUE \(customer_id\)/)
  const original = read(
    "supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"
  )
  assert.match(original, /UNIQUE \(service_id\)/)
  assert.match(sql, /Este servicio ya tiene una conexión técnica/)
})

test("6. servicio sin conexión visible", () => {
  assert.match(detailUi, /ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE/)
  assert.match(detailUi, /Crear conexión/)
})

test("7. conexión siempre requiere servicio", () => {
  const orphan = canCreateOrphanConnection()
  assert.equal(orphan.allowed, false)
  assert.match(orphan.message, /servicio/)
  assert.equal(
    canCreateIspGraph({
      customerId: "c1",
      createService: false,
      createConnection: true,
    }).allowed,
    false
  )
  assert.equal(
    canCreateConnectionForContractedService({ serviceId: null }).allowed,
    false
  )
  assert.match(sql, /Una conexión no puede existir sin un servicio/)
  assert.match(connectionsApi, /serviceId/)
  assert.match(connectionsList, /Seleccionar servicio contratado/)
})

test("8. PPPoE muestra usuario y contraseña", () => {
  const shown = connectionFieldsForType("pppoe")
  assert.equal(shown.showPppoe, true)
  assert.equal(shown.showStaticIp, false)
  assert.match(fields, /Usuario PPPoE/)
  assert.match(fields, /Contraseña PPPoE/)
  assert.match(fields, /type="password"/)
  assert.equal(
    validateConnectionFields({
      type: "pppoe",
      pppoeUsername: "30512345",
      pppoePassword: "secret",
    }).valid,
    true
  )
})

test("9. IP estática muestra IP, prefijo y gateway", () => {
  const shown = connectionFieldsForType("static_ip")
  assert.equal(shown.showStaticIp, true)
  assert.equal(shown.showPppoe, false)
  assert.match(fields, /label="IP"/)
  assert.match(fields, /Máscara\/prefijo/)
  assert.match(fields, /label="Gateway"/)
  assert.equal(
    validateConnectionFields({ type: "static_ip", ipAddress: "200.1.1.1" }).valid,
    true
  )
})

test("10. DHCP no exige PPPoE", () => {
  const shown = connectionFieldsForType("dhcp")
  assert.equal(shown.showPppoe, false)
  assert.equal(shown.showStaticIp, false)
  assert.equal(validateConnectionFields({ type: "dhcp" }).valid, true)
})

test("11. tipos de conexión respetan catálogo", () => {
  assert.equal(
    isConnectionTypeAllowedForCatalog(["pppoe", "static_ip"], "pppoe"),
    true
  )
  assert.equal(
    isConnectionTypeAllowedForCatalog(["pppoe", "static_ip"], "dhcp"),
    false
  )
  assert.equal(
    validateSubscriberServiceCreate({
      customerId: "cust-1",
      actorCompanyId: "co-1",
      catalog: sampleCatalog(),
      catalogId: "cat-100",
      includeConnection: true,
      connection: { connectionType: "dhcp" },
    }).valid,
    false
  )
  assert.match(sql, /El tipo de conexión no está permitido para este servicio/)
})

test("12. perfil técnico se precarga", () => {
  const prefill = prefillConnectionFromCatalog(sampleCatalog())
  assert.equal(prefill.technicalProfileId, "prof-100")
  assert.equal(prefill.technicalProfile, "FTTH-100")
  assert.equal(prefill.coreName, "MikroTik")
  assert.equal(prefill.connectionType, "pppoe")
  assert.match(sheet, /prefillConnectionFromCatalog/)
})

test("13. estado técnico inicia en provisioning pendiente", () => {
  assert.equal(defaultTechnicalStatusOnCreate(), "pending_provision")
  assert.match(sql, /'pending_provision'/)
  assert.doesNotMatch(
    sql.replace(/update_isp_connection[\s\S]*$/, ""),
    /'provisioned'/
  )
  assert.equal(emptyConnectionDraft().technicalStatus, "pending_provision")
})

test("14. estado comercial independiente", () => {
  assert.equal(
    defaultCommercialStatusOnCreate("2026-08-25", "2026-08-25"),
    "active"
  )
  assert.notEqual(
    defaultCommercialStatusOnCreate("2026-08-25", "2026-08-25"),
    defaultTechnicalStatusOnCreate()
  )
  const service = mapIspServiceRow(
    serviceRow({ commercial_status: "active" })
  )
  const connection = mapIspConnectionRow(
    connectionRow({ technical_status: "pending_provision" }),
    "cust-1"
  )
  assert.equal(service.commercialStatus, "active")
  assert.equal(connection.technicalStatus, "pending_provision")
})

test("15. precio contratado puede diferir del catálogo", () => {
  assert.equal(
    contractedPriceDiffersFromList({ listPrice: 30000, contractedPrice: 27000 }),
    true
  )
  const snapshot = snapshotServiceFromCatalog(sampleCatalog())
  assert.equal(snapshot.listPrice, "30000")
  assert.equal(snapshot.monthlyFee, "30000")
  assert.match(sheet, /Precio de lista/)
  assert.match(sheet, /Precio contratado/)
  const mapped = mapIspServiceRow(serviceRow())
  assert.equal(mapped.listPrice, 30000)
  assert.equal(mapped.monthlyFee, 27000)
})

test("16. precio de catálogo no se modifica al editar abonado", () => {
  assert.equal(didModifyCatalogPriceWhenEditingSubscriber(), false)
  assert.match(sql, /update_isp_contracted_service/)
  assert.doesNotMatch(sql, /UPDATE public\.isp_service_catalog/)
  assert.match(
    sql,
    /Does not modify the catalog|Does not rewrite[\s\S]*catalog/
  )
})

test("17. cambio de plan no elimina historial", () => {
  assert.equal(
    planChangeKeepsPreviousService({
      previousServiceId: "svc-old",
      previousDeleted: false,
      previousStatus: "cancelled",
      newServiceId: "svc-new",
      replacedServiceId: "svc-old",
    }),
    true
  )
  assert.equal(
    planChangeKeepsPreviousService({
      previousServiceId: "svc-old",
      previousDeleted: true,
      newServiceId: "svc-new",
      replacedServiceId: "svc-old",
    }),
    false
  )
  assert.match(sql, /replaced_service_id/)
  assert.match(sql, /commercial_status = 'cancelled'/)
  assert.doesNotMatch(sql, /DELETE FROM public\.isp_services/)
  assert.match(detailUi, /Cambiar servicio/)
  assert.match(detailUi, /Baja:/)
})

test("18. RLS impide acceso cross-tenant", () => {
  assert.match(sql, /company_id = v_company_id/)
  assert.match(sql, /El servicio del catálogo no pertenece a esta empresa/)
  assert.match(sql, /El perfil técnico no pertenece a esta empresa/)
  assert.match(sql, /enforce_isp_connection_technical_profile_company/)
  assert.equal(
    validateSubscriberServiceCreate({
      customerId: "cust-1",
      actorCompanyId: "co-1",
      customerCompanyId: "co-2",
      catalog: sampleCatalog(),
      catalogId: "cat-100",
      includeConnection: false,
    }).valid,
    false
  )
})

test("19. no se crean conexiones huérfanas", () => {
  assert.match(sql, /p_service_id IS NULL/)
  assert.equal(
    canCreateConnectionForContractedService({
      serviceId: "svc-1",
      hasExistingConnection: true,
    }).allowed,
    false
  )
  const oneToOne = read("lib/supabase/database.types.ts")
  assert.match(oneToOne, /isp_connections_service_id_fkey/)
})

test("20. alta transaccional funciona", () => {
  assert.match(sql, /IF v_include_connection THEN/)
  assert.match(
    sql,
    /v_connection_id := public.isp_create_connection_on_service\(v_service_id/
  )
  assert.equal(
    isTransactionalServiceAndConnectionCreate({
      includeConnection: true,
      serviceCreated: true,
      connectionCreated: true,
    }),
    true
  )
})

test("21. fallo de conexión no deja servicio parcial", () => {
  assert.equal(
    isTransactionalServiceAndConnectionCreate({
      includeConnection: true,
      serviceCreated: false,
      connectionCreated: false,
      connectionFailed: true,
    }),
    true
  )
  assert.doesNotMatch(sql, /COMMIT/)
  assert.match(sql, /rolls back as one unit/)
})

test("22. cliente puede tener múltiples servicios", () => {
  assert.equal(
    canCreateIspGraph({
      customerId: "c1",
      createService: true,
      createConnection: false,
    }).allowed,
    true
  )
  assert.match(detail, /openSheet\("add-service"/)
})

test("23. un servicio puede existir sin conexión", () => {
  assert.equal(
    submitLabelForIncludeConnection(false),
    "Guardar servicio"
  )
  assert.match(sql, /COALESCE\(\(p_payload ->> 'includeConnection'\)::boolean, false\)/)
})

test("snapshot comercial conserva código, velocidades y precio de lista", () => {
  const snapshot = snapshotServiceFromCatalog(sampleCatalog())
  assert.equal(snapshot.catalogCode, "FTTH-100")
  assert.equal(snapshot.downloadSpeed, 100)
  assert.equal(snapshot.uploadSpeed, 25)
  assert.equal(snapshot.contractedSpeed, "100/25 Mbps")
  assert.equal(
    formatContractedSpeedLabel({
      downloadSpeed: 100,
      uploadSpeed: 25,
      speedUnit: "mbps",
    }),
    "100/25 Mbps"
  )
})

test("contraseñas no viajan en listados ni respuestas de detalle", () => {
  const mapped = mapIspConnectionRow(connectionRow(), "cust-1")
  assert.equal(mapped.pppoePassword, null)
  assert.equal(mapped.pppoePasswordSet, true)
  const stripped = stripConnectionSecrets({
    ...mapped,
    pppoePassword: "secret",
  })
  assert.equal(stripped.pppoePassword, null)
  assert.match(mapper, /includePassword/)
  assert.doesNotMatch(connectionsList, /pppoePassword/)
  assert.doesNotMatch(detail, /pppoePassword/)
})

test("perfiles incompatibles no se ofrecen", () => {
  const dhcpOnly = {
    id: "p-dhcp",
    isActive: true,
    connectionType: "dhcp",
  }
  const pppoe = {
    id: "p-pppoe",
    isActive: true,
    connectionType: "pppoe",
  }
  const compatible = compatibleTechnicalProfiles([dhcpOnly, pppoe], "pppoe")
  assert.equal(compatible.length, 1)
  assert.equal(compatible[0].id, "p-pppoe")
  assert.equal(
    isTechnicalProfileCompatible({
      profile: { companyId: "co-1", isActive: true, connectionType: "dhcp" },
      companyId: "co-1",
      connectionType: "pppoe",
      selectedProfileId: "p-dhcp",
    }),
    false
  )
})

test("el alta cotidiana vive en Clientes 360 y no manda a /servicios", () => {
  assert.match(detail, /IspSubscriberServiceSheet/)
  assert.doesNotMatch(detail, /clientes-360\/nuevo/)
  assert.doesNotMatch(detail, /href=\{`\/servicios\/\$\{service\.catalogId\}`\}/)
  assert.match(sheet, /submitLabelForIncludeConnection/)
  assert.match(sheet, /ISP_CREATE_CONNECTION_CHECKBOX_LABEL/)
  assert.match(connectionsList, /\+ Nueva conexión/)
})

test("no hay provisioning real ni se copian velocidades en la conexión", () => {
  assert.match(sql, /Speeds live on the contracted service, not here/)
  const connectionSql =
    sql.split("INSERT INTO public.isp_connections")[1]?.split("RETURNING")[0] ??
    ""
  assert.doesNotMatch(connectionSql, /download_speed/)
  assert.doesNotMatch(connectionSql, /upload_speed/)
  assert.doesNotMatch(sql, /MikroTik API|provision_user|create_ppp_secret/)
})

test("catálogo inactivo no se puede contratar", () => {
  const result = validateSubscriberServiceCreate({
    customerId: "cust-1",
    actorCompanyId: "co-1",
    catalog: sampleCatalog({ isActive: false }),
    catalogId: "cat-100",
    includeConnection: false,
  })
  assert.equal(result.valid, false)
  assert.match(sql, /El servicio del catálogo no está activo/)
})

test("precio contratado negativo se rechaza", () => {
  const result = validateSubscriberServiceCreate({
    customerId: "cust-1",
    actorCompanyId: "co-1",
    catalog: sampleCatalog(),
    catalogId: "cat-100",
    monthlyFee: -1,
    includeConnection: false,
  })
  assert.equal(result.valid, false)
  assert.match(sql, /El precio contratado no puede ser negativo/)
})
