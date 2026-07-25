"use client"

import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

import type { CrewPlanningSummary } from "@/lib/engines/planning/contracts/CrewPlanningSummary"
import {
  formatPlanningEstimatedClockTime,
  resolvePlanningCapacityMargin,
} from "@/lib/planificacion/planning-ui-density"
import { formatPlanningEstimatedDurationDetailed } from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

type PlanningJourneySummaryPanelProps = {
  summary: CrewPlanningSummary
  /** Habitual / day-override start (HH:MM) — display only with totalMinutes. */
  journeyStartTime?: string | null
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
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span
        className={cn(
          "text-[12px] tabular-nums text-slate-800",
          emphasize && "font-semibold"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SummaryBlock({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "space-y-1.5 border-b border-slate-100 py-2 last:border-b-0 last:pb-0",
        className
      )}
    >
      {children}
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
 * OPS 2.4.1 — Asistente de Jornada in functional blocks.
 * Renders SummaryService output only; clock end is display formatting.
 */
export function PlanningJourneySummaryPanel({
  summary,
  journeyStartTime = null,
  title = "Resumen de Cuadrilla",
  className,
}: PlanningJourneySummaryPanelProps) {
  const advisoryWarnings = summary.warnings.filter(
    (warning) => warning.code !== "NO_TASKS" || summary.status === "empty"
  )
  const startLabel = journeyStartTime?.trim() || null
  const endLabel =
    startLabel != null
      ? formatPlanningEstimatedClockTime(startLabel, summary.totalMinutes)
      : null
  const capacityMargin = resolvePlanningCapacityMargin({
    remainingMinutes: summary.remainingMinutes,
    availableMinutes: summary.availableMinutes,
    totalMinutes: summary.totalMinutes,
  })

  return (
    <aside
      className={cn(
        "rounded-xl border border-slate-200 bg-card px-3 py-2.5 shadow-sm",
        className
      )}
    >
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      <p className="text-[11px] text-slate-500">{summary.crewName}</p>

      <SummaryBlock className="mt-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-slate-500">Estado</span>
          <span
            className={cn(
              "text-[13px] font-semibold",
              statusTone(summary.status)
            )}
          >
            {summary.statusLabel}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] text-slate-500">Ocupación</span>
          <div className="text-right">
            <p className="text-[15px] font-semibold tabular-nums text-slate-900">
              {summary.occupancyPercent} %
            </p>
            <p
              className={cn(
                "text-[11px] font-medium tabular-nums",
                capacityMargin.toneClass
              )}
            >
              {capacityMargin.label}{" "}
              <span className="font-semibold">{capacityMargin.signedValue}</span>
            </p>
          </div>
        </div>
        <p
          className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-700"
          role="status"
        >
          {summary.recommendation}
        </p>
      </SummaryBlock>

      <SummaryBlock>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Jornada
        </p>
        <p className="text-[15px] font-semibold tabular-nums tracking-tight text-slate-900">
          {startLabel && endLabel ? (
            <>
              {startLabel}
              <span className="mx-1.5 font-medium text-slate-400">→</span>
              {endLabel}
            </>
          ) : (
            "—"
          )}
        </p>
      </SummaryBlock>

      <SummaryBlock>
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
        <SummaryRow label="Distancia" value={summary.travelDistanceLabel} />
        <SummaryRow
          label="Total"
          value={formatPlanningEstimatedDurationDetailed(summary.totalMinutes)}
          emphasize
        />
      </SummaryBlock>

      <SummaryBlock>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          📍 Base Operativa
        </p>
        <p className="text-[12px] font-medium text-slate-900">
          {summary.operationalBaseName}
        </p>
        {summary.operationalBaseAddress ? (
          <p className="text-[10px] leading-snug text-slate-500">
            {summary.operationalBaseAddress}
          </p>
        ) : null}
        <div className="space-y-0.5 pt-0.5">
          <SummaryRow
            label="Salida"
            value={formatPlanningEstimatedDurationDetailed(
              summary.departureMinutes
            )}
          />
          <SummaryRow
            label="Regreso"
            value={formatPlanningEstimatedDurationDetailed(
              summary.returnMinutes
            )}
          />
        </div>
      </SummaryBlock>

      {/* OPS v2 metrics extension point — no placeholders. */}
      <div className="hidden" data-planning-v2-metrics-slot="" aria-hidden />

      {advisoryWarnings.length > 0 ? (
        <SummaryBlock className="!border-b-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Advertencias
          </p>
          <ul className="space-y-1" aria-label="Advertencias operativas">
            {advisoryWarnings.map((warning) => (
              <li
                key={warning.code}
                className={cn(
                  "flex items-start gap-1 rounded-md border px-2 py-1.5 text-[11px] leading-snug",
                  warning.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                )}
              >
                <AlertTriangle
                  className="mt-0.5 size-3 shrink-0"
                  aria-hidden
                />
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </SummaryBlock>
      ) : null}
    </aside>
  )
}
