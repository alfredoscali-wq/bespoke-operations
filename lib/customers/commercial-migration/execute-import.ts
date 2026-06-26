import type { SupabaseCustomersClient } from "@/lib/supabase/customers.queries"
import { createCustomer } from "@/lib/supabase/customers.queries"
import type { EnrichedMigrationCustomer } from "@/lib/customers/commercial-migration/review-types"
import { isOperationalMigrationCustomer } from "@/lib/customers/commercial-migration/review-utils"
import type { Customer } from "@/lib/types/customers"

export type CommercialMigrationImportResult = {
  imported: number
  skipped: number
  errors: { legacyId: number; message: string }[]
  customers: Customer[]
}

export async function executeCommercialMigrationImport(input: {
  client: SupabaseCustomersClient
  records: EnrichedMigrationCustomer[]
  existingExternalCodes?: Set<string>
}): Promise<CommercialMigrationImportResult> {
  const existingCodes = input.existingExternalCodes ?? new Set<string>()
  const result: CommercialMigrationImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    customers: [],
  }

  const operational = input.records.filter(isOperationalMigrationCustomer)

  for (const record of operational) {
    const externalCode = record.externalCustomerCode.trim()

    if (externalCode && existingCodes.has(externalCode.toLowerCase())) {
      result.skipped++
      continue
    }

    const createResult = await createCustomer(input.client, {
      name: record.name,
      externalCustomerCode: externalCode || null,
      dni: record.dni || null,
      phone: record.phone || null,
      email: record.email || null,
      address: record.address || null,
      locality: record.locality || null,
      technology: record.technology || null,
      status: "activo",
      validationStatus: record.effectiveValidationStatus ?? "active",
      legacyClientState: record.legacyClientState || null,
      legacyMigrationId: record.legacyId,
    })

    if (createResult.error || !createResult.data) {
      result.errors.push({
        legacyId: record.legacyId,
        message: createResult.error?.message ?? "Error desconocido",
      })
      continue
    }

    result.imported++
    result.customers.push(createResult.data)

    if (externalCode) {
      existingCodes.add(externalCode.toLowerCase())
    }
  }

  return result
}
