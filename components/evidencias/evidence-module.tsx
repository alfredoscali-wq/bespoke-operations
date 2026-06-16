"use client"

import { useMemo, useState } from "react"

import { useEvidence } from "@/components/evidencias/evidence-provider"
import { EvidenceFiltersBar } from "@/components/evidencias/evidence-filters"
import { EvidenceSummaryCards } from "@/components/evidencias/evidence-summary-cards"
import { EvidenceTable } from "@/components/evidencias/evidence-table"
import { EvidenceUploadDialog } from "@/components/evidencias/evidence-upload-dialog"
import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  defaultEvidenceFilters,
  filterEvidence,
} from "@/lib/data/evidence"
import { getActiveEvidence } from "@/lib/evidence/utils"
import { getTasksForProject } from "@/lib/tasks/utils"
import type { EvidenceFilters } from "@/lib/types/evidence"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EvidenceModuleProps = {
  initialFilters?: EvidenceFilters
}

export function EvidenceModule({ initialFilters }: EvidenceModuleProps) {
  const { evidence, uploadEvidence } = useEvidence()
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const [filters, setFilters] = useState<EvidenceFilters>(
    initialFilters ?? defaultEvidenceFilters
  )

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
      })),
    [projects]
  )

  const taskOptions = useMemo(() => {
    if (filters.projectId === "all") {
      return tasks.map((task) => ({
        id: task.id,
        code: task.code,
        title: task.title,
      }))
    }

    const project = projects.find((item) => item.id === filters.projectId)
    if (!project) {
      return tasks.map((task) => ({
        id: task.id,
        code: task.code,
        title: task.title,
      }))
    }

    return getTasksForProject(project, tasks).map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
    }))
  }, [filters.projectId, projects, tasks])

  function handleFiltersChange(nextFilters: EvidenceFilters) {
    if (
      nextFilters.projectId !== filters.projectId &&
      nextFilters.taskId !== "all"
    ) {
      const project =
        nextFilters.projectId === "all"
          ? undefined
          : projects.find((item) => item.id === nextFilters.projectId)
      const taskStillValid =
        !project ||
        getTasksForProject(project, tasks).some(
          (task) => task.id === nextFilters.taskId
        )

      setFilters({
        ...nextFilters,
        taskId: taskStillValid ? nextFilters.taskId : "all",
      })
      return
    }

    setFilters(nextFilters)
  }

  const filteredEvidence = useMemo(
    () => filterEvidence(evidence, filters),
    [evidence, filters]
  )

  return (
    <div className="space-y-8">
      <EvidenceSummaryCards evidence={getActiveEvidence(evidence)} />

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
          <CardTitle className="text-base">Expediente de evidencias</CardTitle>
          <EvidenceUploadDialog onSubmit={uploadEvidence} />
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <EvidenceFiltersBar
            filters={filters}
            onChange={handleFiltersChange}
            resultCount={filteredEvidence.length}
            projects={projectOptions}
            tasks={taskOptions}
          />
          <EvidenceTable evidence={filteredEvidence} />
        </CardContent>
      </Card>
    </div>
  )
}
