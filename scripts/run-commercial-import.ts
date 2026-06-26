import { readFileSync } from "fs"
import { resolve } from "path"

import { executeCommercialMigrationImport } from "@/lib/customers/commercial-migration/execute-import"
import {
  formatCustomersImportSchemaError,
  verifyCustomersImportSchema,
} from "@/lib/customers/commercial-migration/import-schema"
import {
  enrichMigrationCustomers,
  isOperationalMigrationCustomer,
} from "@/lib/customers/commercial-migration/review-utils"
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

async function fetchExistingCustomersForImport(
  supabase: ReturnType<typeof createClient>
) {
  const rows: {
    external_customer_code: string | null
    legacy_migration_id: number | null
  }[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select("external_customer_code, legacy_migration_id")
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(error.message)
    }

    const page = data ?? []
    rows.push(...page)

    if (page.length < pageSize) {
      break
    }

    offset += pageSize
  }

  return rows
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

  const schemaIssues = await verifyCustomersImportSchema(supabase)
  if (schemaIssues.length > 0) {
    console.error(formatCustomersImportSchemaError(schemaIssues))
    process.exit(1)
  }

  const dataset = readPreparedMigrationDataset()
  const reviewState = readMigrationReviewState()
  const records = enrichMigrationCustomers(dataset.records, reviewState.decisions)
  const operationalRecords = records.filter(isOperationalMigrationCustomer)
  const descartados = records.length - operationalRecords.length

  const existingCustomers = await fetchExistingCustomersForImport(supabase)

  const existingExternalCodes = new Set(
    existingCustomers
      .map((customer) => customer.external_customer_code?.trim().toLowerCase())
      .filter(Boolean)
  )
  const existingLegacyMigrationIds = new Set(
    existingCustomers
      .map((customer) => customer.legacy_migration_id)
      .filter((value): value is number => value != null)
  )

  console.error(
    `Importando clientes operativos (${records.length} registros en dataset)...`
  )

  const startedAt = Date.now()
  const result = await executeCommercialMigrationImport({
    client: supabase,
    records,
    existingExternalCodes,
    existingLegacyMigrationIds,
    onProgress(processed, total) {
      if (processed % 500 === 0 || processed === total) {
        console.error(`  ${processed}/${total} procesados...`)
      }
    },
  })

  const { count: totalCustomers } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })

  const { count: migratedCustomers } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .not("legacy_migration_id", "is", null)

  const { count: reviewCustomers } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("validation_status", "review")

  const { count: activeCustomers } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("validation_status", "active")

  console.log(
    JSON.stringify(
      {
        informe: {
          totalEncontrados: records.length,
          operativosEnDataset: operationalRecords.length,
          descartados,
          importados: result.imported,
          omitidos: result.skipped,
          activosEnDataset: operationalRecords.filter(
            (record) => record.effectiveValidationStatus === "active"
          ).length,
          revisarEnDataset: operationalRecords.filter(
            (record) => record.effectiveValidationStatus === "review"
          ).length,
          durationSeconds: Math.round((Date.now() - startedAt) / 1000),
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 10),
        },
        database: {
          totalCustomers: totalCustomers ?? 0,
          withLegacyMigrationId: migratedCustomers ?? 0,
          activos: activeCustomers ?? 0,
          revisar: reviewCustomers ?? 0,
        },
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
