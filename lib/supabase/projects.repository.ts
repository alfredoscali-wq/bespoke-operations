import { createClient } from "@/lib/supabase/server"
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

async function createServerProjectsClient(): Promise<SupabaseProjectsClient> {
  return createClient()
}

export async function listProjects(
  client?: SupabaseProjectsClient
): Promise<ProjectsRepositoryResult<Project[]>> {
  return fetchProjects(client ?? (await createServerProjectsClient()))
}

export async function getProjectById(
  id: string,
  client?: SupabaseProjectsClient
): Promise<ProjectsRepositoryResult<Project>> {
  return fetchProjectById(client ?? (await createServerProjectsClient()), id)
}

export async function createProject(
  payload: CreateProjectPayload,
  client?: SupabaseProjectsClient
): Promise<ProjectsRepositoryResult<Project>> {
  return insertProject(client ?? (await createServerProjectsClient()), payload)
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
  client?: SupabaseProjectsClient
): Promise<ProjectsRepositoryResult<Project>> {
  return patchProject(
    client ?? (await createServerProjectsClient()),
    id,
    payload
  )
}

export { createBrowserProjectsClient } from "@/lib/supabase/projects.browser"
