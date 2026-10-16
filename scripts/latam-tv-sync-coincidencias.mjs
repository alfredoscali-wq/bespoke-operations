/**
 * Sincroniza id_crm en LATAM para la hoja Coincidencias.
 * Uso:
 *   npx tsx scripts/latam-tv-sync-coincidencias.mjs --confirm --audit <xlsx>
 *   npx tsx scripts/latam-tv-sync-coincidencias.mjs --confirm --write --audit <xlsx>
 * Sin --confirm no llama a LATAM. Sin --write no envía POST.
 * No imprime el token. No modifica Bespoke.
 */
import { createRequire } from "node:module"
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import { listLatamTvClients, readLatamClientLink, syncLatamTvClient } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import {
  confirmLatamSyncLink,
  planLatamSyncBatch,
  summarizeLatamSyncResults,
} from "../lib/integrations/latam-tv/sync-batch.ts"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const PAUSE_MS = 250
const DEFAULT_AUDIT = "C:\\Users\\alfre\\Downloads\\coincidencias_LATAM_Bespoke_auditoria.xlsx"
const DEFAULT_REPORT = "C:\\Users\\alfre\\Downloads\\latam-sync-client-report.xlsx"
const TORANZO_IPTV = "29"
const TORANZO_CRM = "6798"

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  return process.argv[index + 1] ?? null
}

function envFile() {
  return readFileSync(new URL("../.env.local", import.meta.url), "utf8")
}

function envValue(name) {
  const line = envFile().split(/\r?\n/).find((item) => item.startsWith(`${name}=`))
  if (!line) return ""
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, "")
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function cell(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function matchType(value) {
  if (value === "DNI + email") return "dni_email"
  if (value === "DNI") return "dni"
  if (value === "email") return "email"
  return null
}

function loadCandidates(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheet = workbook.Sheets.Coincidencias
  if (!sheet) fail("La auditoría no tiene la hoja Coincidencias.")
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
  return rows.map((row) => ({
    iptvId: cell(row.LATAM_ID) ?? "",
    crmId: cell(row.BESPOKE_N_Cliente) ?? "",
    match: matchType(cell(row.Tipo_coincidencia)),
    latamNationalId: cell(row.LATAM_RUT),
    latamEmail: cell(row.LATAM_Email),
    bespokeNationalId: cell(row.BESPOKE_DNI),
    bespokeEmail: cell(row.BESPOKE_Email),
  }))
}

function latamDeps() {
  const rawUrl = envValue("LATAM_TV_API_URL")
  const token = envValue("LATAM_TV_API_TOKEN")
  let origin = ""
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== "https:") fail("LATAM TV no está configurado.")
    origin = parsed.origin
  } catch {
    fail("LATAM TV no está configurado.")
  }
  if (!token || rawUrl.includes(token)) fail("LATAM TV no está configurado.")
  return { baseUrl: origin, token, timeoutMs: 90_000 }
}

function safeText(value, token) {
  if (value == null) return null
  const text = String(value)
  return token ? text.split(token).join("[redacted]") : text
}

function reportRow(item, status, extra = {}) {
  return {
    "N° Cliente Bespoke": item.crmId,
    id_iptv: item.iptvId,
    "id_crm antes": extra.crmBefore ?? item.decision.crmBefore,
    "id_crm después": extra.crmAfter ?? null,
    "estado inicial LATAM": item.decision.latamStatus,
    "plan inicial LATAM": item.decision.planName,
    resultado: status,
    "código LATAM": extra.code ?? null,
    "mensaje LATAM": extra.message ?? null,
    "error técnico": extra.error ?? null,
  }
}

function writeReport(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  const visible = rows.map((row) => {
    const copy = { ...row }
    delete copy.intentos
    return copy
  })
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(visible)
  XLSX.utils.book_append_sheet(workbook, sheet, "Resultados")
  XLSX.writeFile(workbook, file)
}

function resultKey(iptvId, crmId) {
  return `${iptvId}:${crmId}`
}

function loadResume(file) {
  try {
    const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean)
    const saved = new Map()
    for (const line of lines) {
      const row = JSON.parse(line)
      saved.set(resultKey(row.id_iptv, row["N° Cliente Bespoke"]), row)
    }
    return saved
  } catch {
    return new Map()
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

const confirm = process.argv.includes("--confirm")
const write = process.argv.includes("--write")
const resume = process.argv.includes("--resume")
const auditPath = argValue("--audit") ?? DEFAULT_AUDIT
const reportPath = argValue("--report") ?? DEFAULT_REPORT
const limitArg = argValue("--limit")
const limit = limitArg == null ? null : Number(limitArg)

if (!confirm) {
  console.log("Sin --confirm no se consulta ni se escribe en LATAM.")
  process.exit(0)
}
if (limit != null && (!Number.isInteger(limit) || limit < 1)) {
  fail("El límite de escrituras no es válido.")
}

const candidates = loadCandidates(auditPath)
if (candidates.length === 0) fail("Coincidencias no tiene filas.")
const deps = latamDeps()

let catalog
try {
  catalog = await listLatamTvClients(deps)
} catch (error) {
  if (error instanceof LatamTvRequestError) fail(error.message)
  fail("No se pudo consultar LATAM TV.")
}

const decisions = planLatamSyncBatch(
  candidates,
  catalog.map((client) => ({
    iptvId: client.iptvId,
    crmId: client.identifier,
    nationalId: client.nationalId,
    email: client.email,
    status: client.status,
    planName: client.planName,
  }))
)
const items = candidates.map((candidate, index) => ({
  ...candidate,
  decision: decisions[index],
}))
const toranzo = items.find((item) => item.iptvId === TORANZO_IPTV && item.crmId === TORANZO_CRM)
if (!toranzo) fail("Toranzo 6798 no está en Coincidencias.")
console.log(`Toranzo ${TORANZO_CRM} / id_iptv ${TORANZO_IPTV}: ${toranzo.decision.status}`)
if (write && toranzo.decision.status !== "already_synced") {
  fail("Toranzo no está sincronizado. No se envía ningún POST.")
}

const jsonlPath = reportPath.replace(/\.xlsx$/i, ".jsonl")
mkdirSync(dirname(reportPath), { recursive: true })
const saved = resume ? loadResume(jsonlPath) : new Map()
const rows = []
let posts = 0
let consecutiveErrors = 0
let lastError = ""

function remember(row) {
  rows.push(row)
  appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`)
}

async function pauseFor(status) {
  if (status === "error") {
    consecutiveErrors += 1
    await sleep(consecutiveErrors >= 2 ? 8_000 : 1_500)
    return
  }
  consecutiveErrors = 0
  await sleep(PAUSE_MS)
}

for (const item of items) {
  const key = resultKey(item.iptvId, item.crmId)
  const previous = saved.get(key)
  const attempts = Number(previous?.intentos ?? (previous?.resultado === "error" ? 1 : 0))
  if (previous && (previous.resultado !== "error" || attempts >= 3)) {
    rows.push(previous)
    continue
  }
  if (!write || item.decision.status !== "ready") {
    const status = item.decision.status
    const row = reportRow(item, status, {
      crmAfter: item.decision.crmBefore,
      message: item.decision.detail,
    })
    if (previous?.resultado === "error") remember(row)
    else rows.push(row)
    continue
  }
  if (limit != null && posts >= limit) {
    rows.push(reportRow(item, "ready", { crmAfter: item.decision.crmBefore, message: item.decision.detail }))
    continue
  }
  posts += 1
  let outcome
  try {
    outcome = await syncLatamTvClient(
      { idIptv: item.iptvId, idCrm: item.crmId },
      deps
    )
  } catch (error) {
    const httpStatus = error instanceof LatamTvRequestError ? error.status : null
    const technical =
      error instanceof LatamTvRequestError && error.kind === "invalid_identifier"
        ? error.message
        : httpStatus
          ? `HTTP ${httpStatus}`
          : "No se pudo consultar LATAM TV."
    const status = error instanceof LatamTvRequestError && error.kind === "invalid_identifier" ? "conflict" : "error"
    lastError = technical
    remember({
      ...reportRow(item, status, { crmAfter: item.decision.crmBefore, error: technical }),
      intentos: attempts + 1,
    })
    await pauseFor(status)
    continue
  }
  if (outcome.outcome !== "updated") {
    const status =
      outcome.outcome === "iptv_not_found"
        ? "not_found"
        : outcome.outcome === "crm_already_registered"
          ? "conflict"
          : "rejected"
    remember(
      reportRow(item, status, {
        crmAfter: item.decision.crmBefore,
        code: outcome.code,
        message: safeText(outcome.message, deps.token),
      })
    )
    await pauseFor(status)
    continue
  }
  await sleep(PAUSE_MS)
  let link
  try {
    link = await readLatamClientLink(item.crmId, deps)
  } catch {
    remember(
      reportRow(item, "verification_failed", {
        crmAfter: null,
        code: outcome.code,
        message: safeText(outcome.message, deps.token),
        error: "La reconsulta no confirmó el vínculo.",
      })
    )
    await pauseFor("verification_failed")
    continue
  }
  const confirmed = confirmLatamSyncLink({
    iptvId: item.iptvId,
    crmId: item.crmId,
    probeIptvId: link.iptvId,
    probeCrmId: link.crmId,
  })
  remember(
    reportRow(item, confirmed ? "synced" : "verification_failed", {
      crmAfter: confirmed ? item.crmId : link.crmId,
      code: outcome.code,
      message: safeText(outcome.message, deps.token),
      error: confirmed ? null : "La reconsulta no confirmó el vínculo.",
    })
  )
  await pauseFor(confirmed ? "synced" : "verification_failed")
  if (posts % 25 === 0) {
    const partial = summarizeLatamSyncResults(rows.map((row) => row.resultado))
    console.log(
      `${posts} escrituras · sincronizados ${partial.synced} · conflictos ${partial.conflict} · errores ${partial.error}${lastError ? ` · último ${lastError}` : ""}`
    )
    writeReport(reportPath, rows)
  }
}

writeReport(reportPath, rows)
const summary = summarizeLatamSyncResults(rows.map((row) => row.resultado))
console.log(`Total candidatos: ${summary.total}`)
console.log(`Ya sincronizados: ${summary.already_synced}`)
console.log(`Sincronizados ahora: ${summary.synced}`)
console.log(`No encontrados: ${summary.not_found}`)
console.log(`Conflictos: ${summary.conflict}`)
console.log(`Rechazados por LATAM: ${summary.rejected}`)
console.log(`Errores técnicos: ${summary.error}`)
console.log(`Verificación fallida: ${summary.verification_failed}`)
console.log(`POST enviados: ${posts}`)
console.log(`Reporte: ${reportPath}`)
if (!write) console.log("Sin --write no se envió ningún POST.")
writeFileSync(
  reportPath.replace(/\.xlsx$/i, ".summary.json"),
  JSON.stringify({ ...summary, posts, write }, null, 2)
)
