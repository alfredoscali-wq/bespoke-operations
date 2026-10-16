/**
 * Auditoría de solo lectura: fichas Bespoke que comparten el mismo N° Cliente / ABNet.
 *
 * El criterio es únicamente el número normalizado con abnetPadronCustomerNumber,
 * la misma función que TV & Suscripciones y Clients 360 usan para comparar.
 * No cruza LATAM, DNI, email ni nombre, y no elige cuál ficha es la correcta.
 *
 * Uso: npx tsx scripts/abnet-customer-number-duplicates-audit.mjs [salida.csv]
 */
import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { createClient } from "@supabase/supabase-js"

import { abnetPadronCustomerNumber } from "../lib/subscriptions/abnet-tv-padron.ts"
import { ABNET_COMPANY_ID, loadEnv } from "./abnet-residential-sources.mjs"

const PAGE = 1000
const DEFAULT_CSV = path.join(homedir(), "Downloads", "bespoke-numero-cliente-duplicados.csv")

export function assertReadOnlyInvocation(argv = process.argv) {
  if (argv.some((arg) => ["--apply", "--write", "--execute"].includes(arg))) {
    throw new Error("Esta auditoría no acepta escritura.")
  }
}

export function readOnlyFrom(client) {
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

function clean(value) {
  if (value == null) return ""
  return String(value).trim()
}

export function groupCustomersByAbnetNumber(rows) {
  const groups = new Map()
  let withoutNumber = 0
  for (const row of rows) {
    const number = abnetPadronCustomerNumber(row.external_customer_code)
    if (!number) {
      withoutNumber += 1
      continue
    }
    const current = groups.get(number) ?? []
    if (!current.some((item) => item.id === row.id)) current.push(row)
    groups.set(number, current)
  }
  return { groups, withoutNumber }
}

export function duplicateGroups(groups) {
  return [...groups.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .sort(([left], [right]) => Number(left) - Number(right) || left.localeCompare(right))
    .map(([number, rows]) => ({
      number,
      count: rows.length,
      fichas: [...rows].sort((left, right) => {
        const byNumber = clean(left.customer_number).localeCompare(clean(right.customer_number))
        return byNumber || clean(left.id).localeCompare(clean(right.id))
      }),
    }))
}

export function summarize(analyzed, grouped) {
  const distinctNumbers = grouped.groups.size
  const repeated = grouped.duplicates.length
  const involved = grouped.duplicates.reduce((total, group) => total + group.count, 0)
  return {
    analyzed,
    withNumber: analyzed - grouped.withoutNumber,
    withoutNumber: grouped.withoutNumber,
    distinctNumbers,
    repeatedNumbers: repeated,
    involvedFichas: involved,
    extraFichas: involved - repeated,
  }
}

function csvCell(value) {
  const text = value == null ? "" : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function duplicatesToCsv(duplicates) {
  const header = ["N° Cliente", "Fichas", "ID ficha", "N° interno", "Nombre", "DNI", "Estado", "Código almacenado"]
  const lines = [header.join(",")]
  for (const group of duplicates) {
    for (const ficha of group.fichas) {
      lines.push(
        [
          group.number,
          group.count,
          ficha.id,
          clean(ficha.customer_number),
          clean(ficha.name),
          clean(ficha.dni),
          clean(ficha.status),
          clean(ficha.external_customer_code),
        ]
          .map(csvCell)
          .join(",")
      )
    }
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`
}

export function assertDuplicateReport(duplicates, summary) {
  const numbers = new Set(duplicates.map((group) => group.number))
  if (numbers.size !== duplicates.length) {
    throw new Error("Hay un N° Cliente repetido en el detalle.")
  }
  if (numbers.size !== summary.repeatedNumbers) {
    throw new Error("El resumen de N° repetidos no coincide con el detalle.")
  }
  const fichas = duplicates.reduce((total, group) => total + group.fichas.length, 0)
  if (fichas !== summary.involvedFichas) {
    throw new Error("El resumen de fichas involucradas no coincide con el detalle.")
  }
  if (summary.extraFichas !== summary.involvedFichas - summary.repeatedNumbers) {
    throw new Error("Las fichas adicionales no coinciden con el detalle.")
  }
  for (const group of duplicates) {
    if (group.count < 2 || group.fichas.length !== group.count) {
      throw new Error(`El N° ${group.number} no tiene dos o más fichas distintas.`)
    }
    const ids = new Set(group.fichas.map((ficha) => ficha.id))
    if (ids.size !== group.fichas.length) {
      throw new Error(`El N° ${group.number} repite el mismo ID de ficha.`)
    }
  }
}

async function readCustomers(from) {
  const rows = []
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await from("customers")
      .select("id, customer_number, name, dni, status, external_customer_code")
      .eq("company_id", ABNET_COMPANY_ID)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(start, start + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

function printReport(duplicates, summary, csvPath) {
  console.log("Auditoría de solo lectura. No se modificó ninguna ficha.")
  console.log(`Empresa: ${ABNET_COMPANY_ID}`)
  console.log("")
  for (const group of duplicates) {
    console.log(`${group.number} · ${group.count} fichas`)
    for (const ficha of group.fichas) {
      const dni = clean(ficha.dni) || "sin DNI"
      console.log(
        `  ${clean(ficha.customer_number) || "sin N° interno"}  ${ficha.id}  ${clean(ficha.name)}  ${dni}  ${clean(ficha.status)}`
      )
    }
  }
  console.log("")
  console.log(`Fichas analizadas: ${summary.analyzed}`)
  console.log(`Fichas con N° Cliente: ${summary.withNumber}`)
  console.log(`Fichas sin N° Cliente utilizable: ${summary.withoutNumber}`)
  console.log(`N° Cliente distintos: ${summary.distinctNumbers}`)
  console.log(`N° Cliente repetidos: ${summary.repeatedNumbers}`)
  console.log(`Fichas involucradas en duplicados: ${summary.involvedFichas}`)
  console.log(`Fichas adicionales: ${summary.extraFichas}`)
  console.log(`CSV: ${csvPath}`)
}

async function main() {
  assertReadOnlyInvocation()
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV
  const env = loadEnv()
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const rows = await readCustomers(readOnlyFrom(client))
  const grouped = groupCustomersByAbnetNumber(rows)
  const duplicates = duplicateGroups(grouped.groups)
  const summary = summarize(rows.length, { ...grouped, duplicates })
  assertDuplicateReport(duplicates, summary)
  writeFileSync(csvPath, duplicatesToCsv(duplicates), "utf8")
  printReport(duplicates, summary, csvPath)
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
