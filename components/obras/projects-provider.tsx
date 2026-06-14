"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  createProjectDetail,
  createProjectFromInput,
  getProjectDetail,
  mockProjects,
} from "@/lib/data/projects"
import { canTransitionProjectStatus } from "@/lib/projects/utils"
import {
  createBrowserProjectsClient,
  createProject,
  listProjects,
  updateProject as updateProjectInSupabase,
} from "@/lib/supabase/projects.browser"
import type { UpdateProjectPayload } from "@/lib/types/supabase/projects"
import type {
  NewProjectInput,
  Project,
  ProjectDetail,
  ProjectStatus,
} from "@/lib/types/projects"

type ProjectMutationResult = {
  success: boolean
  message?: string
  project?: Project
}

type ProjectsContextValue = {
  projects: Project[]
  isProjectsReady: boolean
  usesSupabase: boolean
  addProject: (input: NewProjectInput) => Promise<Project>
  updateProject: (
    id: string,
    payload: UpdateProjectPayload
  ) => Promise<ProjectMutationResult>
  transitionProjectStatus: (
    id: string,
    newStatus: ProjectStatus
  ) => Promise<ProjectMutationResult>
  getProject: (id: string) => Project | undefined
  getDetail: (id: string) => ProjectDetail | undefined
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

const detailCache = new Map<string, ProjectDetail>()

function cacheProjectDetail(project: Project) {
  const detail = createProjectDetail(project)
  detailCache.set(project.id, detail)
  return detail
}

function mergeProjectUpdate(project: Project, payload: UpdateProjectPayload): Project {
  return {
    ...project,
    ...(payload.code !== undefined ? { code: payload.code } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.client !== undefined ? { client: payload.client } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
    ...(payload.startDate !== undefined
      ? { startDate: payload.startDate ?? undefined }
      : {}),
    ...(payload.endDate !== undefined
      ? { endDate: payload.endDate ?? undefined }
      : {}),
    ...(payload.supervisor !== undefined ? { supervisor: payload.supervisor } : {}),
    ...(payload.location !== undefined ? { location: payload.location } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
  }
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isProjectsReady, setIsProjectsReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProjectsFromSupabase() {
      try {
        const client = createBrowserProjectsClient()
        const result = await listProjects(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          setProjects(mockProjects)
          setUsesSupabase(false)
          return
        }

        setProjects(result.data)
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setProjects(mockProjects)
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsProjectsReady(true)
        }
      }
    }

    void loadProjectsFromSupabase()

    return () => {
      cancelled = true
    }
  }, [])

  const addProject = useCallback(
    async (input: NewProjectInput): Promise<Project> => {
      if (usesSupabase) {
        try {
          const client = createBrowserProjectsClient()
          const result = await createProject(input, client)

          if (result.data) {
            cacheProjectDetail(result.data)
            setProjects((current) => [result.data!, ...current])
            return result.data
          }
        } catch {
          // Fall through to in-memory mock create for this session.
        }
      }

      const project = createProjectFromInput(input)
      cacheProjectDetail(project)
      setProjects((current) => [project, ...current])
      return project
    },
    [usesSupabase]
  )

  const updateProject = useCallback(
    async (
      id: string,
      payload: UpdateProjectPayload
    ): Promise<ProjectMutationResult> => {
      const existing = projects.find((project) => project.id === id)
      if (!existing) {
        return { success: false, message: "Obra no encontrada." }
      }

      if (usesSupabase) {
        try {
          const client = createBrowserProjectsClient()
          const result = await updateProjectInSupabase(id, payload, client)

          if (result.data) {
            cacheProjectDetail(result.data)
            setProjects((current) =>
              current.map((project) =>
                project.id === id ? result.data! : project
              )
            )
            return { success: true, project: result.data }
          }

          if (result.error) {
            return { success: false, message: result.error.message }
          }
        } catch {
          // Fall through to in-memory update for this session.
        }
      }

      const updatedProject = mergeProjectUpdate(existing, payload)
      cacheProjectDetail(updatedProject)
      setProjects((current) =>
        current.map((project) => (project.id === id ? updatedProject : project))
      )

      return { success: true, project: updatedProject }
    },
    [projects, usesSupabase]
  )

  const transitionProjectStatus = useCallback(
    async (
      id: string,
      newStatus: ProjectStatus
    ): Promise<ProjectMutationResult> => {
      const existing = projects.find((project) => project.id === id)
      if (!existing) {
        return { success: false, message: "Obra no encontrada." }
      }

      const validation = canTransitionProjectStatus(existing.status, newStatus)
      if (!validation.allowed) {
        return {
          success: false,
          message: validation.message ?? "Transición no permitida.",
        }
      }

      return updateProject(id, { status: newStatus })
    },
    [projects, updateProject]
  )

  const getProject = useCallback(
    (id: string) => projects.find((project) => project.id === id),
    [projects]
  )

  const getDetail = useCallback(
    (id: string) => {
      const project = projects.find((item) => item.id === id)
      if (!project) return undefined

      if (detailCache.has(id)) {
        return detailCache.get(id)
      }

      const detail = usesSupabase
        ? createProjectDetail(project)
        : getProjectDetail(project)
      detailCache.set(id, detail)
      return detail
    },
    [projects, usesSupabase]
  )

  const value = useMemo(
    () => ({
      projects,
      isProjectsReady,
      usesSupabase,
      addProject,
      updateProject,
      transitionProjectStatus,
      getProject,
      getDetail,
    }),
    [
      projects,
      isProjectsReady,
      usesSupabase,
      addProject,
      updateProject,
      transitionProjectStatus,
      getProject,
      getDetail,
    ]
  )

  return (
    <ProjectsContext.Provider value={value}>
      {isProjectsReady ? children : null}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectsContext)
  if (!context) {
    throw new Error("useProjects must be used within ProjectsProvider")
  }
  return context
}
