"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileSpreadsheet, Plus } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskWorkOrderDialog, type WorkOrderCreateResult } from "@/components/tareas/task-work-order-dialog"
import { TasksAdminListTable } from "@/components/tareas/tasks-admin-list-table"
import { TasksAdminSearch } from "@/components/tareas/tasks-admin-search"
import { WorkOrderImportDialog } from "@/components/tareas/work-order-import-dialog"
import {
  defaultTaskFilters,
  filterAdminTasks,
} from "@/components/tareas/tasks-filters"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import {
  parseTaskOperationalCategoryQuery,
  parseTaskStatusQuery,
} from "@/lib/navigation/query-filters"
import {
  filterTasksByOperationalCategory,
  OPERATIONAL_CATEGORY_KPI_LABELS,
} from "@/lib/tasks/operational-category"
import { Button } from "@/components/ui/button"

export function TasksModule() {
  const searchParams = useSearchParams()
  const { tasks, addTask } = useTasks()
  const [search, setSearch] = useState(defaultTaskFilters.search)
  const [statusFilter, setStatusFilter] = useState(defaultTaskFilters.status)
  const [workOrderOpen, setWorkOrderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const status = parseTaskStatusQuery(searchParams.get("status"))
    if (status !== "all") {
      setStatusFilter(status)
    }
  }, [searchParams])

  const archiveCategory = parseTaskOperationalCategoryQuery(
    searchParams.get("category")
  )
  const isArchiveView = archiveCategory === "finalizadas"

  const displayedTasks = useMemo(() => {
    if (isArchiveView) {
      const archived = filterTasksByOperationalCategory(tasks, "finalizadas")
      return filterAdminTasks(archived, search, "all")
    }

    return filterAdminTasks(tasks, search, statusFilter)
  }, [tasks, search, statusFilter, isArchiveView])

  const hasActiveFilter =
    search.trim() !== "" ||
    isArchiveView ||
    statusFilter !== defaultTaskFilters.status

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
    <div className="space-y-4">
      {isArchiveView ? (
        <p className="text-sm text-muted-foreground">
          {OPERATIONAL_CATEGORY_KPI_LABELS.finalizadas}: órdenes finalizadas en
          solo lectura. No requiere acción manual de archivado.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-h-5">
          {feedback && (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {!isArchiveView ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>

      <TasksAdminSearch
        value={search}
        onChange={setSearch}
        totalCount={tasks.length}
        resultCount={displayedTasks.length}
        hasActiveFilter={hasActiveFilter}
      />

      <TasksAdminListTable
        tasks={displayedTasks}
        hasActiveFilter={hasActiveFilter}
      />

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
