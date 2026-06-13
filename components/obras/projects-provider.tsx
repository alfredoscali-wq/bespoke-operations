"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import {
  createProjectDetail,
  createProjectFromInput,
  getProjectDetail,
  mockProjects,
} from "@/lib/data/projects"
import type {
  NewProjectInput,
  Project,
  ProjectDetail,
} from "@/lib/types/projects"

type ProjectsContextValue = {
  projects: Project[]
  addProject: (input: NewProjectInput) => Project
  getProject: (id: string) => Project | undefined
  getDetail: (id: string) => ProjectDetail | undefined
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

const detailCache = new Map<string, ProjectDetail>()

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(mockProjects)

  const addProject = useCallback((input: NewProjectInput) => {
    const project = createProjectFromInput(input)
    const detail = createProjectDetail(project)
    detailCache.set(project.id, detail)
    setProjects((current) => [project, ...current])
    return project
  }, [])

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
    () => ({ projects, addProject, getProject, getDetail }),
    [projects, addProject, getProject, getDetail]
  )

  return (
    <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectsContext)
  if (!context) {
    throw new Error("useProjects must be used within ProjectsProvider")
  }
  return context
}
