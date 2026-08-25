import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { deriveIspSubscriberListStatus } from "../lib/isp/integrity.ts"
import { isHistoricalWorkOrderUsedForPortfolio } from "../lib/isp/migration/integrity.ts"
import { validateIspMigration } from "../lib/isp/migration/integrity.ts"
import {
  applyReviewPatches,
  buildMigrationReviewItems,
  filterReviewItems,
  storedRowsToParsedWorkbook,
} from "../lib/isp/migration/review.ts"
import { parseIspMigrationWorkbook } from "../lib/isp/migration/parse.ts"
import { buildIspMigrationWorkbook } from "../lib/isp/migration/template.ts"
import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_SERVICE_HEADERS,
} from "../lib/isp/migration/constants.ts"
import { canAccessIspMigration } from "../lib/isp/permissions.ts"

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
    nombre_servicio: "FTTH 50 Mb",
    categoria: "Internet",
    tipo_cliente: "Particular",
    tecnologia: "FTTH",
    velocidad_bajada: "50",
    velocidad_subida: "50",
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
    nombre_servicio: "FTTH 50 Mb",
    tecnologia: "FTTH",
    velocidad_bajada: "50",
    velocidad_subida: "50",
    precio_mensual: "25000",
    fecha_alta: "2024-03-01",
    estado_comercial: "Activo",
    medio_cobranza: "SIRO",
    observaciones: "",
    ...overrides,
  }
}

function connectionRow(overrides = {}) {
  return {
    conexion_id_externo: "CON-001",
    servicio_id_externo: "SER-001",
    tipo_conexion: "PPPoE",
    estado_tecnico: "Provisionado",
    usuario_pppoe: "juan.perez",
    password_pppoe: "super-secret-pass",
    ip: "",
    prefijo: "",
    gateway: "",
    vlan: "",
    perfil_tecnico: "",
    core: "",
    fecha_provisionamiento: "",
    observaciones: "",
    ...overrides,
  }
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
      EQUIPAMIENTO: sheets.EQUIPAMIENTO ?? [],
    })
  )
}

function validateSheets(sheets, existing = emptyExisting()) {
  return validateIspMigration(workbookFrom(sheets), existing)
}

function withIds(result) {
  return result.stagingRows.map((row, index) => ({
    id: `${row.sheet}-${index}`,
    ...row,
  }))
}

const validSheets = {
  CLIENTES: [customerRow()],
  CATALOGO: [catalogRow()],
  SERVICIOS: [serviceRow()],
  CONEXIONES: [connectionRow()],
}

const uiFiles = [
  "components/isp/isp-customer-list-screen.tsx",
  "components/isp/isp-customer-list-ui.tsx",
  "components/isp/isp-customer-detail-screen.tsx",
  "components/isp/isp-migration-screen.tsx",
  "app/(dashboard)/clientes-360/migracion/page.tsx",
  "components/configuracion/maintenance-tools-panel.tsx",
]

test("1. Clientes 360° no muestra OT pendientes", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  assert.doesNotMatch(list, /installation-orders/)
  assert.doesNotMatch(list, /installationOrders/)
})

test("2. Clientes 360° no muestra Alta desde OT", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  assert.doesNotMatch(list, /Alta desde OT/)
  assert.doesNotMatch(list, /taskId=/)
})

test("3. Clientes 360° muestra Importar abonados", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  const nav = read("lib/navigation/nav-items.ts")
  assert.match(list, /Importar abonados/)
  assert.match(list, /Buscar abonado/)
  assert.match(nav, /Vista integral de los abonados ISP/)
  assert.doesNotMatch(list, /<h1[^>]*>Clientes 360°/)
})

test("4. Importar abonados abre migración", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  assert.match(list, /\/clientes-360\/migracion/)
  const page = read("app/(dashboard)/clientes-360/migracion/page.tsx")
  assert.match(page, /IspMigrationScreen/)
})

test("5. Descargar plantilla funciona", () => {
  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /\/api\/isp\/migration\/template/)
  assert.match(screen, /Descargar plantilla/)
  const route = read("app/api/isp/migration/template/route.ts")
  assert.match(route, /buildIspMigrationTemplateWorkbook/)
})

test("6. Validar no modifica tablas definitivas", () => {
  const route = read("app/api/isp/migration/validate/route.ts")
  assert.match(route, /imported: false/)
  assert.doesNotMatch(route, /import_isp_migration/)
  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /Validar archivo/)
})

test("7. Registros válidos quedan pendientes de revisión", () => {
  const queries = read("lib/isp/migration/queries.ts")
  assert.match(queries, /runStatusFromValidation/)
  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /Pendiente de revisión/)
  assert.match(screen, /Abonados pendientes de revisión/)
  const result = validateSheets(validSheets)
  assert.equal(result.canImport, true)
  assert.equal(result.runStatus, "pending_review")
  assert.ok(result.stagingRows.length > 0)
})

test("8. Errores quedan marcados", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [serviceRow({ cliente_id_externo: "CLI-NO" })],
  })
  assert.ok(result.stagingRows.some((row) => row.validationStatus === "error"))
  const items = buildMigrationReviewItems(withIds(result))
  assert.ok(items.some((item) => item.status === "error"))
})

test("9. Advertencias quedan marcadas", () => {
  const result = validateSheets({
    ...validSheets,
    CLIENTES: [customerRow({ email: "" })],
  })
  assert.ok(result.preview.warnings > 0)
  const items = buildMigrationReviewItems(withIds(result))
  assert.ok(items.some((item) => item.status === "warning"))
})

test("10. No se puede confirmar con errores bloqueantes", () => {
  const route = read("app/api/isp/migration/runs/[id]/import/route.ts")
  assert.match(route, /errorsCount > 0/)
  assert.match(route, /No se puede confirmar mientras existan errores bloqueantes/)
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [connectionRow({ servicio_id_externo: "SER-NO" })],
  })
  assert.equal(result.canImport, false)
})

test("11. Se puede confirmar sin errores", () => {
  const result = validateSheets(validSheets)
  assert.equal(result.canImport, true)
  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /Confirmar migración/)
})

test("12. Importación es transaccional", () => {
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.match(sql, /CREATE OR REPLACE FUNCTION public.import_isp_migration/)
  assert.doesNotMatch(sql, /COMMIT;/)
})

test("13. Auditoría se registra", () => {
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.match(sql, /isp_migration_runs/)
  assert.match(sql, /created_by/)
  assert.match(sql, /filename/)
  assert.match(sql, /pending_review/)
  const extra = read(
    "supabase/migrations/20261131000100_isp_1_2_1_migracion_abonados.sql"
  )
  assert.match(extra, /validating/)
  assert.match(extra, /pending_review/)
})

test("14. Fecha de corte se registra", () => {
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.match(sql, /onboarding_cutoff_at/)
})

test("15. Cliente sin servicios se importa", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [],
    CONEXIONES: [],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.customersWithoutService, 1)
})

test("16. Servicio sin conexión se importa", () => {
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.servicesWithoutConnection, 1)
})

test("17. Cliente con múltiples servicios se importa", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [
      serviceRow(),
      serviceRow({ servicio_id_externo: "SER-002", nombre_servicio: "FTTH 100" }),
    ],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.services, 2)
})

test("18. Conexión sin servicio se rechaza", () => {
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [connectionRow({ servicio_id_externo: "SER-NO" })],
  })
  assert.equal(result.canImport, false)
})

test("19. Servicio sin cliente se rechaza", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [serviceRow({ cliente_id_externo: "CLI-NO" })],
  })
  assert.equal(result.canImport, false)
})

test("20. OT históricas no generan servicios", () => {
  assert.equal(isHistoricalWorkOrderUsedForPortfolio(), false)
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.doesNotMatch(sql, /FROM public.tasks/)
})

test("21. OT históricas no generan conexiones", () => {
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.match(sql, /INSERT INTO public.isp_connections/)
  assert.doesNotMatch(sql, /FROM public.tasks/)
})

test("22. OT históricas permanecen intactas", () => {
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.doesNotMatch(sql, /UPDATE public.tasks/)
  assert.doesNotMatch(sql, /DELETE FROM public.tasks/)
})

test("23. Historial de OT aparece en Cliente 360°", () => {
  const detail = read("components/isp/isp-customer-detail-screen.tsx")
  assert.match(detail, /Historial de OT/)
  assert.match(detail, /Ver OT/)
})

test("24. Se puede abrir detalle de OT desde Cliente 360°", () => {
  const detail = read("components/isp/isp-customer-detail-screen.tsx")
  assert.match(detail, /IspWorkOrderSheet/)
  assert.match(detail, /setWorkOrderId/)
})

test("25. No aparece la palabra cartera en la nueva interfaz", () => {
  for (const file of uiFiles) {
    const source = read(file)
    assert.doesNotMatch(
      source,
      /cartera/i,
      `${file} no debe mostrar la palabra cartera`
    )
  }
})

test("26. Migración existente de Clientes sigue funcionando", () => {
  const nav = read("components/clientes/clientes-section-nav.tsx")
  assert.match(nav, /\/clientes\/migracion/)
  assert.match(nav, /Migración de Clientes/)
  const moduleFile = read("components/clientes/migration/migration-review-module.tsx")
  assert.match(moduleFile, /\/api\/clientes\/migracion\/import/)
})

test("27. RLS y company_id correctos", () => {
  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
  const extra = read(
    "supabase/migrations/20261131000100_isp_1_2_1_migracion_abonados.sql"
  )
  assert.match(extra, /auth_can_manage_isp_migration/)
  assert.match(extra, /clientes_360/)
})

test("28. Permisos correctos", () => {
  assert.equal(
    canAccessIspMigration({
      systemRole: "operario",
      roleCode: "operario",
      moduleVisibility: { maintenance: false, clientes_360: false },
    }),
    false
  )
  assert.equal(
    canAccessIspMigration({
      systemRole: "operario",
      roleCode: "operario",
      moduleVisibility: { maintenance: false, clientes_360: true },
    }),
    true
  )
  const context = read("lib/isp/route-context.ts")
  assert.match(context, /canAccessIspMigration/)
})

test("la corrección se guarda en el pendiente y revalida sin tablas finales", () => {
  const first = validateSheets(validSheets)
  const stored = withIds(first)
  const items = buildMigrationReviewItems(stored)
  assert.equal(items.length > 0, true)
  const patched = applyReviewPatches(stored, {
    customerRowId: items[0].customerRowId,
    serviceRowId: items[0].serviceRowId,
    connectionRowId: items[0].connectionRowId,
    fields: { nombre_razon_social: "Pedro González" },
  })
  const parsed = storedRowsToParsedWorkbook(patched)
  const second = validateIspMigration(parsed, emptyExisting())
  assert.equal(second.canImport, true)
  assert.ok(
    second.stagingRows.some(
      (row) =>
        row.sheet === "CLIENTES" &&
        row.payload.nombre_razon_social === "Pedro González"
    )
  )
  const reviewRoute = read("app/api/isp/migration/runs/[id]/review/route.ts")
  assert.doesNotMatch(reviewRoute, /from\("customers"\)\.insert/)
  assert.doesNotMatch(reviewRoute, /import_isp_migration/)
})

test("el filtro de revisión separa correctos, advertencias y errores", () => {
  const result = validateSheets({
    CLIENTES: [
      customerRow(),
      customerRow({
        cliente_id_externo: "CLI-002",
        nombre_razon_social: "Empresa XYZ",
        dni_cuit: "30123456789",
        email: "",
      }),
    ],
    CATALOGO: [catalogRow()],
    SERVICIOS: [
      serviceRow(),
      serviceRow({
        servicio_id_externo: "SER-002",
        cliente_id_externo: "CLI-NO",
      }),
    ],
    CONEXIONES: [connectionRow()],
  })
  const items = buildMigrationReviewItems(withIds(result))
  assert.ok(filterReviewItems(items, "error").length > 0)
  assert.ok(filterReviewItems(items, "warning").length > 0)
})

test("el estado de listado distingue activo, suspendido, baja y pendiente", () => {
  assert.equal(
    deriveIspSubscriberListStatus({
      customerStatus: "activo",
      commercialStatuses: ["active"],
    }),
    "activo"
  )
  assert.equal(
    deriveIspSubscriberListStatus({
      customerStatus: "activo",
      commercialStatuses: ["suspended"],
    }),
    "suspendido"
  )
  assert.equal(
    deriveIspSubscriberListStatus({
      customerStatus: "inactivo",
      commercialStatuses: ["cancelled"],
    }),
    "baja"
  )
  assert.equal(
    deriveIspSubscriberListStatus({
      customerStatus: "pendiente-activacion",
      commercialStatuses: [],
    }),
    "pendiente"
  )
})

test("admin y 360 reutilizan el mismo motor", () => {
  const admin = read("app/(dashboard)/administracion/migracion-isp/page.tsx")
  const primary = read("app/(dashboard)/clientes-360/migracion/page.tsx")
  assert.match(admin, /IspMigrationScreen/)
  assert.match(primary, /IspMigrationScreen/)
})

test("detalle muestra servicios, conexiones y empty states", () => {
  const detail = [
    read("components/isp/isp-customer-detail-screen.tsx"),
    read("components/isp/isp-service-card.tsx"),
  ].join("\n")
  assert.match(detail, /ISP_EMPTY_SERVICES_MESSAGE/)
  assert.match(detail, /ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE/)
  assert.match(detail, /Agregar servicio/)
  assert.match(detail, /Crear conexión|Configurar conexión/)
  assert.match(detail, /Datos del abonado/)
})
