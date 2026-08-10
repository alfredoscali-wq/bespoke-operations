"use client"

import { useEffect, useEffectEvent, useMemo } from "react"

import { formatDateOnly } from "@/lib/dates/date-only"
import {
  buildAutomaticDailyAllocations,
  isMultiDayOperationalRange,
  parseTotalMinutesFromEstimatedDuration,
  rebaseManualAllocations,
  sumAllocatedMinutes,
  type TaskDailyAllocationDraft,
  type TaskDailyAllocationMode,
} from "@/lib/projects/task-daily-allocations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type ProjectTaskDailyAllocationValue = {
  mode: TaskDailyAllocationMode
  allocations: TaskDailyAllocationDraft[]
}

export type ProjectTaskDailyAllocationSectionProps = {
  startDate: string
  dueDate: string
  estimatedDuration: string
  value: ProjectTaskDailyAllocationValue
  onChange: (value: ProjectTaskDailyAllocationValue) => void
  className?: string
}

export function ProjectTaskDailyAllocationSection({
  startDate,
  dueDate,
  estimatedDuration,
  value,
  onChange,
  className,
}: ProjectTaskDailyAllocationSectionProps) {
  const multiDay = isMultiDayOperationalRange(startDate, dueDate)
  const totalMinutes = parseTotalMinutesFromEstimatedDuration(estimatedDuration)

  const automaticRows = useMemo(
    () => buildAutomaticDailyAllocations(startDate, dueDate, totalMinutes),
    [startDate, dueDate, totalMinutes]
  )

  const onChangeEvent = useEffectEvent(onChange)

  useEffect(() => {
    if (!multiDay) {
      if (value.mode !== "automatic" || value.allocations.length > 0) {
        onChangeEvent({ mode: "automatic", allocations: [] })
      }
      return
    }

    if (value.mode === "automatic") {
      if (value.allocations.length > 0) {
        onChangeEvent({ mode: "automatic", allocations: [] })
      }
      return
    }

    const next = rebaseManualAllocations({
      startDate,
      dueDate,
      totalMinutes,
      previous: value.allocations,
    })
    const same =
      next.length === value.allocations.length &&
      next.every(
        (row, index) =>
          row.workDate === value.allocations[index]?.workDate &&
          row.allocatedMinutes === value.allocations[index]?.allocatedMinutes
      )
    if (!same) {
      onChangeEvent({ mode: "manual", allocations: next })
    }
  }, [
    multiDay,
    value.mode,
    value.allocations,
    startDate,
    dueDate,
    totalMinutes,
  ])

  if (!multiDay) {
    return null
  }

  const displayRows =
    value.mode === "automatic" ? automaticRows : value.allocations
  const assignedTotal = sumAllocatedMinutes(displayRows)
  const totalsMatch = totalMinutes > 0 && assignedTotal === totalMinutes

  function handleToggleAutomatic(checked: boolean) {
    if (checked) {
      onChange({ mode: "automatic", allocations: [] })
      return
    }
    onChange({
      mode: "manual",
      allocations: buildAutomaticDailyAllocations(
        startDate,
        dueDate,
        totalMinutes
      ),
    })
  }

  function updateMinutes(workDate: string, raw: string) {
    const parsed = Number.parseInt(raw, 10)
    const allocatedMinutes = Number.isFinite(parsed) ? parsed : 0
    onChange({
      mode: "manual",
      allocations: value.allocations.map((row) =>
        row.workDate === workDate ? { ...row, allocatedMinutes } : row
      ),
    })
  }

  return (
    <section
      className={cn(
        "space-y-3 rounded-md border border-border/80 p-3",
        className
      )}
      data-testid="project-task-daily-allocation"
    >
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Distribución de carga</h4>
        <p className="text-xs text-muted-foreground">
          Defina cuántos minutos aporta la OT a la capacidad de cada día.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.mode === "automatic"}
          onChange={(event) => handleToggleAutomatic(event.target.checked)}
        />
        Distribución automática
      </label>

      {value.mode === "automatic" ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="font-medium text-foreground">
            {totalMinutes > 0 ? `${totalMinutes} min` : "Sin duración"}
          </li>
          {displayRows.map((row) => (
            <li key={row.workDate} className="flex justify-between gap-3">
              <span>{formatDateOnly(row.workDate)}</span>
              <span className="tabular-nums">{row.allocatedMinutes} min</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_7rem] gap-2 text-xs font-medium text-muted-foreground">
            <span>Fecha</span>
            <span>Minutos</span>
          </div>
          {value.allocations.map((row) => (
            <div
              key={row.workDate}
              className="grid grid-cols-[1fr_7rem] items-center gap-2"
            >
              <Label className="text-sm font-normal">
                {formatDateOnly(row.workDate)}
              </Label>
              <Input
                type="number"
                min={1}
                className="h-8 tabular-nums"
                value={row.allocatedMinutes || ""}
                onChange={(event) =>
                  updateMinutes(row.workDate, event.target.value)
                }
              />
            </div>
          ))}
          <p
            className={cn(
              "text-xs tabular-nums",
              totalsMatch ? "text-muted-foreground" : "text-destructive"
            )}
          >
            Total asignado: {assignedTotal} / {totalMinutes || 0} min
          </p>
        </div>
      )}
    </section>
  )
}
