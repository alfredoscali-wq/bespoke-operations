"use client"

import { AlertTriangle } from "lucide-react"

import type { CrewPlanningSummary } from "@/lib/engines/planning/contracts/CrewPlanningSummary"
import { formatPlanningEstimatedDurationDetailed } from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

type PlanningJourneySummaryPanelProps = {
  summary: CrewPlanningSummary
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

function statusTone(status: CrewPlanningSummary["status"]): string {
  switch (status) {
    case "overloaded":
      return "text-red-700"
    case "high_load":
      return "text-amber-700"
    case "empty":
      return "text-slate-600"
    default:
      return "text-emerald-700"
  }
}

/**
 * OPS 2.3B/C — Asistente de Jornada.
 * Renders SummaryService output only; no planning math.
 */
export function PlanningJourneySummaryPanel({
  summary,
  title = "Resumen de Cuadrilla",
  className,
}: PlanningJourneySummaryPanelProps) {
  const advisoryWarnings = summary.warnings.filter(
    (warning) => warning.code !== "NO_TASKS" || summary.status === "empty"
  )

  return (
    <aside
      className={cn(
        "rounded-xl border border-slate-200 bg-card px-4 py-3 shadow-sm",
        className
      )}
    >
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-[12px] text-slate-500">{summary.crewName}</p>

      <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          📍 Base
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-slate-900">
          {summary.operationalBaseName}
        </p>
        {summary.operationalBaseAddress ? (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            {summary.operationalBaseAddress}
          </p>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <SummaryRow label="OT asignadas" value={String(summary.taskCount)} />
        <SummaryRow
          label="Trabajo técnico"
          value={formatPlanningEstimatedDurationDetailed(
            summary.technicalMinutes
          )}
        />
        <SummaryRow
          label="Salida"
          value={formatPlanningEstimatedDurationDetailed(
            summary.departureMinutes
          )}
        />
        <SummaryRow
          label="Traslados"
          value={formatPlanningEstimatedDurationDetailed(summary.travelMinutes)}
        />
        <SummaryRow
          label="Regreso"
          value={formatPlanningEstimatedDurationDetailed(summary.returnMinutes)}
        />
        <SummaryRow label="Distancia" value={summary.travelDistanceLabel} />
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
        <SummaryRow
          label="Ocupación"
          value={`${summary.occupancyPercent} %`}
        />
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
          <span className="text-[12px] text-slate-500">Estado</span>
          <span
            className={cn(
              "text-[13px] font-medium",
              statusTone(summary.status)
            )}
          >
            {summary.statusLabel}
          </span>
        </div>
      </div>

      <p
        className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-[12px] leading-snug text-slate-700"
        role="status"
      >
        {summary.recommendation}
      </p>

      {advisoryWarnings.length > 0 ? (
        <ul className="mt-2 space-y-1.5" aria-label="Advertencias operativas">
          {advisoryWarnings.map((warning) => (
            <li
              key={warning.code}
              className={cn(
                "flex items-start gap-1.5 rounded-md border px-2.5 py-2 text-[12px] leading-snug",
                warning.severity === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden
              />
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  )
}
