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
import {
  appendHistoryEvent,
  buildPauseHistory,
  buildProjectUpdatePayloadForPause,
  buildProjectUpdatePayloadForResume,
  buildStatusChangeHistory,
  createHistoryEvent,
  mergeProjectPauseFields,
} from "@/lib/projects/history"
import { canTransitionProjectStatus } from "@/lib/projects/utils"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import {
  archiveProject as archiveProjectInSupabase,
  createBrowserProjectsClient,
  createProject,
  createProjectHistoryEvent,
  getProjectHistory,
  listProjects,
  updateProject as updateProjectInSupabase,
} from "@/lib/supabase/projects.browser"
import type { UpdateProjectPayload } from "@/lib/types/supabase/projects"
import type {
  NewProjectInput,
  PauseProjectInput,
  Project,
  ProjectDetail,
  ProjectHistoryEvent,
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
  pauseProject: (
    id: string,
    input: PauseProjectInput
  ) => Promise<ProjectMutationResult>
  resumeProject: (id: string) => Promise<ProjectMutationResult>
  finalizeProject: (id: string) => Promise<ProjectMutationResult>
  archiveProject: (id: string) => Promise<ProjectMutationResult>
  reopenProject: (id: string) => Promise<ProjectMutationResult>
  getProject: (id: string) => Project | undefined
  getDetail: (id: string) => ProjectDetail | undefined
  getHistory: (id: string) => ProjectHistoryEvent[]
  loadHistory: (id: string) => Promise<ProjectHistoryEvent[]>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

const detailCache = new Map<string, ProjectDetail>()
const historyCache = new Map<string, ProjectHistoryEvent[]>()

function cacheProjectDetail(project: Project) {
  const existing = detailCache.get(project.id)
  const detail = existing
    ? { ...existing, stats: { ...existing.stats, progress: project.progress } }
    : createProjectDetail(project)
  detailCache.set(project.id, detail)
  return detail
}

function mergeProjectUpdate(project: Project, payload: UpdateProjectPayload): Project {
  const merged = mergeProjectPauseFields(project, payload)

  return {
    ...merged,
    ...(payload.code !== undefined ? { code: payload.code } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.client !== undefined ? { client: payload.client } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
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

  const persistHistoryEvent = useCallback(
    async (projectId: string, event: ProjectHistoryEvent) => {
      historyCache.set(
        projectId,
        appendHistoryEvent(historyCache.get(projectId) ?? [], event)
      )

      const detail = detailCache.get(projectId)
      if (detail) {
        detailCache.set(projectId, {
          ...detail,
          history: historyCache.get(projectId) ?? [],
        })
      }

      if (!usesSupabase) return

      try {
        const client = createBrowserProjectsClient()
        await createProjectHistoryEvent(projectId, event, client)
      } catch {
        // Keep local history even if remote persistence fails.
      }
    },
    [usesSupabase]
  )

  const addProject = useCallback(
    async (input: NewProjectInput): Promise<Project> => {
      let project: Project

      if (usesSupabase) {
        try {
          const client = createBrowserProjectsClient()
          const result = await createProject(input, client)

          if (result.data) {
            project = result.data
          } else {
            project = createProjectFromInput(input)
          }
        } catch {
          project = createProjectFromInput(input)
        }
      } else {
        project = createProjectFromInput(input)
      }

      cacheProjectDetail(project)
      setProjects((current) => [project, ...current])

      await persistHistoryEvent(
        project.id,
        createHistoryEvent({
          eventType: "created",
          description: `Obra ${project.code} registrada en el sistema.`,
        })
      )

      return project
    },
    [usesSupabase, persistHistoryEvent]
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

            if (payload.status === undefined) {
              await persistHistoryEvent(
                id,
                createHistoryEvent({
                  eventType: "updated",
                  description: "Se actualizaron los datos operativos de la obra.",
                })
              )
            }

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

      if (payload.status === undefined) {
        await persistHistoryEvent(
          id,
          createHistoryEvent({
            eventType: "updated",
            description: "Se actualizaron los datos operativos de la obra.",
          })
        )
      }

      return { success: true, project: updatedProject }
    },
    [projects, usesSupabase, persistHistoryEvent]
  )

  const transitionProjectStatus = useCallback(
    async (
      id: string,
      newStatus: ProjectStatus,
      historyEventType: ProjectHistoryEvent["eventType"] = "status_changed"
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

      const result = await updateProject(id, { status: newStatus })
      if (!result.success) {
        return result
      }

      await persistHistoryEvent(
        id,
        historyEventType === "status_changed"
          ? buildStatusChangeHistory(existing.status, newStatus)
          : createHistoryEvent({
              eventType: historyEventType,
              description: `Estado actualizado de ${PROJECT_STATUS_LABELS[existing.status]} a ${PROJECT_STATUS_LABELS[newStatus]}.`,
            })
      )

      return result
    },
    [projects, updateProject, persistHistoryEvent]
  )

  const pauseProject = useCallback(
    async (id: string, input: PauseProjectInput) => {
      const existing = projects.find((project) => project.id === id)
      if (!existing) {
        return { success: false, message: "Obra no encontrada." }
      }

      const validation = canTransitionProjectStatus(existing.status, "paused")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const result = await updateProject(
        id,
        buildProjectUpdatePayloadForPause(input)
      )

      if (result.success) {
        await persistHistoryEvent(id, buildPauseHistory(input))
      }

      return result
    },
    [projects, updateProject, persistHistoryEvent]
  )

  const resumeProject = useCallback(
    async (id: string) => {
      const result = await updateProject(id, buildProjectUpdatePayloadForResume())

      if (result.success) {
        await persistHistoryEvent(
          id,
          createHistoryEvent({
            eventType: "resumed",
            description: "La obra reanudó operaciones.",
          })
        )
      }

      return result
    },
    [updateProject, persistHistoryEvent]
  )

  const finalizeProject = useCallback(
    async (id: string) => {
      return transitionProjectStatus(id, "closed", "finalized")
    },
    [transitionProjectStatus]
  )

  const reopenProject = useCallback(
    async (id: string) => {
      const result = await transitionProjectStatus(id, "active", "reopened")
      return result
    },
    [transitionProjectStatus]
  )

  const archiveProject = useCallback(
    async (id: string) => {
      const existing = projects.find((project) => project.id === id)
      if (!existing) {
        return { success: false, message: "Obra no encontrada." }
      }

      if (usesSupabase) {
        try {
          const client = createBrowserProjectsClient()
          const result = await archiveProjectInSupabase(id, client)

          if (result.error) {
            return { success: false, message: result.error.message }
          }
        } catch {
          return { success: false, message: "No se pudo archivar la obra." }
        }
      }

      await persistHistoryEvent(
        id,
        createHistoryEvent({
          eventType: "archived",
          description: "La obra fue archivada y ya no aparece en operaciones activas.",
        })
      )

      setProjects((current) => current.filter((project) => project.id !== id))
      detailCache.delete(id)

      return { success: true }
    },
    [projects, usesSupabase, persistHistoryEvent]
  )

  const loadHistory = useCallback(
    async (id: string) => {
      if (historyCache.has(id)) {
        return historyCache.get(id) ?? []
      }

      if (usesSupabase) {
        try {
          const client = createBrowserProjectsClient()
          const result = await getProjectHistory(id, client)
          if (result.data) {
            historyCache.set(id, result.data)
            return result.data
          }
        } catch {
          // Fall through to mock detail history.
        }
      }

      const project = projects.find((item) => item.id === id)
      if (!project) return []

      const detail = usesSupabase ? createProjectDetail(project) : getProjectDetail(project)
      const history = detail?.history ?? []
      historyCache.set(id, history)
      return history
    },
    [usesSupabase, projects]
  )

  const getHistory = useCallback(
    (id: string) => historyCache.get(id) ?? [],
    []
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
        const detail = detailCache.get(id)!
        return {
          ...detail,
          history: historyCache.get(id) ?? detail.history,
        }
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
      pauseProject,
      resumeProject,
      finalizeProject,
      archiveProject,
      reopenProject,
      getProject,
      getDetail,
      getHistory,
      loadHistory,
    }),
    [
      projects,
      isProjectsReady,
      usesSupabase,
      addProject,
      updateProject,
      transitionProjectStatus,
      pauseProject,
      resumeProject,
      finalizeProject,
      archiveProject,
      reopenProject,
      getProject,
      getDetail,
      getHistory,
      loadHistory,
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
