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
  createBrowserProjectsClient,
  createProject,
  listProjects,
} from "@/lib/supabase/projects.browser"
import type {
  NewProjectInput,
  Project,
  ProjectDetail,
} from "@/lib/types/projects"

type ProjectsContextValue = {
  projects: Project[]
  isProjectsReady: boolean
  usesSupabase: boolean
  addProject: (input: NewProjectInput) => Promise<Project>
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

      const detail = getProjectDetail(project)
      detailCache.set(id, detail)
      return detail
    },
    [projects]
  )

  const value = useMemo(
    () => ({
      projects,
      isProjectsReady,
      usesSupabase,
      addProject,
      getProject,
      getDetail,
    }),
    [projects, isProjectsReady, usesSupabase, addProject, getProject, getDetail]
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
