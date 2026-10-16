/**
 * Auditoría de solo lectura: servicios y conexiones ABNet que todavía no
 * están representados dentro del universo comercial de Clientes 360.
 *
 * Universo: getClients360CommercialUniverse(). No se reconstruye por DNI,
 * nombre, N° ABNet ni OT.
 *
 * Fuentes: maestro, Conex. Internet + TV, facturación de octubre, customers,
 * isp_subscribers, isp_services, isp_connections y tasks.
 *
 * Planes: mapAbnetResidentialCatalog y la familia de plan de la auditoría de
 * excepciones. Una copia exacta es abnetExactInternetKey (N°, tipo, nodo,
 * plan, estado, TV y FINAL). Morosa e Inactiva no se tratan como baja.
 *
 * No hace INSERT, UPDATE, DELETE ni UPSERT.
 *
 * Uso: npx tsx scripts/abnet-services-connections-gap-audit.mjs
 */
import { createRequire } from "node:module"
import { createClient } from "@supabase/supabase-js"

import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  abnetConnectionExternalCode,
  abnetExactInternetKey,
  abnetNumberFromCell,
  abnetServiceExternalCode,
  collapseExactInternetCopies,
  decideResidentialStatus,
  fold,
  mapAbnetResidentialCatalog,
} from "../lib/isp/abnet-residential-load.ts"
import { getClients360CommercialUniverse } from "../lib/isp/clients-360-universe.ts"
import { classifyClientes360Customer } from "./abnet-clientes-360-universe-audit.mjs"
import { EXCEPTION_DECISIONS } from "./abnet-alta-exceptions-audit.mjs"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"
import {
  ABNET_COMPANY_ID,
  DEFAULT_BILLING,
  DEFAULT_CONEX,
  fetchAll,
  loadEnv,
} from "./abnet-residential-sources.mjs"

const MASTER_PATH = "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"
const CONTROL = {
  universe: 4740,
  customers: 5835,
  services: 3998,
  connections: 3998,
  tasks: 1427,
  masterNumbers: 4785,
  internetRows: 4764,
  internetNumbers: 4377,
  billingRows: 4037,
  billingNumbers: 3792,
}
const KNOWN_DUPLICATE_NUMBERS = ["1390", "1708", "3029", "3058", "4676", "5032", "5437"]
const RESIDENTIAL_CODES = [
  "WIRELESS-20-TV-BASICO",
  "FTTH-50-TV-BASICO",
  "FTTH-100-TV-BASICO",
  "FTTH-300-TV-BASICO",
]
const PLAN_LABEL = {
  "WIRELESS-20-TV-BASICO": "20 MB + TV Básica",
  "FTTH-50-TV-BASICO": "50 MB + TV Básica",
  "FTTH-100-TV-BASICO": "100 MB + TV Básica",
  "FTTH-300-TV-BASICO": "300 MB + TV Básica",
}

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function assertReadOnlyInvocation() {
  const blocked = ["--apply", "--write", "--execute"]
  if (process.argv.some((arg) => blocked.includes(arg))) {
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
  const finalIndex = column(["final"])
  if ([numberIndex, nameIndex, typeIndex, planIndex, statusIndex].some((index) => index < 0)) {
    fail("Internet + TV no tiene las columnas esperadas.")
  }
  return matrix.slice(headerRow + 1).flatMap((row) => {
    const number = abnetNumberFromCell(row[numberIndex])
    if (!number) return []
    return [
      {
        number,
        name: text(row[nameIndex]) ?? "",
        tipo: text(row[typeIndex]) ?? "",
        nodo: nodeIndex >= 0 ? text(row[nodeIndex]) : null,
        plan: text(row[planIndex]) ?? "",
        estado: text(row[statusIndex]) ?? "",
        tv: tvIndex >= 0 ? amount(row[tvIndex]) : null,
        finalAmount: finalIndex >= 0 ? amount(row[finalIndex]) : null,
      },
    ]
  })
}

function readBillingDetailed(file) {
  const matrix = readMatrix(file)
  const column = headerMap(matrix[0] ?? [])
  const numberIndex = column(["ncliente", "numerocliente"])
  const nameIndex = column(["cliente", "nombre"])
  const typeIndex = column(["tipo"])
  const nodeIndex = column(["nodo"])
  const ipIndex = column(["ip"])
  const planIndex = column(["plan"])
  const statusIndex = column(["estado"])
  const amountIndex = column(["importe", "monto", "precio", "total", "abono", "final", "cuota"])
  if (numberIndex < 0 || planIndex < 0) fail("Facturación no tiene N° Cliente y Plan.")
  return matrix.slice(1).flatMap((row) => {
    const number = abnetNumberFromCell(row[numberIndex])
    if (!number) return []
    return [
      {
        number,
        name: nameIndex >= 0 ? text(row[nameIndex]) ?? "" : "",
        tipo: typeIndex >= 0 ? text(row[typeIndex]) ?? "" : "",
        nodo: nodeIndex >= 0 ? text(row[nodeIndex]) : null,
        ip: ipIndex >= 0 ? text(row[ipIndex]) : null,
        plan: text(row[planIndex]) ?? "",
        estado: statusIndex >= 0 ? text(row[statusIndex]) ?? "" : "",
        amount: amountIndex >= 0 ? amount(row[amountIndex]) : null,
      },
    ]
  })
}

function planFamily(row) {
  const compact = compactPlan(row.plan)
  const type = fold(row.tipo)
  if (type === "tv plan" || compact.includes("tvpackfull")) return "tv"
  if (compact.includes("jubilado")) return "jubilado"
  if (compact.includes("empresa")) return "empresa"
  if (compact.includes("duplicado")) return "duplicado"
  if (compact.includes("dedicado")) return "dedicado"
  if (compact.includes("baja")) return "baja"
  if (compact.includes("25")) return "mb25"
  if (compact.includes("15")) return "mb15"
  if (mapAbnetResidentialCatalog(row.tipo, row.plan)) return "residential"
  if (["20mb+tvbasico", "50mb+tvbasico", "100mb+tvbasico", "300mb+tvbasico"].includes(compact)) {
    return "type_mismatch"
  }
  return "other"
}

function baseCatalog(tipo, plan) {
  return mapAbnetResidentialCatalog(tipo, compactPlan(plan).replace(/jubilado/g, ""))
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))]
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

function nodeFromNotes(notes) {
  const current = text(notes)
  if (!current) return null
  const prefix = "nodo:"
  const folded = fold(current)
  if (!folded.startsWith(prefix)) return null
  return current.slice(current.indexOf(":") + 1).trim() || null
}

function sameIp(left, right) {
  return fold(left) === fold(right)
}

function billingIps(rows, tipo, nodo) {
  return unique(
    rows
      .filter((row) => fold(row.tipo) === fold(tipo) && fold(row.nodo) === fold(nodo))
      .map((row) => row.ip?.trim() ?? "")
      .filter((ip) => ip.length > 0)
  )
}

function multiKind(rows) {
  const types = new Set(rows.map((row) => fold(row.tipo)))
  const plans = new Set(rows.map((row) => compactPlan(row.plan)))
  const statuses = new Set(rows.map((row) => fold(row.estado)))
  const nodes = new Set(rows.map((row) => fold(row.nodo)))
  const techChange =
    types.has("wireless") &&
    types.has("fibra") &&
    rows.some((row) => fold(row.estado) === "pendiente")
  if (techChange) return "cambio_de_tecnologia"
  if (plans.size === 1 && statuses.size === 1 && types.size === 1 && nodes.size === 1) {
    return "posible_duplicado_no_exacto"
  }
  return "dos_servicios_reales"
}

function assertControl(label, actual, expected) {
  if (actual !== expected) {
    fail(`${label}: se esperaba ${expected} y hay ${actual}. No se continúa.`)
  }
}

function briefCustomer(customer) {
  return {
    customerNumber: customer.customer_number,
    name: customer.name,
    abnetNumber: customer.abnetNumber,
  }
}

function briefRow(row) {
  return {
    tipo: row.tipo,
    nodo: row.nodo,
    plan: row.plan,
    estado: row.estado,
    tv: row.tv,
    finalAmount: row.finalAmount,
  }
}

async function main() {
  assertReadOnlyInvocation()
  const universeIds = getClients360CommercialUniverse()
  assertControl("Universo comercial", universeIds.length, CONTROL.universe)
  const universeSet = new Set(universeIds)

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: readOnlyFrom(client) }

  const [customerCount, serviceCount, connectionCount, taskCount] = await Promise.all([
    countTable(db, "customers"),
    countTable(db, "isp_services"),
    countTable(db, "isp_connections"),
    countTable(db, "tasks"),
  ])
  assertControl("Customers", customerCount, CONTROL.customers)
  assertControl("Servicios", serviceCount, CONTROL.services)
  assertControl("Conexiones", connectionCount, CONTROL.connections)
  assertControl("OTs", taskCount, CONTROL.tasks)

  const customers = await fetchAll(
    db,
    "customers",
    "id, name, customer_number, external_customer_code, created_at, deleted_at"
  )
  const subscribers = await fetchAll(db, "isp_subscribers", "id, customer_id, deleted_at")
  const services = await fetchAll(
    db,
    "isp_services",
    "id, customer_id, catalog_code, plan_name, external_code, commercial_status, technology, deleted_at"
  )
  const connections = await fetchAll(
    db,
    "isp_connections",
    "id, service_id, ip_address, notes, external_code, connection_type, technical_status, deleted_at"
  )
  const tasks = await fetchAll(
    db,
    "tasks",
    "id, customer_id, code, status, title, created_at, updated_at, deleted_at"
  )

  const liveCustomers = customers.filter((row) => !row.deleted_at)
  const customerById = new Map(liveCustomers.map((row) => [row.id, row]))
  const missingUniverse = universeIds.filter((id) => !customerById.has(id))
  if (missingUniverse.length > 0) {
    fail(`${missingUniverse.length} IDs del universo no son customers activos.`)
  }

  const internetRows = readInternetDetailed(DEFAULT_CONEX)
  const billingRows = readBillingDetailed(DEFAULT_BILLING)
  const masterRows = readAbnetMasterRows(MASTER_PATH)
  const masterNumbers = new Set(
    masterRows.map((row) => abnetNumberFromExternalCode(row.customerNumber)).filter(Boolean)
  )
  assertControl("N° únicos del maestro", masterNumbers.size, CONTROL.masterNumbers)
  assertControl("Filas Internet + TV", internetRows.length, CONTROL.internetRows)
  assertControl("N° únicos Internet + TV", new Set(internetRows.map((row) => row.number)).size, CONTROL.internetNumbers)
  assertControl("Filas de facturación", billingRows.length, CONTROL.billingRows)
  assertControl("N° únicos de facturación", new Set(billingRows.map((row) => row.number)).size, CONTROL.billingNumbers)

  const collapsed = collapseExactInternetCopies(internetRows)
  const residentialRaw = internetRows.filter((row) => planFamily(row) === "residential")
  const collapsedResidential = collapseExactInternetCopies(residentialRaw)

  const liveServices = services.filter((row) => !row.deleted_at)
  const liveConnections = connections.filter((row) => !row.deleted_at)
  const liveSubscribers = subscribers.filter((row) => !row.deleted_at)
  const serviceById = new Map(services.map((row) => [row.id, row]))
  const liveServiceById = new Map(liveServices.map((row) => [row.id, row]))

  const servicesByCustomer = new Map()
  for (const service of liveServices) pushMap(servicesByCustomer, service.customer_id, service)
  const connectionsByService = new Map()
  for (const connection of liveConnections) pushMap(connectionsByService, connection.service_id, connection)

  const connectionsByCustomer = new Map()
  let orphanConnections = 0
  for (const connection of liveConnections) {
    const service = serviceById.get(connection.service_id)
    if (!service || service.deleted_at) {
      orphanConnections += 1
      if (service && !servicesByCustomer.has(service.customer_id)) {
        pushMap(connectionsByCustomer, service.customer_id, connection)
      }
      continue
    }
    pushMap(connectionsByCustomer, service.customer_id, connection)
  }

  const subscriberIds = new Set(liveSubscribers.map((row) => row.customer_id))
  const tasksByCustomer = new Map()
  for (const task of tasks) {
    if (task.customer_id) pushMap(tasksByCustomer, task.customer_id, task)
  }
  const internetByNumber = new Map()
  for (const row of collapsed.kept) pushMap(internetByNumber, row.number, row)
  const billingByNumber = new Map()
  for (const row of billingRows) pushMap(billingByNumber, row.number, row)
  const customersByNumber = new Map()
  for (const customer of liveCustomers) {
    const number = abnetNumberFromExternalCode(customer.external_customer_code)
    if (!number) continue
    pushMap(customersByNumber, number, customer)
  }

  const universeCustomers = universeIds.map((id) => {
    const customer = customerById.get(id)
    const abnetNumber = abnetNumberFromExternalCode(customer.external_customer_code)
    return {
      ...customer,
      abnetNumber,
      services: servicesByCustomer.get(id) ?? [],
      connections: connectionsByCustomer.get(id) ?? [],
      subscriber: subscriberIds.has(id),
    }
  })
  const universeByNumber = new Map()
  for (const customer of universeCustomers) {
    if (customer.abnetNumber) pushMap(universeByNumber, customer.abnetNumber, customer)
  }

  function siblingCovers(customer, catalog) {
    const siblings = (customersByNumber.get(customer.abnetNumber) ?? []).filter((row) => row.id !== customer.id)
    return siblings.some((sibling) =>
      (servicesByCustomer.get(sibling.id) ?? []).some((service) => service.catalog_code === catalog)
    )
  }

  function classifyResidential(customer, rows) {
    const pool = [...customer.services]
    const used = new Set()
    const result = []
    for (const row of rows) {
      const catalog = mapAbnetResidentialCatalog(row.tipo, row.plan)
      const external = abnetServiceExternalCode(row)
      let match = pool.find((service) => service.external_code === external && !used.has(service.id))
      let mismatchedCode = false
      if (match && match.catalog_code !== catalog) mismatchedCode = true
      if (!match) {
        match = pool.find((service) => service.catalog_code === catalog && !used.has(service.id))
      }
      if (match) {
        used.add(match.id)
        const linked = connectionsByService.get(match.id) ?? []
        result.push({
          row,
          catalog,
          status: mismatchedCode
            ? "DESCUADRE_PLAN"
            : linked.length > 0
              ? "REPRESENTADO_CORRECTAMENTE"
              : "FALTA_CONEXION",
          service: match,
          connection: linked[0] ?? null,
        })
        continue
      }
      result.push({ row, catalog, status: "PENDIENTE", service: null, connection: null })
    }
    const leftover = pool.filter((service) => !used.has(service.id))
    for (const item of result) {
      if (item.status !== "PENDIENTE") continue
      if (siblingCovers(customer, item.catalog)) {
        item.status = "CUBIERTO_EN_OTRA_FICHA"
        continue
      }
      if (leftover.length > 0) {
        item.status = "DESCUADRE_PLAN"
        item.service = leftover.shift()
        continue
      }
      item.status = "FALTA_SERVICIO"
    }
    return result
  }

  const classified = universeCustomers.map((customer) => {
    const rows = customer.abnetNumber ? internetByNumber.get(customer.abnetNumber) ?? [] : []
    const residential = rows.filter((row) => planFamily(row) === "residential")
    const specials = rows.filter((row) => planFamily(row) !== "residential")
    const residentialStatus = residential.length > 0 ? classifyResidential(customer, residential) : []
    let bucket = "sin_numero"
    if (customer.abnetNumber && rows.length === 0) bucket = "sin_fila"
    else if (customer.abnetNumber && residential.length === 0) bucket = "especiales"
    else if (customer.abnetNumber) {
      const statuses = new Set(residentialStatus.map((item) => item.status))
      if (statuses.has("DESCUADRE_PLAN")) bucket = "descuadre"
      else if (statuses.has("FALTA_CONEXION")) bucket = "falta_conexion"
      else if (statuses.has("FALTA_SERVICIO")) bucket = "falta_servicio"
      else if ([...statuses].every((status) => status === "CUBIERTO_EN_OTRA_FICHA")) bucket = "duplicado_otra_ficha"
      else if (
        [...statuses].every((status) => status === "REPRESENTADO_CORRECTAMENTE" || status === "CUBIERTO_EN_OTRA_FICHA")
      ) {
        bucket = "representado"
      } else bucket = "falta_servicio"
    }
    const billing = customer.abnetNumber ? billingByNumber.get(customer.abnetNumber) ?? [] : []
    return { customer, rows, residential, specials, residentialStatus, bucket, billing }
  })

  const bucketOrder = [
    "representado",
    "falta_servicio",
    "falta_conexion",
    "descuadre",
    "especiales",
    "sin_fila",
    "sin_numero",
    "duplicado_otra_ficha",
  ]
  const byBucket = new Map(bucketOrder.map((bucket) => [bucket, []]))
  for (const row of classified) {
    if (!byBucket.has(row.bucket)) fail(`Clasificación desconocida: ${row.bucket}`)
    byBucket.get(row.bucket).push(row)
  }
  const bucketSum = [...byBucket.values()].reduce((total, rows) => total + rows.length, 0)
  if (bucketSum !== CONTROL.universe) {
    fail(`La clasificación de customers suma ${bucketSum}, no ${CONTROL.universe}.`)
  }

  function bucketTotals(bucket) {
    const rows = byBucket.get(bucket)
    return {
      clientes: rows.length,
      serviciosBespoke: rows.reduce((total, row) => total + row.customer.services.length, 0),
      conexionesBespoke: rows.reduce((total, row) => total + row.customer.connections.length, 0),
    }
  }

  const summary = {
    representadosCorrectamente: bucketTotals("representado"),
    faltaServicio: bucketTotals("falta_servicio"),
    faltaConexion: bucketTotals("falta_conexion"),
    descuadrePlan: bucketTotals("descuadre"),
    especialesNoMapeados: bucketTotals("especiales"),
    sinServicioAbnetEnExport: bucketTotals("sin_fila"),
    sinNumeroAbnet: bucketTotals("sin_numero"),
    duplicadoRepresentadoEnOtraFicha: bucketTotals("duplicado_otra_ficha"),
  }

  const matrix = {
    servicioYConexion: universeCustomers.filter((row) => row.services.length > 0 && row.connections.length > 0).length,
    servicioSinConexion: universeCustomers.filter((row) => row.services.length > 0 && row.connections.length === 0).length,
    conexionSinServicio: universeCustomers.filter((row) => row.services.length === 0 && row.connections.length > 0).length,
    sinServicioNiConexion: universeCustomers.filter((row) => row.services.length === 0 && row.connections.length === 0).length,
  }
  if (
    matrix.servicioYConexion +
      matrix.servicioSinConexion +
      matrix.conexionSinServicio +
      matrix.sinServicioNiConexion !==
    CONTROL.universe
  ) {
    fail("La matriz A/B/C/D no suma el universo.")
  }

  const plans = {}
  for (const code of RESIDENTIAL_CODES) {
    const holders = classified.filter((row) => row.residentialStatus.some((item) => item.catalog === code))
    const loaded = holders.filter((row) =>
      row.residentialStatus.some(
        (item) =>
          item.catalog === code &&
          (item.status === "REPRESENTADO_CORRECTAMENTE" || item.status === "FALTA_CONEXION")
      )
    )
    const missing = holders.filter((row) =>
      row.residentialStatus.some((item) => item.catalog === code && item.status === "FALTA_SERVICIO")
    )
    const mismatch = holders.filter((row) =>
      row.residentialStatus.some((item) => item.catalog === code && item.status === "DESCUADRE_PLAN")
    )
    const coveredElsewhere = holders.filter((row) =>
      row.residentialStatus.some((item) => item.catalog === code && item.status === "CUBIERTO_EN_OTRA_FICHA")
    )
    const missingByStatus = countBy(
      holders.flatMap((row) =>
        row.residentialStatus
          .filter((item) => item.catalog === code && item.status === "FALTA_SERVICIO")
          .map((item) => fold(item.row.estado) || "(vacío)")
      )
    )
    plans[PLAN_LABEL[code]] = {
      catalogCode: code,
      clientes: holders.length,
      yaCargados: loaded.length,
      faltantes: missing.length,
      descuadre: mismatch.length,
      cubiertosEnOtraFicha: coveredElsewhere.length,
      faltantesPorEstado: missingByStatus,
    }
  }

  function specialGroup(family) {
    const rows = collapsed.kept.filter((row) => planFamily(row) === family)
    const numbers = unique(rows.map((row) => row.number))
    const inUniverse = numbers.filter((number) => (universeByNumber.get(number) ?? []).length > 0)
    const universeCustomersForFamily = inUniverse.flatMap((number) => universeByNumber.get(number))
    const distinctUniverse = [...new Map(universeCustomersForFamily.map((row) => [row.id, row])).values()]
    return {
      filas: rows.length,
      numeros: numbers.length,
      conCustomerEnUniverso: distinctUniverse.length,
      conServicio: distinctUniverse.filter((row) => row.services.length > 0).length,
      conConexion: distinctUniverse.filter((row) => row.connections.length > 0).length,
      facturados: inUniverse.filter((number) => (billingByNumber.get(number) ?? []).length > 0).length,
      sinCustomer: numbers.filter((number) => (customersByNumber.get(number) ?? []).length === 0).length,
      estados: countBy(rows.map((row) => fold(row.estado) || "(vacío)")),
      planes: countBy(rows.map((row) => `${row.tipo} | ${row.plan}`)),
      casos: rows.map((row) => ({
        number: row.number,
        name: row.name,
        ...briefRow(row),
        enUniverso: (universeByNumber.get(row.number) ?? []).length > 0,
        servicio: (universeByNumber.get(row.number) ?? []).some((customer) => customer.services.length > 0),
        conexion: (universeByNumber.get(row.number) ?? []).some((customer) => customer.connections.length > 0),
        facturado: (billingByNumber.get(row.number) ?? []).length > 0,
        baseCatalog: family === "jubilado" ? baseCatalog(row.tipo, row.plan) : null,
      })),
    }
  }

  const noTechnical = classified.filter(
    (row) => row.customer.services.length === 0 && row.customer.connections.length === 0
  )
  function gapReason(row) {
    if (!row.customer.abnetNumber) return "sin_numero"
    if (row.bucket === "duplicado_otra_ficha") return "duplicado_en_otra_ficha"
    if (row.rows.length === 0) return "sin_fila_internet_tv"
    const loadable = row.residentialStatus.filter((item) => decideResidentialStatus(item.row.estado).load)
    if (loadable.length > 0) {
      const duplicated = (customersByNumber.get(row.customer.abnetNumber) ?? []).length > 1
      return duplicated ? "residencial_no_cargada_por_numero_duplicado" : "residencial_que_deberia_estar_cargada"
    }
    if (row.residential.some((item) => fold(item.estado) === "morosa")) return "morosa"
    if (row.residential.some((item) => fold(item.estado) === "inactiva")) return "inactiva"
    if (row.residential.length > 0) return "residencial_otro_estado"
    if (row.specials.length > 0) return "especial_no_mapeable"
    return "otro"
  }
  const sinRepresentacion = noTechnical.map((row) => ({
    ...briefCustomer(row.customer),
    subscriber: row.customer.subscriber,
    motivo: gapReason(row),
    filasInternetTv: row.rows.length,
    estados: unique(row.rows.map((item) => item.estado)),
    planes: unique(row.rows.map((item) => `${item.tipo} | ${item.plan}`)),
  }))

  const maestroSinTecnica = sinRepresentacion.filter((row) => row.abnetNumber)
  const maestro839 = {
    total: maestroSinTecnica.length,
    porMotivo: countBy(maestroSinTecnica.map((row) => row.motivo)),
    conEstado: {
      morosa: maestroSinTecnica.filter((row) => row.estados.some((status) => fold(status) === "morosa")).length,
      pendiente: maestroSinTecnica.filter((row) => row.estados.some((status) => fold(status) === "pendiente")).length,
      inactiva: maestroSinTecnica.filter((row) => row.estados.some((status) => fold(status) === "inactiva")).length,
      activa: maestroSinTecnica.filter((row) => row.estados.some((status) => fold(status) === "activa")).length,
    },
  }

  const withoutSubscriber = universeCustomers.filter((row) => !row.subscriber)
  const withoutSubscriberSplit = {
    total: withoutSubscriber.length,
    sinNumero: withoutSubscriber.filter((row) => !row.abnetNumber).length,
    maestroSinServicio: withoutSubscriber.filter((row) => row.abnetNumber && row.services.length === 0).length,
    maestroConServicio: withoutSubscriber.filter((row) => row.abnetNumber && row.services.length > 0).length,
  }

  const exceptionByNumber = new Map(EXCEPTION_DECISIONS.map((row) => [row.customerNumber, row.decision]))
  const outsideSubscribers = liveSubscribers
    .filter((row) => !universeSet.has(row.customer_id))
    .map((row) => {
      const customer = customerById.get(row.customer_id)
      const decision = customer ? exceptionByNumber.get(customer.customer_number) ?? null : null
      const classifiedCustomer = customer
        ? classifyClientes360Customer(customer, {
            masterNumbers,
            tasks: tasksByCustomer.get(customer.id) ?? [],
          })
        : null
      return {
        customerNumber: customer?.customer_number ?? null,
        name: customer?.name ?? null,
        abnetNumber: abnetNumberFromExternalCode(customer?.external_customer_code),
        exceptionDecision: decision,
        auditCategory: classifiedCustomer?.category ?? "SIN_CUSTOMER",
      }
    })

  const ip = { coincide: 0, falta: 0, diferencia: 0, ambigua: 0, sinIpEnAmbas: 0 }
  const nodo = { coincide: 0, falta: 0, diferente: 0 }
  for (const row of classified) {
    if (!row.customer.abnetNumber) continue
    const billing = billingByNumber.get(row.customer.abnetNumber) ?? []
    for (const item of row.residentialStatus) {
      if (!item.connection) continue
      const ips = billingIps(billing, item.row.tipo, item.row.nodo)
      const current = text(item.connection.ip_address)
      if (ips.length > 1) ip.ambigua += 1
      else if (ips.length === 1 && current && sameIp(ips[0], current)) ip.coincide += 1
      else if (ips.length === 1 && current && !sameIp(ips[0], current)) ip.diferencia += 1
      else if (ips.length === 1 && !current) ip.falta += 1
      else if (ips.length === 0 && current) ip.diferencia += 1
      else ip.sinIpEnAmbas += 1

      const stored = nodeFromNotes(item.connection.notes)
      if (!item.row.nodo || !stored) nodo.falta += 1
      else if (fold(stored) === fold(item.row.nodo)) nodo.coincide += 1
      else nodo.diferente += 1
    }
  }

  const billedUniverseNumbers = [...universeByNumber.keys()].filter(
    (number) => (billingByNumber.get(number) ?? []).length > 0
  )
  const billingSummary = {
    numerosDelUniverso: universeByNumber.size,
    facturadoOctubre: billedUniverseNumbers.length,
    noFacturado: universeByNumber.size - billedUniverseNumbers.length,
    clientesSinNumero: byBucket.get("sin_numero").length,
    clientesSinNumeroFacturados: 0,
    nota: "Las fichas sin N° ABNet no se cruzan por nombre. Ausencia de factura no es baja.",
  }

  const multiNumbers = [...internetByNumber.entries()].filter(([, rows]) => rows.length > 1)
  const multiples = {
    numeros: multiNumbers.length,
    porTipo: countBy(multiNumbers.map(([, rows]) => multiKind(rows))),
    copiasExactasDescartadas: collapsed.extraCopies,
    copiasExactasResidenciales: collapsedResidential.extraCopies,
    casos: multiNumbers.map(([number, rows]) => ({
      number,
      name: rows[0]?.name ?? "",
      tipo: multiKind(rows),
      enUniverso: (universeByNumber.get(number) ?? []).length,
      filas: rows.map(briefRow),
    })),
  }

  const sinNumero = byBucket.get("sin_numero").map((row) => {
    const liveTasks = (tasksByCustomer.get(row.customer.id) ?? []).filter((task) => !task.deleted_at)
    return {
      ...briefCustomer(row.customer),
      subscriber: row.customer.subscriber,
      servicios: row.customer.services.length,
      conexiones: row.customer.connections.length,
      facturadoOctubre: "NO",
      cruceFacturacion: "Sin N° ABNet. No se cruza por nombre.",
      ots: liveTasks.map((task) => ({
        code: task.code,
        status: task.status,
        title: task.title,
        createdAt: task.created_at,
      })),
    }
  })

  const sinCustomer = {
    numeros: unique(
      collapsed.kept
        .filter((row) => (customersByNumber.get(row.number) ?? []).length === 0)
        .map((row) => row.number)
    ).length,
    residenciales: unique(
      collapsedResidential.kept
        .filter((row) => (customersByNumber.get(row.number) ?? []).length === 0)
        .map((row) => row.number)
    ).length,
  }

  const abnetConFilaSinRepresentar = sinRepresentacion.filter((row) =>
    [
      "residencial_que_deberia_estar_cargada",
      "residencial_no_cargada_por_numero_duplicado",
      "morosa",
      "inactiva",
      "residencial_otro_estado",
      "especial_no_mapeable",
    ].includes(row.motivo)
  )

  const report = {
    readOnly: true,
    operations: ["select"],
    sources: {
      universo: "getClients360CommercialUniverse()",
      maestro: MASTER_PATH,
      internetTv: DEFAULT_CONEX,
      facturacion: DEFAULT_BILLING,
      tablas: ["customers", "isp_subscribers", "isp_services", "isp_connections", "tasks"],
    },
    rules: {
      identidad: "external_customer_code normalizado. No se usa nombre ni DNI.",
      universo: "IDs concretos del universo comercial. Los 1.095 de afuera no entran al cruce comercial.",
      residencial: RESIDENTIAL_CODES,
      copiaExacta: "N° + tipo + nodo + plan + estado + TV + FINAL",
      estados: "Activa, Morosa, Pendiente e Inactiva se mantienen separados. Morosa y Pendiente no son baja.",
      representado:
        "Servicio vivo con el código de catálogo del plan, o con el external_code de la fila, y conexión de ese servicio.",
    },
    control: {
      universe: universeIds.length,
      customers: customerCount,
      services: serviceCount,
      connections: connectionCount,
      tasks: taskCount,
    },
    matriz: matrix,
    conServicio: universeCustomers.filter((row) => row.services.length > 0).length,
    conConexion: universeCustomers.filter((row) => row.connections.length > 0).length,
    conexionesHuerfanas: orphanConnections,
    summary,
    plans,
    duplicadosExactos: {
      todasLasFilas: collapsed.extraCopies,
      residenciales: collapsedResidential.extraCopies,
    },
    especiales: {
      tvFull: specialGroup("tv"),
      jubilado: specialGroup("jubilado"),
      empresa: specialGroup("empresa"),
      mb15: specialGroup("mb15"),
      mb25: specialGroup("mb25"),
      dedicado: specialGroup("dedicado"),
      conexionEnBaja: specialGroup("baja"),
      otros: {
        typeMismatch: specialGroup("type_mismatch"),
        duplicadoEtiqueta: specialGroup("duplicado"),
        other: specialGroup("other"),
      },
    },
    sinFilaInternetTv: byBucket.get("sin_fila").length,
    conFilaAbnetSinRepresentar: abnetConFilaSinRepresentar.length,
    sinRepresentacionMotivos: countBy(sinRepresentacion.map((row) => row.motivo)),
    sinRepresentacion,
    maestroSinRepresentacionTecnica: maestro839,
    sinSubscriber: withoutSubscriberSplit,
    subscribersFueraDelUniverso: {
      total: outsideSubscribers.length,
      porCategoriaAudit: countBy(outsideSubscribers.map((row) => row.auditCategory)),
      porDecisionDeExcepcion: countBy(
        outsideSubscribers.map((row) => row.exceptionDecision ?? "no_es_excepcion")
      ),
      casos: outsideSubscribers,
    },
    ip,
    nodo,
    facturacion: billingSummary,
    multiples,
    sinNumero,
    sinCustomerEnInternetTv: sinCustomer,
    faltaServicioPorEstado: countBy(
      classified.flatMap((row) =>
        row.residentialStatus
          .filter((item) => item.status === "FALTA_SERVICIO")
          .map((item) => fold(item.row.estado) || "(vacío)")
      )
    ),
  }

  console.log(JSON.stringify(report))
}

async function countTable(db, table) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", ABNET_COMPANY_ID)
  if (error) fail(`${table}: ${error.message}`)
  return count ?? 0
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
