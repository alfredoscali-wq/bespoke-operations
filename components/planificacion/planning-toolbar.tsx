"use client"

import { ClipboardList, PencilLine } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlanningDispatchMode } from "@/lib/planificacion/planning-dispatch"

type PlanningToolbarProps = {
  mode: PlanningDispatchMode
  date: string
  isReopening?: boolean
  reopenError?: string | null
  onDateChange: (date: string) => void
  onModifyPlanning?: () => Promise<void>
}

export function PlanningToolbar({
  mode,
  date,
  isReopening = false,
  reopenError = null,
  onDateChange,
  onModifyPlanning,
}: PlanningToolbarProps) {
  const isConfirmed = mode === "confirmed"

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="gap-2" asChild>
            <Link href="/tareas">
              <ClipboardList className="size-4" />
              Ir a Órdenes de Trabajo
            </Link>
          </Button>
          {isConfirmed ? (
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
          ) : null}
        </div>
        {reopenError ? (
          <p className="max-w-sm text-right text-xs text-destructive" role="alert">
            {reopenError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
