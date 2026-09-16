import { createClient } from "@/lib/supabase/client"
import {
  fetchProjectDesignOtProposals,
  insertProjectDesignOtProposal,
  insertProjectDesignOtProposals,
  patchProjectDesignOtProposal,
  type ProjectDesignOtRepositoryResult,
  type SupabaseProjectDesignOtClient,
} from "@/lib/supabase/project-design-ot.queries"
import type {
  CreateProjectDesignOtProposalInput,
  ProjectDesignOtProposal,
  UpdateProjectDesignOtProposalInput,
} from "@/lib/types/project-design-ot"

export function createBrowserProjectDesignOtClient(): SupabaseProjectDesignOtClient {
  return createClient()
}

export async function listProjectDesignOtProposals(
  companyId: string,
  projectId: string,
  client: SupabaseProjectDesignOtClient = createBrowserProjectDesignOtClient()
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal[]>> {
  return fetchProjectDesignOtProposals(client, companyId, projectId)
}

export async function createProjectDesignOtProposal(
  companyId: string,
  projectId: string,
  input: CreateProjectDesignOtProposalInput,
  client: SupabaseProjectDesignOtClient = createBrowserProjectDesignOtClient()
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal>> {
  return insertProjectDesignOtProposal(client, companyId, projectId, input)
}

export async function createProjectDesignOtProposals(
  companyId: string,
  projectId: string,
  inputs: CreateProjectDesignOtProposalInput[],
  client: SupabaseProjectDesignOtClient = createBrowserProjectDesignOtClient()
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal[]>> {
  return insertProjectDesignOtProposals(client, companyId, projectId, inputs)
}

export async function updateProjectDesignOtProposal(
  companyId: string,
  projectId: string,
  proposalId: string,
  input: UpdateProjectDesignOtProposalInput,
  client: SupabaseProjectDesignOtClient = createBrowserProjectDesignOtClient()
): Promise<ProjectDesignOtRepositoryResult<ProjectDesignOtProposal>> {
  return patchProjectDesignOtProposal(
    client,
    companyId,
    projectId,
    proposalId,
    input
  )
}
