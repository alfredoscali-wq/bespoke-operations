import type { SupabaseCustomersClient } from "@/lib/supabase/customers.queries"

const REQUIRED_CUSTOMER_COLUMNS = [
  "id",
  "customer_number",
  "external_customer_code",
  "dni",
  "name",
  "phone",
  "email",
  "address",
  "locality",
  "technology",
  "status",
  "validation_status",
  "validated_by",
  "validated_at",
  "legacy_client_state",
  "legacy_migration_id",
  "created_at",
  "updated_at",
  "deleted_at",
] as const

const COLUMN_TO_MIGRATION: Record<string, string> = {
  customer_number: "supabase/migrations/20260732000100_create_customers.sql",
  external_customer_code:
    "supabase/migrations/20260733000100_customers_soft_delete_and_external_code.sql",
  deleted_at:
    "supabase/migrations/20260733000100_customers_soft_delete_and_external_code.sql",
  dni: "supabase/migrations/20260819000100_customers_dni_sprint_clientes_2_0_1.sql",
  validation_status: "supabase/migrations/20260820000100_customers_operational_rc1_1.sql",
  validated_by: "supabase/migrations/20260820000100_customers_operational_rc1_1.sql",
  validated_at: "supabase/migrations/20260820000100_customers_operational_rc1_1.sql",
  legacy_client_state: "supabase/migrations/20260820000100_customers_operational_rc1_1.sql",
  legacy_migration_id: "supabase/migrations/20260820000100_customers_operational_rc1_1.sql",
}

export type CustomersImportSchemaIssue = {
  column: string
  migrationFile: string
}

async function probeCustomerColumn(
  client: SupabaseCustomersClient,
  column: string
): Promise<CustomersImportSchemaIssue | null> {
  const { error } = await client.from("customers").select(column).limit(1)
  if (!error) return null

  const message = error.message.toLowerCase()
  if (!message.includes(column.toLowerCase())) {
    throw new Error(`No se pudo verificar la columna ${column}: ${error.message}`)
  }

  return {
    column,
    migrationFile:
      COLUMN_TO_MIGRATION[column] ??
      "supabase/migrations/20260732000100_create_customers.sql",
  }
}

export async function verifyCustomersImportSchema(
  client: SupabaseCustomersClient
): Promise<CustomersImportSchemaIssue[]> {
  const issues: CustomersImportSchemaIssue[] = []

  for (const column of REQUIRED_CUSTOMER_COLUMNS) {
    const issue = await probeCustomerColumn(client, column)
    if (issue) {
      issues.push(issue)
    }
  }

  const { error: tasksError } = await client
    .from("tasks")
    .select("customer_id")
    .limit(1)

  if (tasksError?.message?.toLowerCase().includes("customer_id")) {
    issues.push({
      column: "tasks.customer_id",
      migrationFile: "supabase/migrations/20260732000100_create_customers.sql",
    })
  }

  return issues
}

export function formatCustomersImportSchemaError(
  issues: CustomersImportSchemaIssue[]
): string {
  const lines = issues.map(
    (issue) => `- ${issue.column} → ${issue.migrationFile}`
  )

  return [
    "El esquema de customers no está listo para la importación.",
    "Aplique estas migraciones en Supabase (SQL Editor) y reintente:",
    ...lines,
  ].join("\n")
}

export function isSchemaCacheError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column") && normalized.includes("customers")
  )
}
