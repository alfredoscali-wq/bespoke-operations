import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { APP_MODULE_KEYS } from "../lib/roles/app-modules.ts"
import { DEFAULT_COMPANY_AREA_MODULE_VISIBILITY } from "../lib/roles/company-areas.ts"
import {
  canCreateIspGraph,
  connectionFieldsForType,
  didCopyOtChargeToMonthlyFee,
  didCopyOtPaymentMethodToMonthlyCollection,
  didInferPppoeUsernameFromDni,
  deriveCustomerServiceOverview,
  belongsToIspUniverse,
  formatCommercialTechnicalPair,
  matchCustomerByDni,
  resolveMonthlyCollectionMethod,
  suggestConnectionTypeFromWorkOrder,
} from "../lib/isp/integrity.ts"
import {
  buildConnectionDraftFromOtPrefill,
  buildIspPrefillFromWorkOrder,
} from "../lib/isp/ot-prefill.ts"
import { NEW_INSTALLATION_SERVICE_TYPE } from "../lib/isp/constants.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
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
    installationCost: 25000,
    amountToCollect: 18000,
    paymentMethod: "efectivo",
    taskMetadata: { email: "juan@test.com", technology: "fiber" },
    ...overrides,
  }
}

test("1. permite crear cliente sin conexión", () => {
  assert.equal(
    canCreateIspGraph({
      createCustomer: true,
      createService: false,
      createConnection: false,
    }).allowed,
    true
  )
})

test("2. permite cliente + servicio + conexión", () => {
  assert.equal(
    canCreateIspGraph({
      createCustomer: true,
      createService: true,
      createConnection: true,
    }).allowed,
    true
  )
})

test("3. impide conexión sin cliente", () => {
  const result = canCreateIspGraph({
    createCustomer: false,
    createService: true,
    createConnection: true,
  })
  assert.equal(result.allowed, false)
})

test("4. impide conexión sin servicio", () => {
  const result = canCreateIspGraph({
    customerId: "c1",
    createService: false,
    createConnection: true,
  })
  assert.equal(result.allowed, false)
  assert.match(result.message ?? "", /servicio/i)
})

test("5-6. cliente con múltiples conexiones o ninguna aparece en 360", () => {
  assert.equal(
    deriveCustomerServiceOverview({
      serviceCount: 2,
      connectionCount: 2,
      hasPendingProvision: false,
      hasActiveCommercial: true,
    }),
    "Activo"
  )
  assert.equal(
    deriveCustomerServiceOverview({
      serviceCount: 0,
      connectionCount: 0,
      hasPendingProvision: false,
      hasActiveCommercial: false,
    }),
    "Sin servicio"
  )
})

test("7. detecta cliente existente por DNI/CUIT", () => {
  const match = matchCustomerByDni(
    [
      { id: "1", dni: "20.123.456" },
      { id: "2", dni: "30111222" },
    ],
    "20123456"
  )
  assert.equal(match?.id, "1")
})

test("8-10. precarga OT y no copia medio de pago ni importe puntual al abono", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [
      { id: "cust-1", name: "Juan", dni: "20123456", phone: "351" },
    ],
    task: sampleTask(),
  })

  assert.equal(prefill.isNewInstallation, true)
  assert.equal(prefill.customer.name, "Juan Pérez")
  assert.equal(prefill.customer.existingCustomer?.id, "cust-1")
  assert.equal(prefill.service.technology, "ftth")
  assert.equal(prefill.service.planName, "300Mb")
  assert.equal(prefill.fromOt.customer, true)
  assert.equal(prefill.service.monthlyCollectionMethod, "pending")
  assert.equal(prefill.service.monthlyFee, "")
  assert.equal(prefill.fromOt.monthlyFee, false)
  assert.equal(prefill.connection.connectionType, "")
  assert.equal(prefill.connection.pppoeUsername, "")
  assert.equal(prefill.otPaymentMethod, "efectivo")
  assert.equal(
    didCopyOtPaymentMethodToMonthlyCollection({
      monthlyCollectionMethod: prefill.service.monthlyCollectionMethod ?? "",
      otPaymentMethod: prefill.otPaymentMethod,
    }),
    false
  )
  assert.equal(
    didCopyOtChargeToMonthlyFee({
      monthlyFee: prefill.service.monthlyFee,
      otInstallationAmount: prefill.otInstallationAmount,
      otAmountToCollect: prefill.otAmountToCollect,
    }),
    false
  )
  assert.equal(
    resolveMonthlyCollectionMethod({
      requested: "efectivo",
      otPaymentMethod: "efectivo",
    }),
    "pending"
  )
})

test("11. diferencia estado comercial y técnico", () => {
  const pair = formatCommercialTechnicalPair({
    commercialStatus: "active",
    technicalStatus: "pending_provision",
  })
  assert.equal(pair.isFullyActive, false)
  assert.match(pair.combinedLabel, /Activo/)
  assert.match(pair.combinedLabel, /Provisionamiento pendiente/)
})

test("12. PPPoE muestra usuario y contraseña", () => {
  const fields = connectionFieldsForType("pppoe")
  assert.equal(fields.showPppoe, true)
  assert.equal(fields.showStaticIp, false)
})

test("13. IP estática muestra IP/máscara/gateway y oculta PPPoE", () => {
  const fields = connectionFieldsForType("static_ip")
  assert.equal(fields.showStaticIp, true)
  assert.equal(fields.showPppoe, false)
})

test("14-16. Clientes 360 y Conexiones no reutilizan /clientes", () => {
  const modules = read("lib/roles/app-modules.ts")
  const nav = read("lib/navigation/nav-items.ts")
  assert.ok(APP_MODULE_KEYS.includes("clientes_360"))
  assert.match(modules, /pathPrefixes: \["\/clientes-360", "\/conexiones", "\/servicios"\]/)
  assert.match(nav, /href: "\/clientes-360"/)
  assert.match(nav, /href: "\/conexiones"/)
  assert.match(nav, /href: "\/servicios"/)
  assert.match(nav, /href: "\/clientes"/)
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.operario.clientes_360,
    false
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.tecnica.clientes_360,
    true
  )
})

test("17-18. RLS y FKs impiden registros huérfanos y cruzar empresas", () => {
  const sql = read(
    "supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"
  )
  assert.match(sql, /customer_id uuid NOT NULL REFERENCES public.customers/)
  assert.match(sql, /service_id uuid NOT NULL REFERENCES public.isp_services/)
  assert.match(
    sql,
    /CONSTRAINT isp_connections_service_unique UNIQUE \(service_id\)/
  )
  assert.match(sql, /auth_user_has_allowed_module\('clientes_360'\)/)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
  assert.match(
    sql,
    /El servicio no puede asociarse a un cliente de otra empresa/
  )
  assert.match(sql, /La conexión requiere un servicio existente/)
})

test("19. el alta es transaccional en un RPC", () => {
  const sql = read(
    "supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"
  )
  assert.match(sql, /CREATE OR REPLACE FUNCTION public.create_isp_onboarding/)
  assert.match(sql, /Una conexión no puede existir sin un servicio/)
})

test("20. cliente histórico sin conexión sigue visible", () => {
  const list = [
    read("components/isp/isp-customer-list-screen.tsx"),
    read("components/isp/isp-customer-list-ui.tsx"),
  ].join("\n")
  const detail = read("components/isp/isp-customer-detail-screen.tsx")
  assert.match(list, /serviceCount/)
  assert.match(detail, /ISP_EMPTY_SERVICES_MESSAGE/)
  assert.doesNotMatch(list, /serviceCount === 0 \? null/)
  assert.doesNotMatch(list, /Alta desde OT/)
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: true,
      serviceCount: 0,
      connectionCount: 0,
    }),
    true
  )
  assert.equal(
    belongsToIspUniverse({
      hasExplicitIspMembership: false,
      hasWorkOrder: true,
    }),
    false
  )
})

test("pantallas nuevas no reemplazan Clientes, OT, ATC ni Tesorería", () => {
  const gitFiles = [
    "components/clientes/customers-module.tsx",
    "components/tareas/tasks-module.tsx",
    "components/atencion-cliente/atencion-cliente-module.tsx",
    "components/tesoreria/treasury-module.tsx",
  ]
  for (const file of gitFiles) {
    assert.ok(read(file).length > 0)
  }
  const wizard = read("components/isp/isp-onboarding-wizard.tsx")
  assert.match(wizard, /Crear Cliente y Conexión/)
  assert.match(wizard, /copia como medio de cobranza mensual/)
  const connectionDetail = read(
    "components/isp/isp-connection-detail-screen.tsx"
  )
  assert.match(connectionDetail, /ISP_MONITORING_PLACEHOLDER/)
  assert.match(connectionDetail, /ISP_ACTION_NOT_IMPLEMENTED_MESSAGE/)
})

test("OT Wireless con IP sugiere IP estática y precarga la IP", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      code: "TSK-OT-689",
      type: "wireless",
      contractedPlan: "20 Mb Wireless",
      taskMetadata: {
        technology: "wireless",
        installationIp: "10.40.12.88",
      },
    }),
  })

  assert.equal(prefill.service.technology, "wireless")
  assert.equal(prefill.connection.connectionType, "static_ip")
  assert.equal(prefill.connection.ipAddress, "10.40.12.88")
  assert.equal(prefill.fromOt.ipAddress, true)
  assert.equal(prefill.otInstallationIp, "10.40.12.88")
  assert.equal(
    suggestConnectionTypeFromWorkOrder({
      technology: "wireless",
      installationIp: "10.40.12.88",
    }),
    "static_ip"
  )
})

test("OT Wireless no muestra campos PPPoE ni inventa usuario por DNI", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      type: "wireless",
      customerDni: "27.890.123",
      taskMetadata: {
        technology: "wireless",
        installationIp: "10.40.12.88",
        pppoeUsername: "27890123",
      },
    }),
  })
  const fields = connectionFieldsForType(
    prefill.connection.connectionType ?? ""
  )
  const wizard = read("components/isp/isp-onboarding-wizard.tsx")

  assert.equal(fields.showPppoe, false)
  assert.equal(fields.showStaticIp, true)
  assert.equal(prefill.connection.pppoeUsername, "")
  assert.equal(
    didInferPppoeUsernameFromDni({
      pppoeUsername: prefill.connection.pppoeUsername,
      dni: prefill.customer.dni,
    }),
    false
  )
  assert.doesNotMatch(wizard, /pppoeUsername:\s*customer\.dni/)
  assert.match(wizard, /fields\.showPppoe/)
  assert.match(wizard, /IP proveniente de la OT/)
})

test("FTTH no asume PPPoE y no copia DNI como usuario", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      type: "fiber",
      customerDni: "20.123.456",
    }),
  })
  assert.equal(prefill.service.technology, "ftth")
  assert.equal(prefill.connection.connectionType, "")
  assert.equal(prefill.connection.pppoeUsername, "")
  assert.equal(
    suggestConnectionTypeFromWorkOrder({
      technology: "ftth",
      installationIp: "",
    }),
    ""
  )
})

test("OT sin precio mensual no inventa abono ni copia el importe de la OT", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      installationCost: 25000,
      amountToCollect: 18000,
      taskMetadata: { email: "juan@test.com", technology: "fiber" },
    }),
  })
  assert.equal(prefill.service.monthlyFee, "")
  assert.equal(prefill.fromOt.monthlyFee, false)
  assert.equal(prefill.otInstallationAmount, 25000)
  assert.equal(prefill.otAmountToCollect, 18000)
  assert.equal(
    didCopyOtChargeToMonthlyFee({
      monthlyFee: prefill.service.monthlyFee,
      otInstallationAmount: 25000,
      otAmountToCollect: 18000,
    }),
    false
  )
  const wizard = read("components/isp/isp-onboarding-wizard.tsx")
  assert.match(wizard, /Pendiente de carga/)
  assert.match(wizard, /no se copia como precio del abono mensual/)
})

test("si la OT tiene precio mensual propio, se precarga como abono", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      installationCost: 25000,
      amountToCollect: 18000,
      taskMetadata: {
        email: "juan@test.com",
        technology: "fiber",
        monthlyFee: 15000,
      },
    }),
  })
  assert.equal(prefill.service.monthlyFee, "15000")
  assert.equal(prefill.fromOt.monthlyFee, true)
})

test("la IP de la OT se conserva al armar la conexión", () => {
  const prefill = buildIspPrefillFromWorkOrder({
    existingCustomers: [],
    task: sampleTask({
      type: "wireless",
      taskMetadata: {
        technology: "wireless",
        installationIp: "10.40.12.88",
      },
    }),
  })
  const connection = buildConnectionDraftFromOtPrefill(prefill)
  const sql = read(
    "supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"
  )
  const wizard = read("components/isp/isp-onboarding-wizard.tsx")

  assert.equal(connection.connectionType, "static_ip")
  assert.equal(connection.ipAddress, "10.40.12.88")
  assert.equal(connection.pppoeUsername, "")
  assert.match(sql, /v_connection ->> 'ipAddress'/)
  assert.match(wizard, /\.\.\.body\.prefill!\.connection/)
})

test("hotfix 1.2.2. listado espera sesión y no aborta el fetch", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  const api = read("app/api/isp/customers/route.ts")
  assert.match(list, /isAuthReady/)
  assert.match(list, /credentials: "same-origin"/)
  assert.doesNotMatch(list, /AbortController/)
  assert.match(api, /success: true/)
  assert.match(api, /customers/)
  assert.match(api, /total: customers\.length/)
  assert.match(api, /items: customers/)
})

test("hotfix 1.2.2. estado vacío y título no duplicado", () => {
  const list = [
    read("components/isp/isp-customer-list-screen.tsx"),
    read("components/isp/isp-customer-list-ui.tsx"),
  ].join("\n")
  const nav = read("lib/navigation/nav-items.ts")
  const page = read("app/(dashboard)/clientes-360/page.tsx")
  assert.match(page, /IspCustomerListScreen/)
  assert.match(nav, /pageTitle: "Clientes 360°"/)
  assert.match(nav, /Vista integral de los abonados ISP/)
  assert.doesNotMatch(list, /<h1[^>]*>[\s\S]*Clientes 360°/)
  assert.doesNotMatch(list, /Vista integral de los abonados ISP/)
  assert.match(list, /ISP_CUSTOMER_LIST_EMPTY_MESSAGE/)
  assert.match(list, /0 abonado|items\.length/)
  assert.match(list, /Buscar abonado/)
  assert.match(list, /Cantidad de servicios/)
  assert.match(list, /Cantidad de conexiones/)
  assert.match(list, /Nuevo Cliente/)
  assert.match(list, /Importar abonados/)
  assert.doesNotMatch(list, /TypeError/)
})
