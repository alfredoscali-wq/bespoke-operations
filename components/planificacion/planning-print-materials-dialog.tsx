"use client"

import { useEffect, useMemo, useState } from "react"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchTaskMaterialLinesForTasksClient } from "@/lib/materials/task-material-lines.client"
import {
  buildPlanningMaterialsReport,
  formatStructuredLineForPrint,
  printPlanningMaterialsReport,
  type PlanningMaterialsReport,
} from "@/lib/planificacion/planning-print-materials"
import { filterPlanningTasksByCrewFilter } from "@/lib/planificacion/planning-utils"
import type { TaskMaterialLineView } from "@/lib/types/materials"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

type PlanningPrintMaterialsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  planningDate: string
  tasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  initialCrewId?: string | null
}

export function PlanningPrintMaterialsDialog({
  open,
  onOpenChange,
  planningDate,
  tasks,
  crews,
  initialCrewId = null,
}: PlanningPrintMaterialsDialogProps) {
  const [crewId, setCrewId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [linesByTaskId, setLinesByTaskId] = useState<
    Record<string, TaskMaterialLineView[]>
  >({})
  const [isLoadingLines, setIsLoadingLines] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const preferred =
      (initialCrewId && crews.some((crew) => crew.id === initialCrewId)
        ? initialCrewId
        : "") ||
      crews[0]?.id ||
      ""
    setCrewId(preferred)
    setError(null)
  }, [open, initialCrewId, crews])

  useEffect(() => {
    if (!open || !crewId) {
      setLinesByTaskId({})
      return
    }

    const crewTasks = filterPlanningTasksByCrewFilter(tasks, crewId, crews)
    const taskIds = crewTasks.map((task) => task.id)
    if (taskIds.length === 0) {
      setLinesByTaskId({})
      return
    }

    let cancelled = false
    setIsLoadingLines(true)

    void fetchTaskMaterialLinesForTasksClient(taskIds)
      .then((grouped) => {
        if (!cancelled) setLinesByTaskId(grouped)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar materiales estructurados."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLines(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, crewId, tasks, crews])

  const reportResult = useMemo(() => {
    if (!crewId) {
      return null
    }

    return buildPlanningMaterialsReport({
      tasks,
      crews,
      planningDate,
      crewId,
      linesByTaskId,
    })
  }, [tasks, crews, planningDate, crewId, linesByTaskId])

  const report: PlanningMaterialsReport | null =
    reportResult?.ok === true ? reportResult.report : null

  function handlePrint() {
    setError(null)

    const result = buildPlanningMaterialsReport({
      tasks,
      crews,
      planningDate,
      crewId,
      linesByTaskId,
    })

    if (!result.ok) {
      setError(result.message)
      return
    }

    const printed = printPlanningMaterialsReport(result.report)
    if (!printed) {
      setError(
        "No se pudo abrir la ventana de impresión. Revise el bloqueo de ventanas emergentes."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Imprimir Materiales</DialogTitle>
          <DialogDescription>
            Seleccione la cuadrilla para generar el informe de materiales de la
            fecha de planificación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="print-materials-crew">Cuadrilla</Label>
            <Select
              value={crewId || undefined}
              onValueChange={(value) => {
                setCrewId(value)
                setError(null)
              }}
            >
              <SelectTrigger id="print-materials-crew">
                <SelectValue placeholder="Seleccionar cuadrilla" />
              </SelectTrigger>
              <SelectContent>
                {crews.map((crew) => (
                  <SelectItem key={crew.id} value={crew.id}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingLines ? (
            <p className="text-sm text-muted-foreground">
              Cargando materiales del catálogo…
            </p>
          ) : null}

          {report ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium text-foreground">
                {report.crewName} · {report.planningDateLabel}
              </p>
              {report.rows.length === 0 ? (
                <p className="mt-2 text-muted-foreground">
                  No hay materiales registrados para esta cuadrilla.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {report.rows.map((row) => (
                    <li
                      key={`${row.executionOrder}-${row.workOrderNumber}`}
                      className="rounded-md border bg-background p-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        Orden {row.executionOrder} · OT {row.workOrderNumber}
                      </p>
                      <p className="font-medium">{row.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.address}
                      </p>
                      {row.structuredLines.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Materiales del catálogo
                          </p>
                          <ul className="list-disc pl-4 text-sm">
                            {row.structuredLines.map((line) => (
                              <li key={`${line.code}-${line.warehouseName}-${line.quantityPlanned}`}>
                                {formatStructuredLineForPrint(line)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {row.materialsNeeded ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Materiales / indicaciones adicionales
                          </p>
                          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                            {row.materialsNeeded}
                          </pre>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handlePrint}
            disabled={!crewId || isLoadingLines}
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
