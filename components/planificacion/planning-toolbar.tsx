"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlanningSummaryCards } from "@/components/planificacion/planning-summary-cards"
import type { PlanningKpis } from "@/lib/planificacion/planning-utils"

type PlanningToolbarProps = {
  date: string
  kpis: PlanningKpis
  onDateChange: (date: string) => void
}

export function PlanningToolbar({ date, kpis, onDateChange }: PlanningToolbarProps) {
  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-2">
        <Label htmlFor="planning-date">Fecha</Label>
        <Input
          id="planning-date"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>

      <PlanningSummaryCards kpis={kpis} />
    </div>
  )
}
