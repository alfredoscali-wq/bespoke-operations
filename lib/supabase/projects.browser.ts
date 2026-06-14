import { createClient } from "@/lib/supabase/client"
import {
  fetchProjectById,
  fetchProjects,
  insertProject,
  patchProject,
  type SupabaseProjectsClient,
} from "@/lib/supabase/projects.queries"
import type { Project } from "@/lib/types/projects"
import type {
  CreateProjectPayload,
  ProjectsRepositoryResult,
  UpdateProjectPayload,
} from "@/lib/types/supabase/projects"

export function createBrowserProjectsClient(): SupabaseProjectsClient {
  return createClient()
}

export async function listProjects(
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<Project[]>> {
  return fetchProjects(client)
}

export async function getProjectById(
  id: string,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<Project>> {
  return fetchProjectById(client, id)
}

export async function createProject(
  payload: CreateProjectPayload,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<Project>> {
  return insertProject(client, payload)
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<Project>> {
  return patchProject(client, id, payload)
}
