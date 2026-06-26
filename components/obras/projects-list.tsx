"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import {
  defaultProjectFilters,
  filterProjects,
  ProjectsFilters,
} from "@/components/obras/projects-filters"
import { NewProjectDialog } from "@/components/obras/new-project-dialog"
import { useProjects } from "@/components/obras/projects-provider"
import { ProjectsTable } from "@/components/obras/projects-table"
import { parseProjectStatusQuery } from "@/lib/navigation/query-filters"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ProjectsList() {
  const searchParams = useSearchParams()
  const { projects, addProject } = useProjects()
  const [filters, setFilters] = useState(defaultProjectFilters)

  useEffect(() => {
    const status = parseProjectStatusQuery(searchParams.get("status"))
    if (status !== "all") {
      setFilters((current) => ({ ...current, status }))
    }
  }, [searchParams])

  const filteredProjects = useMemo(
    () => filterProjects(projects, filters),
    [projects, filters]
  )

  const summary = useMemo(() => {
    const active = projects.filter((project) => project.status === "active").length
    const planned = projects.filter((project) => project.status === "planned").length
    const avgProgress = Math.round(
      projects.reduce((sum, project) => sum + project.progress, 0) /
        Math.max(projects.length, 1)
    )

    return { total: projects.length, active, planned, avgProgress }
  }, [projects])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Gestión de obras de fibra óptica, cámaras, wireless, postes y
          mantenimiento.
        </p>
        <NewProjectDialog onSubmit={addProject} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm" className="shadow-sm">
          <CardHeader className="pb-1">
            <CardDescription>Total de obras</CardDescription>
            <CardTitle className="text-2xl">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="shadow-sm">
          <CardHeader className="pb-1">
            <CardDescription>Obras activas</CardDescription>
            <CardTitle className="text-2xl">{summary.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="shadow-sm">
          <CardHeader className="pb-1">
            <CardDescription>Planificadas</CardDescription>
            <CardTitle className="text-2xl">{summary.planned}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="shadow-sm">
          <CardHeader className="pb-1">
            <CardDescription>Avance promedio</CardDescription>
            <CardTitle className="text-2xl">{summary.avgProgress}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Listado de obras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProjectsFilters
            filters={filters}
            onChange={setFilters}
            resultCount={filteredProjects.length}
          />
          <ProjectsTable projects={filteredProjects} />
        </CardContent>
      </Card>
    </div>
  )
}
