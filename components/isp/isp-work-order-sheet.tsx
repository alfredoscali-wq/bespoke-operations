"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Task } from "@/lib/types/tasks"
import { formatContractedPlanLabel } from "@/lib/tasks/commercial-plan"
import { formatWorkOrderPaymentMethodLabel } from "@/lib/tasks/commercial-plan"
import { WORK_ORDER_SERVICE_TYPE_OPTIONS } from "@/lib/tasks/work-order"

export function IspWorkOrderSheet({
  taskId,
  onClose,
}: {
  taskId: string | null
  onClose: () => void
}) {
  const [task, setTask] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setError(null)
      return
    }

    fetch(`/api/isp/tasks/${taskId}?mode=task`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          task?: Task
          message?: string
        }
        if (!body.success || !body.task) {
          throw new Error(body.message ?? "No se pudo abrir la OT.")
        }
        setTask(body.task)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Error inesperado.")
      })
  }, [taskId])

  const typeLabel =
    WORK_ORDER_SERVICE_TYPE_OPTIONS.find(
      (option) => option.value === task?.serviceType
    )?.label ?? task?.serviceType

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task?.code ?? "Orden de trabajo"}</SheetTitle>
        </SheetHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {task ? (
          <div className="space-y-3 p-1 text-sm">
            <Row label="Código" value={task.code} />
            <Row label="Tipo" value={typeLabel} />
            <Row label="Estado" value={task.status} />
            <Row label="Cliente" value={task.customerName} />
            <Row label="Dirección" value={task.serviceAddress} />
            <Row label="Tecnología" value={task.type} />
            <Row
              label="Plan"
              value={formatContractedPlanLabel(task.contractedPlan)}
            />
            <Row label="Cuadrilla" value={task.crew} />
            <Row label="Turno" value={task.scheduledTime} />
            <Row label="Duración" value={task.estimatedDuration} />
            <Row label="Instrucciones" value={task.observationsForCrew} />
            <Row
              label="GPS"
              value={
                task.latitude != null && task.longitude != null
                  ? `${task.latitude}, ${task.longitude}`
                  : task.sharedLocation
              }
            />
            <Row
              label="Importe de la OT"
              value={
                task.installationCost != null
                  ? `$ ${task.installationCost.toLocaleString("es-AR")}`
                  : null
              }
            />
            <Row
              label="Medio de pago de la OT"
              value={formatWorkOrderPaymentMethodLabel(task.paymentMethod)}
            />
            <Row label="Fecha" value={task.dueDate || task.startDate} />
            <p className="text-xs text-muted-foreground">
              Esta consulta reutiliza la OT existente. No abre Archivo OT ni
              duplica el registro.
            </p>
          </div>
        ) : null}
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </SheetContent>
    </Sheet>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value?.trim() || "—"}</p>
    </div>
  )
}
