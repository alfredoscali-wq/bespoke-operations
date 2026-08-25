import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { formatCatalogSpeed } from "../lib/isp/catalog-integrity.ts"
import { mapIspConnectionRow, mapIspServiceRow } from "../lib/isp/mapper.ts"
import {
  ISP_ACTIVITY_SUMMARY_LIMIT,
  ISP_KEEP_PPPOE_PASSWORD_PLACEHOLDER,
  ISP_SUBSEQUENT_COMMERCIAL_STATUSES,
  canOperatorChooseCommercialStatusOnCreate,
  commercialStatusFromActivationDate,
  defaultCommercialStatusOnCreate,
  defaultTechnicalStatusOnCreate,
  keepExistingText,
  mergeConnectionEdit,
  resolveCommercialStatusOnServiceUpdate,
  resolveEffectiveCommercialStatus,
  shouldUpdatePppoePassword,
  validateConnectionUpdate,
} from "../lib/isp/subscriber-service-integrity.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261137000100_isp_1_4_1_fecha_alta_estado_comercial.sql"
)
const sql14 = read(
  "supabase/migrations/20261136000100_isp_1_4_servicios_conexiones_abonado.sql"
)
const detail = read("components/isp/isp-customer-detail-screen.tsx")
const sheet = read("components/isp/isp-subscriber-service-sheet.tsx")
const fields = read("components/isp/isp-connection-fields.tsx")
const editCustomer = read("components/isp/isp-customer-edit-sheet.tsx")
const historySheet = read("components/isp/isp-subscriber-history-sheet.tsx")
const customerApi = read("app/api/isp/customers/[id]/route.ts")
const createServiceApi = read("app/api/isp/customers/[id]/services/route.ts")
const updateServiceApi = read("app/api/isp/services/[id]/route.ts")
const connectionApi = read("app/api/isp/connections/[id]/route.ts")
const queries = read("lib/isp/queries.ts")
const clientesPage = read("components/clientes/customers-module.tsx")

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
    list_price: 35000,
    monthly_fee: 30000,
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
    pppoe_username: "30651517",
    pppoe_password: "secret",
    technical_profile: "FTTH-100",
    technical_profile_id: "prof-100",
    ip_address: "200.1.1.1",
    prefix_length: 24,
    gateway: "200.1.1.254",
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

test("1. abrir abonado muestra Editar cliente", () => {
  assert.match(detail, /Editar cliente/)
  assert.doesNotMatch(detail, /Editar abonado/)
  assert.match(detail, /Nueva Atención/)
  assert.match(detail, /\+ Agregar servicio/)
})

test("2-6. editar nombre, teléfono, email y domicilio del cliente", () => {
  assert.match(editCustomer, /Nombre \/ Razón social/)
  assert.match(editCustomer, /DNI \/ CUIT/)
  assert.match(editCustomer, /htmlFor="isp-customer-phone"/)
  assert.match(editCustomer, /htmlFor="isp-customer-whatsapp"/)
  assert.match(editCustomer, /htmlFor="isp-customer-email"/)
  assert.match(editCustomer, /htmlFor="isp-customer-address"/)
  assert.match(editCustomer, /Domicilio/)
  assert.match(editCustomer, /Localidad/)
  assert.match(editCustomer, /method: "PATCH"/)
  assert.match(editCustomer, /\/api\/isp\/customers\/\$\{customer\.id\}/)
})

test("7-9. guardar actualiza customers y conserva isp_subscriber", () => {
  assert.match(customerApi, /export async function PATCH/)
  assert.match(customerApi, /updateCustomer/)
  assert.match(customerApi, /eq\("company_id", auth\.companyId\)/)
  assert.match(customerApi, /from\("isp_subscribers"\)/)
  assert.match(customerApi, /\.select\("id"\)/)
  assert.doesNotMatch(
    customerApi,
    /from\("isp_subscribers"\)[\s\S]{0,120}\.(insert|update|delete)\(/
  )
  assert.doesNotMatch(customerApi, /from\("isp_services"\)/)
  assert.doesNotMatch(customerApi, /from\("isp_connections"\)/)
  assert.match(detail, /IspCustomerEditSheet/)
  assert.match(detail, /onSaved=\{handleSaved\}/)
})

test("10. /clientes no se modifica en este sprint", () => {
  assert.match(clientesPage, /CustomersModule|clientes/)
  assert.doesNotMatch(editCustomer, /useCustomers/)
})

test("alta hoy o anterior → Activo", () => {
  assert.equal(
    commercialStatusFromActivationDate("2026-08-25", "2026-08-25"),
    "active"
  )
  assert.equal(
    commercialStatusFromActivationDate("2026-08-24", "2026-08-25"),
    "active"
  )
  assert.equal(defaultCommercialStatusOnCreate("2026-08-25", "2026-08-25"), "active")
})

test("alta futura → Pendiente de alta", () => {
  assert.equal(
    commercialStatusFromActivationDate("2026-09-01", "2026-08-25"),
    "pending_activation"
  )
})

test("al llegar la fecha futura → Activo sin intervención", () => {
  assert.equal(
    resolveEffectiveCommercialStatus({
      storedStatus: "pending_activation",
      activationDate: "2026-09-01",
      today: "2026-08-25",
    }),
    "pending_activation"
  )
  assert.equal(
    resolveEffectiveCommercialStatus({
      storedStatus: "pending_activation",
      activationDate: "2026-09-01",
      today: "2026-09-01",
    }),
    "active"
  )
  const mapped = mapIspServiceRow(
    serviceRow({
      commercial_status: "pending_activation",
      activation_date: "2026-08-24",
    })
  )
  assert.equal(
    resolveEffectiveCommercialStatus({
      storedStatus: mapped.commercialStatus === "active" ? "pending_activation" : mapped.commercialStatus,
      activationDate: "2026-08-24",
      today: "2026-08-25",
    }),
    "active"
  )
})

test("no existe selector manual de estado comercial en el alta", () => {
  assert.equal(canOperatorChooseCommercialStatusOnCreate(), false)
  assert.doesNotMatch(sheet, /ISP_COMMERCIAL_STATUSES/)
  assert.match(sheet, /Fecha de alta/)
  assert.match(sheet, /todayIsoDate\(\)/)
  assert.doesNotMatch(
    createServiceApi,
    /commercialStatus: body\.commercialStatus/
  )
  assert.match(sql, /isp_commercial_status_from_activation/)
  assert.match(sql, /isp_apply_activation_commercial_status/)
})

test("Suspendido y Baja siguen como estados posteriores", () => {
  assert.deepEqual([...ISP_SUBSEQUENT_COMMERCIAL_STATUSES], [
    "suspended",
    "cancelled",
  ])
  assert.equal(
    resolveEffectiveCommercialStatus({
      storedStatus: "suspended",
      activationDate: "2026-08-01",
      today: "2026-08-25",
    }),
    "suspended"
  )
  assert.equal(
    resolveEffectiveCommercialStatus({
      storedStatus: "cancelled",
      activationDate: "2026-08-01",
      today: "2026-08-25",
    }),
    "cancelled"
  )
  assert.match(sheet, /SelectItem value="suspended">Suspendido/)
  assert.match(sheet, /SelectItem value="cancelled">Baja/)
  assert.match(sheet, /Según fecha de alta/)
  assert.equal(
    resolveCommercialStatusOnServiceUpdate({
      requested: "suspended",
      existingStatus: "active",
      activationDate: "2026-08-25",
    }),
    "suspended"
  )
  assert.equal(
    resolveCommercialStatusOnServiceUpdate({
      existingStatus: "suspended",
      activationDate: "2026-08-25",
    }),
    undefined
  )
})

test("editar servicio permite precio, fecha y observaciones", () => {
  assert.match(sheet, /Precio contratado/)
  assert.match(sheet, /Fecha de alta/)
  assert.match(sheet, /Observaciones/)
  assert.match(updateServiceApi, /monthlyFee/)
  assert.match(updateServiceApi, /activationDate/)
  assert.doesNotMatch(sql14, /UPDATE public\.isp_service_catalog/)
  assert.doesNotMatch(sql, /UPDATE public\.isp_service_catalog/)
})

test("precio de lista y contratado permanecen independientes", () => {
  const mapped = mapIspServiceRow(serviceRow())
  assert.equal(mapped.listPrice, 35000)
  assert.equal(mapped.monthlyFee, 30000)
})

test("editar PPPoE existente no exige volver a cargar usuario", () => {
  assert.equal(keepExistingText("", "30651517"), "30651517")
  assert.equal(
    validateConnectionUpdate({
      type: "pppoe",
      pppoeUsername: "",
      pppoePassword: "",
      existingPppoeUsername: "30651517",
      existingPasswordSet: true,
    }).valid,
    true
  )
  assert.match(sheet, /pppoeUsername: connection\.pppoeUsername/)
  assert.match(sql, /isp_keep_text\(v_connection ->> 'pppoeUsername'/)
  assert.match(connectionApi, /validateConnectionUpdate/)
  assert.match(connectionApi, /mergeConnectionEdit/)
})

test("contraseña vacía conserva; nueva actualiza; nunca se muestra", () => {
  assert.equal(shouldUpdatePppoePassword(""), false)
  assert.equal(shouldUpdatePppoePassword("nueva"), true)
  assert.equal(ISP_KEEP_PPPOE_PASSWORD_PLACEHOLDER, "Dejar vacío para conservar la contraseña actual")
  assert.match(sheet, /ISP_KEEP_PPPOE_PASSWORD_PLACEHOLDER/)
  assert.match(fields, /type="password"/)
  assert.match(fields, /passwordPlaceholder/)
  assert.match(sql, /Empty password keeps the stored secret/)
  const mapped = mapIspConnectionRow(connectionRow(), "cust-1")
  assert.equal(mapped.pppoePassword, null)
  assert.equal(mapped.pppoePasswordSet, true)
})

test("editar conexión conserva VLAN, IP, perfil y no toca velocidades", () => {
  const existing = mapIspConnectionRow(connectionRow(), "cust-1")
  const merged = mergeConnectionEdit(
    {
      connectionType: "pppoe",
      pppoeUsername: "",
      pppoePassword: "",
      vlan: "",
      ipAddress: "",
      technicalProfileId: "",
      technicalProfile: "",
    },
    existing
  )
  assert.equal(merged.pppoeUsername, "30651517")
  assert.equal(merged.vlan, "20")
  assert.equal(merged.ipAddress, "200.1.1.1")
  assert.equal(merged.technicalProfileId, "prof-100")
  assert.equal(merged.technicalProfile, "FTTH-100")
  assert.match(fields, /inheritedDownload/)
  assert.match(fields, /inheritedPair/)
  assert.match(fields, /value=\{inheritedDownload\} disabled/)
  assert.match(fields, /value=\{inheritedUpload\} disabled/)
  assert.equal(formatCatalogSpeed(100, 25, "mbps"), "100/25 Mbps")
  assert.notEqual(formatCatalogSpeed(100, 25, "mbps"), "100/100 Mbps")
  const service = mapIspServiceRow(serviceRow({ commercial_status: "active" }))
  const connection = mapIspConnectionRow(
    connectionRow({ technical_status: "pending_provision" }),
    "cust-1"
  )
  assert.equal(service.commercialStatus, "active")
  assert.equal(connection.technicalStatus, "pending_provision")
  assert.notEqual(service.commercialStatus, connection.technicalStatus)
  assert.notEqual(
    defaultCommercialStatusOnCreate("2026-08-25", "2026-08-25"),
    defaultTechnicalStatusOnCreate()
  )
})

test("actividad resumida y historial completo permanecen en el abonado", () => {
  assert.match(detail, /CardTitle[\s\S]{0,80}Actividad/)
  assert.match(detail, /Ver historial completo/)
  assert.match(detail, /setHistoryOpen\(true\)/)
  assert.match(detail, /ISP_ACTIVITY_SUMMARY_LIMIT/)
  assert.equal(ISP_ACTIVITY_SUMMARY_LIMIT, 8)
  assert.doesNotMatch(
    detail,
    /href="\/atencion-cliente">Ver historial completo/
  )
  assert.match(historySheet, /Historial del abonado/)
  assert.match(detail, /IspSubscriberHistorySheet/)
  assert.match(queries, /Servicio \$\{service\.planName\} creado/)
  assert.match(queries, /Conexión \$\{typeLabel\} registrada/)
  assert.match(queries, /Atención/)
  assert.match(queries, /OT \$\{order\.code\}/)
  assert.match(queries, /Datos del cliente actualizados/)
  assert.doesNotMatch(queries, /\.eq\("customer_dni"/)
  assert.match(detail, /Este abonado no tiene OT asociadas/)
  assert.match(sql, /Future billing uses this date/)
  assert.doesNotMatch(sql, /INSERT INTO public\.invoices/)
  assert.doesNotMatch(detail, /prorrateo|proporcional/i)
})
