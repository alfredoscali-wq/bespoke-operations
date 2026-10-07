/**
 * Carga el padrón ABNet de Conex. Internet + TV.xlsx en abnet_tv_padron_rows.
 *
 * Sin --apply solo lee el Excel e imprime cantidades.
 * Con --apply reemplaza las filas de esa fuente. No toca customers,
 * isp_services, isp_connections, catálogo ni Pack Fútbol.
 */
import { createClient } from "@supabase/supabase-js"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import {
  ABNET_TV_PADRON_SOURCE,
  presentAbnetPadronRow,
  summarizeAbnetTvPadron,
  withAbnetPadronDuplicates,
} from "../lib/subscriptions/abnet-tv-padron.ts"
import {
  ABNET_TV_PADRON_XLSX_PATH,
  readAbnetTvPadronWorkbook,
} from "../lib/subscriptions/abnet-tv-padron-file.ts"
import { loadEnv } from "./abnet-residential-sources.mjs"

const apply = process.argv.includes("--apply")
const sourceRows = readAbnetTvPadronWorkbook(ABNET_TV_PADRON_XLSX_PATH)
const presented = withAbnetPadronDuplicates(sourceRows).map(presentAbnetPadronRow)
const summary = summarizeAbnetTvPadron(presented)
console.log(JSON.stringify({ apply, ...summary }, null, 2))

if (!apply) {
  console.log("Sin --apply no se escribe nada.")
  process.exit(0)
}

const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false } })
const existing = await client
  .from("abnet_tv_padron_rows")
  .select("id")
  .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
  .eq("source", ABNET_TV_PADRON_SOURCE)
  .limit(1)
if (existing.error) {
  console.error(existing.error.message)
  process.exit(1)
}

const removed = await client
  .from("abnet_tv_padron_rows")
  .delete()
  .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
  .eq("source", ABNET_TV_PADRON_SOURCE)
if (removed.error) {
  console.error(removed.error.message)
  process.exit(1)
}

for (let index = 0; index < sourceRows.length; index += 400) {
  const batch = sourceRows.slice(index, index + 400).map((row) => ({
    company_id: BESPOKE_PRODUCTION_COMPANY_ID,
    abnet_customer_number: row.abnetCustomerNumber,
    customer_name: row.customerName,
    service_type: row.serviceType,
    node: row.node,
    plan_name: row.planName,
    status: row.status,
    tv_amount: row.tvAmount,
    tv_tax_amount: row.tvTaxAmount,
    final_amount: row.finalAmount,
    source: row.source,
    source_row: row.sourceRow,
  }))
  const inserted = await client.from("abnet_tv_padron_rows").insert(batch)
  if (inserted.error) {
    console.error(inserted.error.message)
    process.exit(1)
  }
}

console.log(`Filas guardadas: ${sourceRows.length}`)
