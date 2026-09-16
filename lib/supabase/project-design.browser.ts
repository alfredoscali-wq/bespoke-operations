import { createClient } from "@/lib/supabase/client"
import {
  deleteProjectDesignElement,
  deleteProjectDesignGain,
  deleteProjectDesignSegment,
  fetchProjectDesignSnapshot,
  insertProjectDesignElement,
  insertProjectDesignGain,
  insertProjectDesignSegment,
  patchProjectDesignElement,
  patchProjectDesignGain,
  patchProjectDesignSegment,
  type SupabaseProjectDesignClient,
} from "@/lib/supabase/project-design.queries"
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
import type { ProjectDesignRepositoryResult } from "@/lib/supabase/project-design.queries"

export function createBrowserProjectDesignClient(): SupabaseProjectDesignClient {
  return createClient()
}

export async function listProjectDesign(
  companyId: string,
  projectId: string,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignSnapshot>> {
  return fetchProjectDesignSnapshot(client, companyId, projectId)
}

export async function createProjectDesignElement(
  companyId: string,
  projectId: string,
  input: CreateProjectDesignElementInput,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignElement>> {
  return insertProjectDesignElement(client, companyId, projectId, input)
}

export async function updateProjectDesignElement(
  companyId: string,
  projectId: string,
  elementId: string,
  input: UpdateProjectDesignElementInput,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignElement>> {
  return patchProjectDesignElement(client, companyId, projectId, elementId, input)
}

export async function removeProjectDesignElement(
  companyId: string,
  projectId: string,
  elementId: string,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<void>> {
  return deleteProjectDesignElement(client, companyId, projectId, elementId)
}

export async function createProjectDesignSegment(
  companyId: string,
  projectId: string,
  input: CreateProjectDesignSegmentInput,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignSegment>> {
  return insertProjectDesignSegment(client, companyId, projectId, input)
}

export async function updateProjectDesignSegment(
  companyId: string,
  projectId: string,
  segmentId: string,
  input: UpdateProjectDesignSegmentInput,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignSegment>> {
  return patchProjectDesignSegment(client, companyId, projectId, segmentId, input)
}

export async function removeProjectDesignSegment(
  companyId: string,
  projectId: string,
  segmentId: string,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<void>> {
  return deleteProjectDesignSegment(client, companyId, projectId, segmentId)
}

export async function createProjectDesignGain(
  companyId: string,
  projectId: string,
  input: CreateProjectDesignGainInput,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignGain>> {
  return insertProjectDesignGain(client, companyId, projectId, input)
}

export async function updateProjectDesignGain(
  companyId: string,
  projectId: string,
  gainId: string,
  input: UpdateProjectDesignGainInput,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<ProjectDesignGain>> {
  return patchProjectDesignGain(client, companyId, projectId, gainId, input)
}

export async function removeProjectDesignGain(
  companyId: string,
  projectId: string,
  gainId: string,
  client: SupabaseProjectDesignClient = createBrowserProjectDesignClient()
): Promise<ProjectDesignRepositoryResult<void>> {
  return deleteProjectDesignGain(client, companyId, projectId, gainId)
}
