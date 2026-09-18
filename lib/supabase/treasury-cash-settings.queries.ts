import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import type { TreasuryCashOpening } from "@/lib/tesoreria/cash-opening"

export type SupabaseTreasuryCashSettingsClient = SupabaseClient<Database>

export type TreasuryCashSettingsRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }

type TreasuryCashSettingsRow = {
  company_id: string
  opening_balance: number | string
  as_of_date: string
  notes: string | null
}

function mapError(error: { code?: string; message: string }) {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function mapRow(row: TreasuryCashSettingsRow): TreasuryCashOpening {
  const amount = Number(row.opening_balance)
  return {
    companyId: row.company_id,
    openingBalance: Number.isFinite(amount) ? amount : 0,
    asOfDate: row.as_of_date,
    notes: row.notes?.trim() ?? "",
  }
}

export async function fetchTreasuryCashSettings(
  client: SupabaseTreasuryCashSettingsClient,
  companyId: string
): Promise<TreasuryCashSettingsRepositoryResult<TreasuryCashOpening | null>> {
  const { data, error } = await (client as SupabaseClient)
    .from("treasury_cash_settings")
    .select("company_id, opening_balance, as_of_date, notes")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return { data: null, error: null }
  }

  return {
    data: mapRow(data as TreasuryCashSettingsRow),
    error: null,
  }
}
