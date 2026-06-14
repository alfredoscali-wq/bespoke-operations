"use client"

import { useEffect, useMemo, useState } from "react"
import { LayoutGrid, List, Plus } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskFormDialog, taskDefaultChecklist } from "@/components/tareas/task-form-dialog"
import { TasksSummaryCards } from "@/components/tareas/tasks-summary-cards"
import {
  TasksFiltersBar,
  defaultTaskFilters,
  filterAndSortTasks,
} from "@/components/tareas/tasks-filters"
import { TasksKanban } from "@/components/tareas/tasks-kanban"
import { TasksListTable } from "@/components/tareas/tasks-list-table"
import type { TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type ViewMode = "kanban" | "list"

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return "kanban"
  }

  return window.matchMedia("(max-width: 1023px)").matches ? "list" : "kanban"
}

export function TasksModule() {
  const { tasks, addTask } = useTasks()
  const { crews } = useCrews()
  const crewOptions = useMemo(
    () => crews.map((crew) => crew.name).sort((a, b) => a.localeCompare(b, "es")),
    [crews]
  )
  const [view, setView] = useState<ViewMode>("kanban")
  const [viewInitialized, setViewInitialized] = useState(false)
  const [filters, setFilters] = useState(defaultTaskFilters)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    setView(getInitialViewMode())
    setViewInitialized(true)
  }, [])

  const filteredTasks = useMemo(
    () => filterAndSortTasks(tasks, filters),
    [tasks, filters]
  )

  async function handleCreateTask(payload: {
    operationMode: "obra" | "servicio"
    code: string
    title: string
    description: string
    projectId?: string | null
    projectCode: string
    projectName: string
    customerCompany?: string
    customerName?: string
    customerPhone?: string
    serviceAddress?: string
    workOrderNumber?: string
    type: TaskType
    status: TaskStatus
    priority: TaskPriority
    supervisor: string
    crew: string
    startDate: string
    dueDate: string
    estimatedDuration: string
  }) {
    const selectedCrew = crews.find((crew) => crew.name === payload.crew)

    await addTask({
      code: payload.code,
      title: payload.title,
      description: payload.description,
      projectId: payload.projectId ?? undefined,
      projectCode: payload.projectCode,
      projectName: payload.projectName,
      customerCompany: payload.customerCompany,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      serviceAddress: payload.serviceAddress,
      workOrderNumber: payload.workOrderNumber,
      type: payload.type,
      status: payload.status,
      priority: payload.priority,
      supervisor: payload.supervisor,
      crewId: selectedCrew?.id,
      crew: payload.crew,
      startDate: payload.startDate,
      dueDate: payload.dueDate,
      estimatedDuration: payload.estimatedDuration,
      checklist: taskDefaultChecklist,
    })

    setFeedback(
      payload.operationMode === "servicio"
        ? "Servicio de campo creado correctamente."
        : "Tarea de obra creada correctamente."
    )
  }

  if (!viewInitialized) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {feedback && (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5 self-start"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="size-4" />
          Nueva tarea
        </Button>
      </div>

      <TasksSummaryCards tasks={tasks} />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {view === "kanban" ? "Tablero Kanban" : "Listado de tareas"}
          </CardTitle>

          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="size-3.5" />
              Kanban
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              onClick={() => setView("list")}
            >
              <List className="size-3.5" />
              Lista
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <TasksFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredTasks.length}
            showSort={view === "list"}
            crewOptions={crewOptions}
          />

          {view === "kanban" ? (
            <TasksKanban tasks={filteredTasks} />
          ) : (
            <TasksListTable tasks={filteredTasks} />
          )}
        </CardContent>
      </Card>

      <TaskFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        existingTasks={tasks}
        onSubmit={handleCreateTask}
      />
    </div>
  )
}
