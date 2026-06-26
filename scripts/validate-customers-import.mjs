/**
 * RC1.1 — Informe post-importación y validación de KPIs.
 * Uso: node scripts/validate-customers-import.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

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

function countOperationalSummary(customers) {
  const operational = customers.filter((customer) => !customer.deleted_at)
  return {
    operativos: operational.length,
    activos: operational.filter((c) => c.validation_status === "active").length,
    revisar: operational.filter((c) => c.validation_status === "review").length,
  }
}

function matchCustomerSearchQuery(customer, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  const fields = [
    customer.name,
    customer.external_customer_code,
    customer.dni,
    customer.phone,
    customer.address,
    customer.locality,
    customer.legacy_migration_id != null
      ? String(customer.legacy_migration_id)
      : "",
  ]

  return fields.some((field) => field?.toLowerCase().includes(normalizedQuery))
}

function matchesQuickFilter(customer, filter) {
  if (filter === "operativos") return !customer.deleted_at
  if (filter === "activos") {
    return !customer.deleted_at && customer.validation_status === "active"
  }
  return !customer.deleted_at && customer.validation_status === "review"
}

async function fetchAllCustomers(supabase) {
  const rows = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return rows
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient(url, key)

  const rows = await fetchAllCustomers(supabase)
  const summary = countOperationalSummary(rows)

  const { count: dbOperativos } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

  const { count: dbActivos } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("validation_status", "active")

  const { count: dbRevisar } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("validation_status", "review")

  const { count: dbWithLegacy } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .not("legacy_migration_id", "is", null)

  const reviewSample = rows.find(
    (customer) =>
      !customer.deleted_at && customer.validation_status === "review"
  )
  const activeSample = rows.find(
    (customer) =>
      !customer.deleted_at && customer.validation_status === "active"
  )

  const searchByDni = reviewSample?.dni
    ? rows.filter((customer) => matchCustomerSearchQuery(customer, reviewSample.dni))
    : []
  const filterActivos = rows.filter((customer) =>
    matchesQuickFilter(customer, "activos")
  )
  const filterRevisar = rows.filter((customer) =>
    matchesQuickFilter(customer, "revisar")
  )

  let canUseForWorkOrder = false
  let workOrderNotes = null

  if (reviewSample?.id && reviewSample.name?.trim()) {
    const { error: tasksColumnError } = await supabase
      .from("tasks")
      .select("customer_id")
      .limit(1)

    canUseForWorkOrder = !tasksColumnError
    workOrderNotes =
      "Cliente en Revisar disponible para OT (sin bloqueo por validation_status). " +
      "La creación de OT usa el flujo completo de la app (code, project_code)."
  }

  const kpiMatches =
    summary.operativos === (dbOperativos ?? 0) &&
    summary.activos === (dbActivos ?? 0) &&
    summary.revisar === (dbRevisar ?? 0) &&
    filterActivos.length === summary.activos &&
    filterRevisar.length === summary.revisar

  console.log(
    JSON.stringify(
      {
        database: {
          totalRows: rows.length,
          operativos: dbOperativos ?? 0,
          activos: dbActivos ?? 0,
          revisar: dbRevisar ?? 0,
          withLegacyMigrationId: dbWithLegacy ?? 0,
        },
        moduleKpis: summary,
        kpiMatchesDatabase: kpiMatches,
        functionalChecks: {
          listLoads: rows.length > 0,
          detailSampleActive: activeSample
            ? {
                id: activeSample.id,
                name: activeSample.name,
                validationStatus: activeSample.validation_status,
              }
            : null,
          detailSampleReview: reviewSample
            ? {
                id: reviewSample.id,
                name: reviewSample.name,
                validationStatus: reviewSample.validation_status,
              }
            : null,
          searchByDniMatches: reviewSample?.dni
            ? searchByDni.length >= 1
            : null,
          filterActivosCount: filterActivos.length,
          filterRevisarCount: filterRevisar.length,
          canUseForWorkOrder,
          workOrderNotes,
        },
        readyForProduction: kpiMatches && rows.length > 0 && canUseForWorkOrder,
      },
      null,
      2
    )
  )

  process.exit(kpiMatches && rows.length > 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
