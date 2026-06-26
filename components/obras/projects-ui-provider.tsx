"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  countProjectsByOperationalCategory,
  filterProjectsByOperationalCategory,
  type OperationalProjectCategory,
} from "@/lib/projects/operational-project-category"
import {
  buildProjectOperationalMetricsMap,
  type ProjectOperationalMetrics,
} from "@/lib/projects/project-operational-metrics"
import {
  buildProjectsOperationalSummary,
  projectOperationalMetricsMapToRecord,
  type ProjectsOperationalSummary as ProjectsManagementSummary,
} from "@/lib/projects/project-operational-summary"
import type { Project } from "@/lib/types/projects"

type ProjectsUIContextValue = {
  selectedCategory: OperationalProjectCategory | null
  openCategory: (category: OperationalProjectCategory) => void
  selectCategory: (category: OperationalProjectCategory | null) => void
  closeCategory: () => void
  filteredProjects: Project[]
  operationalSummary: Record<OperationalProjectCategory, number>
  metricsByProjectId: Map<string, ProjectOperationalMetrics>
  managementSummary: ProjectsManagementSummary
}

const ProjectsUIContext = createContext<ProjectsUIContextValue | null>(null)

export function ProjectsUIProvider({ children }: { children: React.ReactNode }) {
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const [selectedCategory, setSelectedCategory] =
    useState<OperationalProjectCategory | null>(null)

  const operationalSummary = useMemo(
    () => countProjectsByOperationalCategory(projects, tasks),
    [projects, tasks]
  )

  const metricsByProjectId = useMemo(
    () => buildProjectOperationalMetricsMap(projects, tasks),
    [projects, tasks]
  )

  const managementSummary = useMemo(
    () =>
      buildProjectsOperationalSummary(
        projectOperationalMetricsMapToRecord(metricsByProjectId)
      ),
    [metricsByProjectId]
  )

  const filteredProjects = useMemo(() => {
    if (!selectedCategory) {
      return projects
    }

    return filterProjectsByOperationalCategory(
      projects,
      selectedCategory,
      tasks
    )
  }, [projects, selectedCategory, tasks])

  const openCategory = useCallback((category: OperationalProjectCategory) => {
    setSelectedCategory((current) => (current === category ? null : category))
  }, [])

  const selectCategory = useCallback(
    (category: OperationalProjectCategory | null) => {
      setSelectedCategory(category)
    },
    []
  )

  const closeCategory = useCallback(() => {
    setSelectedCategory(null)
  }, [])

  const value = useMemo(
    () => ({
      selectedCategory,
      openCategory,
      selectCategory,
      closeCategory,
      filteredProjects,
      operationalSummary,
      metricsByProjectId,
      managementSummary,
    }),
    [
      selectedCategory,
      openCategory,
      selectCategory,
      closeCategory,
      filteredProjects,
      operationalSummary,
      metricsByProjectId,
      managementSummary,
    ]
  )

  return (
    <ProjectsUIContext.Provider value={value}>
      {children}
    </ProjectsUIContext.Provider>
  )
}

export function useProjectsUI() {
  const context = useContext(ProjectsUIContext)

  if (!context) {
    throw new Error("useProjectsUI must be used within ProjectsUIProvider")
  }

  return context
}
