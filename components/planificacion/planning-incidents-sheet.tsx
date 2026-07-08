"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { PlanningIncidentResolveDialog } from "@/components/planificacion/planning-incident-resolve-dialog"
import { PlanningIncidentTaskContextPanel } from "@/components/planificacion/planning-incident-task-context-panel"
import { TaskAdminIncidentRecordPanel } from "@/components/tareas/task-admin-incident-record-panel"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  fetchOperationsIncidentById,
  resolveOperationsIncident,
} from "@/lib/operations/incidents/fetch-operations-incidents.client"
import {
  buildPlanningIncidentListItems,
  PLANNING_INCIDENT_STATUS_LABELS,
  resolvePlanningIncidentTypeLabel,
} from "@/lib/planificacion/planning-incidents"
import {
  buildPlanningIncidentResolveSuccessMessage,
  PLANNING_INCIDENT_RESOLVE_PRIMARY_ACTION_LABEL,
} from "@/lib/planificacion/planning-incidents-resolve"
import {
  normalizePlanningIncidentSelectionId,
  resolvePlanningIncidentSheetViewPhase,
} from "@/lib/planificacion/planning-incidents-sheet-state"
import { fetchIncidentTypes } from "@/lib/supabase/incident-types.browser"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { canUsePlanningWebOperationalActions } from "@/lib/roles/web-module-access"
import type { IncidentResponse, IncidentSummary } from "@/lib/types/task-incidents"
import type { IncidentType } from "@/lib/types/incident-types"
import type { PlanningIncidentResolvePayload } from "@/lib/planificacion/planning-incidents-resolve"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

type PlanningIncidentsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidents: IncidentSummary[]
  isLoading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  selectedIncidentId: string | null
  onSelectedIncidentIdChange: (incidentId: string | null) => void
}

export function PlanningIncidentsSheet({
  open,
  onOpenChange,
  incidents,
  isLoading,
  error,
  onRefresh,
  selectedIncidentId,
  onSelectedIncidentIdChange,
}: PlanningIncidentsSheetProps) {
  const { sessionUser } = useAuth()
  const { companyId } = useTenantCompanyId()
  const { crews } = useCrews()
  const { employees } = useEmployees()
  const { tasks, getTask, refreshTasksFromServer } = useTasks()

  const [selectedIncident, setSelectedIncident] =
    useState<IncidentResponse | null>(null)
  const [incidentTypes, setIncidentTypes] = useState<
    Pick<IncidentType, "id" | "name" | "code">[]
  >([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)

  const canSupervise = canUsePlanningWebOperationalActions(sessionUser)
  const supervisorActionsDisabled =
    isPending || detailLoading || !selectedIncident

  const viewPhase = resolvePlanningIncidentSheetViewPhase({
    selectedIncidentId,
    detailLoading,
    detailError,
    hasSelectedIncident: Boolean(selectedIncident),
  })

  const listItems = useMemo(
    () =>
      buildPlanningIncidentListItems(
        incidents,
        tasks,
        crews,
        employees,
        incidentTypes
      ),
    [incidents, tasks, crews, employees, incidentTypes]
  )

  const selectedListItem = useMemo(() => {
    if (!selectedIncidentId) {
      return null
    }

    return listItems.find((item) => item.id === selectedIncidentId) ?? null
  }, [listItems, selectedIncidentId])

  const selectedTask = useMemo(() => {
    if (!selectedListItem) {
      return null
    }

    return (
      getTask(selectedListItem.taskId) ??
      tasks.find((task) => task.id === selectedListItem.taskId) ??
      null
    )
  }, [getTask, selectedListItem, tasks])

  const incidentTypeLabel = useMemo(() => {
    const incidentTypeId =
      selectedIncident?.incidentTypeId ?? selectedListItem?.incidentTypeId

    if (!incidentTypeId) {
      return "—"
    }

    return resolvePlanningIncidentTypeLabel(incidentTypeId, incidentTypes)
  }, [incidentTypes, selectedIncident, selectedListItem])

  const reporterLabel = selectedListItem?.operatorLabel ?? null

  useEffect(() => {
    if (!open) {
      setSelectedIncident(null)
      setDetailError(null)
      setActionError(null)
      setActionSuccess(null)
      setResolveOpen(false)
      return
    }

    void fetchIncidentTypes(companyId).then((result) => {
      if (result.data) {
        setIncidentTypes(result.data)
      }
    })
  }, [open, companyId])

  useEffect(() => {
    if (!open || !selectedIncidentId) {
      setSelectedIncident(null)
      return
    }

    let cancelled = false

    async function loadIncidentDetail() {
      setDetailLoading(true)
      setDetailError(null)

      try {
        const detail = await fetchOperationsIncidentById(selectedIncidentId!)
        if (!cancelled) {
          setSelectedIncident(detail)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedIncident(null)
          setDetailError(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible cargar la incidencia."
          )
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false)
        }
      }
    }

    void loadIncidentDetail()

    return () => {
      cancelled = true
    }
  }, [open, selectedIncidentId])

  function handleSelectIncident(incidentId: string | null | undefined) {
    const normalizedIncidentId =
      normalizePlanningIncidentSelectionId(incidentId)

    if (!normalizedIncidentId) {
      onSelectedIncidentIdChange(null)
      setSelectedIncident(null)
      setDetailError(
        "No fue posible identificar la incidencia seleccionada. Actualice la bandeja e intente nuevamente."
      )
      setActionError(null)
      setActionSuccess(null)
      return
    }

    onSelectedIncidentIdChange(normalizedIncidentId)
    setSelectedIncident(null)
    setActionError(null)
    setActionSuccess(null)
    setDetailError(null)
  }

  function handleBackToIncidentList() {
    onSelectedIncidentIdChange(null)
    setSelectedIncident(null)
    setActionError(null)
    setActionSuccess(null)
    setDetailError(null)
  }

  async function reloadIncidentDetail() {
    if (!selectedIncidentId) {
      return
    }

    setDetailLoading(true)
    setDetailError(null)

    try {
      const detail = await fetchOperationsIncidentById(selectedIncidentId)
      setSelectedIncident(detail)
    } catch (loadError) {
      setSelectedIncident(null)
      setDetailError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar la incidencia."
      )
    } finally {
      setDetailLoading(false)
    }
  }

  async function reloadIncidentContext() {
    await onRefresh()

    const refreshResult = await refreshTasksFromServer()
    if (!refreshResult.success) {
      throw new Error(
        refreshResult.message ??
          "La incidencia fue resuelta pero no fue posible refrescar las OT."
      )
    }

    if (!selectedIncidentId) {
      return
    }

    const detail = await fetchOperationsIncidentById(selectedIncidentId)

    if (detail.status === "RESUELTA" || detail.status === "RECHAZADA") {
      onSelectedIncidentIdChange(null)
      setSelectedIncident(null)
      return
    }

    setSelectedIncident(detail)
  }

  async function handleResolveIncident(payload: PlanningIncidentResolvePayload) {
    if (!selectedIncident) {
      throw new Error("Incidencia no disponible.")
    }

    setIsPending(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      await resolveOperationsIncident(selectedIncident.id, payload)
      setActionSuccess(buildPlanningIncidentResolveSuccessMessage(payload.action))
      await reloadIncidentContext()
    } catch (resolveError) {
      const message =
        resolveError instanceof Error
          ? resolveError.message
          : "No fue posible resolver la incidencia."

      setActionError(message)
      throw resolveError
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Incidencias activas</SheetTitle>
            <SheetDescription>
              Revise la incidencia y tome una decisión operativa.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {error ? (
              <p
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {actionError ? (
              <p
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}

            {actionSuccess ? (
              <p
                className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
                role="status"
                data-testid="planning-incident-resolve-success"
              >
                {actionSuccess}
              </p>
            ) : null}

            {viewPhase === "LIST" ? (
              <div className="space-y-2" data-testid="planning-incidents-list">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : listItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay incidencias activas en este momento.
                  </p>
                ) : (
                  listItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`planning-incidents-list-item-${item.id}`}
                      onClick={() => handleSelectIncident(item.id)}
                      className="w-full rounded-lg border bg-muted/20 p-4 text-left transition hover:border-primary/40 hover:bg-muted/30"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-2">
                          <Badge variant="outline">
                            {PLANNING_INCIDENT_STATUS_LABELS[item.status]}
                          </Badge>
                          <div>
                            <p className="font-mono text-xs font-semibold text-primary">
                              {item.taskCode}
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {item.customerLabel}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{formatTaskDateTime(item.createdAt)}</p>
                          <p className="mt-1 font-medium text-foreground">
                            {item.elapsedLabel}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo</p>
                          <p className="font-medium">{item.incidentTypeLabel}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Cuadrilla
                          </p>
                          <p className="font-medium">{item.crewLabel}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Operario
                          </p>
                          <p className="font-medium">{item.operatorLabel}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div
                className="space-y-4"
                data-testid="planning-incidents-detail"
                data-view-phase={viewPhase}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 text-muted-foreground"
                  onClick={handleBackToIncidentList}
                >
                  <ArrowLeft className="size-4" />
                  Volver al listado
                </Button>

                {detailError ? (
                  <div
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    role="alert"
                  >
                    <p>{detailError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={detailLoading}
                      onClick={() => {
                        void reloadIncidentDetail()
                      }}
                    >
                      Reintentar
                    </Button>
                  </div>
                ) : null}

                {detailLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <>
                    {selectedTask ? (
                      <PlanningIncidentTaskContextPanel
                        task={selectedTask}
                        crewLabel={selectedListItem?.crewLabel ?? "—"}
                        operatorLabel={reporterLabel}
                      />
                    ) : selectedListItem ? (
                      <p className="text-sm text-muted-foreground">
                        No fue posible cargar el contexto reducido de la OT.
                      </p>
                    ) : null}

                    {selectedIncident ? (
                      <TaskAdminIncidentRecordPanel
                        incident={selectedIncident}
                        incidentTypeLabel={incidentTypeLabel}
                        reporterLabel={reporterLabel}
                      />
                    ) : detailError ? null : (
                      <p className="text-sm text-muted-foreground">
                        No fue posible cargar el detalle de la incidencia.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {selectedIncidentId && canSupervise ? (
            <SheetFooter
              className="shrink-0 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end"
              data-testid="planning-incidents-primary-actions"
            >
              <Button
                type="button"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                data-testid="planning-incident-resolve-primary-action"
                onClick={() => setResolveOpen(true)}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  PLANNING_INCIDENT_RESOLVE_PRIMARY_ACTION_LABEL
                )}
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <PlanningIncidentResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        isSubmitting={isPending}
        onConfirm={handleResolveIncident}
      />
    </>
  )
}
