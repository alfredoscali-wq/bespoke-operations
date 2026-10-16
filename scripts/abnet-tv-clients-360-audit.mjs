/**
 * Auditoría de solo lectura de la TV comercial de Clientes 360.
 *
 * Universo: getClients360CommercialUniverse(). No se reconstruye por DNI,
 * nombre, N° ABNet ni OT.
 *
 * La situación de TV sale del plan de Conex. Internet + TV. No se infiere
 * por isp_services, isp_connections, IP, nodo ni tecnología.
 *
 * En Bespoke, TV Básica es el plan incluido por tv_plan_catalog_id (TV-BASICO).
 * TV Full es el componente activo TV-FULL-UPGRADE, o un plan incluido TV-FULL.
 * No se crean planes ni componentes.
 *
 * No hace INSERT, UPDATE, DELETE ni UPSERT.
 *
 * Uso: npx tsx scripts/abnet-tv-clients-360-audit.mjs
 */
import { createRequire } from "node:module"
import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  abnetNumberFromCell,
  collapseExactInternetCopies,
  fold,
} from "../lib/isp/abnet-residential-load.ts"
import { getClients360CommercialUniverse } from "../lib/isp/clients-360-universe.ts"
import {
  ABNET_COMPANY_ID,
  fetchAll,
  loadEnv,
} from "./abnet-residential-sources.mjs"

const REQUESTED_CONEX = "C:\\Users\\alfre\\Downloads\\Conex. Internet + TV(1).xlsx"
const PRESENT_CONEX = "C:\\Users\\alfre\\Downloads\\Conex. Internet + TV.xlsx"

const EXPECTED_UNIVERSE = 4737

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function assertReadOnlyInvocation() {
  if (process.argv.some((arg) => ["--apply", "--write", "--execute"].includes(arg))) {
    throw new Error("Esta auditoría no acepta escritura.")
  }
}

function readOnlyFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(`Auditoría de solo lectura: ${String(prop)} bloqueado en ${table}.`)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

function fail(message) {
  throw new Error(message)
}

function text(value) {
  if (value == null) return null
  const current = String(value).trim()
  return current.length > 0 ? current : null
}

function amount(value) {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function compactPlan(value) {
  return fold(value).replace(/[^a-z0-9+]/g, "")
}

function normalizeHeader(value) {
  return fold(value).replace(/[^a-z0-9]/g, "")
}

function readMatrix(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0]
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  })
}

function headerMap(row) {
  const map = new Map()
  for (let index = 0; index < row.length; index += 1) {
    if (row[index] != null) map.set(normalizeHeader(row[index]), index)
  }
  return (aliases) => {
    for (const alias of aliases) {
      if (map.has(alias)) return map.get(alias)
    }
    return -1
  }
}

function readInternetDetailed(file) {
  const matrix = readMatrix(file)
  const headerRow = matrix.findIndex(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => {
        const header = normalizeHeader(cell)
        return header === "ncliente" || header === "cliente"
      })
  )
  if (headerRow < 0) fail("Internet + TV no tiene encabezado reconocible.")
  const column = headerMap(matrix[headerRow])
  const numberIndex = column(["ncliente", "numerocliente"])
  const nameIndex = column(["cliente", "nombre"])
  const typeIndex = column(["tipo"])
  const nodeIndex = column(["nodo"])
  const planIndex = column(["plan"])
  const statusIndex = column(["estado"])
  const tvIndex = column(["tv"])
  const taxIndex = column(["2imptv"])
  const finalIndex = column(["final"])
  if ([numberIndex, nameIndex, typeIndex, nodeIndex, planIndex, statusIndex, tvIndex, taxIndex, finalIndex].some((index) => index < 0)) {
    fail("Internet + TV no tiene N° Cliente, Cliente, Tipo, Nodo, Plan, Estado, TV, 2% IMP. TV y FINAL.")
  }
  return {
    headerRow: headerRow + 1,
    rows: matrix.slice(headerRow + 1).flatMap((row) => {
    const number = abnetNumberFromCell(row[numberIndex])
    if (!number) return []
    return [
      {
        number,
        name: nameIndex >= 0 ? text(row[nameIndex]) ?? "" : "",
        tipo: text(row[typeIndex]) ?? "",
        nodo: nodeIndex >= 0 ? text(row[nodeIndex]) : null,
        plan: text(row[planIndex]) ?? "",
        finalAmount: finalIndex >= 0 ? amount(row[finalIndex]) : null,
        estado: statusIndex >= 0 ? text(row[statusIndex]) ?? "" : "",
        tv: tvIndex >= 0 ? amount(row[tvIndex]) : null,
      },
    ]
    }),
  }
}

function countBy(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]))
}

function pushMap(map, key, value) {
  const current = map.get(key) ?? []
  current.push(value)
  map.set(key, current)
}

function packLabel(plan) {
  const compact = compactPlan(plan)
  if (compact.includes("tvpackfull1")) return "TV PACK FULL 1"
  if (compact.includes("tvpackfull2")) return "TV PACK FULL 2"
  if (compact.includes("tvpackfull")) return "TV PACK FULL"
  return null
}

function nameGratisKind(name) {
  const folded = fold(name)
  if (!folded.includes("gratis")) return null
  if (folded.includes("camara")) return "camaras"
  if (folded.includes("nodo gratis")) return "nodo"
  return "nombre"
}

/**
 * FULL dentro de un plan empresa no es TV Full. Solo cuenta un pack explícito.
 * Gratis en el nombre no pisa un plan que sigue diciendo TV y cobrando la columna TV.
 */
function rowFacts(row) {
  const compact = compactPlan(row.plan)
  const pack = packLabel(row.plan)
  const basica = compact.includes("tvbasico") || compact.includes("tvbasica")
  const planGratis =
    compact.includes("sintv") ||
    compact.includes("sintelevision") ||
    compact.includes("gratuit") ||
    compact.includes("gratis") ||
    compact.includes("sincargo")
  return {
    pack,
    basica,
    planGratis,
    jubilado: compact.includes("jubilado"),
    nameGratis: nameGratisKind(row.name),
    halfTvWithoutJubilado: basica && !compact.includes("jubilado") && row.tv === 2250,
    empresaFull: compact.includes("empresa") && compact.includes("full") && !pack,
  }
}

function originForRows(rows) {
  if (rows.length === 0) {
    return {
      tv: "REVIEW",
      reason: "sin_fila_internet_tv",
      condition: null,
      conflicts: [],
      packs: [],
    }
  }
  const facts = rows.map(rowFacts)
  const packs = [...new Set(facts.map((fact) => fact.pack).filter(Boolean))]
  const hasFull = packs.length > 0
  const hasPlanGratis = facts.some((fact) => fact.planGratis)
  const hasBasica = facts.some((fact) => fact.basica)
  const hasJubilado = facts.some((fact) => fact.jubilado)
  const nameKinds = [...new Set(facts.map((fact) => fact.nameGratis).filter(Boolean))]
  const conflicts = []
  if (hasFull && hasPlanGratis) conflicts.push("pack_full_y_plan_gratuito")
  if (hasFull && nameKinds.length > 0) conflicts.push("pack_full_y_nombre_gratis")
  if (hasBasica && hasPlanGratis) conflicts.push("tv_basica_y_plan_gratuito")
  if (hasBasica && nameKinds.length > 0) conflicts.push("nombre_gratis_con_tv_explicita")
  if (hasJubilado && hasFull) conflicts.push("jubilado_y_tv_full")
  if (facts.some((fact) => fact.halfTvWithoutJubilado)) conflicts.push("importe_tv_50_sin_palabra_jubilado")
  if (packs.length > 1) conflicts.push("mas_de_un_pack_full")

  const condition = hasJubilado ? { code: "JUBILADO", discountPercent: 50 } : null
  if (hasFull) {
    return { tv: "TV_FULL", reason: "pack_full", condition, conflicts, packs }
  }
  if (hasPlanGratis) {
    return { tv: "SIN_TV", reason: "plan_gratuito", condition, conflicts, packs }
  }
  if (nameKinds.length > 0 && hasBasica) {
    return {
      tv: "REVIEW",
      reason: "conflicto_nombre_gratis_con_tv_explicita",
      condition,
      conflicts,
      packs,
      nameGratis: nameKinds,
    }
  }
  if (nameKinds.length > 0) {
    return { tv: "SIN_TV", reason: "nombre_gratis_sin_tv_en_plan", condition, conflicts, packs, nameGratis: nameKinds }
  }
  if (hasBasica) {
    return {
      tv: "TV_BASICA",
      reason: hasJubilado ? "tv_basica_jubilado" : "tv_basica_en_plan",
      condition,
      conflicts,
      packs,
    }
  }
  return { tv: "REVIEW", reason: "plan_sin_mencion_de_tv", condition, conflicts, packs }
}

function bespokeTv(services, catalogById, catalogByCode, fullUpgradeByService) {
  let basica = false
  let full = false
  let other = []
  for (const service of services) {
    const catalog =
      (service.catalog_id && catalogById.get(service.catalog_id)) ||
      (service.catalog_code && catalogByCode.get(fold(service.catalog_code))) ||
      null
    const included = catalog?.tv_plan_catalog_id ? catalogById.get(catalog.tv_plan_catalog_id) : null
    const includedCode = fold(included?.code)
    if (includedCode === "tv-basico") basica = true
    else if (includedCode === "tv-full") full = true
    else if (includedCode) other.push(included.code)
    if ((fullUpgradeByService.get(service.id) ?? []).length > 0) full = true
  }
  return { basica, full, other: [...new Set(other)] }
}

function representation(origin, current) {
  if (origin === "REVIEW") return "NO_EVALUADO"
  if (origin === "TV_BASICA") {
    if (current.full || current.other.length > 0) return "INCONSISTENTE"
    if (current.basica) return "CORRECTA"
    return "FALTA_BASICA"
  }
  if (origin === "TV_FULL") {
    if (current.other.length > 0) return "INCONSISTENTE"
    if (current.full) return "CORRECTA"
    return "FALTA_FULL"
  }
  if (current.basica || current.full || current.other.length > 0) return "INCONSISTENTE"
  return "CORRECTA_SIN_TV"
}

async function countTable(db, table) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", ABNET_COMPANY_ID)
  if (error) fail(`${table}: ${error.message}`)
  return count ?? 0
}

function brief(customer, extra) {
  return {
    customerNumber: customer.customerNumber ?? customer.customer_number,
    name: customer.name,
    abnetNumber: customer.abnetNumber,
    ...extra,
  }
}

async function main() {
  assertReadOnlyInvocation()
  const universeIds = getClients360CommercialUniverse()
  if (universeIds.length !== EXPECTED_UNIVERSE) {
    fail(`Universo comercial: se esperaba ${EXPECTED_UNIVERSE} y hay ${universeIds.length}.`)
  }
  const universeSet = new Set(universeIds)

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: readOnlyFrom(client) }

  const before = {
    customers: await countTable(db, "customers"),
    services: await countTable(db, "isp_services"),
    connections: await countTable(db, "isp_connections"),
    tasks: await countTable(db, "tasks"),
  }

  const customers = await fetchAll(
    db,
    "customers",
    "id, name, customer_number, external_customer_code, deleted_at"
  )
  const services = await fetchAll(
    db,
    "isp_services",
    "id, customer_id, catalog_id, catalog_code, plan_name, deleted_at"
  )
  const catalog = await fetchAll(
    db,
    "isp_service_catalog",
    "id, code, tv_plan_catalog_id, category, deleted_at"
  )
  const components = await fetchAll(
    db,
    "isp_commercial_components",
    "id, code, component_type, tv_plan_catalog_id, deleted_at"
  )
  const assignments = await fetchAll(
    db,
    "isp_service_components",
    "id, service_id, component_id, status, deleted_at"
  )
  const conditionCatalog = await fetchAll(
    db,
    "isp_commercial_conditions",
    "id, code, discount_percent, deleted_at"
  )
  const serviceConditions = await fetchAll(
    db,
    "isp_service_conditions",
    "id, service_id, condition_id, discount_percent, status, deleted_at"
  )

  const liveCustomers = customers.filter((row) => !row.deleted_at)
  const customerById = new Map(liveCustomers.map((row) => [row.id, row]))
  const missing = universeIds.filter((id) => !customerById.has(id))
  if (missing.length > 0) fail(`${missing.length} IDs del universo no son customers activos.`)

  const conex = existsSync(REQUESTED_CONEX)
    ? { path: REQUESTED_CONEX, requestedFound: true }
    : existsSync(PRESENT_CONEX)
      ? { path: PRESENT_CONEX, requestedFound: false }
      : null
  if (!conex) fail("No está el Excel de Internet + TV.")
  const internetFile = readInternetDetailed(conex.path)
  const collapsed = collapseExactInternetCopies(internetFile.rows)
  const rowsByNumber = new Map()
  for (const row of collapsed.kept) pushMap(rowsByNumber, row.number, row)

  const catalogById = new Map(catalog.filter((row) => !row.deleted_at).map((row) => [row.id, row]))
  const catalogByCode = new Map(
    catalog.filter((row) => !row.deleted_at && row.code).map((row) => [fold(row.code), row])
  )
  const fullComponentIds = new Set(
    components
      .filter(
        (row) =>
          !row.deleted_at &&
          row.component_type === "tv_upgrade" &&
          fold(catalogById.get(row.tv_plan_catalog_id)?.code) === "tv-full"
      )
      .map((row) => row.id)
  )
  const fullUpgradeByService = new Map()
  for (const row of assignments) {
    if (row.deleted_at || row.status !== "active" || !fullComponentIds.has(row.component_id)) continue
    pushMap(fullUpgradeByService, row.service_id, row)
  }
  const servicesByCustomer = new Map()
  for (const service of services) {
    if (!service.deleted_at) pushMap(servicesByCustomer, service.customer_id, service)
  }
  const jubiladoConditionIds = new Set(
    conditionCatalog
      .filter((row) => !row.deleted_at && fold(row.code) === "jubilado" && Number(row.discount_percent) === 50)
      .map((row) => row.id)
  )
  const jubiladoServices = new Set()
  for (const row of serviceConditions) {
    if (row.deleted_at || row.status !== "active" || !jubiladoConditionIds.has(row.condition_id)) continue
    if (Number(row.discount_percent) !== 50) continue
    jubiladoServices.add(row.service_id)
  }

  const classified = universeIds.map((id) => {
    const customer = customerById.get(id)
    const abnetNumber = abnetNumberFromExternalCode(customer.external_customer_code)
    const rows = abnetNumber ? rowsByNumber.get(abnetNumber) ?? [] : []
    const origin = abnetNumber
      ? originForRows(rows)
      : { tv: "REVIEW", reason: "sin_numero_abnet", condition: null, conflicts: [], packs: [] }
    const customerServices = servicesByCustomer.get(id) ?? []
    const current = bespokeTv(customerServices, catalogById, catalogByCode, fullUpgradeByService)
    const bespoke = representation(origin.tv, current)
    const jubiladoRepresented = customerServices.some((service) => jubiladoServices.has(service.id))
    return {
      id,
      customerNumber: customer.customer_number,
      name: customer.name,
      abnetNumber,
      rows,
      tv: origin.tv,
      reason: origin.reason,
      condition: origin.condition,
      conflicts: origin.conflicts,
      packs: origin.packs,
      bespoke,
      current,
      jubiladoRepresented,
    }
  })

  const tvCounts = countBy(classified.map((row) => row.tv))
  const bespokeCounts = countBy(classified.map((row) => row.bespoke))
  const tvSum = Object.values(tvCounts).reduce((total, value) => total + value, 0)
  const bespokeSum = Object.values(bespokeCounts).reduce((total, value) => total + value, 0)
  if (tvSum !== EXPECTED_UNIVERSE) fail(`La clasificación de TV suma ${tvSum}, no ${EXPECTED_UNIVERSE}.`)
  if (bespokeSum !== EXPECTED_UNIVERSE) {
    fail(`La representación Bespoke suma ${bespokeSum}, no ${EXPECTED_UNIVERSE}.`)
  }
  const fullWithoutExplicitPack = classified.filter((row) => row.tv === "TV_FULL" && row.packs.length === 0)
  if (fullWithoutExplicitPack.length > 0) {
    fail("Hay TV Full sin una fila TV PACK FULL. FULL de un plan empresa no puede clasificarse así.")
  }

  function list(predicate, extra) {
    return classified.filter(predicate).map((row) =>
      brief(row, {
        tv: row.tv,
        reason: row.reason,
        bespoke: row.bespoke,
        planes: [...new Set(row.rows.map((item) => `${item.tipo} | ${item.plan}`))],
        packs: row.packs,
        conflicts: row.conflicts,
        condition: row.condition,
        filas: row.rows.map((item) => ({
          tipo: item.tipo,
          nodo: item.nodo,
          plan: item.plan,
          estado: item.estado,
          tv: item.tv,
          final: item.finalAmount,
        })),
        ...extra(row),
      })
    )
  }

  const after = {
    customers: await countTable(db, "customers"),
    services: await countTable(db, "isp_services"),
    connections: await countTable(db, "isp_connections"),
    tasks: await countTable(db, "tasks"),
  }
  const unchanged =
    before.customers === after.customers &&
    before.services === after.services &&
    before.connections === after.connections &&
    before.tasks === after.tasks
  if (!unchanged) fail("Los conteos cambiaron durante la auditoría. No debería haber escrituras.")

  const numbersByTv = (tv) =>
    new Set(classified.filter((row) => row.tv === tv && row.abnetNumber).map((row) => row.abnetNumber)).size

  const report = {
    readOnly: true,
    operations: ["select"],
    sources: {
      universo: "getClients360CommercialUniverse()",
      internetTv: conex.path,
      requestedWorkbook: REQUESTED_CONEX,
      requestedWorkbookFound: conex.requestedFound,
      headerRow: internetFile.headerRow,
      bespoke: [
        "customers",
        "isp_services",
        "isp_service_catalog",
        "isp_commercial_components",
        "isp_service_components",
        "isp_commercial_conditions",
        "isp_service_conditions",
      ],
    },
    rules: {
      universo: "IDs concretos. Los clientes de afuera no entran.",
      tv: "El plan de Internet + TV decide. Una fila TV PACK FULL clasifica TV Full aunque el internet diga TV Básica. Un plan sin esas palabras queda en revisión.",
      noInferencia: "No se usa la conexión, la IP, el nodo ni la existencia de un servicio para decidir si tiene TV.",
      bespoke:
        "TV Básica representada: el abono incluye el plan TV-BASICO y no tiene upgrade Full. TV Full representada: componente activo hacia TV-FULL. Sin TV representada: ningún plan ni upgrade de TV.",
    },
    resumen: {
      universo: classified.length,
      conNumeroAbnet: classified.filter((row) => row.abnetNumber).length,
      sinNumeroAbnet: classified.filter((row) => !row.abnetNumber).length,
      numerosAbnetDistintos: new Set(classified.map((row) => row.abnetNumber).filter(Boolean)).size,
      tv: {
        basica: tvCounts.TV_BASICA ?? 0,
        full: tvCounts.TV_FULL ?? 0,
        sinTv: tvCounts.SIN_TV ?? 0,
        review: tvCounts.REVIEW ?? 0,
      },
      numerosDistintos: {
        basica: numbersByTv("TV_BASICA"),
        full: numbersByTv("TV_FULL"),
        sinTv: numbersByTv("SIN_TV"),
        review: numbersByTv("REVIEW"),
      },
      bespoke: {
        correcta: bespokeCounts.CORRECTA ?? 0,
        faltaBasica: bespokeCounts.FALTA_BASICA ?? 0,
        faltaFull: bespokeCounts.FALTA_FULL ?? 0,
        inconsistente: bespokeCounts.INCONSISTENTE ?? 0,
        correctaSinTv: bespokeCounts.CORRECTA_SIN_TV ?? 0,
        noEvaluado: bespokeCounts.NO_EVALUADO ?? 0,
      },
    },
    distribucion: {
      motivos: countBy(classified.map((row) => `${row.tv}:${row.reason}`)),
      bespokePorTv: countBy(classified.map((row) => `${row.tv}:${row.bespoke}`)),
      planes: countBy(
        classified.flatMap((row) => row.rows.map((item) => {
          const facts = rowFacts(item)
          const signal = facts.pack ? "FULL" : facts.planGratis ? "SIN_TV" : facts.basica ? "BASICA" : "SIN_MENCION"
          return `${signal} | ${item.tipo} | ${item.plan}`
        }))
      ),
    },
    copiasExactasDescartadas: collapsed.extraCopies,
    clientesFueraDelUniversoIgnorados: universeSet.size === EXPECTED_UNIVERSE,
    tvFull: list((row) => row.tv === "TV_FULL", (row) => ({
      incluidaBasica: row.current.basica,
      upgradeFull: row.current.full,
    })),
    sinTv: list((row) => row.tv === "SIN_TV", () => ({})),
    review: list((row) => row.tv === "REVIEW", () => ({})),
    faltaBasica: list((row) => row.bespoke === "FALTA_BASICA", (row) => ({
      incluidaBasica: row.current.basica,
      upgradeFull: row.current.full,
    })),
    faltaFull: list((row) => row.bespoke === "FALTA_FULL", (row) => ({
      incluidaBasica: row.current.basica,
      upgradeFull: row.current.full,
    })),
    inconsistentes: list((row) => row.bespoke === "INCONSISTENTE", (row) => ({
      incluidaBasica: row.current.basica,
      upgradeFull: row.current.full,
      otrosPlanesTv: row.current.other,
    })),
    counts: { before, after },
    unchanged,
    tvFullResumen: {
      clientes: (tvCounts.TV_FULL ?? 0),
      numeros: numbersByTv("TV_FULL"),
      pack1: classified.filter((row) => row.packs.includes("TV PACK FULL 1")).length,
      pack2: classified.filter((row) => row.packs.includes("TV PACK FULL 2")).length,
      multiplesFilas: classified.filter((row) => row.tv === "TV_FULL" && row.rows.length > 1).length,
      conBasicaEnBespoke: classified.filter((row) => row.tv === "TV_FULL" && row.current.basica).length,
      conUpgradeFull: classified.filter((row) => row.tv === "TV_FULL" && row.current.full).length,
    },
    jubilados: {
      clientes: classified.filter((row) => row.condition?.code === "JUBILADO").length,
      tvBasica: classified.filter((row) => row.condition?.code === "JUBILADO" && row.tv === "TV_BASICA").length,
      tvFull: classified.filter((row) => row.condition?.code === "JUBILADO" && row.tv === "TV_FULL").length,
      review: classified.filter((row) => row.condition?.code === "JUBILADO" && row.tv === "REVIEW").length,
      sinTv: classified.filter((row) => row.condition?.code === "JUBILADO" && row.tv === "SIN_TV").length,
      condicion: "JUBILADO",
      descuento: 50,
      conCondicionActivaEnBespoke: classified.filter((row) => row.condition?.code === "JUBILADO" && row.jubiladoRepresented).length,
    },
    gratis: {
      identificadosEnNombreOPlan: classified.filter((row) =>
        row.reason === "plan_gratuito" ||
        row.reason === "nombre_gratis_sin_tv_en_plan" ||
        row.reason === "conflicto_nombre_gratis_con_tv_explicita" ||
        row.conflicts.includes("nombre_gratis_con_tv_explicita") ||
        row.conflicts.includes("pack_full_y_nombre_gratis")
      ).length,
      sinTv: classified.filter((row) => row.tv === "SIN_TV").length,
      conflictos: list((row) => row.conflicts.some((conflict) => conflict.includes("gratis") || conflict.includes("gratuito")), () => ({})),
    },
  }

  console.log(JSON.stringify(report))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
