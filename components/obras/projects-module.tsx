"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { NewProjectDialog } from "@/components/obras/new-project-dialog"
import { ProjectsOperationalList } from "@/components/obras/projects-operational-list"
import { ProjectsOperationalSummary } from "@/components/obras/projects-operational-summary"
import {
  defaultProjectFilters,
  filterProjects,
  ProjectsFilters,
} from "@/components/obras/projects-filters"
import { useProjects } from "@/components/obras/projects-provider"
import {
  ProjectsUIProvider,
  useProjectsUI,
} from "@/components/obras/projects-ui-provider"
import {
  parseProjectHealthQuery,
  parseProjectOperationalCategoryQuery,
  parseProjectStatusQuery,
} from "@/lib/navigation/query-filters"
import type { ProjectStatus } from "@/lib/types/projects"

export function ProjectsModule() {
  return (
    <ProjectsUIProvider>
      <ProjectsModuleContent />
    </ProjectsUIProvider>
  )
}

function ProjectsModuleContent() {
  const searchParams = useSearchParams()
  const { projects, addProject } = useProjects()
  const {
    filteredProjects: categoryFilteredProjects,
    selectCategory,
    closeCategory,
    metricsByProjectId,
  } = useProjectsUI()
  const [filters, setFilters] = useState(defaultProjectFilters)

  useEffect(() => {
    const status = parseProjectStatusQuery(searchParams.get("status"))
    const health = parseProjectHealthQuery(searchParams.get("health"))
    const category = parseProjectOperationalCategoryQuery(
      searchParams.get("category")
    )

    setFilters((current) => ({
      ...current,
      ...(status !== "all" ? { status } : {}),
      ...(health !== "all" ? { health } : {}),
    }))

    if (category) {
      selectCategory(category)
    }
  }, [searchParams, selectCategory])

  function handleStatusKpiChange(status: ProjectStatus | "all") {
    closeCategory()
    setFilters((current) => ({
      ...current,
      status,
    }))
  }

  const displayedProjects = useMemo(() => {
    const filtered = filterProjects(categoryFilteredProjects, filters)

    if (filters.health === "all") {
      return filtered
    }

    return filtered.filter((project) => {
      const metrics = metricsByProjectId.get(project.id)
      return metrics?.health === filters.health
    })
  }, [categoryFilteredProjects, filters, metricsByProjectId])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Obras
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Centro operativo de obras y órdenes de trabajo.
          </p>
        </div>
        <NewProjectDialog onSubmit={addProject} />
      </div>

      <ProjectsOperationalSummary
        activeStatusFilter={filters.status}
        onStatusFilterChange={handleStatusKpiChange}
      />

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <ProjectsFilters
          filters={filters}
          onChange={setFilters}
          resultCount={displayedProjects.length}
          operationalMode
        />

        <ProjectsOperationalList projects={displayedProjects} />
      </div>
    </div>
  )
}
