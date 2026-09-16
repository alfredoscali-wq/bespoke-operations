import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateProposalToInsert,
  mapProjectDesignOtProposalRow,
  mapUpdateProposalToUpdate,
} from "@/lib/supabase/project-design-ot.mapper"
import type {
  CreateProjectDesignOtProposalInput,
  ProjectDesignOtProposal,
  UpdateProjectDesignOtProposalInput,
} from "@/lib/types/project-design-ot"

export type SupabaseProjectDesignOtClient = SupabaseClient<Database>

export type ProjectDesignOtRepositoryResult<T> = {
  data: T | null
  error: { code: string; message: string } | null
}

function mapProposalError(error: { code?: string; message: string }) {
  const message = error.message ?? ""
  if (error.code === "23505") {
    return {
      code: "DUPLICATE" as const,
      message: "Ya existe una preliminar activa para este elemento.",
    }
  }
  if (
    message.includes("PROJECT_NOT_FOUND") ||
    error.code === "PGRST116" ||
    error.code === "23503"
  ) {
    return { code: "NOT_FOUND" as const, message: "Obra o elemento no encontrado." }
  }
  if (
    message.includes("PROJECT_DESIGN_OT_SOURCE_MISMATCH") ||
    message.includes("PROJECT_DESIGN_OT_SOURCE_KIND_MISMATCH")
  ) {
    return {
      code: "VALIDATION" as const,
      message: "La preliminar no pertenece a este diseño.",
    }
  }
  if (message.includes("row-level security") || error.code === "42501") {
    return {
      code: "FORBIDDEN" as const,
      message: "Operación no permitida para esta empresa.",
    }
  }
  return { code: "UNKNOWN" as const, message: error.message }
}

export async function fetchProjectDesignOtProposals(
  client: SupabaseProjectDesignOtClient,
  companyId: string,
  projectId: string
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal[]>> {
  const { data, error } = await client
    .from("project_design_ot_proposals")
    .select("*")
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapProposalError(error) }
  }

  return {
    data: (data ?? []).map(mapProjectDesignOtProposalRow),
    error: null,
  }
}

export async function insertProjectDesignOtProposal(
  client: SupabaseProjectDesignOtClient,
  companyId: string,
  projectId: string,
  input: CreateProjectDesignOtProposalInput
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal>> {
  if (input.companyId !== companyId || input.projectId !== projectId) {
    return {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "La preliminar no pertenece a esta obra.",
      },
    }
  }

  const { data, error } = await client
    .from("project_design_ot_proposals")
    .insert(mapCreateProposalToInsert(input))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapProposalError(error) }
  }

  return { data: mapProjectDesignOtProposalRow(data), error: null }
}

export async function insertProjectDesignOtProposals(
  client: SupabaseProjectDesignOtClient,
  companyId: string,
  projectId: string,
  inputs: CreateProjectDesignOtProposalInput[]
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal[]>> {
  if (inputs.length === 0) {
    return { data: [], error: null }
  }

  if (
    inputs.some(
      (input) => input.companyId !== companyId || input.projectId !== projectId
    )
  ) {
    return {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "La preliminar no pertenece a esta obra.",
      },
    }
  }

  const { data, error } = await client
    .from("project_design_ot_proposals")
    .insert(inputs.map(mapCreateProposalToInsert))
    .select("*")

  if (error) {
    return { data: null, error: mapProposalError(error) }
  }

  return {
    data: (data ?? []).map(mapProjectDesignOtProposalRow),
    error: null,
  }
}

export async function patchProjectDesignOtProposal(
  client: SupabaseProjectDesignOtClient,
  companyId: string,
  projectId: string,
  proposalId: string,
  input: UpdateProjectDesignOtProposalInput
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal>> {
  const { data, error } = await client
    .from("project_design_ot_proposals")
    .update(mapUpdateProposalToUpdate(input))
    .eq("id", proposalId)
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapProposalError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Preliminar no encontrada." },
    }
  }

  return { data: mapProjectDesignOtProposalRow(data), error: null }
}
