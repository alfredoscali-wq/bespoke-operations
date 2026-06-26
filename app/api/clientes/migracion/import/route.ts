import { NextResponse } from "next/server"

import { executeCommercialMigrationImport } from "@/lib/customers/commercial-migration/execute-import"
import { enrichMigrationCustomers } from "@/lib/customers/commercial-migration/review-utils"
import {
  readMigrationReviewState,
  readPreparedMigrationDataset,
} from "@/lib/customers/commercial-migration/review-storage"
import { createClient } from "@/lib/supabase/server"
import { getCustomers } from "@/lib/supabase/customers.queries"

export async function POST() {
  try {
    const supabase = await createClient()
    const dataset = readPreparedMigrationDataset()
    const reviewState = readMigrationReviewState()
    const records = enrichMigrationCustomers(
      dataset.records,
      reviewState.decisions
    )

    const existing = await getCustomers(supabase)
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { error: existing.error?.message ?? "No se pudieron leer clientes existentes." },
        { status: 500 }
      )
    }

    const existingExternalCodes = new Set(
      existing.data
        .map((customer) => customer.externalCustomerCode?.trim().toLowerCase())
        .filter(Boolean) as string[]
    )

    const result = await executeCommercialMigrationImport({
      client: supabase,
      records,
      existingExternalCodes,
    })

    return NextResponse.json({
      ok: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible importar clientes"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
