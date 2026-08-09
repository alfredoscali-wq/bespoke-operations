"use client"

import { formatDateOnly } from "@/lib/dates/date-only"
import { formatPlanningDurationMinutesCompact } from "@/lib/planificacion/planning-ui-density"
import type { PlanningObraActiveRow } from "@/lib/planificacion/planning-obras-lane"
import type { PlanningObrasKpis } from "@/lib/planificacion/planning-obras-lane"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PlanningObrasActivasSectionProps = {
  rows: PlanningObraActiveRow[]
  kpis: PlanningObrasKpis
  readOnly?: boolean
  onEditTask?: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
  className?: string
}

export function PlanningObrasActivasSection({
  rows,
  kpis,
  readOnly = false,
  onEditTask,
  onOpenTask,
  className,
}: PlanningObrasActivasSectionProps) {
  if (rows.length === 0 && kpis.activeObraTaskCount === 0) {
    return null
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-sky-200/80 bg-sky-50/40 px-3 py-2.5",
        className
      )}
      data-testid="planning-obras-activas"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-sky-950">
          Obras activas
        </h3>
        <p className="text-[11px] text-sky-900/70">
          {kpis.activeObrasCount} obra
          {kpis.activeObrasCount === 1 ? "" : "s"} · {kpis.activeObraTaskCount}{" "}
          OT · {kpis.affectedCrewsCount} cuadrilla
          {kpis.affectedCrewsCount === 1 ? "" : "s"} ·{" "}
          {formatPlanningDurationMinutesCompact(kpis.committedDayMinutes)}{" "}
          hoy
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay OT de obra para esta fecha o filtro.
        </p>
      ) : (
        <ul className="divide-y divide-sky-100/80">
          {rows.map((row) => (
            <li
              key={row.taskId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]"
            >
              <button
                type="button"
                className="font-mono text-[11px] text-muted-foreground hover:underline"
                onClick={() => onOpenTask?.(row.taskId)}
              >
                {row.code}
              </button>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {row.title}
              </span>
              <span className="truncate text-sky-900/80" title={row.obraName}>
                {row.obraName}
              </span>
              <span className="text-muted-foreground">{row.crewName}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatDateOnly(row.startDate)} → {formatDateOnly(row.dueDate)}
              </span>
              {row.dayBadge ? (
                <span className="rounded border border-sky-200 bg-white px-1.5 py-px text-[10px] font-medium text-sky-800">
                  {row.dayBadge}
                </span>
              ) : null}
              <span className="tabular-nums text-muted-foreground">
                {formatPlanningDurationMinutesCompact(row.dayDurationMinutes)}
              </span>
              {!readOnly && onEditTask ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onEditTask(row.taskId)}
                >
                  Ajustar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
