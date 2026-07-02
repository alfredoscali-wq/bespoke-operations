"use client"

import { CheckCircle2, ClipboardList, PencilLine } from "lucide-react"
import Link from "next/link"

import { PlanningConfirmDialog } from "@/components/planificacion/planning-confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlanningConfirmReadiness } from "@/lib/planificacion/planning-confirm"
import type { PlanningDispatchMode } from "@/lib/planificacion/planning-dispatch"

type PlanningToolbarProps = {
  mode: PlanningDispatchMode
  date: string
  plannedCount: number
  confirmReadiness: PlanningConfirmReadiness
  isConfirming?: boolean
  isReopening?: boolean
  reopenError?: string | null
  confirmError?: string | null
  confirmDialogOpen: boolean
  onConfirmDialogOpenChange: (open: boolean) => void
  onDateChange: (date: string) => void
  onConfirmPlanning: () => Promise<void>
  onModifyPlanning?: () => Promise<void>
}

export function PlanningToolbar({
  mode,
  date,
  plannedCount,
  confirmReadiness,
  isConfirming = false,
  isReopening = false,
  reopenError = null,
  confirmError = null,
  confirmDialogOpen,
  onConfirmDialogOpenChange,
  onDateChange,
  onConfirmPlanning,
  onModifyPlanning,
}: PlanningToolbarProps) {
  const isEditing = mode === "editing"
  const confirmDisabled =
    !confirmReadiness.canConfirm || isConfirming || confirmReadiness.taskCount === 0
  const confirmHint =
    confirmReadiness.validationError ??
    confirmReadiness.disabledReason ??
    null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="max-w-xs">
            <Label htmlFor="planning-date">Fecha</Label>
            <Input
              id="planning-date"
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className="mt-2"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {plannedCount} orden{plannedCount === 1 ? "" : "es"} en la
            planificación propuesta
          </p>
        </div>

        {isEditing ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="gap-2" asChild>
                <Link href="/tareas">
                  <ClipboardList className="size-4" />
                  Ir a Órdenes de Trabajo
                </Link>
              </Button>
              <Button
                type="button"
                onClick={() => onConfirmDialogOpenChange(true)}
                disabled={confirmDisabled}
                title={confirmHint ?? undefined}
              >
                <CheckCircle2 className="size-4" />
                Confirmar planificación
              </Button>
            </div>
            {confirmHint ? (
              <p className="max-w-sm text-right text-xs text-muted-foreground">
                {confirmHint}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="gap-2" asChild>
                <Link href="/tareas">
                  <ClipboardList className="size-4" />
                  Ir a Órdenes de Trabajo
                </Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={isReopening}
                onClick={() => void onModifyPlanning?.()}
              >
                <PencilLine className="size-4" />
                {isReopening ? "Reabriendo..." : "Modificar planificación"}
              </Button>
            </div>
            {reopenError ? (
              <p className="max-w-sm text-right text-xs text-destructive" role="alert">
                {reopenError}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {isEditing ? (
        <PlanningConfirmDialog
          open={confirmDialogOpen}
          onOpenChange={onConfirmDialogOpenChange}
          onConfirm={onConfirmPlanning}
          isSubmitting={isConfirming}
          error={confirmError}
        />
      ) : null}
    </div>
  )
}
