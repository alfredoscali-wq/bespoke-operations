/**
 * Carga idempotente de la representación comercial de TV en Clientes 360.
 *
 * La clasificación sale de scripts/abnet-tv-clients-360-audit.mjs.
 * Crea el abono del catálogo existente cuando falta TV Básica.
 * Agrega TV-FULL-UPGRADE y la condición JUBILADO con los repositorios comerciales.
 * No crea conexiones, no asigna Pack Fútbol y no toca REVIEW ni el N° 5032.
 *
 * Uso:
 *   npx tsx scripts/import-abnet-tv-clients-360.mjs
 *   npx tsx scripts/import-abnet-tv-clients-360.mjs --apply
 */
import { spawnSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createIspCommercialAssignmentQueries } from "../lib/isp/commercial-assignment-queries.ts"
import {
  ABNET_RESIDENTIAL_CATALOG,
  resolveAbnetTvCommercialPlan,
  sourceStatusNote,
} from "../lib/isp/abnet-residential-load.ts"
import { ABNET_COMPANY_ID, fetchAll, loadEnv } from "./abnet-residential-sources.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DUPLICATE_CUSTOMERS = new Set(["CLI-003740", "CLI-005235"])
const DUPLICATE_NUMBER = "5032"
const TV_UPGRADE_CODE = "TV-FULL-UPGRADE"
const JUBILADO_CODE = "JUBILADO"
const PACK_FUTBOL_CODE = "PACK-FUTBOL"
const INSERT_CHUNK = 100

function fail(message) {
  throw new Error(message)
}

function proposedAction(row) {
  if (
    DUPLICATE_CUSTOMERS.has(row.customerNumber) ||
    row.abnetNumber === DUPLICATE_NUMBER
  ) {
    return "REVIEW_DUPLICATE_ABNET"
  }
  if (row.tv === "TV_BASICA" && row.bespoke === "FALTA_BASICA") return "ADD_TV_BASICA"
  if (row.tv === "TV_FULL" && row.bespoke === "FALTA_FULL" && row.incluidaBasica) {
    return "ADD_TV_FULL_UPGRADE"
  }
  if (row.tv === "TV_FULL" && row.bespoke === "FALTA_FULL") {
    return "ADD_TV_BASICA_AND_TV_FULL_UPGRADE"
  }
  return null
}

function loadAudit() {
  const result = spawnSync("npx tsx scripts/abnet-tv-clients-360-audit.mjs", {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    fail(result.stderr?.trim() || result.error?.message || "La auditoría de TV no terminó.")
  }
  const line = result.stdout
    .trim()
    .split(/\r?\n/)
    .filter((row) => row.startsWith("{"))
    .at(-1)
  if (!line) fail("La auditoría no devolvió JSON.")
  return JSON.parse(line)
}

function contractedSpeed(download, upload, unit) {
  const label = String(unit ?? "mbps").toLowerCase() === "mbps" ? "Mbps" : unit
  if (download != null && upload != null) return `${download}/${upload} ${label}`
  if (download != null) return `${download}/— ${label}`
  return null
}

function externalCode(customerId) {
  return `abnet-tv:${customerId}`
}

function fingerprint(row) {
  return [
    row.id,
    row.customer_number ?? "",
    row.external_customer_code ?? "",
    row.status ?? "",
    row.name ?? "",
    row.updated_at ?? "",
    row.deleted_at ?? "",
  ].join("\u001f")
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", ABNET_COMPANY_ID)
  if (error) fail(`${table}: ${error.message}`)
  return count ?? 0
}

async function latestTimestamp(client, table) {
  const { data, error } = await client
    .from(table)
    .select("updated_at")
    .eq("company_id", ABNET_COMPANY_ID)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (error) fail(`${table}: ${error.message}`)
  return data?.[0]?.updated_at ?? null
}

function assertAudit(audit) {
  const resumen = audit.resumen
  if (resumen.universo !== 4737) fail(`Universo ${resumen.universo}, se esperaba 4737.`)
  if (resumen.tv.review !== 497) fail(`REVIEW ${resumen.tv.review}, se esperaba 497.`)
  const actions = {
    ADD_TV_BASICA: 0,
    ADD_TV_FULL_UPGRADE: 0,
    ADD_TV_BASICA_AND_TV_FULL_UPGRADE: 0,
    REVIEW_DUPLICATE_ABNET: 0,
  }
  for (const row of [...audit.faltaBasica, ...audit.faltaFull]) {
    const action = proposedAction(row)
    if (!action || actions[action] == null) fail(`Sin acción de carga para ${row.customerNumber}.`)
    if (row.tv === "REVIEW" || row.bespoke === "NO_EVALUADO") fail(`${row.customerNumber} está en REVIEW.`)
    if (row.reason?.includes("gratis") || row.conflicts?.some((conflict) => String(conflict).includes("gratis"))) {
      fail(`${row.customerNumber} es un caso gratis y no entra en la carga.`)
    }
    actions[action] += 1
  }
  const duplicate = [...audit.faltaBasica, ...audit.faltaFull].filter(
    (row) => row.abnetNumber === DUPLICATE_NUMBER || DUPLICATE_CUSTOMERS.has(row.customerNumber)
  )
  if (duplicate.some((row) => proposedAction(row) !== "REVIEW_DUPLICATE_ABNET")) {
    fail("El N° 5032 no quedó excluido.")
  }
  return actions
}

async function main() {
  const apply = process.argv.includes("--apply")
  if (process.argv.some((arg) => ["--connections", "--pack-futbol"].includes(arg))) {
    fail("Esta carga no acepta conexiones ni Pack Fútbol.")
  }

  const audit = loadAudit()
  const actions = assertAudit(audit)
  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const commercial = createIspCommercialAssignmentQueries(client)

  const customers = await fetchAll(
    client,
    "customers",
    "id, customer_number, name, external_customer_code, status, updated_at, deleted_at"
  )
  const customerByNumber = new Map(
    customers.filter((row) => !row.deleted_at && row.customer_number).map((row) => [row.customer_number, row])
  )
  const catalog = await fetchAll(
    client,
    "isp_service_catalog",
    "id, code, name, technology, monthly_price, download_speed_mbps, upload_speed_mbps, speed_unit, billing_method, tv_plan_catalog_id, deleted_at"
  )
  const liveCatalog = catalog.filter((row) => !row.deleted_at)
  const catalogById = new Map(liveCatalog.map((row) => [row.id, row]))
  const catalogByCode = new Map(liveCatalog.map((row) => [row.code, row]))
  const basicaCatalog = liveCatalog.find((row) => row.code?.toLowerCase() === "tv-basico")
  if (!basicaCatalog) fail("No está el plan TV-BASICO.")
  for (const code of Object.keys(ABNET_RESIDENTIAL_CATALOG)) {
    const row = catalogByCode.get(code)
    if (!row || row.monthly_price == null || row.tv_plan_catalog_id !== basicaCatalog.id) {
      fail(`El catálogo ${code} no incluye TV-BASICO con precio.`)
    }
  }

  const components = await fetchAll(
    client,
    "isp_commercial_components",
    "id, code, monthly_price, deleted_at"
  )
  const upgrade = components.find((row) => !row.deleted_at && row.code === TV_UPGRADE_CODE)
  const packFutbol = components.find((row) => !row.deleted_at && row.code === PACK_FUTBOL_CODE)
  if (!upgrade || upgrade.monthly_price == null) fail("TV-FULL-UPGRADE no tiene precio de catálogo.")
  const conditions = await fetchAll(
    client,
    "isp_commercial_conditions",
    "id, code, discount_percent, is_active, deleted_at"
  )
  const jubilado = conditions.find((row) => !row.deleted_at && row.code === JUBILADO_CODE)
  if (!jubilado?.is_active || Number(jubilado.discount_percent) !== 50) {
    fail("La condición JUBILADO no está activa al 50%.")
  }

  const services = await fetchAll(
    client,
    "isp_services",
    "id, customer_id, catalog_id, external_code, created_at, deleted_at"
  )
  const assignments = await fetchAll(
    client,
    "isp_service_components",
    "id, service_id, component_id, status, deleted_at"
  )
  const serviceConditions = await fetchAll(
    client,
    "isp_service_conditions",
    "id, service_id, condition_id, discount_percent, status, deleted_at"
  )
  const subscribers = await fetchAll(client, "isp_subscribers", "id, customer_id, deleted_at")

  const servicesByCustomer = new Map()
  for (const service of services) {
    if (service.deleted_at) continue
    const current = servicesByCustomer.get(service.customer_id) ?? []
    current.push(service)
    servicesByCustomer.set(service.customer_id, current)
  }
  const upgradeServices = new Set(
    assignments
      .filter((row) => !row.deleted_at && row.status === "active" && row.component_id === upgrade.id)
      .map((row) => row.service_id)
  )
  const conditionByService = new Map()
  for (const row of serviceConditions) {
    if (row.deleted_at || row.status !== "active") continue
    conditionByService.set(row.service_id, row)
  }
  const subscriberState = new Map()
  for (const row of subscribers) {
    const current = subscriberState.get(row.customer_id) ?? { live: false, deleted: false }
    if (row.deleted_at) current.deleted = true
    else current.live = true
    subscriberState.set(row.customer_id, current)
  }

  function basicaServices(customerId) {
    return (servicesByCustomer.get(customerId) ?? []).filter((service) => {
      const plan = catalogById.get(service.catalog_id)
      return plan?.tv_plan_catalog_id === basicaCatalog.id
    })
  }

  const blocked = []
  const toCreate = []
  const ready = []
  const abonoElegidoEntreVarios = []
  for (const row of [...audit.faltaBasica, ...audit.faltaFull]) {
    const action = proposedAction(row)
    if (action === "REVIEW_DUPLICATE_ABNET") continue
    const customer = customerByNumber.get(row.customerNumber)
    if (!customer) fail(`No está el customer ${row.customerNumber}.`)
    const needsUpgrade = action !== "ADD_TV_BASICA"
    const needsJubilado = row.condition?.code === JUBILADO_CODE
    const current = basicaServices(customer.id)
    if (current.length > 1) {
      const withUpgrade = current.filter((service) => upgradeServices.has(service.id))
      const chosen = withUpgrade[0] ?? [...current].sort((left, right) =>
        String(left.created_at).localeCompare(String(right.created_at))
      )[0]
      abonoElegidoEntreVarios.push({
        customerNumber: row.customerNumber,
        name: row.name,
        abonos: current.length,
        serviceId: chosen.id,
      })
      ready.push({
        customerId: customer.id,
        customerNumber: row.customerNumber,
        name: row.name,
        serviceId: chosen.id,
        created: false,
        needsUpgrade,
        needsJubilado,
      })
      continue
    }
    if (current.length === 1) {
      ready.push({
        customerId: customer.id,
        customerNumber: row.customerNumber,
        name: row.name,
        serviceId: current[0].id,
        created: false,
        needsUpgrade,
        needsJubilado,
      })
      continue
    }
    const membership = subscriberState.get(customer.id)
    if (membership?.deleted && !membership.live) {
      blocked.push({ customerNumber: row.customerNumber, name: row.name, reason: "reactivaria_abonado" })
      continue
    }
    const plan = resolveAbnetTvCommercialPlan(row.filas ?? [])
    if (!plan.ok) {
      blocked.push({
        customerNumber: row.customerNumber,
        name: row.name,
        abnetNumber: row.abnetNumber,
        reason: plan.reason,
        planes: [...new Set((row.filas ?? []).map((item) => item.plan))],
      })
      continue
    }
    toCreate.push({
      customerId: customer.id,
      customerNumber: row.customerNumber,
      name: row.name,
      needsUpgrade,
      needsJubilado,
      plan,
      catalog: catalogByCode.get(plan.catalogCode),
    })
  }

  const packBefore = assignments.filter(
    (row) => !row.deleted_at && row.status === "active" && packFutbol && row.component_id === packFutbol.id
  ).length
  const summary = {
    mode: apply ? "apply" : "dry-run",
    universo: 4737,
    reviewExcluida: 497,
    duplicado5032Excluido: actions.REVIEW_DUPLICATE_ABNET,
    candidatos: actions.ADD_TV_BASICA + actions.ADD_TV_FULL_UPGRADE + actions.ADD_TV_BASICA_AND_TV_FULL_UPGRADE,
    abonosACrear: toCreate.length,
    upgradesSobreAbonoExistente: ready.filter((row) => row.needsUpgrade).length,
    jubilados: [...toCreate, ...ready].filter((row) => row.needsJubilado).length,
    bloqueados: blocked.length,
    bloqueadosDetalle: blocked,
    abonoElegidoEntreVarios,
    conexionesACrear: 0,
    packFutbolAAgregar: 0,
  }
  if (!apply) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const before = {
    customers: new Map(customers.map((row) => [row.id, fingerprint(row)])),
    services: await countRows(client, "isp_services"),
    connections: await countRows(client, "isp_connections"),
    tasks: await countRows(client, "tasks"),
    subscribers: await countRows(client, "isp_subscribers"),
    taskUpdatedAt: await latestTimestamp(client, "tasks"),
    packFutbol: packBefore,
  }

  let servicesCreated = 0
  for (let index = 0; index < toCreate.length; index += INSERT_CHUNK) {
    const chunk = toCreate.slice(index, index + INSERT_CHUNK).map((row) => ({
      company_id: ABNET_COMPANY_ID,
      customer_id: row.customerId,
      catalog_id: row.catalog.id,
      catalog_code: row.catalog.code,
      technology: row.catalog.technology,
      plan_name: row.catalog.name,
      contracted_speed: contractedSpeed(
        row.catalog.download_speed_mbps,
        row.catalog.upload_speed_mbps,
        row.catalog.speed_unit
      ),
      download_speed: row.catalog.download_speed_mbps,
      upload_speed: row.catalog.upload_speed_mbps,
      speed_unit: row.catalog.speed_unit || "mbps",
      list_price: row.catalog.monthly_price,
      monthly_fee: row.catalog.monthly_price,
      activation_date: row.plan.activationDate,
      commercial_status: row.plan.commercialStatus,
      monthly_collection_method: row.catalog.billing_method === "siro" ? "siro" : "pending",
      notes: `${sourceStatusNote(row.plan.sourceStatuses.join(", "))}. Representación comercial de TV. Sin conexión.`,
      external_code: externalCode(row.customerId),
    }))
    const { data, error } = await client.from("isp_services").insert(chunk).select("id, customer_id")
    if (error) fail(error.message)
    const createdByCustomer = new Map((data ?? []).map((item) => [item.customer_id, item.id]))
    for (const row of toCreate.slice(index, index + INSERT_CHUNK)) {
      const serviceId = createdByCustomer.get(row.customerId)
      if (!serviceId) fail(`No se creó el abono de ${row.customerNumber}.`)
      ready.push({ ...row, serviceId, created: true })
    }
    servicesCreated += data?.length ?? 0
  }

  let upgradesAssigned = 0
  let conditionsAssigned = 0
  let skipped = 0
  let servicesModified = 0
  const errors = []
  for (const row of ready) {
    let changed = false
    const alreadyUpgrade = upgradeServices.has(row.serviceId)
    const activeCondition = conditionByService.get(row.serviceId) ?? null
    if (row.needsUpgrade && !alreadyUpgrade) {
      await commercial.assignComponent(ABNET_COMPANY_ID, {
        serviceId: row.serviceId,
        componentId: upgrade.id,
      })
      upgradesAssigned += 1
      changed = true
    }
    if (row.needsJubilado) {
      const sameJubilado =
        activeCondition?.condition_id === jubilado.id && Number(activeCondition.discount_percent) === 50
      if (!sameJubilado && activeCondition) {
        errors.push({ customerNumber: row.customerNumber, reason: "condicion_distinta_activa" })
      } else if (!sameJubilado) {
        await commercial.assignCondition(ABNET_COMPANY_ID, {
          serviceId: row.serviceId,
          conditionId: jubilado.id,
        })
        conditionsAssigned += 1
        changed = true
      }
    }
    if (row.created) continue
    if (changed) servicesModified += 1
    else skipped += 1
  }
  if (errors.length > 0) {
    fail(`Hay condiciones comerciales distintas y no se reemplazaron: ${JSON.stringify(errors)}.`)
  }

  const afterCustomers = await fetchAll(
    client,
    "customers",
    "id, customer_number, name, external_customer_code, status, updated_at, deleted_at"
  )
  const changedCustomers = []
  const afterById = new Map(afterCustomers.map((row) => [row.id, row]))
  for (const [id, previous] of before.customers) {
    const current = afterById.get(id)
    if (!current || fingerprint(current) !== previous) changedCustomers.push(id)
  }
  const afterAssignments = await fetchAll(
    client,
    "isp_service_components",
    "id, component_id, status, deleted_at"
  )
  const packAfter = afterAssignments.filter(
    (row) => !row.deleted_at && row.status === "active" && packFutbol && row.component_id === packFutbol.id
  ).length
  const after = {
    services: await countRows(client, "isp_services"),
    connections: await countRows(client, "isp_connections"),
    tasks: await countRows(client, "tasks"),
    subscribers: await countRows(client, "isp_subscribers"),
    taskUpdatedAt: await latestTimestamp(client, "tasks"),
  }
  if (changedCustomers.length > 0) fail("Se modificó un customer. La carga no debía tocarlo.")
  if (after.connections !== before.connections) fail("Se crearon o borraron conexiones.")
  if (after.tasks !== before.tasks || after.taskUpdatedAt !== before.taskUpdatedAt) {
    fail("Se modificaron OTs.")
  }
  if (packAfter !== before.packFutbol) fail("Se agregó Pack Fútbol.")
  if (after.services !== before.services + servicesCreated) fail("El conteo de servicios no cierra.")

  console.log(JSON.stringify({
    ...summary,
    procesados: toCreate.length + ready.filter((row) => !row.created).length,
    tvBasicaCargada: servicesCreated,
    tvFullCargada: upgradesAssigned,
    jubiladosActualizados: conditionsAssigned,
    skipped,
    review: 497,
    errores: blocked.length,
    serviciosCreados: servicesCreated,
    serviciosModificados: servicesModified,
    componentesAsignados: upgradesAssigned,
    condicionesAsignadas: conditionsAssigned,
    conexionesCreadas: after.connections - before.connections,
    packFutbolAgregado: packAfter - before.packFutbol,
    abonadosIspCreadosPorTrigger: after.subscribers - before.subscribers,
    counts: { before: { ...before, customers: before.customers.size }, after },
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
