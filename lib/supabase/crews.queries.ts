import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateMemberPayloadToInsert,
  mapCreatePayloadToInsert,
  mapCrewMemberRowToMember,
  mapCrewRowToCrew,
  mapUpdateMemberPayloadToUpdate,
  mapUpdatePayloadToUpdate,
  type CrewRowWithMembers,
} from "@/lib/supabase/crews.mapper"
import type { Crew, CrewMember } from "@/lib/types/crews"
import type {
  CreateCrewMemberPayload,
  CreateCrewPayload,
  CrewsRepositoryResult,
  UpdateCrewMemberPayload,
  UpdateCrewPayload,
} from "@/lib/types/supabase/crews"

export type SupabaseCrewsClient = SupabaseClient<Database>

const CREW_SELECT = "*, crew_members (*)"

export function mapSupabaseCrewError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23505") {
    const message = error.message.toLowerCase()

    if (message.includes("crew_members_crew_employee_unique")) {
      return {
        code: "DUPLICATE_EMPLOYEE" as const,
        message: "Este empleado ya está asignado a la cuadrilla.",
      }
    }

    if (message.includes("crews_company_name")) {
      return {
        code: "DUPLICATE_NAME" as const,
        message: "Ya existe una cuadrilla con ese nombre.",
      }
    }

    return {
      code: "DUPLICATE_NAME" as const,
      message: "Ya existe un registro duplicado.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchCrews(
  client: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<Crew[]>> {
  const { data, error } = await client
    .from("crews")
    .select(CREW_SELECT)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  return {
    data: (data ?? []).map((row) =>
      mapCrewRowToCrew(row as CrewRowWithMembers)
    ),
    error: null,
  }
}

export async function fetchCrewById(
  client: SupabaseCrewsClient,
  id: string
): Promise<CrewsRepositoryResult<Crew>> {
  const { data, error } = await client
    .from("crews")
    .select(CREW_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Cuadrilla no encontrada.",
      },
    }
  }

  return {
    data: mapCrewRowToCrew(data as CrewRowWithMembers),
    error: null,
  }
}

export async function insertCrew(
  client: SupabaseCrewsClient,
  payload: CreateCrewPayload
): Promise<CrewsRepositoryResult<Crew>> {
  const { data, error } = await client
    .from("crews")
    .insert(mapCreatePayloadToInsert(payload))
    .select(CREW_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  return {
    data: mapCrewRowToCrew(data as CrewRowWithMembers),
    error: null,
  }
}

export async function patchCrew(
  client: SupabaseCrewsClient,
  id: string,
  payload: UpdateCrewPayload
): Promise<CrewsRepositoryResult<Crew>> {
  const update = mapUpdatePayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("crews")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select(CREW_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Cuadrilla no encontrada.",
      },
    }
  }

  return {
    data: mapCrewRowToCrew(data as CrewRowWithMembers),
    error: null,
  }
}

export async function softDeleteCrew(
  client: SupabaseCrewsClient,
  id: string
): Promise<CrewsRepositoryResult<void>> {
  const { error } = await client
    .from("crews")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  return { data: undefined, error: null }
}

export async function insertCrewMember(
  client: SupabaseCrewsClient,
  payload: CreateCrewMemberPayload
): Promise<CrewsRepositoryResult<CrewMember>> {
  const { data, error } = await client
    .from("crew_members")
    .insert(mapCreateMemberPayloadToInsert(payload))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  return { data: mapCrewMemberRowToMember(data), error: null }
}

export async function patchCrewMember(
  client: SupabaseCrewsClient,
  id: string,
  payload: UpdateCrewMemberPayload
): Promise<CrewsRepositoryResult<CrewMember>> {
  const update = mapUpdateMemberPayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("crew_members")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Integrante no encontrado.",
      },
    }
  }

  return { data: mapCrewMemberRowToMember(data), error: null }
}

export async function softDeleteCrewMember(
  client: SupabaseCrewsClient,
  id: string
): Promise<CrewsRepositoryResult<void>> {
  const { error } = await client
    .from("crew_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseCrewError(error) }
  }

  return { data: undefined, error: null }
}
