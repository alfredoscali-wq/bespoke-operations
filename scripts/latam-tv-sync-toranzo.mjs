/**
 * Una sincronización real de Toranzo: POST /api/sync-client.
 * Uso: npx tsx scripts/latam-tv-sync-toranzo.mjs --confirm --write
 * Sin --confirm no llama a LATAM.
 * No imprime el token. No llama a ningún otro endpoint de escritura.
 */
import { readFileSync } from "node:fs"

import { createClient } from "@supabase/supabase-js"

import { listLatamTvClients, probeLatamTvIdentifier, syncLatamTvClient } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"

const ID_IPTV = "29"
const ID_CRM = "6798"
const DNI = "35226272"
const BESPOKE_EMAIL = "ggerardotoranzo@hotmail.com.ar"
const LATAM_EMAIL = "ggerardotoranzo@hotmail.com.ar"
const ABNET = "00006798"

function envValue(name) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  const line = env.split(/\r?\n/).find((item) => item.startsWith(`${name}=`))
  if (!line) return ""
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, "")
}

function supabaseEnv() {
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL")
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) fail("No se pudo leer el cliente Bespoke.")
  return { url, key }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function view(client) {
  if (!client) return null
  return {
    dni: client.nationalId,
    usuario: client.email,
    id_iptv: client.iptvId,
    id_crm: client.identifier,
    estado: client.status,
    plan: client.planName,
    nombre: client.displayName,
  }
}

if (!process.argv.includes("--confirm") || !process.argv.includes("--write")) {
  console.log("Sin --confirm y --write no se consulta ni se escribe en LATAM.")
  process.exit(0)
}
if (ID_IPTV === ID_CRM || ID_IPTV === "6798") {
  fail("id_iptv no puede ser el N° ABNet.")
}

const { url, key } = supabaseEnv()
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await supabase
  .from("customers")
  .select("id, name, external_customer_code, dni, email, company_id, deleted_at")
  .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
  .eq("external_customer_code", ABNET)
  .is("deleted_at", null)
  .maybeSingle()
if (error) fail("No se pudo leer el cliente Bespoke.")
if (!data || data.company_id !== BESPOKE_PRODUCTION_COMPANY_ID) fail("Toranzo no está en la empresa actual.")
const bespokeDni = String(data.dni ?? "").replace(/\D/g, "")
const bespokeEmail = String(data.email ?? "").trim().toLowerCase()
const bespokeName = String(data.name ?? "").toLowerCase()
if (data.external_customer_code !== ABNET || bespokeDni !== DNI || bespokeEmail !== BESPOKE_EMAIL) {
  fail("La ficha Bespoke no coincide con Toranzo.")
}
if (!bespokeName.includes("toranzo") || !bespokeName.includes("gabriel")) {
  fail("El nombre Bespoke no es Gabriel Toranzo.")
}

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
if (!token) fail("LATAM TV no está configurado.")
const deps = { baseUrl: origin, token, timeoutMs: 25_000 }

let catalog
try {
  catalog = await listLatamTvClients(deps)
} catch (error) {
  if (error instanceof LatamTvRequestError) fail(error.message)
  fail("No se pudo consultar LATAM TV.")
}
const matches = catalog.filter((client) => client.nationalId === DNI)
if (matches.length !== 1) fail(`LATAM devolvió ${matches.length} clientes con ese DNI.`)
const row = matches[0]
if (
  row.iptvId !== ID_IPTV ||
  row.email !== LATAM_EMAIL ||
  !row.displayName?.toLowerCase().includes("toranzo") ||
  !row.displayName?.toLowerCase().includes("gabriel")
) {
  fail("El registro LATAM del DNI no es el cliente de prueba.")
}

let beforeIptv
let beforeCrm
try {
  beforeIptv = await probeLatamTvIdentifier(ID_IPTV, deps)
  beforeCrm = await probeLatamTvIdentifier(ID_CRM, deps)
} catch (error) {
  if (error instanceof LatamTvRequestError) fail(error.message)
  fail("No se pudo consultar LATAM TV.")
}

const alreadyLinked =
  beforeCrm.code === 1 &&
  beforeCrm.client?.nationalId === DNI &&
  beforeCrm.client?.iptvId === ID_IPTV &&
  beforeCrm.client?.identifier === ID_CRM
if (alreadyLinked) {
  console.log(JSON.stringify({
    skipped: true,
    reason: "ya vinculado",
    beforeIdentificador6798: { code: beforeCrm.code, client: view(beforeCrm.client) },
  }, null, 2))
  process.exit(0)
}
if (beforeCrm.code !== 3 || beforeIptv.code !== 3) {
  console.log(JSON.stringify({
    stopped: true,
    beforeIdIptv29: { code: beforeIptv.code, message: beforeIptv.message },
    beforeIdentificador6798: { code: beforeCrm.code, message: beforeCrm.message },
  }, null, 2))
  process.exit(1)
}

let sync
try {
  sync = await syncLatamTvClient({ idIptv: ID_IPTV, idCrm: ID_CRM }, deps)
} catch (error) {
  if (error instanceof LatamTvRequestError) fail(error.message)
  fail("No se pudo sincronizar LATAM TV.")
}
if (sync.code !== 1) {
  console.log(JSON.stringify({ sync }, null, 2))
  process.exit(sync.code === 4 || sync.code === 3 || sync.code === 5 ? 2 : 1)
}

let after
try {
  after = await probeLatamTvIdentifier(ID_CRM, deps)
} catch (error) {
  if (error instanceof LatamTvRequestError) fail(error.message)
  fail("La sincronización respondió, pero no se pudo verificar.")
}
console.log(JSON.stringify({
  beforeIdentificador6798: { code: beforeCrm.code, message: beforeCrm.message },
  beforeIdIptv29: { code: beforeIptv.code, message: beforeIptv.message },
  sync,
  afterIdentificador6798: { code: after.code, message: after.message, client: view(after.client) },
}, null, 2))
