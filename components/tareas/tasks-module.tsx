"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  TaskWorkOrderDialog,
  type WorkOrderCreateResult,
} from "@/components/tareas/task-work-order-dialog"
import { TasksAdminListTable } from "@/components/tareas/tasks-admin-list-table"
import { WorkOrderImportDialog } from "@/components/tareas/work-order-import-dialog"
import {
  defaultTaskFilters,
  filterAndSortTasks,
  TasksFiltersBar,
} from "@/components/tareas/tasks-filters"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import { parseTaskStatusQuery, parsePlanningReturnedQuery } from "@/lib/navigation/query-filters"
import {
  ARCHIVE_OT_STATUS_FILTER_OPTIONS,
  filterActiveWorkOrders,
  filterArchivedWorkOrders,
  type ArchiveOtStatusFilter,
} from "@/lib/tasks/task-list-scope"
import { filterPlanningReturnedTasks } from "@/lib/tasks/planning-return"
import { TasksPlanningReturnedKpi } from "@/components/tareas/tasks-planning-returned-kpi"
import { formatConsultationExpedienteCode } from "@/lib/customer-atenciones/consultation-expediente"
import {
  clearConsultationOtCreatePrefill,
  readConsultationOtCreatePrefill,
  type ConsultationOtCreatePrefill,
} from "@/lib/customer-atenciones/consultation-ot-create"
import { linkConsultationOtManagement } from "@/lib/supabase/customer-atenciones-management.browser"
import { Button } from "@/components/ui/button"

const TASKS_PAGE_SIZE = 25

export type TasksModuleMode = "active" | "archive"

type TasksModuleProps = {
  mode?: TasksModuleMode
}

export function TasksModule({ mode = "active" }: TasksModuleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tasks, addTask } = useTasks()
  const { crews } = useCrews()
  const isArchiveView = mode === "archive"
  const [filters, setFilters] = useState(defaultTaskFilters)
  const [archiveStatusFilter, setArchiveStatusFilter] =
    useState<ArchiveOtStatusFilter>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [workOrderOpen, setWorkOrderOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [planningReturnedFilterActive, setPlanningReturnedFilterActive] =
    useState(false)
  const [consultationPrefill, setConsultationPrefill] =
    useState<ConsultationOtCreatePrefill | null>(null)

  useEffect(() => {
    const status = parseTaskStatusQuery(searchParams.get("status"))
    if (status !== "all") {
      setFilters((current) => ({ ...current, status }))
    }
  }, [searchParams])

  useEffect(() => {
    if (mode !== "active") {
      return
    }

    setPlanningReturnedFilterActive(
      parsePlanningReturnedQuery(searchParams.get("planningReturned"))
    )
  }, [mode, searchParams])

  // RC 3.2.6 — open Nueva OT from Gestión de Consultas with prefill + auto-link.
  useEffect(() => {
    if (mode !== "active") {
      return
    }

    if (searchParams.get("nuevaOt") !== "1") {
      return
    }

    const atencionId = searchParams.get("atencionId")?.trim() || ""
    if (!atencionId) {
      return
    }

    const stored = readConsultationOtCreatePrefill(atencionId)
    const customerId =
      stored?.customerId || searchParams.get("customerId")?.trim() || ""

    if (!customerId) {
      return
    }

    setConsultationPrefill(
      stored ?? {
        atencionId,
        customerId,
        expedienteCode: formatConsultationExpedienteCode(atencionId),
        motivoLabel: "Consulta",
        initialObservations: "",
        technicalHistory: null,
      }
    )
    setWorkOrderOpen(true)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("nuevaOt")
    params.delete("atencionId")
    params.delete("customerId")
    const query = params.toString()
    router.replace(query ? `/tareas?${query}` : "/tareas", { scroll: false })
  }, [mode, router, searchParams])

  useEffect(() => {
    if (mode !== "active") {
      return
    }

    const category = searchParams.get("category")
    if (category === "finalizadas" || category === "completadas") {
      router.replace("/operations/archivo-ot")
    }
  }, [mode, router, searchParams])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, mode, archiveStatusFilter, planningReturnedFilterActive])

  const scopedTasks = useMemo(() => {
    if (isArchiveView) {
      return filterArchivedWorkOrders(tasks, archiveStatusFilter)
    }

    return filterActiveWorkOrders(tasks)
  }, [tasks, isArchiveView, archiveStatusFilter])

  const displayedTasks = useMemo(() => {
    const filtered = filterAndSortTasks(scopedTasks, filters, crews)
    if (!isArchiveView && planningReturnedFilterActive) {
      return filterPlanningReturnedTasks(filtered)
    }
    return filtered
  }, [scopedTasks, filters, crews, isArchiveView, planningReturnedFilterActive])

  const totalPages = Math.max(
    1,
    Math.ceil(displayedTasks.length / TASKS_PAGE_SIZE)
  )
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedTasks = useMemo(() => {
    const start = (safeCurrentPage - 1) * TASKS_PAGE_SIZE
    return displayedTasks.slice(start, start + TASKS_PAGE_SIZE)
  }, [displayedTasks, safeCurrentPage])

  const crewOptions = useMemo(
    () => crews.map((crew) => ({ id: crew.id, name: crew.name })),
    [crews]
  )

  const hasActiveFilter =
    filters.search.trim() !== "" ||
    filters.type !== "all" ||
    (isArchiveView && filters.workOrderType !== "all") ||
    filters.priority !== "all" ||
    filters.crew !== "all" ||
    planningReturnedFilterActive ||
    (!isArchiveView && filters.status !== defaultTaskFilters.status)

  function handlePlanningReturnedKpiToggle() {
    const nextActive = !planningReturnedFilterActive
    setPlanningReturnedFilterActive(nextActive)

    const params = new URLSearchParams(searchParams.toString())
    if (nextActive) {
      params.set("planningReturned", "1")
    } else {
      params.delete("planningReturned")
    }

    const query = params.toString()
    router.replace(query ? `/tareas?${query}` : "/tareas", { scroll: false })
  }

  async function handleCreateWorkOrder(payload: CreateTaskPayload) {
    return addTask(payload)
  }

  const handleWorkOrderOpenChange = useCallback((open: boolean) => {
    setWorkOrderOpen(open)
    if (!open) {
      setConsultationPrefill((current) => {
        if (current) {
          clearConsultationOtCreatePrefill(current.atencionId)
        }
        return null
      })
    }
  }, [])

  async function handleWorkOrderCreated(result: WorkOrderCreateResult) {
    const atencionId = consultationPrefill?.atencionId

    if (atencionId) {
      const linkResult = await linkConsultationOtManagement(
        atencionId,
        result.task.id
      )
      clearConsultationOtCreatePrefill(atencionId)
      setConsultationPrefill(null)

      if (!linkResult.success) {
        setFeedback(
          result.photoUpload.failedPhotos > 0
            ? `La OT se creó, pero no se pudo vincular a la consulta: ${linkResult.message} Algunas fotos no pudieron cargarse.`
            : `La OT se creó, pero no se pudo vincular a la consulta: ${linkResult.message}`
        )
        return
      }

      setFeedback(
        result.photoUpload.failedPhotos > 0
          ? "OT creada y vinculada a la consulta. Algunas fotos no pudieron cargarse."
          : "Orden de trabajo creada y vinculada a la consulta."
      )
      router.push(`/atencion-cliente/${atencionId}`)
      return
    }

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
          Historial operativo de OT finalizadas, canceladas y pendientes de
          cierre. Las canceladas permanecen visibles; no se eliminan.
        </p>
      ) : null}

      {isArchiveView ? (
        <div className="flex flex-wrap gap-2">
          {ARCHIVE_OT_STATUS_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={
                archiveStatusFilter === option.value ? "default" : "outline"
              }
              onClick={() => setArchiveStatusFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
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

      {!isArchiveView ? (
        <div className="max-w-sm">
          <TasksPlanningReturnedKpi
            tasks={scopedTasks}
            isActive={planningReturnedFilterActive}
            onToggle={handlePlanningReturnedKpiToggle}
          />
        </div>
      ) : null}

      <TasksFiltersBar
        filters={filters}
        onChange={setFilters}
        resultCount={displayedTasks.length}
        crewOptions={crewOptions}
        operationalMode={false}
        showWorkOrderTypeFilter={isArchiveView}
        showSort
      />

      <TasksAdminListTable
        tasks={paginatedTasks}
        hasActiveFilter={hasActiveFilter}
        readOnly={isArchiveView}
        showExtendedColumns={isArchiveView}
        detailBasePath={
          isArchiveView ? "/operations/archivo-ot" : "/tareas"
        }
      />

      {displayedTasks.length > TASKS_PAGE_SIZE ? (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Página {safeCurrentPage} de {totalPages} · {displayedTasks.length}{" "}
            {displayedTasks.length === 1 ? "orden" : "órdenes"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(safeCurrentPage - 1)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(safeCurrentPage + 1)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {!isArchiveView ? (
        <>
          <TaskWorkOrderDialog
            open={workOrderOpen}
            onOpenChange={handleWorkOrderOpenChange}
            existingTasks={tasks}
            onSubmit={handleCreateWorkOrder}
            onTaskCreated={handleWorkOrderCreated}
            consultationPrefill={consultationPrefill}
          />

          <WorkOrderImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onImported={(message) => setFeedback(message)}
          />
        </>
      ) : null}
    </div>
  )
}
