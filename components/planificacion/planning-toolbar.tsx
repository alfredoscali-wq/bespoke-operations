"use client"

import { CheckCircle2 } from "lucide-react"

import { PlanningConfirmDialog } from "@/components/planificacion/planning-confirm-dialog"
import { PlanningSummaryCards } from "@/components/planificacion/planning-summary-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlanningConfirmReadiness } from "@/lib/planificacion/planning-confirm"
import type { PlanningKpis } from "@/lib/planificacion/planning-utils"

type PlanningToolbarProps = {
  date: string
  kpis: PlanningKpis
  confirmReadiness: PlanningConfirmReadiness
  isConfirming?: boolean
  confirmError?: string | null
  confirmDialogOpen: boolean
  onConfirmDialogOpenChange: (open: boolean) => void
  onDateChange: (date: string) => void
  onConfirmPlanning: () => Promise<void>
}

export function PlanningToolbar({
  date,
  kpis,
  confirmReadiness,
  isConfirming = false,
  confirmError = null,
  confirmDialogOpen,
  onConfirmDialogOpenChange,
  onDateChange,
  onConfirmPlanning,
}: PlanningToolbarProps) {
  const confirmDisabled =
    !confirmReadiness.canConfirm || isConfirming || confirmReadiness.taskCount === 0
  const confirmHint =
    confirmReadiness.validationError ??
    confirmReadiness.disabledReason ??
    null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="planning-date">Fecha</Label>
          <Input
            id="planning-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            type="button"
            onClick={() => onConfirmDialogOpenChange(true)}
            disabled={confirmDisabled}
            title={confirmHint ?? undefined}
          >
            <CheckCircle2 className="size-4" />
            Confirmar planificación
          </Button>
          {confirmHint ? (
            <p className="max-w-sm text-right text-xs text-muted-foreground">
              {confirmHint}
            </p>
          ) : null}
        </div>
      </div>

      <PlanningSummaryCards kpis={kpis} />

      <PlanningConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={onConfirmDialogOpenChange}
        onConfirm={onConfirmPlanning}
        isSubmitting={isConfirming}
        error={confirmError}
      />
    </div>
  )
}
