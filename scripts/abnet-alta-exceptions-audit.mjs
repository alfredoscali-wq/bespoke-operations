/**
 * Revisión de solo lectura de 12 altas recientes de Clientes 360.
 * No asigna N° ABNet ni modifica customers, servicios, conexiones u OTs.
 *
 * Uso: npx tsx scripts/abnet-alta-exceptions-audit.mjs
 */
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

import {
  abnetNumberFromExternalCode,
  documentDigits,
  isReliableIdentityDocument,
} from "../lib/isp/abnet-master-universe.ts"
import { abnetNumberFromCell } from "../lib/isp/abnet-residential-load.ts"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"
import {
  ABNET_COMPANY_ID,
  DEFAULT_BILLING,
  DEFAULT_CONEX,
  fetchAll,
  loadEnv,
  readInternetRows,
} from "./abnet-residential-sources.mjs"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const MASTER_PATH = "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"

export const EXCEPTION_DECISIONS = [
  {
    customerNumber: "CLI-005783",
    name: "Kumiec Axel",
    otCode: "TSK-OT-1129",
    identity: "MISMA_PERSONA",
    decision: "EXCLUIR",
    evidence: "Mismo DNI, teléfono y email que CLI-001317, que ya tiene el N° 2205, servicio de fibra activo y una OT de cambio de tecnología. Esta ficha repite a esa persona.",
  },
  {
    customerNumber: "CLI-005742",
    name: "Gallardo Laura",
    otCode: "TSK-OT-1030",
    identity: "MISMA_PERSONA",
    decision: "EXCLUIR",
    evidence: "Mismo DNI, nombre y email que CLI-004696 / 5994, que ya tiene dos servicios activos. La instalación se completó el 21 de septiembre, antes de la ventana. El updated_at del 23 de septiembre 13:55 coincide con un toque posterior, no con el cierre operativo.",
  },
  {
    customerNumber: "CLI-005728",
    name: "Castro Isabel",
    otCode: "TSK-OT-1011",
    identity: "MISMA_PERSONA",
    decision: "EXCLUIR",
    evidence: "Mismo DNI, teléfono y email que CLI-003160 / 4430, que ya tiene wireless y fibra activos. La instalación se completó el 21 de septiembre. El updated_at del 23 de septiembre 13:55 está a tres segundos del de Gallardo: es un toque administrativo.",
  },
  {
    customerNumber: "CLI-005759",
    name: "Casas Daniel",
    otCode: "TSK-OT-1063",
    identity: "MISMA_PERSONA",
    decision: "INCLUIR",
    evidence: "Instalación nueva de fibra finalizada el 25 de septiembre. No hay otra ficha. El maestro 6785 coincide en nombre, DNI, email y domicilio. El teléfono de la ficha repite el del maestro con dígitos de más. No se asigna el número.",
  },
  {
    customerNumber: "CLI-005567",
    name: "Fontana Carla",
    otCode: "TSK-OT-1125",
    identity: "REVIEW",
    decision: "REVIEW",
    evidence: "La OT reciente es un service técnico, no un alta. Existe otra ficha igual, CLI-005566, sin número. El maestro 6688 no está asignado. No se elige ficha.",
  },
  {
    customerNumber: "CLI-005765",
    name: "Molina Alexis",
    otCode: "TSK-OT-1071",
    identity: "MISMA_PERSONA",
    decision: "INCLUIR",
    evidence: "Instalación nueva wireless finalizada el 25 de septiembre. No hay otra ficha. El maestro 6791 coincide en nombre, DNI, teléfono y email. El domicilio precisa la misma calle Misiones. No se asigna el número.",
  },
  {
    customerNumber: "CLI-005421",
    name: "Gonzalez Julieta",
    otCode: "TSK-OT-1180",
    identity: "REVIEW",
    decision: "REVIEW",
    evidence: "La OT reciente es un service técnico sobre un alta de agosto. CLI-005422 es la misma persona, mismo contacto, sin número. El maestro 6639 no está asignado. No se elige ficha.",
  },
  {
    customerNumber: "CLI-005248",
    name: "Maldonado Estela",
    otCode: "TSK-OT-1218",
    identity: "REVIEW",
    decision: "REVIEW",
    evidence: "El DNI coincide con el maestro 3329, pero el teléfono, el email, el domicilio y la localidad no. La OT reciente es un cambio de tecnología sobre una instalación de julio, no un alta nueva.",
  },
  {
    customerNumber: "CLI-005812",
    name: "La Rubia Daniela",
    otCode: "TSK-OT-1211",
    identity: null,
    decision: "EXCLUIR",
    evidence: "Instalación nueva cancelada al día siguiente: no se puede instalar porque está tapado de pinos. No hay OT posterior, servicio ni conexión. Otra ficha, CLI-004969, tiene el mismo DNI y teléfono con el N° 6268, que no está en el maestro actual.",
  },
  {
    customerNumber: "CLI-005793",
    name: "Aparicio Santiago",
    otCode: "TSK-OT-1165",
    identity: null,
    decision: "EXCLUIR",
    evidence: "Instalación nueva cancelada: el pedido fue un error porque ya tienen servicio y necesitaban las boletas. No hay OT posterior, servicio ni conexión, y el DNI no está en el maestro.",
  },
  {
    customerNumber: "CLI-005801",
    name: "Gallerano Evelyn",
    otCode: "TSK-OT-1187",
    identity: null,
    decision: "INCLUIR",
    evidence: "Instalación nueva de fibra programada, creada el 2 de octubre. No hay otra ficha, ni N° ABNet, ni servicio anterior. El DNI no está en el maestro.",
  },
  {
    customerNumber: "CLI-005804",
    name: "Dovic Federico",
    otCode: "TSK-OT-1199",
    identity: null,
    decision: "INCLUIR",
    evidence: "Instalación nueva wireless finalizada el 6 de octubre. No hay otra ficha, ni N° ABNet, ni servicio anterior. El DNI no está en el maestro.",
  },
]

export function summarizeExceptionDecisions(decisions = EXCEPTION_DECISIONS) {
  if (decisions.length !== 12) throw new Error("Deben ser 12 decisiones.")
  const counts = { INCLUIR: 0, EXCLUIR: 0, REVIEW: 0 }
  for (const row of decisions) {
    if (!counts.hasOwnProperty(row.decision)) throw new Error("Decisión no permitida.")
    counts[row.decision] += 1
  }
  const base = 4748
  const adicionales = 0
  return {
    counts,
    adicionales,
    universoFinal: base - counts.EXCLUIR - counts.REVIEW + adicionales,
  }
}

export const EXCEPTION_CASES = [
  { customerNumber: "CLI-005783", masterHint: "2205", otCode: "TSK-OT-1129" },
  { customerNumber: "CLI-005742", masterHint: "5994", otCode: "TSK-OT-1030" },
  { customerNumber: "CLI-005728", masterHint: "4430", otCode: "TSK-OT-1011" },
  { customerNumber: "CLI-005759", masterHint: "6785", otCode: "TSK-OT-1063" },
  { customerNumber: "CLI-005567", masterHint: "6688", otCode: "TSK-OT-1125" },
  { customerNumber: "CLI-005765", masterHint: "6791", otCode: "TSK-OT-1071" },
  { customerNumber: "CLI-005421", masterHint: "6639", otCode: "TSK-OT-1180" },
  { customerNumber: "CLI-005248", masterHint: "3329", otCode: "TSK-OT-1218" },
  { customerNumber: "CLI-005812", masterHint: null, otCode: "TSK-OT-1211" },
  { customerNumber: "CLI-005793", masterHint: null, otCode: "TSK-OT-1165" },
  { customerNumber: "CLI-005801", masterHint: null, otCode: "TSK-OT-1187" },
  { customerNumber: "CLI-005804", masterHint: null, otCode: "TSK-OT-1199" },
]

function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function phoneKey(value) {
  let digits = String(value ?? "").replace(/\D/g, "")
  if (digits.startsWith("54")) digits = digits.slice(2)
  if (digits.length >= 11 && digits.startsWith("9")) digits = digits.slice(1)
  return digits.replace(/^0+/, "")
}

function tokens(value) {
  return fold(value).split(" ").filter((token) => token.length > 1)
}

export function nameRelation(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (a.length === 0 || b.length === 0) return "sin_nombre"
  if (a.join(" ") === b.join(" ")) return "igual"
  const shared = a.filter((token) => b.includes(token))
  if (shared.length === 0) return "distinto"
  if (shared.length === a.length && shared.length === b.length) return "mismo_conjunto"
  return "parcial"
}

function text(value) {
  if (value == null) return null
  const current = String(value).trim()
  return current.length > 0 ? current : null
}

function readBillingDetail(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  return matrix.slice(1).flatMap((row) => {
    const number = abnetNumberFromCell(row[0])
    if (!number) return []
    return [{
      number,
      name: text(row[1]),
      tipo: text(row[2]),
      nodo: text(row[3]),
      ip: text(row[4]),
      plan: text(row[5]),
      estado: text(row[6]),
    }]
  })
}

function customerView(row) {
  if (!row) return null
  return {
    id: row.id,
    customerNumber: row.customer_number,
    name: row.name,
    dni: row.dni,
    phone: row.phone,
    email: row.email,
    address: row.address,
    locality: row.locality,
    externalCustomerCode: row.external_customer_code,
    abnetNumber: abnetNumberFromExternalCode(row.external_customer_code),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

function taskView(row) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description,
    serviceAddress: row.service_address,
    locality: row.locality,
    startDate: row.start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    closedAt: row.closed_at,
    cancellationReason: row.cancellation_reason,
    cancellationObservation: row.cancellation_observation,
    customerName: row.customer_name,
    customerDni: row.customer_dni,
    customerPhone: row.customer_phone,
    deletedAt: row.deleted_at,
  }
}

function comparePeople(left, right) {
  if (!left || !right) return null
  const leftPhone = phoneKey(left.phone)
  const rightPhone = phoneKey(right.phone)
  return {
    name: nameRelation(left.name, right.name),
    dni: documentDigits(left.dni || left.document) === documentDigits(right.dni || right.document) && documentDigits(left.dni || left.document).length > 0,
    phone: leftPhone.length >= 6 && leftPhone === rightPhone ? "igual" : leftPhone && rightPhone ? "distinto" : "faltante",
    email: fold(left.email) && fold(left.email) === fold(right.email) ? "igual" : fold(left.email) && fold(right.email) ? "distinto" : "faltante",
    address: fold(left.address) && fold(right.address) && (fold(left.address) === fold(right.address) || fold(left.address).includes(fold(right.address)) || fold(right.address).includes(fold(left.address))) ? "parecido" : fold(left.address) && fold(right.address) ? "distinto" : "faltante",
  }
}

function guardedFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(String(prop) + " está bloqueado.")
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

async function main() {
  if (EXCEPTION_CASES.length !== 12) throw new Error("La revisión es de 12 casos.")
  const masterRows = readAbnetMasterRows(MASTER_PATH)
  const masterByNumber = new Map()
  for (const row of masterRows) {
    const number = abnetNumberFromExternalCode(row.customerNumber)
    if (!number) continue
    const current = masterByNumber.get(number) ?? []
    current.push(row)
    masterByNumber.set(number, current)
  }
  const billingByNumber = new Map()
  for (const row of readBillingDetail(DEFAULT_BILLING)) {
    const current = billingByNumber.get(row.number) ?? []
    current.push(row)
    billingByNumber.set(row.number, current)
  }
  const internetByNumber = new Map()
  for (const row of readInternetRows(DEFAULT_CONEX)) {
    const current = internetByNumber.get(row.number) ?? []
    current.push(row)
    internetByNumber.set(row.number, current)
  }

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: guardedFrom(client) }
  const before = {
    customers: (await fetchAll(db, "customers", "id")).length,
    services: (await fetchAll(db, "isp_services", "id")).length,
    connections: (await fetchAll(db, "isp_connections", "id")).length,
    tasks: (await fetchAll(db, "tasks", "id")).length,
  }
  const customers = await fetchAll(
    db,
    "customers",
    "id, customer_number, name, dni, email, phone, address, locality, external_customer_code, created_at, updated_at, deleted_at"
  )
  const tasks = await fetchAll(
    db,
    "tasks",
    "id, customer_id, code, type, status, title, description, service_address, locality, start_date, created_at, updated_at, completed_at, closed_at, cancellation_reason, cancellation_observation, customer_name, customer_dni, customer_phone, deleted_at"
  )
  const services = await fetchAll(db, "isp_services", "id, customer_id, catalog_code, commercial_status, deleted_at")
  const connections = await fetchAll(db, "isp_connections", "id, service_id, connection_type, technical_status, ip_address, deleted_at")
  const live = customers.filter((row) => !row.deleted_at)
  const byNumber = new Map(live.map((row) => [row.customer_number, row]))
  const tasksByCustomer = new Map()
  for (const task of tasks) {
    if (!task.customer_id) continue
    const current = tasksByCustomer.get(task.customer_id) ?? []
    current.push(task)
    tasksByCustomer.set(task.customer_id, current)
  }
  const servicesByCustomer = new Map()
  for (const service of services) {
    if (service.deleted_at) continue
    const current = servicesByCustomer.get(service.customer_id) ?? []
    current.push(service)
    servicesByCustomer.set(service.customer_id, current)
  }
  const serviceOwner = new Map(services.filter((row) => !row.deleted_at).map((row) => [row.id, row.customer_id]))
  const connectionsByCustomer = new Map()
  for (const connection of connections) {
    if (connection.deleted_at) continue
    const owner = serviceOwner.get(connection.service_id)
    if (!owner) continue
    const current = connectionsByCustomer.get(owner) ?? []
    current.push(connection)
    connectionsByCustomer.set(owner, current)
  }

  const cases = EXCEPTION_CASES.map((item) => {
    const customer = byNumber.get(item.customerNumber) ?? null
    const dni = customer && isReliableIdentityDocument(customer.dni) ? documentDigits(customer.dni) : null
    const siblings = live.filter((row) => {
      if (!customer || row.id === customer.id) return false
      const sameDocument = dni && isReliableIdentityDocument(row.dni) && documentDigits(row.dni) === dni
      const sameNumber = item.masterHint && abnetNumberFromExternalCode(row.external_customer_code) === item.masterHint
      return sameDocument || sameNumber
    })
    const master = item.masterHint ? (masterByNumber.get(item.masterHint) ?? []) : []
    const customerTasks = customer ? (tasksByCustomer.get(customer.id) ?? []) : []
    return {
      customerNumber: item.customerNumber,
      masterHint: item.masterHint,
      customer: customerView(customer),
      tasks: customerTasks.map(taskView),
      services: customer ? (servicesByCustomer.get(customer.id) ?? []).map((row) => ({ code: row.catalog_code, status: row.commercial_status })) : [],
      connections: customer ? (connectionsByCustomer.get(customer.id) ?? []).map((row) => ({ type: row.connection_type, status: row.technical_status, ip: row.ip_address })) : [],
      master,
      billing: item.masterHint ? (billingByNumber.get(item.masterHint) ?? []) : [],
      internet: item.masterHint ? (internetByNumber.get(item.masterHint) ?? []) : [],
      siblings: siblings.map((row) => ({
        customer: customerView(row),
        comparedWithCase: comparePeople(customer, row),
        comparedWithMaster: master[0] ? comparePeople(row, { ...master[0], dni: master[0].document, locality: master[0].city }) : null,
        tasks: (tasksByCustomer.get(row.id) ?? []).map(taskView),
        services: (servicesByCustomer.get(row.id) ?? []).map((service) => ({ code: service.catalog_code, status: service.commercial_status })),
        connections: (connectionsByCustomer.get(row.id) ?? []).length,
      })),
      comparedWithMaster: master[0] ? comparePeople(customer, { ...master[0], dni: master[0].document, locality: master[0].city, address: master[0].address }) : null,
    }
  })

  const after = {
    customers: (await fetchAll(db, "customers", "id")).length,
    services: (await fetchAll(db, "isp_services", "id")).length,
    connections: (await fetchAll(db, "isp_connections", "id")).length,
    tasks: (await fetchAll(db, "tasks", "id")).length,
  }
  const unchanged = {
    customers: before.customers === after.customers && after.customers === 5835,
    services: before.services === after.services && after.services === 3998,
    connections: before.connections === after.connections && after.connections === 3998,
    tasks: before.tasks === after.tasks && after.tasks === 1427,
  }
  const decisions = summarizeExceptionDecisions()
  console.log(JSON.stringify({
    readOnly: true,
    operations: ["select"],
    companyId: ABNET_COMPANY_ID,
    decisions,
    decisionRows: EXCEPTION_DECISIONS,
    cases,
    unchanged,
    counts: { before, after },
  }, null, 2))
  if (!Object.values(unchanged).every(Boolean) || cases.some((row) => !row.customer)) process.exit(1)
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
