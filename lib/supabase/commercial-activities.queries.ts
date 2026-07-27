import type { SupabaseClient } from "@supabase/supabase-js"

import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import {
  mapCommercialActivityListItem,
  mapCommercialActivityRow,
  mapCommercialActivityTypeRow,
  mapCreateCommercialActivityPayloadToInsert,
  mapUpdateCommercialActivityPayloadToUpdate,
} from "@/lib/supabase/commercial-activities.mapper"
import { insertCommercialCommitment } from "@/lib/supabase/commercial-commitments.queries"
import type { Database } from "@/lib/supabase/database.types"
import type {
  CommercialActivity,
  CommercialActivityListItem,
  CommercialActivityType,
} from "@/lib/types/commercial-activities"
import type {
  CommercialActivityRepositoryResult,
  CreateCommercialActivityPayload,
  UpdateCommercialActivityPayload,
} from "@/lib/types/supabase/commercial-activities"

export type SupabaseCommercialActivitiesClient = SupabaseClient<Database>

const ACTIVITY_SELECT =
  "*, activity_type:commercial_activity_types(code, label), employee:employees!commercial_activities_employee_id_fkey(first_name, last_name)"

function mapError(error: { code?: string; message: string }) {
  if (error.code === "23503") {
    return {
      code: "VALIDATION" as const,
      message: "Referencia inválida para la actividad comercial.",
    }
  }
  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchCommercialActivityTypes(
  client: SupabaseCommercialActivitiesClient
): Promise<CommercialActivityRepositoryResult<CommercialActivityType[]>> {
  const { data, error } = await client
    .from("commercial_activity_types")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapCommercialActivityTypeRow),
    error: null,
  }
}

export async function fetchCommercialActivityTypeByCode(
  client: SupabaseCommercialActivitiesClient,
  code: CommercialActivityTypeCode
): Promise<CommercialActivityRepositoryResult<CommercialActivityType>> {
  const { data, error } = await client
    .from("commercial_activity_types")
    .select("*")
    .eq("code", code)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Tipo de actividad no encontrado." },
    }
  }

  return { data: mapCommercialActivityTypeRow(data), error: null }
}

export async function fetchCommercialActivitiesByOpportunity(
  client: SupabaseCommercialActivitiesClient,
  companyId: string,
  opportunityId: string,
  options?: { limit?: number; offset?: number }
): Promise<
  CommercialActivityRepositoryResult<CommercialActivityListItem[]> & {
    hasMore?: boolean
    totalCount?: number
  }
> {
  const limit = options?.limit
  const offset = options?.offset ?? 0

  let query = client
    .from("commercial_activities")
    .select(ACTIVITY_SELECT, limit !== undefined ? { count: "exact" } : undefined)
    .eq("company_id", companyId)
    .eq("opportunity_id", opportunityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (limit !== undefined) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error, count } = await query

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const rows = (data ?? []).map(mapCommercialActivityListItem)
  const totalCount = count ?? rows.length
  const hasMore =
    limit !== undefined ? offset + rows.length < totalCount : false

  return {
    data: rows,
    error: null,
    hasMore,
    totalCount,
  }
}

export async function fetchCommercialActivityStats(
  client: SupabaseCommercialActivitiesClient,
  companyId: string,
  opportunityId: string
): Promise<
  CommercialActivityRepositoryResult<{
    total: number
    pending: number
    completed: number
  }>
> {
  const base = () =>
    client
      .from("commercial_activities")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("opportunity_id", opportunityId)
      .is("deleted_at", null)

  const [totalResult, pendingResult, completedResult] = await Promise.all([
    base(),
    base().eq("status", "pending"),
    base().eq("status", "completed"),
  ])

  if (totalResult.error || pendingResult.error || completedResult.error) {
    return {
      data: null,
      error: mapError(
        totalResult.error ??
          pendingResult.error ??
          completedResult.error ?? { message: "No se pudieron obtener stats." }
      ),
    }
  }

  return {
    data: {
      total: totalResult.count ?? 0,
      pending: pendingResult.count ?? 0,
      completed: completedResult.count ?? 0,
    },
    error: null,
  }
}

export async function fetchCommercialActivityById(
  client: SupabaseCommercialActivitiesClient,
  id: string
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  const { data, error } = await client
    .from("commercial_activities")
    .select(ACTIVITY_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Actividad no encontrada." },
    }
  }

  return { data: mapCommercialActivityListItem(data), error: null }
}

export async function insertCommercialActivity(
  client: SupabaseCommercialActivitiesClient,
  payload: CreateCommercialActivityPayload
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  if (!payload.title?.trim()) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Ingrese el título de la actividad." },
    }
  }

  let activityTypeId = payload.activityTypeId?.trim() ?? ""
  if (!activityTypeId && payload.activityTypeCode) {
    const typeResult = await fetchCommercialActivityTypeByCode(
      client,
      payload.activityTypeCode
    )
    if (typeResult.error || !typeResult.data) {
      return {
        data: null,
        error: typeResult.error ?? {
          code: "VALIDATION",
          message: "Tipo de actividad inválido.",
        },
      }
    }
    activityTypeId = typeResult.data.id
  }

  if (!activityTypeId) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Seleccione un tipo de actividad." },
    }
  }

  const { commitment, ...activityPayload } = payload

  const { data, error } = await client
    .from("commercial_activities")
    .insert(
      mapCreateCommercialActivityPayloadToInsert({
        ...activityPayload,
        activityTypeId,
      })
    )
    .select(ACTIVITY_SELECT)
    .single()

  if (error || !data) {
    return { data: null, error: mapError(error ?? { message: "Error al crear." }) }
  }

  let activity = mapCommercialActivityListItem(data)

  if (commitment?.title.trim() && commitment.dueAt) {
    const commitmentResult = await insertCommercialCommitment(client, {
      companyId: activity.companyId,
      opportunityId: activity.opportunityId,
      activityId: activity.id,
      title: commitment.title,
      description: commitment.description,
      assignedEmployeeId:
        commitment.assignedEmployeeId ?? activity.employeeId ?? null,
      dueAt: commitment.dueAt,
      priority: commitment.priority ?? "media",
      createdBy: activity.createdBy,
    })

    if (commitmentResult.data) {
      const nextStep = {
        commitmentId: commitmentResult.data.id,
        title: commitmentResult.data.title,
        dueAt: commitmentResult.data.dueAt,
        priority: commitmentResult.data.priority,
        assignedEmployeeId: commitmentResult.data.assignedEmployeeId,
      }
      const metadata = {
        ...(activity.metadata ?? {}),
        nextStep,
      }
      const patched = await patchCommercialActivity(client, activity.id, {
        metadata,
        updatedBy: activity.createdBy,
      })
      if (patched.data) {
        activity = patched.data
      } else {
        activity = { ...activity, metadata }
      }
    }
  }

  return { data: activity, error: null }
}

export async function patchCommercialActivity(
  client: SupabaseCommercialActivitiesClient,
  id: string,
  payload: UpdateCommercialActivityPayload
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  let resolved = { ...payload }
  if (!resolved.activityTypeId && resolved.activityTypeCode) {
    const typeResult = await fetchCommercialActivityTypeByCode(
      client,
      resolved.activityTypeCode
    )
    if (typeResult.error || !typeResult.data) {
      return {
        data: null,
        error: typeResult.error ?? {
          code: "VALIDATION",
          message: "Tipo de actividad inválido.",
        },
      }
    }
    resolved = { ...resolved, activityTypeId: typeResult.data.id }
  }

  const update = mapUpdateCommercialActivityPayloadToUpdate(resolved)
  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "No hay cambios para guardar." },
    }
  }

  const { data, error } = await client
    .from("commercial_activities")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select(ACTIVITY_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Actividad no encontrada." },
    }
  }

  return { data: mapCommercialActivityListItem(data), error: null }
}

export async function softDeleteCommercialActivity(
  client: SupabaseCommercialActivitiesClient,
  id: string,
  deletedBy?: string | null
): Promise<CommercialActivityRepositoryResult<CommercialActivity>> {
  const { data, error } = await client
    .from("commercial_activities")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Actividad no encontrada." },
    }
  }

  return { data: mapCommercialActivityRow(data), error: null }
}
