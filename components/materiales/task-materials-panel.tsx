"use client"

import { useEffect, useState } from "react"

import { TaskMaterialConsumptionPanel } from "@/components/materiales/task-material-consumption-panel"
import { getTaskMaterialLineReservationDisplay } from "@/lib/materials/reservation-status"
import {
  fetchTaskMaterialLinesDetailClient,
} from "@/lib/materials/task-material-consumption.client"
import { readMaterialsNeededFromTask } from "@/lib/tasks/work-order"
import { formatUnitLabel } from "@/lib/materials/units"
import { taskRequiresMaterialConsumptionConfirmation } from "@/lib/materials/task-material-consumption"
import { cn } from "@/lib/utils"
import type { TaskMaterialLineView } from "@/lib/types/materials"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TaskMaterialsPanelProps = {
  task: Pick<Task, "id" | "taskMetadata" | "code" | "status">
  showConsumptionConfirmation?: boolean
}

function ReservationStatusBadge({
  status,
}: {
  status: TaskMaterialLineView["status"]
}) {
  const display = getTaskMaterialLineReservationDisplay(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        display.tone === "success" ? "text-emerald-600" : "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          display.tone === "success" ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
        aria-hidden
      />
      {display.label}
    </span>
  )
}

function formatQuantity(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return "—"
  return `${value.toLocaleString("es-AR")} ${formatUnitLabel(unit)}`
}

export function TaskMaterialsPanel({
  task,
  showConsumptionConfirmation = false,
}: TaskMaterialsPanelProps) {
  const [lines, setLines] = useState<TaskMaterialLineView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const materialsNeeded = readMaterialsNeededFromTask(task)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    void fetchTaskMaterialLinesDetailClient(task.id)
      .then((loaded) => {
        if (!cancelled) setLines(loaded)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los materiales."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [task.id])

  const hasStructured = lines.length > 0
  const hasFreeText = Boolean(materialsNeeded.trim())
  const hasConsumptionHistory = lines.some((line) => line.status === "consumed")
  const showConsumptionTable =
    hasConsumptionHistory ||
    lines.some((line) => line.status === "reserved")
  const needsConfirmation =
    showConsumptionConfirmation &&
    taskRequiresMaterialConsumptionConfirmation(lines)

  if (!isLoading && !error && !hasStructured && !hasFreeText) {
    return null
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Materiales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando materiales…</p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {needsConfirmation ? (
          <TaskMaterialConsumptionPanel taskId={task.id} />
        ) : null}

        {hasStructured && showConsumptionTable ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Materiales del catálogo</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Planificado</TableHead>
                  <TableHead>Reservado</TableHead>
                  <TableHead>Consumido</TableHead>
                  <TableHead>Devuelto</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const reserved =
                    line.status === "reserved" || line.status === "consumed"
                      ? line.quantityPlanned
                      : null
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>
                          <p className="font-mono text-xs text-primary">
                            {line.materialCode}
                          </p>
                          <p className="font-medium">{line.materialName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatQuantity(line.quantityPlanned, line.unit)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatQuantity(reserved, line.unit)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatQuantity(line.quantityConsumed, line.unit)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatQuantity(line.quantityReturned, line.unit)}
                      </TableCell>
                      <TableCell>{line.warehouseName}</TableCell>
                      <TableCell>
                        <ReservationStatusBadge status={line.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : hasStructured ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Materiales del catálogo</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div>
                        <p className="font-mono text-xs text-primary">
                          {line.materialCode}
                        </p>
                        <p className="font-medium">{line.materialName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatQuantity(line.quantityPlanned, line.unit)}
                    </TableCell>
                    <TableCell>{line.warehouseName}</TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={line.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {hasFreeText ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Materiales adicionales</h4>
            <pre className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">
              {materialsNeeded}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
