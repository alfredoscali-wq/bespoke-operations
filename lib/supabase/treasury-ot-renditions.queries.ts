import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapTreasuryOtRenditionRow,
  type TreasuryOtRenditionRow,
} from "@/lib/supabase/treasury-ot-renditions.mapper"
import type { Database } from "@/lib/supabase/database.types"
import {
  OT_RENDITION_INCOME_CATEGORY,
} from "@/lib/tesoreria/ot-renditions"
import { TREASURY_OT_RENDITION_STATUSES } from "@/lib/tesoreria/ot-rendition-status"
import {
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGINS,
  TREASURY_STATUSES,
} from "@/lib/tesoreria/categories"
import type {
  ConfirmOtRenditionInput,
  TreasuryOtRendition,
} from "@/lib/types/treasury-ot-renditions"
import { insertTreasuryMovement } from "@/lib/supabase/treasury.queries"

export type SupabaseTreasuryOtRenditionsClient = SupabaseClient<Database>

export type TreasuryOtRenditionRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }

function mapError(error: { code?: string; message: string }) {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

const RENDITION_SELECT = "*" as const

export async function fetchTreasuryOtRenditions(
  client: SupabaseTreasuryOtRenditionsClient,
  companyId: string
): Promise<TreasuryOtRenditionRepositoryResult<TreasuryOtRendition[]>> {
  const { data, error } = await (client as SupabaseClient)
    .from("treasury_ot_renditions")
    .select(RENDITION_SELECT)
    .eq("company_id", companyId)
    .order("collection_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as TreasuryOtRenditionRow[]).map(
      mapTreasuryOtRenditionRow
    ),
    error: null,
  }
}

export async function ensureTreasuryOtRenditionForTask(
  client: SupabaseTreasuryOtRenditionsClient,
  taskId: string
): Promise<TreasuryOtRenditionRepositoryResult<string | null>> {
  const { data, error } = await (client as SupabaseClient).rpc(
    "ensure_treasury_ot_rendition_for_task",
    { p_task_id: taskId }
  )

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: (data as string | null) ?? null, error: null }
}

export async function confirmTreasuryOtRendition(
  client: SupabaseTreasuryOtRenditionsClient,
  rendition: TreasuryOtRendition,
  input: ConfirmOtRenditionInput & {
    companyId: string
    confirmedBy: string | null
    confirmedByName: string
  }
): Promise<
  TreasuryOtRenditionRepositoryResult<{
    rendition: TreasuryOtRendition
    movementId: string
  }>
> {
  if (rendition.status !== TREASURY_OT_RENDITION_STATUSES.PENDING) {
    return {
      data: null,
      error: {
        code: "INVALID_STATUS",
        message: "La rendición ya no está pendiente.",
      },
    }
  }

  const amount = input.amountReceived
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      data: null,
      error: {
        code: "INVALID_AMOUNT",
        message: "Ingrese un monto recibido válido.",
      },
    }
  }

  const movementResult = await insertTreasuryMovement(client, {
    companyId: input.companyId,
    movementType: TREASURY_MOVEMENT_TYPES.INCOME,
    origin: TREASURY_ORIGINS.TASK,
    category: OT_RENDITION_INCOME_CATEGORY,
    amount,
    movementDate: rendition.collectionDate,
    employeeId: rendition.technicianId,
    registeredBy: input.confirmedBy,
    status: TREASURY_STATUSES.CONFIRMED,
    notes:
      [
        `Rendición OT ${rendition.taskCode}`.trim(),
        rendition.customerName ? `Cliente: ${rendition.customerName}` : "",
        input.deliveredBy?.trim()
          ? `Entrega: ${input.deliveredBy.trim()}`
          : "",
        input.notes?.trim() || "",
      ]
        .filter(Boolean)
        .join(" · "),
    metadata: {
      taskId: rendition.taskId,
      taskCode: rendition.taskCode,
      renditionId: rendition.id,
      source: "ot_rendition",
    },
  })

  if (movementResult.error || !movementResult.data) {
    return {
      data: null,
      error: movementResult.error ?? {
        code: "MOVEMENT_FAILED",
        message: "No se pudo crear el ingreso de tesorería.",
      },
    }
  }

  const confirmedAt = new Date().toISOString()
  const { data, error } = await (client as SupabaseClient)
    .from("treasury_ot_renditions")
    .update({
      status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
      amount,
      delivered_by: input.deliveredBy?.trim() || "",
      notes: input.notes?.trim() || "",
      treasury_movement_id: movementResult.data.id,
      confirmed_by: input.confirmedBy,
      confirmed_by_name: input.confirmedByName,
      confirmed_at: confirmedAt,
    })
    .eq("id", rendition.id)
    .eq("status", TREASURY_OT_RENDITION_STATUSES.PENDING)
    .select(RENDITION_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "CONFLICT",
        message: "La rendición ya fue confirmada por otro usuario.",
      },
    }
  }

  return {
    data: {
      rendition: mapTreasuryOtRenditionRow(data as TreasuryOtRenditionRow),
      movementId: movementResult.data.id,
    },
    error: null,
  }
}
