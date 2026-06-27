import { createClient } from "@/lib/supabase/client"
import {
  fetchProjectById,
  fetchProjects,
  fetchProjectHistory,
  insertProject,
  insertProjectHistoryEvent,
  archiveProjectWhenEligible,
  patchProject,
  type SupabaseProjectsClient,
} from "@/lib/supabase/projects.queries"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import type { Project, ProjectHistoryEvent } from "@/lib/types/projects"
import type {
  CreateProjectPayload,
  ProjectsRepositoryResult,
  UpdateProjectPayload,
} from "@/lib/types/supabase/projects"

export function createBrowserProjectsClient(): SupabaseProjectsClient {
  return createClient()
}

export async function listProjects(
  companyId: string,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<Project[]>> {
  return fetchProjects(client, companyId)
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

export async function archiveProject(
  id: string,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<void>> {
  logDeleteTrace("browser.archiveProject", { entity: "project", id })
  return archiveProjectWhenEligible(client, id)
}

export async function getProjectHistory(
  projectId: string,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<ProjectHistoryEvent[]>> {
  return fetchProjectHistory(client, projectId)
}

export async function createProjectHistoryEvent(
  projectId: string,
  event: ProjectHistoryEvent,
  companyId?: string,
  client: SupabaseProjectsClient = createBrowserProjectsClient()
): Promise<ProjectsRepositoryResult<ProjectHistoryEvent>> {
  return insertProjectHistoryEvent(client, projectId, event, companyId)
}
