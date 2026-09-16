import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateElementToInsert,
  mapCreateGainToInsert,
  mapCreateSegmentToInsert,
  mapProjectDesignElementRow,
  mapProjectDesignGainRow,
  mapProjectDesignSegmentRow,
  mapUpdateElementToUpdate,
  mapUpdateGainToUpdate,
  mapUpdateSegmentToUpdate,
} from "@/lib/supabase/project-design.mapper"
import type {
  CreateProjectDesignElementInput,
  CreateProjectDesignGainInput,
  CreateProjectDesignSegmentInput,
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSnapshot,
  UpdateProjectDesignElementInput,
  UpdateProjectDesignGainInput,
  UpdateProjectDesignSegmentInput,
} from "@/lib/types/project-design"

export type SupabaseProjectDesignClient = SupabaseClient<Database>

export type ProjectDesignRepositoryResult<T> = {
  data: T | null
  error: { code: string; message: string } | null
}

function mapDesignError(error: { code?: string; message: string }) {
  const message = error.message ?? ""
  if (
    message.includes("PROJECT_NOT_FOUND") ||
    error.code === "PGRST116" ||
    error.code === "23503"
  ) {
    return { code: "NOT_FOUND" as const, message: "Obra no encontrada." }
  }
  if (
    message.includes("PROJECT_DESIGN_ORIGIN_MISMATCH") ||
    message.includes("PROJECT_DESIGN_DESTINATION_MISMATCH") ||
    message.includes("PROJECT_DESIGN_GAIN_SEGMENT_MISMATCH")
  ) {
    return {
      code: "VALIDATION" as const,
      message: "El origen, destino o traza no pertenece a esta obra.",
    }
  }
  if (message.includes("row-level security") || error.code === "42501") {
    return {
      code: "FORBIDDEN" as const,
      message: "Operación no permitida para esta empresa.",
    }
  }
  if (
    message.includes("PROJECT_DESIGN_GEOMETRY") ||
    error.code === "23514"
  ) {
    return {
      code: "VALIDATION" as const,
      message: "La geometría del tramo no es válida.",
    }
  }
  return { code: "UNKNOWN" as const, message: error.message }
}

export async function fetchProjectDesignSnapshot(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string
): Promise<ProjectDesignRepositoryResult<ProjectDesignSnapshot>> {
  const [elementsResult, segmentsResult, gainsResult] = await Promise.all([
    client
      .from("project_design_elements")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("project_design_segments")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("project_design_gains")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ])

  if (elementsResult.error) {
    return { data: null, error: mapDesignError(elementsResult.error) }
  }
  if (segmentsResult.error) {
    return { data: null, error: mapDesignError(segmentsResult.error) }
  }
  if (gainsResult.error) {
    return { data: null, error: mapDesignError(gainsResult.error) }
  }

  return {
    data: {
      elements: (elementsResult.data ?? []).map(mapProjectDesignElementRow),
      segments: (segmentsResult.data ?? []).map(mapProjectDesignSegmentRow),
      gains: (gainsResult.data ?? []).map(mapProjectDesignGainRow),
    },
    error: null,
  }
}

export async function insertProjectDesignElement(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  input: CreateProjectDesignElementInput
): Promise<ProjectDesignRepositoryResult<ProjectDesignElement>> {
  if (input.companyId !== companyId || input.projectId !== projectId) {
    return {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "El elemento no pertenece a esta obra.",
      },
    }
  }

  const { data, error } = await client
    .from("project_design_elements")
    .insert(mapCreateElementToInsert(input))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  return { data: mapProjectDesignElementRow(data), error: null }
}

export async function patchProjectDesignElement(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  elementId: string,
  input: UpdateProjectDesignElementInput
): Promise<ProjectDesignRepositoryResult<ProjectDesignElement>> {
  const { data, error } = await client
    .from("project_design_elements")
    .update(mapUpdateElementToUpdate(input))
    .eq("id", elementId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Elemento no encontrado." },
    }
  }

  return { data: mapProjectDesignElementRow(data), error: null }
}

export async function deleteProjectDesignElement(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  elementId: string
): Promise<ProjectDesignRepositoryResult<void>> {
  const { data, error } = await client
    .from("project_design_elements")
    .delete()
    .eq("id", elementId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Elemento no encontrado." },
    }
  }

  return { data: null, error: null }
}

export async function insertProjectDesignSegment(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  input: CreateProjectDesignSegmentInput
): Promise<ProjectDesignRepositoryResult<ProjectDesignSegment>> {
  if (input.companyId !== companyId || input.projectId !== projectId) {
    return {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "El tramo no pertenece a esta obra.",
      },
    }
  }

  const { data, error } = await client
    .from("project_design_segments")
    .insert(mapCreateSegmentToInsert(input))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  return { data: mapProjectDesignSegmentRow(data), error: null }
}

export async function patchProjectDesignSegment(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  segmentId: string,
  input: UpdateProjectDesignSegmentInput
): Promise<ProjectDesignRepositoryResult<ProjectDesignSegment>> {
  const { data, error } = await client
    .from("project_design_segments")
    .update(mapUpdateSegmentToUpdate(input))
    .eq("id", segmentId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Tramo no encontrado." },
    }
  }

  return { data: mapProjectDesignSegmentRow(data), error: null }
}

export async function deleteProjectDesignSegment(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  segmentId: string
): Promise<ProjectDesignRepositoryResult<void>> {
  const { data, error } = await client
    .from("project_design_segments")
    .delete()
    .eq("id", segmentId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Tramo no encontrado." },
    }
  }

  return { data: null, error: null }
}

export async function insertProjectDesignGain(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  input: CreateProjectDesignGainInput
): Promise<ProjectDesignRepositoryResult<ProjectDesignGain>> {
  if (input.companyId !== companyId || input.projectId !== projectId) {
    return {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "La ganancia no pertenece a esta obra.",
      },
    }
  }

  const { data, error } = await client
    .from("project_design_gains")
    .insert(mapCreateGainToInsert(input))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  return { data: mapProjectDesignGainRow(data), error: null }
}

export async function patchProjectDesignGain(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  gainId: string,
  input: UpdateProjectDesignGainInput
): Promise<ProjectDesignRepositoryResult<ProjectDesignGain>> {
  const { data, error } = await client
    .from("project_design_gains")
    .update(mapUpdateGainToUpdate(input))
    .eq("id", gainId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Ganancia no encontrada." },
    }
  }

  return { data: mapProjectDesignGainRow(data), error: null }
}

export async function deleteProjectDesignGain(
  client: SupabaseProjectDesignClient,
  companyId: string,
  projectId: string,
  gainId: string
): Promise<ProjectDesignRepositoryResult<void>> {
  const { data, error } = await client
    .from("project_design_gains")
    .delete()
    .eq("id", gainId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapDesignError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Ganancia no encontrada." },
    }
  }

  return { data: null, error: null }
}
