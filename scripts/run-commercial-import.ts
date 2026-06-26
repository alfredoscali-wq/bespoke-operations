import { readFileSync } from "fs"
import { resolve } from "path"

import { executeCommercialMigrationImport } from "@/lib/customers/commercial-migration/execute-import"
import { enrichMigrationCustomers } from "@/lib/customers/commercial-migration/review-utils"
import {
  readMigrationReviewState,
  readPreparedMigrationDataset,
} from "@/lib/customers/commercial-migration/review-storage"
import { createClient } from "@supabase/supabase-js"

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

  if (!url || !key) {
    throw new Error("Missing Supabase env in .env.local")
  }

  return { url, key }
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient(url, key)

  const probe = await supabase
    .from("customers")
    .select("id, validation_status")
    .limit(1)

  if (probe.error) {
    console.error(
      "Migration RC1.1 not applied:",
      probe.error.message,
      "\nRun SQL in Supabase Dashboard or: npm run db:rc1-1 (with SUPABASE_DB_URL)"
    )
    process.exit(1)
  }

  const dataset = readPreparedMigrationDataset()
  const reviewState = readMigrationReviewState()
  const records = enrichMigrationCustomers(dataset.records, reviewState.decisions)

  const { data: existingCustomers } = await supabase.from("customers").select("*")
  const existingExternalCodes = new Set(
    (existingCustomers ?? [])
      .map((customer) => customer.external_customer_code?.trim().toLowerCase())
      .filter(Boolean)
  )

  const result = await executeCommercialMigrationImport({
    client: supabase,
    records,
    existingExternalCodes,
  })

  console.log(
    JSON.stringify(
      {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.slice(0, 5),
        errorCount: result.errors.length,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
