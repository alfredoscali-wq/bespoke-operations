"use client"

import Link from "next/link"

import { formatDateOnlyDateTime } from "@/lib/dates/date-only"
import { formatPlanningDurationMinutesCompact } from "@/lib/planificacion/planning-ui-density"
import type { PlanningObraActiveRow } from "@/lib/planificacion/planning-obras-lane"
import type { PlanningObrasKpis } from "@/lib/planificacion/planning-obras-lane"
import { formatPlanningTaskDateRangeLabel } from "@/lib/planificacion/planning-date-range"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PlanningObrasActivasSectionProps = {
  rows: PlanningObraActiveRow[]
  kpis: PlanningObrasKpis
  onOpenTask?: (taskId: string) => void
  onResolveIncident?: (taskId: string) => void
  className?: string
}

export function PlanningObrasActivasSection({
  rows,
  kpis,
  onOpenTask,
  onResolveIncident,
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

      <p className="mb-2 text-[11px] text-sky-900/65">
        La administración de OT de Obra se realiza desde el módulo Obras.
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay OT de obra para esta fecha o filtro.
        </p>
      ) : (
        <ul className="divide-y divide-sky-100/80">
          {rows.map((row) => (
            <li
              key={row.taskId}
              className={cn(
                "flex flex-col gap-1.5 py-2 text-[13px]",
                row.hasOpenIncident &&
                  "-mx-1 rounded-md border border-red-200 bg-red-50/90 px-2 shadow-sm"
              )}
              data-testid={
                row.hasOpenIncident
                  ? "planning-obra-row-incident"
                  : "planning-obra-row"
              }
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                  {formatPlanningTaskDateRangeLabel({
                    startDate: row.startDate,
                    dueDate: row.dueDate,
                  })}
                </span>
                {row.dayBadge ? (
                  <span className="rounded border border-sky-200 bg-white px-1.5 py-px text-[10px] font-medium text-sky-800">
                    {row.dayBadge}
                  </span>
                ) : null}
                <span className="tabular-nums text-muted-foreground">
                  {formatPlanningDurationMinutesCompact(row.dayDurationMinutes)}
                </span>
                {row.hasOpenIncident ? (
                  <span className="rounded border border-red-300 bg-red-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
                    Incidencia
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {TASK_STATUS_LABELS[row.status] ?? row.status}
                  </span>
                )}
                {row.projectId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    asChild
                  >
                    <Link href={`/obras/${row.projectId}`}>Ver Obra</Link>
                  </Button>
                ) : null}
                {row.hasOpenIncident && onResolveIncident ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-red-300 px-2 text-xs text-red-800 hover:bg-red-100"
                    onClick={() => onResolveIncident(row.taskId)}
                  >
                    Resolver Incidencia
                  </Button>
                ) : null}
              </div>
              {row.hasOpenIncident ? (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-0.5 text-[11px] text-red-950/80">
                  <span>
                    Motivo:{" "}
                    <span className="font-medium">
                      {row.incidentReasonLabel ?? "—"}
                    </span>
                  </span>
                  <span>
                    Generada:{" "}
                    <span className="font-medium">
                      {row.incidentReportedAt
                        ? formatDateOnlyDateTime(row.incidentReportedAt)
                        : "—"}
                    </span>
                  </span>
                  <span>
                    Responsable:{" "}
                    <span className="font-medium">
                      {row.incidentReportedBy?.trim() || "—"}
                    </span>
                  </span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
