import type { EnrichedMigrationCustomer } from "@/lib/customers/commercial-migration/review-types"
import { isOperationalMigrationCustomer } from "@/lib/customers/commercial-migration/review-utils"
import { isSchemaCacheError } from "@/lib/customers/commercial-migration/import-schema"
import {
  createCustomersBatch,
  CUSTOMER_IMPORT_BATCH_SIZE,
  getLatestCustomerNumberCounter,
} from "@/lib/supabase/customers.queries"
import type { SupabaseCustomersClient } from "@/lib/supabase/customers.queries"
import type { Customer } from "@/lib/types/customers"
import type { CreateCustomerPayload } from "@/lib/types/supabase/customers"

export type CommercialMigrationImportResult = {
  imported: number
  skipped: number
  errors: { legacyId: number; message: string }[]
  customers: Customer[]
}

function buildMigrationCustomerPayload(
  record: EnrichedMigrationCustomer
): Omit<CreateCustomerPayload, "customerNumber"> {
  const externalCode = record.externalCustomerCode.trim()

  return {
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
  }
}

async function insertBatchWithFallback(
  client: SupabaseCustomersClient,
  batch: {
    record: EnrichedMigrationCustomer
    payload: Omit<CreateCustomerPayload, "customerNumber">
  }[],
  startCounter: number
): Promise<{
  imported: Customer[]
  errors: { legacyId: number; message: string }[]
  nextCounter: number
}> {
  const batchResult = await createCustomersBatch(
    client,
    batch.map((item) => item.payload),
    startCounter
  )

  if (!batchResult.error && batchResult.data) {
    return {
      imported: batchResult.data.customers,
      errors: [],
      nextCounter: batchResult.data.nextCounter,
    }
  }

  const batchErrorMessage = batchResult.error?.message ?? "Error desconocido"
  if (isSchemaCacheError(batchErrorMessage)) {
    throw new Error(batchErrorMessage)
  }

  const imported: Customer[] = []
  const errors: { legacyId: number; message: string }[] = []
  let counter = startCounter

  for (const item of batch) {
    counter += 1
    const singleResult = await createCustomersBatch(
      client,
      [item.payload],
      counter - 1
    )

    if (singleResult.error || !singleResult.data?.customers.length) {
      errors.push({
        legacyId: item.record.legacyId,
        message: singleResult.error?.message ?? "Error desconocido",
      })
      counter -= 1
      continue
    }

    imported.push(singleResult.data.customers[0])
    counter = singleResult.data.nextCounter
  }

  return { imported, errors, nextCounter: counter }
}

export async function executeCommercialMigrationImport(input: {
  client: SupabaseCustomersClient
  records: EnrichedMigrationCustomer[]
  existingExternalCodes?: Set<string>
  existingLegacyMigrationIds?: Set<number>
  onProgress?: (processed: number, total: number) => void
}): Promise<CommercialMigrationImportResult> {
  const existingCodes = input.existingExternalCodes ?? new Set<string>()
  const existingLegacyIds = input.existingLegacyMigrationIds ?? new Set<number>()
  const result: CommercialMigrationImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    customers: [],
  }

  const operational = input.records.filter(isOperationalMigrationCustomer)
  const pending: {
    record: EnrichedMigrationCustomer
    payload: Omit<CreateCustomerPayload, "customerNumber">
  }[] = []

  for (const record of operational) {
    const externalCode = record.externalCustomerCode.trim()

    if (existingLegacyIds.has(record.legacyId)) {
      result.skipped++
      continue
    }

    if (externalCode && existingCodes.has(externalCode.toLowerCase())) {
      result.skipped++
      continue
    }

    pending.push({
      record,
      payload: buildMigrationCustomerPayload(record),
    })
  }

  let counter = await getLatestCustomerNumberCounter(input.client)
  let processed = 0

  for (let index = 0; index < pending.length; index += CUSTOMER_IMPORT_BATCH_SIZE) {
    const batch = pending.slice(index, index + CUSTOMER_IMPORT_BATCH_SIZE)
    const batchResult = await insertBatchWithFallback(
      input.client,
      batch,
      counter
    )

    counter = batchResult.nextCounter
    result.imported += batchResult.imported.length
    result.customers.push(...batchResult.imported)
    result.errors.push(...batchResult.errors)

    for (const customer of batchResult.imported) {
      if (customer.externalCustomerCode?.trim()) {
        existingCodes.add(customer.externalCustomerCode.trim().toLowerCase())
      }
      if (customer.legacyMigrationId != null) {
        existingLegacyIds.add(customer.legacyMigrationId)
      }
    }

    processed += batch.length
    input.onProgress?.(processed, pending.length)
  }

  return result
}
