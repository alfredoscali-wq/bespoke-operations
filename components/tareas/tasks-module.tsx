"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileSpreadsheet, Plus } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskWorkOrderDialog, type WorkOrderCreateResult } from "@/components/tareas/task-work-order-dialog"
import { TasksOperationalList } from "@/components/tareas/tasks-operational-list"
import { TasksOperationalSummary } from "@/components/tareas/tasks-operational-summary"
import { TasksUIProvider, useTasksUI } from "@/components/tareas/tasks-ui-provider"
import { WorkOrderImportDialog } from "@/components/tareas/work-order-import-dialog"
import {
  TasksFiltersBar,
  defaultTaskFilters,
  filterAndSortTasks,
} from "@/components/tareas/tasks-filters"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import { buildCrewFilterOptions } from "@/lib/tasks/crew-relation"
import {
  parseTaskOperationalCategoryQuery,
  parseTaskStatusQuery,
  taskStatusToOperationalCategory,
} from "@/lib/navigation/query-filters"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function TasksModule() {
  return (
    <TasksUIProvider>
      <TasksModuleContent />
    </TasksUIProvider>
  )
}

function TasksModuleContent() {
  const searchParams = useSearchParams()
  const { tasks, addTask } = useTasks()
  const {
    filteredTasks: categoryFilteredTasks,
    selectedCategory,
    selectCategory,
  } = useTasksUI()
  const { crews } = useCrews()
  const crewOptions = useMemo(() => buildCrewFilterOptions(crews), [crews])
  const [filters, setFilters] = useState(defaultTaskFilters)
  const [workOrderOpen, setWorkOrderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const status = parseTaskStatusQuery(searchParams.get("status"))
    const category = parseTaskOperationalCategoryQuery(searchParams.get("category"))

    if (status !== "all") {
      setFilters((current) => ({ ...current, status }))
      const mappedCategory = taskStatusToOperationalCategory(status)
      selectCategory(mappedCategory ?? category)
    } else if (category) {
      selectCategory(category)
    }
  }, [searchParams, selectCategory])

  const displayedTasks = useMemo(
    () => filterAndSortTasks(categoryFilteredTasks, filters, crews),
    [categoryFilteredTasks, filters, crews]
  )

  async function handleCreateWorkOrder(payload: CreateTaskPayload) {
    return addTask(payload)
  }

  function handleWorkOrderCreated(result: WorkOrderCreateResult) {
    if (result.photoUpload.failedPhotos > 0) {
      setFeedback(
        "La orden fue creada correctamente. Algunas fotos no pudieron cargarse."
      )
      return
    }

    setFeedback("Orden de trabajo creada correctamente.")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {feedback && (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setWorkOrderOpen(true)}
          >
            <Plus className="size-4" />
            Nueva Orden de Trabajo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <FileSpreadsheet className="size-4" />
            Importar Excel
          </Button>
        </div>
      </div>

      <TasksOperationalSummary />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b">
          <CardTitle className="text-base">Órdenes de trabajo</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <TasksFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={displayedTasks.length}
            showSort
            crewOptions={crewOptions}
            operationalMode
          />

          <TasksOperationalList tasks={displayedTasks} />
        </CardContent>
      </Card>

      <TaskWorkOrderDialog
        open={workOrderOpen}
        onOpenChange={setWorkOrderOpen}
        existingTasks={tasks}
        onSubmit={handleCreateWorkOrder}
        onTaskCreated={handleWorkOrderCreated}
      />

      <WorkOrderImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(message) => setFeedback(message)}
      />
    </div>
  )
}
