"use client"

import { AlertTriangle } from "lucide-react"

import type { PlanningSummary } from "@/lib/planificacion/planning-summary"
import { formatPlanningEstimatedDurationDetailed } from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

type PlanningJourneySummaryPanelProps = {
  summary: PlanningSummary
  title?: string
  className?: string
}

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span
        className={cn(
          "text-[13px] tabular-nums text-slate-800",
          emphasize && "font-semibold"
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function PlanningJourneySummaryPanel({
  summary,
  title = "Resumen de jornada",
  className,
}: PlanningJourneySummaryPanelProps) {
  const exceeded = summary.status === "exceeded"

  return (
    <aside
      className={cn(
        "rounded-xl border border-slate-200 bg-card px-4 py-3 shadow-sm",
        className
      )}
    >
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>

      <div className="mt-3 space-y-2">
        <SummaryRow label="OT" value={String(summary.taskCount)} />
        <SummaryRow
          label="Trabajo técnico"
          value={formatPlanningEstimatedDurationDetailed(
            summary.technicalMinutes
          )}
        />
        <SummaryRow
          label="Traslados"
          value={formatPlanningEstimatedDurationDetailed(summary.travelMinutes)}
        />
        <SummaryRow
          label="Total jornada"
          value={formatPlanningEstimatedDurationDetailed(summary.totalMinutes)}
          emphasize
        />
        <SummaryRow
          label="Disponible"
          value={formatPlanningEstimatedDurationDetailed(
            summary.availableMinutes
          )}
        />
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
          <span className="text-[12px] text-slate-500">Estado</span>
          <span
            className={cn(
              "text-[13px] font-medium",
              exceeded ? "text-amber-700" : "text-emerald-700"
            )}
          >
            {exceeded ? "⚠ Excedida" : "Normal"}
          </span>
        </div>
      </div>

      {exceeded ? (
        <p
          className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] leading-snug text-amber-900"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Jornada excedida en {summary.overtimeMinutes} minutos
        </p>
      ) : null}
    </aside>
  )
}
