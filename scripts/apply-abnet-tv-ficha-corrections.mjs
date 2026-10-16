/**
 * Correcciones finales de fichas TV.
 *
 * Conserva CLI-005235 con TV Full comercial y sin conexión.
 * Elimina CLI-003059, CLI-002444 y CLI-003740 solo si no tienen
 * servicios, conexiones, OTs, evidencias ni atenciones.
 * No toca CLI-003016: tiene una atención.
 * No toca los 17 planes sin catálogo.
 *
 * Uso: npx tsx scripts/apply-abnet-tv-ficha-corrections.mjs --apply
 */
import { createClient } from "@supabase/supabase-js"

import { createIspCommercialAssignmentQueries } from "../lib/isp/commercial-assignment-queries.ts"
import {
  ABNET_ACTIVA_OBSERVED_ON,
  sourceStatusNote,
} from "../lib/isp/abnet-residential-load.ts"
import { ABNET_COMPANY_ID, fetchAll, loadEnv } from "./abnet-residential-sources.mjs"

const DELETE_TARGETS = [
  { customerNumber: "CLI-003059", customerId: "416f60ba-b822-4c11-8dd9-dd92d00e932c" },
  { customerNumber: "CLI-002444", customerId: "def6c24c-ab56-4afa-a758-01c03fa715be" },
  { customerNumber: "CLI-003740", customerId: "9d00d2fe-6089-4803-b8cf-f40a797c9edf" },
]
const BLOCKED = { customerNumber: "CLI-003016", customerId: "1ceee487-8682-427f-b9b6-c5f8d6e878b3" }
const KEPT = { customerNumber: "CLI-005235", customerId: "e088c1ab-577b-495e-b019-8638d2caff4b" }
const UNCATALOGUED = [
  "CLI-001298", "CLI-001165", "CLI-002521", "CLI-001982", "CLI-001992", "CLI-001921",
  "CLI-001096", "CLI-000965", "CLI-002021", "CLI-003097", "CLI-001078", "CLI-001780",
  "CLI-005846", "CLI-005823", "CLI-003221", "CLI-004760", "CLI-003406",
]

function fail(message) {
  throw new Error(message)
}

async function countWhere(client, table, column, value) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value)
  if (error) fail(`${table}: ${error.message}`)
  return count ?? 0
}

async function companyCount(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", ABNET_COMPANY_ID)
  if (error) fail(`${table}: ${error.message}`)
  return count ?? 0
}

function contractedSpeed(download, upload, unit) {
  const label = String(unit ?? "mbps").toLowerCase() === "mbps" ? "Mbps" : unit
  if (download != null && upload != null) return `${download}/${upload} ${label}`
  if (download != null) return `${download}/— ${label}`
  return null
}

async function dependencyCounts(client, customerId) {
  const services = await countWhere(client, "isp_services", "customer_id", customerId)
  const tasks = await countWhere(client, "tasks", "customer_id", customerId)
  return {
    servicios: services,
    conexiones: services === 0 ? 0 : await countWhere(client, "isp_connections", "service_id", "none"),
    tareas: tasks,
    atenciones: await countWhere(client, "customer_atenciones", "customer_id", customerId),
    subscribers: await countWhere(client, "isp_subscribers", "customer_id", customerId),
    seguimientos: await countWhere(client, "customer_seguimientos", "customer_id", customerId),
    retenciones: await countWhere(client, "customer_retenciones", "customer_id", customerId),
    recuperaciones: await countWhere(client, "customer_recuperaciones", "customer_id", customerId),
    comprobantes: await countWhere(client, "isp_billing_documents", "customer_id", customerId),
    itemsFacturacion: await countWhere(client, "isp_billing_run_items", "customer_id", customerId),
    rendiciones: await countWhere(client, "treasury_ot_renditions", "customer_id", customerId),
    oportunidades: await countWhere(client, "commercial_opportunities", "source_customer_id", customerId),
  }
}

async function main() {
  if (!process.argv.includes("--apply")) {
    fail("Falta --apply. El preview está en scripts/abnet-tv-ficha-delete-preview.mjs.")
  }

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const commercial = createIspCommercialAssignmentQueries(client)

  const blockedAtencion = await client
    .from("customer_atenciones")
    .select("id, channel, motivo, resultado, created_at, deleted_at")
    .eq("customer_id", BLOCKED.customerId)
  if (blockedAtencion.error) fail(blockedAtencion.error.message)
  if ((blockedAtencion.data ?? []).length !== 1) {
    fail("CLI-003016 ya no tiene exactamente una atención. No se eliminó nada.")
  }

  for (const target of DELETE_TARGETS) {
    const counts = await dependencyCounts(client, target.customerId)
    const blocking = Object.entries(counts).filter(([key, value]) => key !== "subscribers" && value !== 0)
    if (blocking.length > 0 || counts.subscribers !== 1) {
      fail(`${target.customerNumber} tiene dependencias y no se elimina: ${JSON.stringify(counts)}`)
    }
    const { data: services, error } = await client
      .from("isp_services")
      .select("id")
      .eq("customer_id", target.customerId)
    if (error) fail(error.message)
    if ((services ?? []).length > 0) fail(`${target.customerNumber} tiene servicios.`)
  }
  const liveCustomers = await fetchAll(client, "customers", "id, customer_number, deleted_at")
  const uncataloguedIds = UNCATALOGUED.map((number) => {
    const row = liveCustomers.find((item) => !item.deleted_at && item.customer_number === number)
    if (!row) fail(`${number} no está entre los clientes. No se escribió nada.`)
    return row.id
  })
  const uncataloguedBefore = await client
    .from("isp_services")
    .select("id")
    .in("customer_id", uncataloguedIds)
    .is("deleted_at", null)
  if (uncataloguedBefore.error) fail(uncataloguedBefore.error.message)
  if ((uncataloguedBefore.data ?? []).length !== 0) {
    fail("Alguno de los 17 sin catálogo ya tiene un servicio. No se escribió nada.")
  }

  const before = {
    customers: await companyCount(client, "customers"),
    services: await companyCount(client, "isp_services"),
    connections: await companyCount(client, "isp_connections"),
    tasks: await companyCount(client, "tasks"),
    subscribers: await companyCount(client, "isp_subscribers"),
  }

  const catalog = await client
    .from("isp_service_catalog")
    .select("id, code, name, technology, monthly_price, download_speed_mbps, upload_speed_mbps, speed_unit, billing_method, tv_plan_catalog_id")
    .eq("company_id", ABNET_COMPANY_ID)
    .eq("code", "WIRELESS-20-TV-BASICO")
    .is("deleted_at", null)
    .single()
  if (catalog.error || catalog.data.monthly_price == null) fail("No está WIRELESS-20-TV-BASICO con precio.")
  const upgrade = await client
    .from("isp_commercial_components")
    .select("id, code, monthly_price")
    .eq("company_id", ABNET_COMPANY_ID)
    .eq("code", "TV-FULL-UPGRADE")
    .is("deleted_at", null)
    .single()
  if (upgrade.error || upgrade.data.monthly_price == null) fail("TV-FULL-UPGRADE no tiene precio.")
  const pack = await client
    .from("isp_commercial_components")
    .select("id")
    .eq("company_id", ABNET_COMPANY_ID)
    .eq("code", "PACK-FUTBOL")
    .is("deleted_at", null)
    .maybeSingle()
  if (pack.error) fail(pack.error.message)
  const packBefore = pack.data
    ? await countWhere(client, "isp_service_components", "component_id", pack.data.id)
    : 0

  const externalCode = `abnet-tv:${KEPT.customerId}`
  const existing = await client
    .from("isp_services")
    .select("id, external_code, deleted_at")
    .eq("customer_id", KEPT.customerId)
    .is("deleted_at", null)
  if (existing.error) fail(existing.error.message)
  let serviceId = (existing.data ?? []).find((row) => row.external_code === externalCode)?.id ?? null
  let serviceCreated = false
  if ((existing.data ?? []).length > 0 && !serviceId) {
    fail("CLI-005235 ya tiene otro abono. No se creó uno paralelo.")
  }
  if (!serviceId) {
    const { data, error } = await client
      .from("isp_services")
      .insert({
        company_id: ABNET_COMPANY_ID,
        customer_id: KEPT.customerId,
        catalog_id: catalog.data.id,
        catalog_code: catalog.data.code,
        technology: catalog.data.technology,
        plan_name: catalog.data.name,
        contracted_speed: contractedSpeed(
          catalog.data.download_speed_mbps,
          catalog.data.upload_speed_mbps,
          catalog.data.speed_unit
        ),
        download_speed: catalog.data.download_speed_mbps,
        upload_speed: catalog.data.upload_speed_mbps,
        speed_unit: catalog.data.speed_unit || "mbps",
        list_price: catalog.data.monthly_price,
        monthly_fee: catalog.data.monthly_price,
        activation_date: ABNET_ACTIVA_OBSERVED_ON,
        commercial_status: "active",
        monthly_collection_method: catalog.data.billing_method === "siro" ? "siro" : "pending",
        notes: `${sourceStatusNote("Activa")}. Representación comercial de TV Full. Sin conexión.`,
        external_code: externalCode,
      })
      .select("id")
      .single()
    if (error) fail(error.message)
    serviceId = data.id
    serviceCreated = true
  }
  const activeUpgrade = await client
    .from("isp_service_components")
    .select("id")
    .eq("service_id", serviceId)
    .eq("component_id", upgrade.data.id)
    .eq("status", "active")
    .is("deleted_at", null)
  if (activeUpgrade.error) fail(activeUpgrade.error.message)
  let upgradeAssigned = false
  if ((activeUpgrade.data ?? []).length === 0) {
    await commercial.assignComponent(ABNET_COMPANY_ID, {
      serviceId,
      componentId: upgrade.data.id,
    })
    upgradeAssigned = true
  }

  const deleted = []
  for (const target of DELETE_TARGETS) {
    const { data: subscriber, error: loadError } = await client
      .from("isp_subscribers")
      .select("*")
      .eq("customer_id", target.customerId)
      .maybeSingle()
    if (loadError || !subscriber) fail(`No se pudo leer el subscriber de ${target.customerNumber}.`)
    const { error: subscriberError } = await client.from("isp_subscribers").delete().eq("id", subscriber.id)
    if (subscriberError) fail(subscriberError.message)
    const { error: customerError } = await client.from("customers").delete().eq("id", target.customerId)
    if (customerError) {
      const { error: restoreError } = await client.from("isp_subscribers").insert(subscriber)
      fail(
        restoreError
          ? `${target.customerNumber} no se eliminó y el subscriber no pudo restaurarse: ${customerError.message}`
          : `${target.customerNumber} no se eliminó. Subscriber restaurado. ${customerError.message}`
      )
    }
    deleted.push(target.customerNumber)
  }

  const customers = await fetchAll(client, "customers", "id, customer_number, external_customer_code, deleted_at")
  const live = customers.filter((row) => !row.deleted_at)
  const kept = live.find((row) => row.customer_number === KEPT.customerNumber)
  const blocked = live.find((row) => row.customer_number === BLOCKED.customerNumber)
  const uncataloguedServices = await client
    .from("isp_services")
    .select("id, customer_id")
    .in(
      "customer_id",
      live.filter((row) => UNCATALOGUED.includes(row.customer_number)).map((row) => row.id)
    )
    .is("deleted_at", null)
  if (uncataloguedServices.error) fail(uncataloguedServices.error.message)
  const packAfter = pack.data
    ? await countWhere(client, "isp_service_components", "component_id", pack.data.id)
    : 0
  const after = {
    customers: await companyCount(client, "customers"),
    services: await companyCount(client, "isp_services"),
    connections: await companyCount(client, "isp_connections"),
    tasks: await companyCount(client, "tasks"),
    subscribers: await companyCount(client, "isp_subscribers"),
  }

  if (after.connections !== before.connections) fail("Cambiaron las conexiones.")
  if (after.tasks !== before.tasks) fail("Cambiaron las tareas.")
  if (packAfter !== packBefore) fail("Se agregó Pack Fútbol.")
  if (!kept || kept.external_customer_code?.replace(/^0+/, "") !== "5032" && kept.external_customer_code !== "00005032") {
    const number = kept?.external_customer_code ?? null
    if (!kept || !/^0*5032$/.test(number ?? "")) fail("CLI-005235 no conserva el N° 5032.")
  }
  if (!blocked) fail("CLI-003016 no debía eliminarse.")
  if (deleted.length !== 3) fail("No se eliminaron las tres fichas seguras.")
  if ((uncataloguedServices.data ?? []).length !== 0) fail("Los 17 sin catálogo recibieron un servicio.")

  console.log(JSON.stringify({
    eliminadas: deleted,
    noEliminada: {
      ...BLOCKED,
      motivo: "Tiene una atención al cliente. La FK no permite borrar la ficha sin perder esa atención.",
      atencion: blockedAtencion.data[0],
    },
    conservada: {
      ...KEPT,
      abnetNumber: kept.external_customer_code,
      servicioCreado: serviceCreated,
      upgradeAsignado: upgradeAssigned,
      catalogo: "WIRELESS-20-TV-BASICO",
      componente: "TV-FULL-UPGRADE",
    },
    serviciosCreados: serviceCreated ? 1 : 0,
    serviciosModificados: upgradeAssigned && !serviceCreated ? 1 : 0,
    componentesAsignados: upgradeAssigned ? 1 : 0,
    conexionesEliminadas: after.connections - before.connections,
    packFutbolAgregado: packAfter - packBefore,
    sinCatalogoSiguenSinPlan: UNCATALOGUED.length,
    counts: { before, after },
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
