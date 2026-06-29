"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlanningSummaryCards } from "@/components/planificacion/planning-summary-cards"
import type { PlanningKpis } from "@/lib/planificacion/planning-utils"
import {
  WORK_ORDER_SHIFT_OPTIONS,
  type WorkOrderShift,
} from "@/lib/tasks/work-order"

type PlanningToolbarProps = {
  date: string
  shift: WorkOrderShift
  kpis: PlanningKpis
  onDateChange: (date: string) => void
  onShiftChange: (shift: WorkOrderShift) => void
}

export function PlanningToolbar({
  date,
  shift,
  kpis,
  onDateChange,
  onShiftChange,
}: PlanningToolbarProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="planning-date">Fecha</Label>
          <Input
            id="planning-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="planning-shift">Turno</Label>
          <Select
            value={shift}
            onValueChange={(value) => onShiftChange(value as WorkOrderShift)}
          >
            <SelectTrigger id="planning-shift">
              <SelectValue placeholder="Seleccionar turno" />
            </SelectTrigger>
            <SelectContent>
              {WORK_ORDER_SHIFT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PlanningSummaryCards kpis={kpis} />
    </div>
  )
}
