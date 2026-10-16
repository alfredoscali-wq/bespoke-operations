/**
 * Preview de solo lectura de la carga comercial de TV para Clientes 360.
 *
 * Reutiliza la clasificación de scripts/abnet-tv-clients-360-audit.mjs.
 * No crea servicios, conexiones, upgrades ni condiciones.
 *
 * Uso: npx tsx scripts/abnet-tv-clients-360-load-preview.mjs
 */
import { spawnSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { ABNET_COMPANY_ID, fetchAll, loadEnv } from "./abnet-residential-sources.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DUPLICATE_CUSTOMERS = ["CLI-003740", "CLI-005235"]
const DUPLICATE_NUMBER = "5032"
const PACK_ONLY = [
  ["CLI-005846", "6519", "Sabrina Lujan"],
  ["CLI-005823", "6627", "Javier Angulo"],
  ["CLI-003221", "4494", "Nicolas Alvarez"],
  ["CLI-004760", "6058", "Mauricio Ledesma"],
]
const EMPRESA_FULL = ["CLI-003406", "4689"]

function fail(message) {
  throw new Error(message)
}

function assertReadOnlyInvocation() {
  if (process.argv.some((arg) => ["--apply", "--write", "--execute"].includes(arg))) {
    fail("Este preview no acepta escritura.")
  }
}

function readOnlyFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (["insert", "update", "delete", "upsert", "rpc"].includes(prop)) {
          return () => {
            throw new Error(`Preview de solo lectura: ${String(prop)} bloqueado en ${table}.`)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
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
  const line = result.stdout.trim().split(/\r?\n/).filter((row) => row.startsWith("{")).at(-1)
  if (!line) fail("La auditoría no devolvió JSON.")
  return JSON.parse(line)
}

function tvActual(row) {
  if (row.incluidaBasica && row.upgradeFull) return "TV-BASICO+TV-FULL-UPGRADE"
  if (row.upgradeFull) return "TV-FULL"
  if (row.incluidaBasica) return "TV-BASICO"
  return "sin TV representada"
}

function proposedAction(row) {
  if (row.customerNumber === "CLI-003740" || row.customerNumber === "CLI-005235" || row.abnetNumber === DUPLICATE_NUMBER) {
    return "REVIEW_DUPLICATE_ABNET"
  }
  if (row.tv === "TV_BASICA" && row.bespoke === "FALTA_BASICA") return "ADD_TV_BASICA"
  if (row.tv === "TV_FULL" && row.bespoke === "FALTA_FULL" && row.incluidaBasica) return "ADD_TV_FULL_UPGRADE"
  if (row.tv === "TV_FULL" && row.bespoke === "FALTA_FULL") return "ADD_TV_BASICA_AND_TV_FULL_UPGRADE"
  return null
}

function observation(row, action) {
  const notes = ["Solo representación comercial. No se propone conexión, servicio técnico ni Pack Fútbol."]
  if (action === "REVIEW_DUPLICATE_ABNET") {
    notes.push("N° 5032 está en CLI-003740 y CLI-005235. No se elige ficha y no hay acción de escritura.")
  }
  if (action === "ADD_TV_FULL_UPGRADE") {
    notes.push("La TV Básica ya está representada. Se agregaría TV-FULL-UPGRADE sobre ese abono, sin un segundo servicio.")
  }
  if (action === "ADD_TV_BASICA_AND_TV_FULL_UPGRADE") {
    notes.push("Falta la TV Básica y el upgrade. La representación queda TV-BASICO + TV-FULL-UPGRADE, no un servicio aparte de TV Full.")
  }
  if (row.customerNumber === "CLI-003406") {
    notes.push("TV Full sale de la fila TV PACK FULL 2. El FULL del plan empresa no es TV Full.")
  }
  if (PACK_ONLY.some(([code]) => code === row.customerNumber)) {
    notes.push("Solo hay fila TV PACK FULL 1, sin una fila de internet con TV Básica. No se asume una conexión.")
  }
  if (!row.servicioActualBespoke) {
    notes.push("Hoy no hay un servicio contratado en Bespoke. Este preview no propone crearlo ni crear la conexión.")
  }
  return notes.join(" ")
}

function planAbnet(row) {
  return row.filas?.map((item) => item.plan).filter(Boolean).join(" | ") || null
}

function estadoAbnet(row) {
  return [...new Set(row.filas?.map((item) => item.estado).filter(Boolean) ?? [])].join(" | ") || null
}

function tvAbnet(row) {
  return [...new Set(row.filas?.map((item) => item.tv).filter((value) => value != null) ?? [])].join(" | ") || null
}

async function countTable(db, table) {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq("company_id", ABNET_COMPANY_ID)
  if (error) fail(`${table}: ${error.message}`)
  return count ?? 0
}

async function main() {
  assertReadOnlyInvocation()
  const audit = loadAudit()
  const resumen = audit.resumen
  if (resumen.universo !== 4737) fail(`Universo ${resumen.universo}, se esperaba 4737.`)
  if (resumen.tv.review !== 497) fail(`REVIEW ${resumen.tv.review}, se esperaba 497.`)
  const determinados = resumen.universo - resumen.tv.review
  if (determinados !== 4240) fail(`Determinados ${determinados}, se esperaba 4240.`)
  const pendiente = audit.faltaBasica.length + audit.faltaFull.length
  if (pendiente !== resumen.bespoke.faltaBasica + resumen.bespoke.faltaFull) {
    fail("El detalle pendiente no coincide con el resumen.")
  }

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: readOnlyFrom(client) }
  const before = {
    customers: await countTable(db, "customers"),
    services: await countTable(db, "isp_services"),
    connections: await countTable(db, "isp_connections"),
    tasks: await countTable(db, "tasks"),
  }

  const customers = await fetchAll(db, "customers", "id, customer_number, deleted_at")
  const customerIdByNumber = new Map(
    customers.filter((row) => !row.deleted_at && row.customer_number).map((row) => [row.customer_number, row.id])
  )
  const services = await fetchAll(db, "isp_services", "id, customer_id, catalog_code, plan_name, deleted_at")
  const conditions = await fetchAll(db, "isp_service_conditions", "service_id, condition_id, status, discount_percent, deleted_at")
  const conditionCatalog = await fetchAll(db, "isp_commercial_conditions", "id, code, discount_percent, deleted_at")
  const catalogById = new Map(conditionCatalog.filter((row) => !row.deleted_at).map((row) => [row.id, row]))
  const servicesByCustomer = new Map()
  for (const service of services) {
    if (service.deleted_at) continue
    const current = servicesByCustomer.get(service.customer_id) ?? []
    current.push(service)
    servicesByCustomer.set(service.customer_id, current)
  }
  const conditionByService = new Map()
  for (const row of conditions) {
    if (row.deleted_at || row.status !== "active") continue
    const catalog = catalogById.get(row.condition_id)
    if (!catalog) continue
    const current = conditionByService.get(row.service_id) ?? []
    current.push(`${catalog.code} ${row.discount_percent}%`)
    conditionByService.set(row.service_id, current)
  }

  const candidates = [...audit.faltaBasica, ...audit.faltaFull]
  const detail = candidates.map((row) => {
    const action = proposedAction(row)
    if (!action) fail(`Sin acción para ${row.customerNumber}. No se inventa una acción.`)
    const customerId = customerIdByNumber.get(row.customerNumber) ?? null
    if (!customerId) fail(`No se encontró el customer de ${row.customerNumber}.`)
    const currentServices = servicesByCustomer.get(customerId) ?? []
    const currentConditions = [...new Set(currentServices.flatMap((service) => conditionByService.get(service.id) ?? []))]
    const proposedCondition = row.condition?.code === "JUBILADO" ? "JUBILADO" : null
    const item = {
      accion: action,
      customerId,
      customerNumber: row.customerNumber,
      abnetNumber: row.abnetNumber,
      name: row.name,
      planAbnet: planAbnet(row),
      tvAbnet: tvAbnet(row),
      estadoAbnet: estadoAbnet(row),
      tvActualBespoke: tvActual(row),
      servicioActualBespoke: currentServices.map((service) => service.plan_name || service.catalog_code).filter(Boolean).join(" | ") || null,
      condicionActualBespoke: currentConditions.join(" | ") || null,
      condicionPropuesta: proposedCondition,
      descuentoPropuesto: proposedCondition ? 50 : null,
      motivo: row.reason,
      packs: row.packs,
      observaciones: null,
    }
    item.observaciones = observation(item, action)
    return item
  })

  if (detail.some((row) => JSON.stringify(row).includes("PACK-FUTBOL") || JSON.stringify(row).includes("PACK FUTBOL"))) {
    fail("El preview propuso Pack Fútbol.")
  }
  if (detail.some((row) => /conexi[oó]n|isp_connections|servicio t[eé]cnico/i.test(row.accion))) {
    fail("El preview propuso una conexión o un servicio técnico.")
  }

  const byAction = {}
  for (const row of detail) byAction[row.accion] = (byAction[row.accion] ?? 0) + 1
  const automaticas = detail.filter((row) => row.accion !== "REVIEW_DUPLICATE_ABNET").length
  const fullRows = detail.filter((row) => audit.faltaFull.some((item) => item.customerNumber === row.customerNumber))
  const basicRows = detail.filter((row) => audit.faltaBasica.some((item) => item.customerNumber === row.customerNumber))
  const duplicate = detail.filter(
    (row) => row.abnetNumber === DUPLICATE_NUMBER || DUPLICATE_CUSTOMERS.has(row.customerNumber)
  )
  if (duplicate.some((row) => row.accion !== "REVIEW_DUPLICATE_ABNET")) {
    fail("Una ficha del N° 5032 quedó con acción de escritura.")
  }
  for (const [code, number] of PACK_ONLY) {
    const row = detail.find((item) => item.customerNumber === code && item.abnetNumber === number)
    if (!row || !row.packs?.includes("TV PACK FULL 1")) fail(`${code} no quedó como TV PACK FULL 1 dentro del preview.`)
    if (row.accion === "REVIEW_DUPLICATE_ABNET") fail(`${code} no debe tratarse como duplicado.`)
  }
  const martinez = detail.find((row) => row.customerNumber === EMPRESA_FULL[0] && row.abnetNumber === EMPRESA_FULL[1])
  if (!martinez || !martinez.packs?.includes("TV PACK FULL 2")) fail("Martinez Maria Jose no quedó como TV PACK FULL 2.")
  if (!["ADD_TV_FULL_UPGRADE", "ADD_TV_BASICA_AND_TV_FULL_UPGRADE"].includes(martinez.accion)) {
    fail("Martinez Maria Jose no tiene una acción de TV Full.")
  }

  const after = {
    customers: await countTable(db, "customers"),
    services: await countTable(db, "isp_services"),
    connections: await countTable(db, "isp_connections"),
    tasks: await countTable(db, "tasks"),
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) fail("Los conteos cambiaron durante el preview.")

  const report = {
    readOnly: true,
    operations: ["select"],
    writes: [],
    packFutbol: false,
    conexiones: false,
    serviciosTecnicos: false,
    resumen: {
      universo: 4737,
      determinados: 4240,
      review: 497,
      tvBasicaFaltante: audit.faltaBasica.length,
      tvFullFaltante: audit.faltaFull.length,
      totalPendiente: pendiente,
      accionesAutomaticas: automaticas,
      diferenciaContraPendiente: pendiente - automaticas,
      full: {
        conBasicaExistente: fullRows.filter((row) => row.accion === "ADD_TV_FULL_UPGRADE").length,
        sinBasica: fullRows.filter((row) => row.accion === "ADD_TV_BASICA_AND_TV_FULL_UPGRADE").length,
        duplicidadAbnet: fullRows.filter((row) => row.accion === "REVIEW_DUPLICATE_ABNET").length,
        otros: fullRows.filter((row) => !["ADD_TV_FULL_UPGRADE", "ADD_TV_BASICA_AND_TV_FULL_UPGRADE", "REVIEW_DUPLICATE_ABNET"].includes(row.accion)).length,
      },
      basica: {
        faltanteNormal: basicRows.filter((row) => row.accion === "ADD_TV_BASICA" && row.condicionPropuesta !== "JUBILADO").length,
        jubilado: basicRows.filter((row) => row.condicionPropuesta === "JUBILADO").length,
        otros: basicRows.filter((row) => row.accion !== "ADD_TV_BASICA").length,
      },
      porAccion: byAction,
      jubiladosEnPendiente: detail.filter((row) => row.condicionPropuesta === "JUBILADO").length,
    },
    controles: {
      duplicado5032: duplicate.map((row) => ({
        customerNumber: row.customerNumber,
        customerId: row.customerId,
        name: row.name,
        accion: row.accion,
        tvActualBespoke: row.tvActualBespoke,
      })),
      packSolo: PACK_ONLY.map(([code]) => {
        const row = detail.find((item) => item.customerNumber === code)
        return { customerNumber: row.customerNumber, abnetNumber: row.abnetNumber, accion: row.accion, tvActualBespoke: row.tvActualBespoke, planAbnet: row.planAbnet }
      }),
      martinez: {
        customerNumber: martinez.customerNumber,
        abnetNumber: martinez.abnetNumber,
        accion: martinez.accion,
        planAbnet: martinez.planAbnet,
        packs: martinez.packs,
      },
    },
    counts: { before, after },
    detalle: detail,
  }

  console.log(JSON.stringify(report))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
