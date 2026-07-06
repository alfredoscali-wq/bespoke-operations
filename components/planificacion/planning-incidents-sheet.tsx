"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Play,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { TaskIncidentCancelDialog } from "@/components/tareas/task-incident-cancel-dialog"
import { TaskRescheduleDialog } from "@/components/tareas/task-reschedule-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  addOperationsIncidentEvent,
  fetchOperationsIncidentById,
  transitionOperationsIncidentStatus,
} from "@/lib/operations/incidents/fetch-operations-incidents.client"
import {
  buildPlanningIncidentListItems,
  PLANNING_INCIDENT_STATUS_LABELS,
  resolvePlanningIncidentTypeLabel,
} from "@/lib/planificacion/planning-incidents"
import { fetchIncidentTypes } from "@/lib/supabase/incident-types.browser"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { canCloseWorkOrder } from "@/lib/tasks/task-closure-permissions"
import type { IncidentResponse, IncidentSummary } from "@/lib/types/task-incidents"
import type { IncidentType } from "@/lib/types/incident-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
}

export function PlanningIncidentsSheet({
  open,
  onOpenChange,
  incidents,
  isLoading,
  error,
  onRefresh,
}: PlanningIncidentsSheetProps) {
  const { sessionUser } = useAuth()
  const { companyId } = useTenantCompanyId()
  const { crews } = useCrews()
  const { employees } = useEmployees()
  const {
    tasks,
    getTask,
    getDetail,
    detailVersion,
    resumeTaskFromIncident,
    rescheduleTaskFromIncident,
    cancelTask,
  } = useTasks()

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    null
  )
  const [selectedIncident, setSelectedIncident] =
    useState<IncidentResponse | null>(null)
  const [incidentTypes, setIncidentTypes] = useState<
    Pick<IncidentType, "id" | "name" | "code">[]
  >([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const canSupervise = canCloseWorkOrder(sessionUser?.systemRole)
  const actorName = sessionUser?.displayName?.trim() || "Supervisor"
  const supervisorActionsDisabled =
    isPending || detailLoading || !selectedIncident

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

  const selectedListItem = useMemo(
    () => listItems.find((item) => item.id === selectedIncidentId) ?? null,
    [listItems, selectedIncidentId]
  )

  const selectedTask = useMemo(() => {
    if (!selectedListItem) {
      return null
    }

    return (
      getTask(selectedListItem.taskId) ??
      tasks.find((task) => task.id === selectedListItem.taskId) ??
      null
    )
  }, [getTask, selectedListItem, tasks, detailVersion])

  const selectedTaskDetail = useMemo(() => {
    if (!selectedListItem) {
      return undefined
    }

    return getDetail(selectedListItem.taskId)
  }, [getDetail, selectedListItem, detailVersion])

  const incidentTypeLabel = selectedIncident
    ? resolvePlanningIncidentTypeLabel(
        selectedIncident.incidentTypeId,
        incidentTypes
      )
    : selectedListItem?.incidentTypeLabel ?? "—"

  useEffect(() => {
    if (!open) {
      setSelectedIncidentId(null)
      setSelectedIncident(null)
      setDetailError(null)
      setActionError(null)
      setRescheduleOpen(false)
      setCancelOpen(false)
      setCloseOpen(false)
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

  useEffect(() => {
    if (
      open &&
      selectedIncidentId &&
      !isLoading &&
      !listItems.some((item) => item.id === selectedIncidentId)
    ) {
      setSelectedIncidentId(null)
    }
  }, [open, selectedIncidentId, isLoading, listItems])

  async function reloadIncidentContext() {
    await onRefresh()

    if (!selectedIncidentId) {
      return
    }

    const detail = await fetchOperationsIncidentById(selectedIncidentId)
    setSelectedIncident(detail)

    if (
      detail.status === "RESUELTA" ||
      detail.status === "RECHAZADA"
    ) {
      setSelectedIncidentId(null)
    }
  }

  async function runIncidentAction(action: () => Promise<void>) {
    setIsPending(true)
    setActionError(null)

    try {
      await action()
      await reloadIncidentContext()
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "No fue posible completar la acción."
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl"
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Incidencias activas</SheetTitle>
            <SheetDescription>
              Gestione las excepciones operativas sin salir de planificación.
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

            {!selectedIncidentId ? (
              <div className="space-y-2">
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
                      onClick={() => {
                        setSelectedIncidentId(item.id)
                        setActionError(null)
                        setDetailError(null)
                      }}
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
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setSelectedIncidentId(null)
                    setSelectedIncident(null)
                    setActionError(null)
                    setDetailError(null)
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Volver al listado
                </Button>

                {detailError ? (
                  <p
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    role="alert"
                  >
                    {detailError}
                  </p>
                ) : null}

                {selectedTask && selectedTaskDetail ? (
                  <TaskAdminDetailView
                    task={selectedTask}
                    detail={selectedTaskDetail}
                    embedded
                    incident={selectedIncident}
                    incidentTypeLabel={incidentTypeLabel}
                    isIncidentDetailLoading={detailLoading}
                  />
                ) : detailLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No fue posible cargar el expediente técnico de la OT
                    asociada.
                  </p>
                )}
              </div>
            )}
          </div>

          {selectedIncidentId && canSupervise ? (
            <SheetFooter className="shrink-0 border-t bg-background px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                onClick={() => {
                  if (!selectedIncident) {
                    return
                  }

                  void runIncidentAction(async () => {
                    await addOperationsIncidentEvent(selectedIncident.id, {
                      eventType: "REQUEST_INFO",
                      comment: "Se solicitó información adicional al operario.",
                    })

                    if (selectedIncident.status === "REPORTADA") {
                      await transitionOperationsIncidentStatus(
                        selectedIncident.id,
                        selectedIncident.status,
                        "EN_ANALISIS"
                      )
                    }
                  })
                }}
              >
                <MessageSquare className="size-4" />
                Solicitar información
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                onClick={() => setRescheduleOpen(true)}
              >
                <CalendarClock className="size-4" />
                Replanificar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="size-4" />
                Cancelar OT
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                onClick={() => setCloseOpen(true)}
              >
                <CheckCircle2 className="size-4" />
                Cerrar incidencia
              </Button>
              <Button
                type="button"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                onClick={() => {
                  if (!selectedIncident) {
                    return
                  }

                  void runIncidentAction(async () => {
                    if (selectedTask) {
                      const result = await resumeTaskFromIncident(
                        selectedTask.id,
                        actorName
                      )

                      if (!result.success) {
                        throw new Error(
                          result.message ??
                            "No fue posible continuar la orden de trabajo."
                        )
                      }
                    }

                    await addOperationsIncidentEvent(selectedIncident.id, {
                      eventType: "CONTINUE",
                      comment: "El supervisor autorizó continuar la ejecución.",
                    })

                    await transitionOperationsIncidentStatus(
                      selectedIncident.id,
                      selectedIncident.status,
                      "RESUELTA",
                      { canContinue: true }
                    )
                  })
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Continuar
                  </>
                )}
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      {selectedTask ? (
        <>
          <TaskRescheduleDialog
            open={rescheduleOpen}
            onOpenChange={setRescheduleOpen}
            task={selectedTask}
            rescheduledBy={actorName}
            isSubmitting={isPending}
            onConfirm={async (input) => {
              if (!selectedIncident) {
                return
              }

              await runIncidentAction(async () => {
                const result = await rescheduleTaskFromIncident(selectedTask.id, {
                  ...input,
                  actor: actorName,
                })

                if (!result.success) {
                  throw new Error(
                    result.message ??
                      "No fue posible replanificar la orden de trabajo."
                  )
                }

                await addOperationsIncidentEvent(selectedIncident.id, {
                  eventType: "RESCHEDULE",
                  comment: input.reason?.trim() || "OT replanificada.",
                })

                if (selectedIncident.status === "REPORTADA") {
                  await transitionOperationsIncidentStatus(
                    selectedIncident.id,
                    selectedIncident.status,
                    "EN_ANALISIS"
                  )
                }
              })

              setRescheduleOpen(false)
            }}
          />

          <TaskIncidentCancelDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            isSubmitting={isPending}
            onConfirm={async (input) => {
              if (!selectedIncident) {
                return
              }

              await runIncidentAction(async () => {
                const result = await cancelTask(selectedTask.id, {
                  ...input,
                  actor: actorName,
                })

                if (!result.success) {
                  throw new Error(
                    result.message ??
                      "No fue posible cancelar la orden de trabajo."
                  )
                }

                await addOperationsIncidentEvent(selectedIncident.id, {
                  eventType: "CANCEL_TASK",
                  comment: input.observation?.trim() || "OT cancelada.",
                })

                await transitionOperationsIncidentStatus(
                  selectedIncident.id,
                  selectedIncident.status,
                  "RECHAZADA"
                )
              })

              setCancelOpen(false)
            }}
          />
        </>
      ) : null}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar incidencia</DialogTitle>
            <DialogDescription>
              Seleccione cómo desea cerrar la incidencia activa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setCloseOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void runIncidentAction(async () => {
                  if (!selectedIncident) {
                    return
                  }

                  await addOperationsIncidentEvent(selectedIncident.id, {
                    eventType: "CLOSED",
                    comment: "Incidencia cerrada como rechazada.",
                  })

                  await transitionOperationsIncidentStatus(
                    selectedIncident.id,
                    selectedIncident.status,
                    "RECHAZADA"
                  )

                  setCloseOpen(false)
                })
              }
            >
              Rechazar
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                void runIncidentAction(async () => {
                  if (!selectedIncident) {
                    return
                  }

                  await addOperationsIncidentEvent(selectedIncident.id, {
                    eventType: "CLOSED",
                    comment: "Incidencia cerrada como resuelta.",
                  })

                  await transitionOperationsIncidentStatus(
                    selectedIncident.id,
                    selectedIncident.status,
                    "RESUELTA"
                  )

                  setCloseOpen(false)
                })
              }
            >
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
