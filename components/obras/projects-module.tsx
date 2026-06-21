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
import { parseProjectStatusQuery } from "@/lib/navigation/query-filters"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
  const { filteredProjects: categoryFilteredProjects, selectedCategory } =
    useProjectsUI()
  const [filters, setFilters] = useState(defaultProjectFilters)

  useEffect(() => {
    const status = parseProjectStatusQuery(searchParams.get("status"))
    if (status !== "all") {
      setFilters((current) => ({ ...current, status }))
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedCategory) {
      setFilters((current) => ({ ...current, status: "all" }))
    }
  }, [selectedCategory])

  const displayedProjects = useMemo(
    () => filterProjects(categoryFilteredProjects, filters),
    [categoryFilteredProjects, filters]
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Gestión de proyectos de fibra óptica, cámaras, wireless, postes y
          mantenimiento.
        </p>
        <NewProjectDialog onSubmit={addProject} />
      </div>

      <ProjectsOperationalSummary />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b">
          <CardTitle className="text-base">Obras</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <ProjectsFilters
            filters={filters}
            onChange={setFilters}
            resultCount={displayedProjects.length}
            operationalMode
          />

          <ProjectsOperationalList projects={displayedProjects} />
        </CardContent>
      </Card>
    </div>
  )
}
