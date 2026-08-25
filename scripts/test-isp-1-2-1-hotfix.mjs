import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_MIGRATION_CATALOG_HEADERS,
  ISP_MIGRATION_CONNECTION_HEADERS,
  ISP_MIGRATION_CUSTOMER_HEADERS,
  ISP_MIGRATION_NO_REAL_DATA_MESSAGE,
  ISP_MIGRATION_NO_REAL_DATA_REVIEW_HINT,
  ISP_MIGRATION_NO_REAL_DATA_REVIEW_TITLE,
  ISP_MIGRATION_SERVICE_HEADERS,
} from "../lib/isp/migration/constants.ts"
import { validateIspMigration } from "../lib/isp/migration/integrity.ts"
import { isExampleMigrationRow } from "../lib/isp/migration/maps.ts"
import { parseIspMigrationWorkbook } from "../lib/isp/migration/parse.ts"
import { buildMigrationReviewItems } from "../lib/isp/migration/review.ts"
import {
  buildIspMigrationTemplateWorkbook,
  buildIspMigrationWorkbook,
} from "../lib/isp/migration/template.ts"

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
    password_pppoe: "secret",
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

function exampleCustomer(overrides = {}) {
  return customerRow({
    cliente_id_externo: "EJEMPLO-CLI-001",
    observaciones: "DATOS DE EJEMPLO",
    ...overrides,
  })
}

function exampleCatalog(overrides = {}) {
  return catalogRow({
    catalogo_id_externo: "EJEMPLO-CAT-001",
    descripcion: "DATOS DE EJEMPLO",
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
      EQUIPAMIENTO: sheets.EQUIPAMIENTO ?? [],
    })
  )
}

function validateSheets(sheets) {
  return validateIspMigration(workbookFrom(sheets), emptyExisting())
}

function withIds(result) {
  return result.stagingRows.map((row, index) => ({
    id: `${row.sheet}-${index}`,
    ...row,
  }))
}

function hasExamplePayload(row) {
  return isExampleMigrationRow({
    cliente_id_externo: String(row.payload.cliente_id_externo ?? ""),
    catalogo_id_externo: String(row.payload.catalogo_id_externo ?? ""),
    servicio_id_externo: String(row.payload.servicio_id_externo ?? ""),
    conexion_id_externo: String(row.payload.conexion_id_externo ?? ""),
    equipamiento_id_externo: String(row.payload.equipamiento_id_externo ?? ""),
    observaciones: String(row.payload.observaciones ?? ""),
  })
}

test("TEST 1. plantilla oficial sin modificar queda sin datos reales", () => {
  const parsed = parseIspMigrationWorkbook(buildIspMigrationTemplateWorkbook())
  const result = validateIspMigration(parsed, emptyExisting())

  assert.equal(result.hasRealData, false)
  assert.equal(result.canImport, false)
  assert.equal(result.runStatus, "no_real_data")
  assert.equal(result.preview.errors, 0)
  assert.equal(result.preview.warnings, 0)
  assert.ok(result.preview.examplesIgnored > 0)
  assert.equal(result.stagingRows.length, 0)
  assert.equal(result.counts.CLIENTES.valid, 0)
  assert.equal(result.counts.CLIENTES.errors, 0)
  assert.ok(result.counts.CLIENTES.examples > 0)
  assert.ok(result.counts.SERVICIOS.examples > 0)
  assert.ok(result.counts.CONEXIONES.examples > 0)
  assert.ok(result.counts.CATALOGO.examples > 0)
  assert.ok(result.counts.EQUIPAMIENTO.examples > 0)
  assert.equal(buildMigrationReviewItems(withIds(result)).length, 0)

  const queries = read("lib/isp/migration/queries.ts")
  assert.match(queries, /no_real_data/)
  assert.match(queries, /stagingRows.length > 0/)
  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /Sin datos reales/)
  assert.match(screen, /disabled=\{!canConfirm\}/)
  assert.match(screen, /ISP_MIGRATION_NO_REAL_DATA_REVIEW_TITLE/)
  assert.match(screen, /ISP_MIGRATION_NO_REAL_DATA_REVIEW_HINT/)
})

test("TEST 2. ejemplos + 1 abonado real válido quedan pendientes", () => {
  const result = validateSheets({
    CLIENTES: [exampleCustomer(), customerRow()],
    CATALOGO: [exampleCatalog()],
    SERVICIOS: [],
    CONEXIONES: [],
  })

  assert.equal(result.hasRealData, true)
  assert.equal(result.canImport, true)
  assert.equal(result.runStatus, "pending_review")
  assert.equal(result.preview.customers, 1)
  assert.ok(result.preview.examplesIgnored >= 2)
  assert.equal(result.stagingRows.some(hasExamplePayload), false)

  const items = buildMigrationReviewItems(withIds(result))
  assert.equal(items.length, 1)
  assert.equal(items[0].subscriberName, "Juan Pérez")
  assert.equal(items[0].status, "valid")
})

test("TEST 3. ejemplos + 1 abonado real inválido quedan con errores visibles", () => {
  const result = validateSheets({
    CLIENTES: [
      exampleCustomer(),
      customerRow({ dni_cuit: "", nombre_razon_social: "Empresa XYZ" }),
    ],
    CATALOGO: [exampleCatalog()],
    SERVICIOS: [],
    CONEXIONES: [],
  })

  assert.equal(result.hasRealData, true)
  assert.equal(result.canImport, false)
  assert.equal(result.runStatus, "rejected")
  assert.equal(result.counts.CLIENTES.valid, 0)
  assert.equal(result.counts.CLIENTES.errors, 1)
  assert.ok(result.preview.examplesIgnored >= 2)

  const items = buildMigrationReviewItems(withIds(result))
  const errors = items.filter((item) => item.status === "error")
  assert.equal(errors.length, 1)
  assert.equal(errors[0].subscriberName, "Empresa XYZ")
  assert.ok(errors[0].issues.some((issue) => issue.level === "error"))

  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /Con errores/)
})

test("TEST 4. ejemplos + datos reales con advertencias permiten revisar", () => {
  const result = validateSheets({
    CLIENTES: [exampleCustomer(), customerRow({ email: "" })],
    CATALOGO: [exampleCatalog(), catalogRow()],
    SERVICIOS: [serviceRow()],
    CONEXIONES: [connectionRow()],
  })

  assert.equal(result.hasRealData, true)
  assert.equal(result.canImport, true)
  assert.equal(result.runStatus, "pending_review")
  assert.ok(result.preview.warnings > 0)
  assert.ok(result.preview.examplesIgnored >= 2)

  const items = buildMigrationReviewItems(withIds(result))
  assert.ok(items.some((item) => item.status === "warning"))
  assert.equal(items.some((item) => item.subscriberName.includes("EJEMPLO")), false)
})

test("TEST 5. ninguna fila de ejemplo llega al staging ni a tablas definitivas", () => {
  const result = validateSheets({
    CLIENTES: [exampleCustomer(), customerRow()],
    CATALOGO: [exampleCatalog(), catalogRow()],
    SERVICIOS: [
      serviceRow({
        observaciones: "DATOS DE EJEMPLO",
        servicio_id_externo: "EJEMPLO-SER-001",
        cliente_id_externo: "EJEMPLO-CLI-001",
      }),
      serviceRow(),
    ],
    CONEXIONES: [
      connectionRow({
        conexion_id_externo: "EJEMPLO-CON-001",
        observaciones: "DATOS DE EJEMPLO",
      }),
      connectionRow(),
    ],
  })

  assert.equal(result.stagingRows.some(hasExamplePayload), false)
  for (const row of result.stagingRows) {
    const blob = JSON.stringify(row.payload).toLowerCase()
    assert.equal(blob.includes("ejemplo-"), false)
  }

  const sql = read(
    "supabase/migrations/20261130000100_isp_1_2_migracion_cartera.sql"
  )
  assert.match(sql, /INSERT INTO public.customers/)
  assert.match(sql, /isp_migration_staging_rows/)
  const queries = read("lib/isp/migration/queries.ts")
  assert.match(queries, /insertStagingRows/)
  assert.match(queries, /validation.stagingRows/)
})

test("TEST 6. revalidar una versión corregida reemplaza el estado anterior", () => {
  const first = validateIspMigration(
    parseIspMigrationWorkbook(buildIspMigrationTemplateWorkbook()),
    emptyExisting()
  )
  assert.equal(first.runStatus, "no_real_data")
  assert.equal(first.stagingRows.length, 0)

  const second = validateSheets({
    CLIENTES: [exampleCustomer(), customerRow()],
    CATALOGO: [catalogRow()],
    SERVICIOS: [serviceRow()],
    CONEXIONES: [connectionRow()],
  })
  assert.equal(second.runStatus, "pending_review")
  assert.equal(second.hasRealData, true)
  assert.ok(second.stagingRows.length > 0)
  assert.equal(second.preview.errors, 0)

  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(screen, /Cargar versión corregida/)
  assert.match(screen, /setValidation\(body\)/)
  const validateRoute = read("app/api/isp/migration/validate/route.ts")
  assert.match(validateRoute, /createIspMigrationRun/)
  assert.doesNotMatch(validateRoute, /updateIspMigrationRunValidation/)
})

test("detecta DATOS DE EJEMPLO aunque el id no empiece con EJEMPLO-", () => {
  const result = validateSheets({
    CLIENTES: [
      customerRow({
        cliente_id_externo: "CLI-DEMO",
        observaciones: "DATOS DE EJEMPLO — no importar",
      }),
    ],
    CATALOGO: [catalogRow()],
    SERVICIOS: [],
    CONEXIONES: [],
  })
  assert.equal(result.hasRealData, true)
  assert.equal(result.preview.customers, 0)
  assert.equal(result.counts.CLIENTES.examples, 1)
  assert.equal(result.preview.catalog, 1)
})

test("la UI coincide con el validador y no pide borrar ejemplos", () => {
  const screen = read("components/isp/isp-migration-screen.tsx")
  assert.match(
    screen,
    /Completá los datos reales. Las filas marcadas como DATOS DE EJEMPLO/
  )
  assert.match(screen, /se ignoran automáticamente/)
  assert.doesNotMatch(screen, /eliminá las filas marcadas/)
  assert.match(screen, /ISP_MIGRATION_NO_REAL_DATA_MESSAGE/)
  assert.match(screen, /ISP_MIGRATION_NO_REAL_DATA_REVIEW_HINT/)
  const importRoute = read("app/api/isp/migration/runs/[id]/import/route.ts")
  assert.match(importRoute, /no_real_data/)
  assert.match(importRoute, /No hay datos reales para importar/)
})

test("hotfix SQL agrega el estado no_real_data", () => {
  const sql = read(
    "supabase/migrations/20261132000100_isp_1_2_1_hotfix_plantilla_ejemplos.sql"
  )
  assert.match(sql, /no_real_data/)
  assert.doesNotMatch(sql, /FROM public.tasks/)
})
