"use client"

import { useState } from "react"
import { ArrowDown } from "lucide-react"

import {
  formatPlanningTravelDistanceLabel,
  resolvePlanningTravelAttention,
  resolvePlanningTravelAttentionLabel,
  resolvePlanningTravelAttentionShellClass,
  resolvePlanningTravelAttentionToneClass,
} from "@/lib/planificacion/planning-ui-density"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export type PlanningTravelSegmentVariant =
  | "connector"
  | "journey-start"
  | "journey-end"

type PlanningTravelSegmentRowProps = {
  fromLabel: string
  toLabel: string
  minutes: number
  /** Optional distance from persisted RouteService metadata. */
  distanceMeters?: number
  colSpan: number
  readOnly?: boolean
  isSaving?: boolean
  /** @deprecated Prefer variant — kept for callers that only know base legs. */
  isBaseLeg?: boolean
  variant?: PlanningTravelSegmentVariant
  /** Display name for operational base (e.g. Oficinas). */
  baseDisplayName?: string | null
  onCommitMinutes: (minutes: number) => void | Promise<void>
  className?: string
}

function TravelMetricsEnd({
  fromLabel,
  toLabel,
  minutes,
  draft,
  setDraft,
  distanceLabel,
  tone,
  attentionLabel,
  readOnly,
  isSaving,
  onCommit,
}: {
  fromLabel: string
  toLabel: string
  minutes: number
  draft: string
  setDraft: (value: string) => void
  distanceLabel: string | null
  tone: string
  attentionLabel: string | null
  readOnly: boolean
  isSaving: boolean
  onCommit: () => void
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
      {attentionLabel ? (
        <span className={cn("text-[9px] font-medium", tone)}>
          {attentionLabel}
        </span>
      ) : null}
      {readOnly ? (
        <span
          className={cn(
            "whitespace-nowrap text-right text-[11px] font-medium tabular-nums",
            tone
          )}
        >
          {minutes} min
          {distanceLabel ? ` · ${distanceLabel}` : ""}
        </span>
      ) : (
        <label className="flex items-center justify-end gap-1">
          <span className="sr-only">
            Minutos de traslado {fromLabel} a {toLabel}
          </span>
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={draft}
            disabled={isSaving}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              onCommit()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                ;(event.target as HTMLInputElement).blur()
              }
            }}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "h-5 w-11 border-slate-200/70 bg-white px-0.5 text-center text-[11px] tabular-nums font-medium",
              tone
            )}
          />
          <span
            className={cn(
              "whitespace-nowrap text-[10px] font-medium tabular-nums",
              tone
            )}
          >
            min
            {distanceLabel ? (
              <span className="ml-1 font-normal text-slate-500">
                · {distanceLabel}
              </span>
            ) : null}
          </span>
        </label>
      )}
    </div>
  )
}

/**
 * OPS 2.4.3 — neutral travel connectors; color only for exceptions.
 */
export function PlanningTravelSegmentRow({
  fromLabel,
  toLabel,
  minutes,
  distanceMeters = 0,
  colSpan,
  readOnly = false,
  isSaving = false,
  isBaseLeg = false,
  variant: variantProp,
  baseDisplayName = null,
  onCommitMinutes,
  className,
}: PlanningTravelSegmentRowProps) {
  const [draft, setDraft] = useState(String(minutes))
  const [syncedMinutes, setSyncedMinutes] = useState(minutes)
  if (minutes !== syncedMinutes) {
    setSyncedMinutes(minutes)
    setDraft(String(minutes))
  }

  async function commit() {
    const parsed = Number.parseInt(draft.trim(), 10)
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    setDraft(String(next))
    if (next === minutes) {
      return
    }
    await onCommitMinutes(next)
  }

  const distanceLabel = formatPlanningTravelDistanceLabel(distanceMeters)
  const attention = resolvePlanningTravelAttention({
    minutes,
    distanceMeters,
  })
  const tone = resolvePlanningTravelAttentionToneClass(attention)
  const shell = resolvePlanningTravelAttentionShellClass(attention)
  const attentionLabel = resolvePlanningTravelAttentionLabel(attention)
  const baseName = baseDisplayName?.trim() || "Base Operativa"
  const metricsProps = {
    fromLabel,
    toLabel,
    minutes,
    draft,
    setDraft,
    distanceLabel,
    tone,
    attentionLabel,
    readOnly,
    isSaving,
    onCommit: () => {
      void commit()
    },
  }

  const variant: PlanningTravelSegmentVariant =
    variantProp ??
    (isBaseLeg
      ? fromLabel === "Base"
        ? "journey-start"
        : "journey-end"
      : "connector")

  if (variant === "journey-start") {
    return (
      <tr
        className={cn("border-b border-slate-100", className)}
        data-planning-travel-segment="journey-start"
      >
        <td colSpan={colSpan} className="px-1.5 py-1">
          <div
            className={cn(
              "rounded-md border border-slate-200/70 bg-slate-50/60 px-2 py-1",
              attention !== "none" && shell
            )}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  📍 Inicio de Jornada
                </p>
                <p className="text-[11px] font-medium leading-tight text-slate-700">
                  Base Operativa
                </p>
                <p className="truncate text-[10px] leading-tight text-slate-500">
                  {baseName}
                </p>
              </div>
              <ArrowDown
                className="size-3 shrink-0 text-slate-400"
                aria-hidden
              />
              <TravelMetricsEnd {...metricsProps} />
            </div>
          </div>
        </td>
      </tr>
    )
  }

  if (variant === "journey-end") {
    return (
      <tr
        className={cn("border-b border-slate-100", className)}
        data-planning-travel-segment="journey-end"
      >
        <td colSpan={colSpan} className="px-1.5 py-1">
          <div
            className={cn(
              "rounded-md border border-slate-200/70 bg-slate-50/60 px-2 py-1",
              attention !== "none" && shell
            )}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  Última OT
                </p>
                <p className="text-[11px] font-medium leading-tight text-slate-700">
                  📍 Regreso a Base
                </p>
                <p className="truncate text-[10px] leading-tight text-slate-500">
                  {baseName}
                </p>
              </div>
              <ArrowDown
                className="size-3 shrink-0 text-slate-400"
                aria-hidden
              />
              <TravelMetricsEnd {...metricsProps} />
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className={cn("border-b border-slate-50", className)}
      data-planning-travel-segment="connector"
    >
      <td colSpan={colSpan} className="px-1.5 py-0">
        <div
          className={cn(
            "flex min-h-5 items-center gap-1.5 rounded px-1.5 py-0.5",
            shell
          )}
        >
          <ArrowDown
            className="size-3 shrink-0 text-slate-400"
            aria-hidden
          />
          <p className="min-w-0 flex-1 truncate text-[10px] text-slate-500">
            <span className="text-slate-600">{fromLabel}</span>
            <span className="mx-1 text-slate-300">→</span>
            <span className="text-slate-600">{toLabel}</span>
          </p>
          <TravelMetricsEnd {...metricsProps} />
        </div>
      </td>
    </tr>
  )
}
