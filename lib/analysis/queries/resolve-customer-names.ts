/**
 * Batch customer name resolution for Análisis (Sprint 17).
 * Single .in() per chunk — never one query per customer id.
 */

import { createClient } from "@/lib/supabase/client"

const CUSTOMER_ID_CHUNK_SIZE = 200

export async function resolveCustomerNamesBatch(
  customerIds: readonly string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(customerIds.filter((id) => id.trim().length > 0))]
  if (unique.length === 0) return map

  const client = createClient()

  for (let i = 0; i < unique.length; i += CUSTOMER_ID_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CUSTOMER_ID_CHUNK_SIZE)
    const { data, error } = await client
      .from("customers")
      .select("id, name")
      .in("id", chunk)

    if (error || !data) continue
    for (const row of data) {
      if (typeof row.id === "string" && typeof row.name === "string") {
        map.set(row.id, row.name)
      }
    }
  }

  return map
}
