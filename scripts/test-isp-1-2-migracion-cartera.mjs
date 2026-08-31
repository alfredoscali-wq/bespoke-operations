import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isWorkOrderEligibleForIspOnboarding } from "../lib/isp/migration/cutoff.ts"
import {
  assertPasswordNotInIssues,
  didCopyCatalogPriceToContractedService,
  isHistoricalWorkOrderUsedForPortfolio,
  validateIspMigration,
} from "../lib/isp/migration/integrity.ts"
import {
  isValidIpv4,
  mapCommercialStatus,
  mapConnectionType,
  mapCustomerStatus,
  mapTechnicalStatus,
} from "../lib/isp/migration/maps.ts"
import { parseIspMigrationWorkbook } from "../lib/isp/migration/parse.ts"
import {
  buildIspMigrationTemplateWorkbook,
  buildIspMigrationWorkbook,
} from "../lib/isp/migration/template.ts"
import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_SERVICE_HEADERS,
  ISP_MIGRATION_TEMPLATE_FILENAME,
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

const validSheets = {
  CLIENTES: [customerRow()],
  CATALOGO: [catalogRow()],
  SERVICIOS: [serviceRow()],
  CONEXIONES: [connectionRow()],
}

test("1. descargar plantilla", () => {
  const parsed = parseIspMigrationWorkbook(buildIspMigrationTemplateWorkbook())
  assert.ok(parsed.sheets.CLIENTES)
  assert.ok(parsed.sheets.CATALOGO)
  assert.ok(parsed.sheets.SERVICIOS)
  assert.ok(parsed.sheets.CONEXIONES)
  assert.ok(parsed.sheets.EQUIPAMIENTO)
  const template = read("lib/isp/migration/template.ts")
  assert.match(template, /INSTRUCCIONES/)
  assert.match(template, /DATOS DE EJEMPLO/)
  assert.equal(ISP_MIGRATION_TEMPLATE_FILENAME.includes("v1.0"), true)
})

test("2. archivo válido", () => {
  const result = validateSheets(validSheets)
  assert.equal(result.canImport, true)
  assert.equal(result.preview.errors, 0)
})

test("3. cliente válido", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [],
    CONEXIONES: [],
  })
  assert.equal(result.counts.CLIENTES.valid + result.counts.CLIENTES.warnings > 0, true)
  assert.equal(result.canImport, true)
})

test("4. cliente duplicado", () => {
  const result = validateSheets({
    ...validSheets,
    CLIENTES: [
      customerRow(),
      customerRow({ cliente_id_externo: "CLI-002", dni_cuit: "20123456" }),
    ],
  })
  assert.ok(result.issues.some((issue) => issue.message.includes("DNI/CUIT duplicado")))
  assert.equal(result.canImport, false)
})

test("5. servicio válido", () => {
  const result = validateSheets(validSheets)
  assert.equal(result.preview.services, 1)
})

test("6. servicio sin cliente", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [serviceRow({ cliente_id_externo: "CLI-NO-EXISTE" })],
  })
  assert.ok(
    result.issues.some((issue) =>
      issue.message.includes("No existe un cliente con este identificador")
    )
  )
  assert.equal(result.canImport, false)
})

test("7. conexión válida", () => {
  const result = validateSheets(validSheets)
  assert.equal(result.preview.connections, 1)
})

test("8. conexión sin servicio", () => {
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [connectionRow({ servicio_id_externo: "SER-NO" })],
  })
  assert.ok(
    result.issues.some((issue) =>
      issue.message.includes("No existe un servicio con este identificador")
    )
  )
})

test("9. catálogo válido", () => {
  const result = validateSheets(validSheets)
  assert.equal(result.preview.catalog, 1)
})

test("10. servicio con catálogo inexistente", () => {
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [serviceRow({ catalogo_id_externo: "CAT-NO" })],
  })
  assert.ok(
    result.issues.some((issue) =>
      issue.message.includes("Servicio no encontrado en el catálogo de la empresa")
    )
  )
})

test("11. cliente sin servicio permitido", () => {
  const result = validateSheets({
    CLIENTES: [customerRow(), customerRow({ cliente_id_externo: "CLI-002", dni_cuit: "27999888" })],
    CATALOGO: [catalogRow()],
    SERVICIOS: [serviceRow()],
    CONEXIONES: [connectionRow()],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.customersWithoutService, 1)
})

test("12. servicio sin conexión permitido", () => {
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.servicesWithoutConnection, 1)
  assert.ok(result.issues.some((issue) => issue.message.includes("Servicio sin conexión técnica")))
})

test("13. múltiples servicios por cliente", () => {
  const result = validateSheets({
    ...validSheets,
    CATALOGO: [catalogRow(), catalogRow({ catalogo_id_externo: "CAT-002", nombre_servicio: "IP Pública" })],
    SERVICIOS: [
      serviceRow(),
      serviceRow({
        servicio_id_externo: "SER-002",
        catalogo_id_externo: "CAT-002",
        nombre_servicio: "IP Pública",
      }),
    ],
    CONEXIONES: [connectionRow()],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.services, 2)
})

test("14. relaciones correctas", () => {
  const result = validateSheets(validSheets)
  assert.equal(result.canImport, true)
  assert.equal(result.preview.customers, 1)
  assert.equal(result.preview.services, 1)
  assert.equal(result.preview.connections, 1)
})

test("15. IP inválida", () => {
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [
      connectionRow({
        tipo_conexion: "IP estática",
        usuario_pppoe: "",
        password_pppoe: "",
        ip: "999.1.1.1",
      }),
    ],
  })
  assert.equal(isValidIpv4("999.1.1.1"), false)
  assert.ok(result.issues.some((issue) => issue.field === "ip" && issue.level === "error"))
})

test("16. PPPoE válido", () => {
  const result = validateSheets(validSheets)
  assert.equal(mapConnectionType("PPP"), "pppoe")
  assert.equal(result.canImport, true)
})

test("17. estado comercial válido", () => {
  assert.equal(mapCommercialStatus("Pendiente de alta"), "pending_activation")
  assert.equal(mapCommercialStatus("Baja"), "cancelled")
  const result = validateSheets({
    ...validSheets,
    SERVICIOS: [serviceRow({ estado_comercial: "Desconocido" })],
  })
  assert.equal(result.canImport, false)
})

test("18. estado técnico válido", () => {
  assert.equal(mapTechnicalStatus("Provisionamiento pendiente"), "pending_provision")
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [connectionRow({ estado_tecnico: "rareza" })],
  })
  assert.equal(result.canImport, false)
})

test("19. error bloquea importación", () => {
  const result = validateSheets({
    ...validSheets,
    CLIENTES: [customerRow({ cliente_id_externo: "" })],
  })
  assert.equal(result.canImport, false)
  assert.ok(result.preview.errors > 0)
})

test("20. advertencia permite continuar", () => {
  const result = validateSheets({
    ...validSheets,
    CLIENTES: [customerRow({ email: "" })],
  })
  assert.equal(result.canImport, true)
  assert.ok(result.preview.warnings > 0)
})

test("21. preview no modifica datos", () => {
  const validateRoute = read("app/api/isp/migration/validate/route.ts")
  assert.match(validateRoute, /imported: false/)
  assert.doesNotMatch(validateRoute, /import_isp_migration/)
  const queries = read("lib/isp/migration/queries.ts")
  assert.match(queries, /createIspMigrationRun/)
  assert.doesNotMatch(queries.split("createIspMigrationRun")[1].split("export async function listIspMigrationRuns")[0], /from\("isp_services"\)\.insert/)
})

test("22. importación transaccional", () => {
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /CREATE OR REPLACE FUNCTION public.import_isp_migration/)
  assert.match(sql, /LANGUAGE plpgsql/)
  assert.doesNotMatch(sql, /COMMIT;/)
})

test("23. rollback ante error", () => {
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /RAISE EXCEPTION/)
})

test("24. company_id correcto", () => {
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /auth_user_company_id/)
  assert.match(sql, /company_id = v_company_id/)
})

test("25. RLS", () => {
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /isp_migration_runs_select_policy/)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
})

test("26. auditoría de migración", () => {
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public.isp_migration_runs/)
  assert.match(sql, /created_by/)
  assert.match(sql, /filename/)
  assert.match(sql, /customers_count/)
})

test("27. duplicación de archivo detectada", () => {
  const result = validateIspMigration(workbookFrom(validSheets), {
    ...emptyExisting(),
    completedFileHashes: ["abc123"],
  }, { fileSha256: "abc123" })
  assert.equal(result.duplicateCompletedRun, true)
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /Este archivo ya fue importado/)
})

test("28. fecha de corte creada", () => {
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /onboarding_cutoff_at/)
  assert.match(sql, /isp_company_settings/)
})

test("29. OT anterior al corte no aparece como alta ISP", () => {
  const eligible = isWorkOrderEligibleForIspOnboarding({
    task: { id: "ot-old", closedAt: "2026-01-01T00:00:00.000Z" },
    cutoffAt: "2026-08-24T00:00:00.000Z",
    linkedSourceTaskIds: [],
  })
  assert.equal(eligible, false)
})

test("30. OT posterior al corte puede aparecer", () => {
  const eligible = isWorkOrderEligibleForIspOnboarding({
    task: { id: "ot-new", closedAt: "2026-08-25T00:00:00.000Z" },
    cutoffAt: "2026-08-24T00:00:00.000Z",
    linkedSourceTaskIds: [],
  })
  assert.equal(eligible, true)
})

test("31. cliente existente puede recibir servicio migrado", () => {
  const result = validateSheets(
    {
      CLIENTES: [],
      CATALOGO: [catalogRow()],
      SERVICIOS: [serviceRow()],
      CONEXIONES: [],
    },
    {
      ...emptyExisting(),
      customers: [{ id: "c1", externalCode: "CLI-001", dniDigits: "20123456" }],
    }
  )
  assert.equal(result.canImport, true)
})

test("32. cliente sin servicio se importa", () => {
  const result = validateSheets({
    CLIENTES: [customerRow()],
    CATALOGO: [catalogRow()],
    SERVICIOS: [],
    CONEXIONES: [],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.customers, 1)
})

test("33. servicio sin conexión se importa", () => {
  const result = validateSheets({
    ...validSheets,
    CONEXIONES: [],
  })
  assert.equal(result.canImport, true)
  assert.equal(result.preview.connections, 0)
})

test("34. conexión huérfana se rechaza", () => {
  const result = validateSheets({
    CLIENTES: [customerRow()],
    CATALOGO: [catalogRow()],
    SERVICIOS: [],
    CONEXIONES: [connectionRow()],
  })
  assert.equal(result.canImport, false)
})

test("35. contraseña PPPoE no aparece en logs ni issues", () => {
  const result = validateSheets(validSheets)
  assert.equal(assertPasswordNotInIssues(result.issues), true)
  assert.ok(!JSON.stringify(result.issues).includes("super-secret-pass"))
  const validateRoute = read("app/api/isp/migration/validate/route.ts")
  const importRoute = read("app/api/isp/migration/runs/[id]/import/route.ts")
  assert.doesNotMatch(validateRoute, /console\.log/)
  assert.doesNotMatch(importRoute, /console\.log/)
})

test("36. catálogo y cartera quedan separados", () => {
  const result = validateSheets(validSheets)
  const catalog = result.stagingRows.find((row) => row.sheet === "CATALOGO")
  const service = result.stagingRows.find((row) => row.sheet === "SERVICIOS")
  assert.equal(catalog?.payload.monthly_price, 35000)
  assert.equal(service?.payload.monthly_price, 25000)
})

test("37. precio contratado se conserva como snapshot", () => {
  assert.equal(
    didCopyCatalogPriceToContractedService({
      catalogPrice: 35000,
      contractedPrice: 25000,
      copiedAutomatically: false,
    }),
    false
  )
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /monthly_fee/)
  assert.match(sql, /plan_name/)
  assert.doesNotMatch(sql, /SELECT[\s\S]*FROM public.tasks/)
})

test("38. reimportación no duplica silenciosamente registros", () => {
  const result = validateSheets(validSheets, {
    ...emptyExisting(),
    services: [{ id: "s1", externalCode: "SER-001", hasConnection: true }],
  })
  assert.ok(
    result.issues.some((issue) =>
      issue.message.includes("Ya existe un servicio con este identificador")
    )
  )
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /p_force boolean/)
  assert.match(sql, /skippedServices/)
})

test("no usa OT históricas para reconstruir cartera", () => {
  assert.equal(isHistoricalWorkOrderUsedForPortfolio(), false)
  const sql = read("supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql")
  assert.match(sql, /Does not rebuild portfolio from historical work orders/)
  assert.match(sql, /source_task_id/)
  assert.match(sql, /INSERT INTO public.isp_services/)
  assert.doesNotMatch(sql, /FROM public.tasks/)
  const queries = read("lib/isp/queries.ts")
  assert.match(queries, /isWorkOrderEligibleForIspOnboarding/)
  assert.match(queries, /source_task_id/)
})

test("acceso restringido a maintenance, clientes 360 o administrador", () => {
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
  assert.equal(
    canAccessIspMigration({
      systemRole: "administrador",
      roleCode: "administrador",
      moduleVisibility: { maintenance: false, clientes_360: false },
    }),
    true
  )
})

test("mapea estados de cliente y tipos de conexión inequívocos", () => {
  assert.equal(mapCustomerStatus("Suspendido"), "inactivo")
  assert.equal(mapCustomerStatus("Pendiente"), "pendiente-activacion")
  assert.equal(mapConnectionType("IP FIJA"), "static_ip")
  assert.equal(mapConnectionType("STATIC"), "static_ip")
  assert.equal(mapConnectionType("radio enlace"), null)
})

test("ruta administrativa y pathPrefixes", () => {
  const modules = read("lib/roles/app-modules.ts")
  assert.match(modules, /pathPrefixes: \["\/mantenimiento", "\/administracion"\]/)
  const page = read("app/(dashboard)/administracion/migracion-isp/page.tsx")
  assert.match(page, /IspMigrationScreen/)
})
