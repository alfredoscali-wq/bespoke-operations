/**
 * Preview de solo lectura para eliminar cuatro fichas de Clientes 360.
 * No borra nada.
 *
 * Uso: npx tsx scripts/abnet-tv-ficha-delete-preview.mjs
 */
import { createClient } from "@supabase/supabase-js"

import { getClients360CommercialUniverse } from "../lib/isp/clients-360-universe.ts"
import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  ABNET_COMPANY_ID,
  DEFAULT_CONEX,
  fetchAll,
  loadEnv,
  readInternetRows,
} from "./abnet-residential-sources.mjs"

const TARGETS = ["CLI-003016", "CLI-003059", "CLI-002444", "CLI-003740", "CLI-005235"]

function fail(message) {
  throw new Error(message)
}

async function rowsFor(client, table, column, ids) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .in(column, ids)
  if (error) return { error: error.message, rows: [] }
  return { error: null, rows: data ?? [] }
}

async function main() {
  if (process.argv.includes("--apply")) fail("Este script es solo el preview. No elimina fichas.")
  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const universe = new Set(getClients360CommercialUniverse())
  const customers = await fetchAll(
    client,
    "customers",
    "id, customer_number, name, external_customer_code, status, deleted_at, company_id"
  )
  const wanted = customers.filter((row) => TARGETS.includes(row.customer_number))
  const ids = wanted.map((row) => row.id)
  if (ids.length === 0) fail("No se encontraron las fichas.")

  const services = await rowsFor(client, "isp_services", "customer_id", ids)
  const subscribers = await rowsFor(client, "isp_subscribers", "customer_id", ids)
  const tasks = await rowsFor(client, "tasks", "customer_id", ids)
  const atenciones = await rowsFor(client, "customer_atenciones", "customer_id", ids)
  const seguimientos = await rowsFor(client, "customer_seguimientos", "customer_id", ids)
  const retenciones = await rowsFor(client, "customer_retenciones", "customer_id", ids)
  const recuperaciones = await rowsFor(client, "customer_recuperaciones", "customer_id", ids)
  const documents = await rowsFor(client, "isp_billing_documents", "customer_id", ids)
  const billingItems = await rowsFor(client, "isp_billing_run_items", "customer_id", ids)
  const renditions = await rowsFor(client, "treasury_ot_renditions", "customer_id", ids)
  const opportunities = await rowsFor(client, "commercial_opportunities", "source_customer_id", ids)

  const serviceIds = (services.rows ?? []).map((row) => row.id)
  const taskIds = (tasks.rows ?? []).map((row) => row.id)
  const atencionIds = (atenciones.rows ?? []).map((row) => row.id)
  const connections = serviceIds.length
    ? await rowsFor(client, "isp_connections", "service_id", serviceIds)
    : { error: null, rows: [] }
  const connectionIds = (connections.rows ?? []).map((row) => row.id)
  const equipment = connectionIds.length
    ? await rowsFor(client, "isp_connection_equipment", "connection_id", connectionIds)
    : { error: null, rows: [] }
  const components = serviceIds.length
    ? await rowsFor(client, "isp_service_components", "service_id", serviceIds)
    : { error: null, rows: [] }
  const conditions = serviceIds.length
    ? await rowsFor(client, "isp_service_conditions", "service_id", serviceIds)
    : { error: null, rows: [] }
  const evidences = taskIds.length
    ? await rowsFor(client, "evidences", "task_id", taskIds)
    : { error: null, rows: [] }
  const atencionEvents = atencionIds.length
    ? await rowsFor(client, "customer_atencion_events", "atencion_id", atencionIds)
    : { error: null, rows: [] }

  const internet = readInternetRows(DEFAULT_CONEX)
  const byNumber = new Map()
  for (const row of internet) {
    const current = byNumber.get(row.number) ?? []
    current.push(row)
    byNumber.set(row.number, current)
  }

  function count(list, customerId, column = "customer_id") {
    return (list.rows ?? []).filter((row) => row[column] === customerId).length
  }

  const report = wanted.map((customer) => {
    const abnetNumber = abnetNumberFromExternalCode(customer.external_customer_code)
    const ownServices = (services.rows ?? []).filter((row) => row.customer_id === customer.id)
    const ownServiceIds = new Set(ownServices.map((row) => row.id))
    const ownTasks = (tasks.rows ?? []).filter((row) => row.customer_id === customer.id)
    const ownTaskIds = new Set(ownTasks.map((row) => row.id))
    const ownConnections = (connections.rows ?? []).filter((row) => ownServiceIds.has(row.service_id))
    return {
      customerId: customer.id,
      customerNumber: customer.customer_number,
      name: customer.name,
      abnetNumber,
      status: customer.status,
      deletedAt: customer.deleted_at,
      enUniverso4740: universe.has(customer.id),
      servicios: ownServices.length,
      conexiones: ownConnections.length,
      ots: ownTasks.length,
      tareas: ownTasks.length,
      evidencias: (evidences.rows ?? []).filter((row) => ownTaskIds.has(row.task_id)).length,
      atenciones: count(atenciones, customer.id),
      subscribers: count(subscribers, customer.id),
      seguimientos: count(seguimientos, customer.id),
      retenciones: count(retenciones, customer.id),
      recuperaciones: count(recuperaciones, customer.id),
      comprobantes: count(documents, customer.id),
      itemsFacturacion: count(billingItems, customer.id),
      rendiciones: count(renditions, customer.id),
      oportunidades: count(opportunities, customer.id, "source_customer_id"),
      eventosAtencion: (atencionEvents.rows ?? []).filter((row) =>
        (atenciones.rows ?? []).some((item) => item.id === row.atencion_id && item.customer_id === customer.id)
      ).length,
      componentes: (components.rows ?? []).filter((row) => ownServiceIds.has(row.service_id)).length,
      condiciones: (conditions.rows ?? []).filter((row) => ownServiceIds.has(row.service_id)).length,
      equipos: (equipment.rows ?? []).filter((row) => ownConnections.some((item) => item.id === row.connection_id)).length,
      filasExcel: (byNumber.get(abnetNumber) ?? []).map((row) => ({
        tipo: row.tipo,
        plan: row.plan,
        estado: row.estado,
      })),
      serviciosDetalle: ownServices.map((row) => ({
        id: row.id,
        catalogCode: row.catalog_code,
        planName: row.plan_name,
        status: row.commercial_status,
        deletedAt: row.deleted_at,
        externalCode: row.external_code,
      })),
      subscribersDetalle: (subscribers.rows ?? [])
        .filter((row) => row.customer_id === customer.id)
        .map((row) => ({ id: row.id, source: row.source, deletedAt: row.deleted_at })),
      tareasDetalle: ownTasks.map((row) => ({
        id: row.id,
        number: row.task_number ?? row.code ?? null,
        status: row.status,
        deletedAt: row.deleted_at,
      })),
    }
  })

  const queryErrors = {
    services: services.error,
    subscribers: subscribers.error,
    tasks: tasks.error,
    atenciones: atenciones.error,
    seguimientos: seguimientos.error,
    retenciones: retenciones.error,
    recuperaciones: recuperaciones.error,
    documents: documents.error,
    billingItems: billingItems.error,
    renditions: renditions.error,
    opportunities: opportunities.error,
    connections: connections.error,
    equipment: equipment.error,
    components: components.error,
    conditions: conditions.error,
    evidences: evidences.error,
    atencionEvents: atencionEvents.error,
  }

  console.log(JSON.stringify({ readOnly: true, queryErrors, fichas: report }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
