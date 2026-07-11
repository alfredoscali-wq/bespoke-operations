"use client"

import {
  buildPlanningCrewLegendItems,
  PLANNING_CREW_PIN_COLORS,
  type PlanningCrewLegendItem,
} from "@/lib/planificacion/planning-map-markers"
import type {
  CrewPlanningButtonVisibility,
} from "@/lib/planificacion/planning-crew-state"
import {
  formatPlanningEstimatedDurationDetailed,
  type PlanningCrewSummary,
} from "@/lib/planificacion/planning-utils"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Azul institucional — KPI OT Programadas (distinto del azul de cuadrilla 1). */
export const PLANNING_KPI_PROGRAMMED_COLOR = "#1e40af"

type PlanningOperationalSummaryProps = {
  programmedCount: number
  crewSummaries: PlanningCrewSummary[]
  crewIdsInOrder: string[]
  crewNamesById: Record<string, string>
  activeCrewFilterId: string | null
  crewPlanningButtonsById: Record<string, CrewPlanningButtonVisibility>
  isEditingMode?: boolean
  processingCrewId?: string | null
  crewActionError?: string | null
  onSelectAll: () => void
  onSelectCrew: (crewId: string) => void
  onPlanCrew?: (crewId: string) => void
  onModifyCrew?: (crewId: string) => void
  className?: string
}

type PlanningOperationsKpiCardProps = {
  label: string
  otCount: number
  durationLabel?: string
  backgroundColor: string
  isActive: boolean
  onClick: () => void
  ariaLabel: string
  actions?: React.ReactNode
}

function PlanningOperationsKpiCard({
  label,
  otCount,
  durationLabel,
  backgroundColor,
  isActive,
  onClick,
  ariaLabel,
  actions,
}: PlanningOperationsKpiCardProps) {
  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] min-w-0 flex-1 items-stretch rounded-xl text-white transition-all duration-200",
        isActive
          ? "shadow-lg ring-2 ring-white/90 brightness-110"
          : "opacity-90 hover:opacity-100"
      )}
      style={{ backgroundColor }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={ariaLabel}
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center rounded-xl px-3 py-2 text-left transition-all duration-200",
          "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        )}
      >
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xl font-bold leading-tight tabular-nums">
          {otCount} OT
          {durationLabel ? (
            <span className="ml-1.5 text-sm font-medium">· ⏱ {durationLabel}</span>
          ) : null}
        </p>
      </button>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1 px-2">{actions}</div>
      ) : null}
    </div>
  )
}

function PlanningCrewOperationsKpiCard({
  item,
  summary,
  isActive,
  buttonVisibility,
  isProcessing,
  onClick,
  onPlan,
  onModify,
}: {
  item: PlanningCrewLegendItem
  summary: PlanningCrewSummary
  isActive: boolean
  buttonVisibility: CrewPlanningButtonVisibility
  isProcessing: boolean
  onClick: () => void
  onPlan?: () => void
  onModify?: () => void
}) {
  const durationLabel = formatPlanningEstimatedDurationDetailed(
    summary.estimatedMinutes
  )
  const { showPlanificar, showReplanificar } = buttonVisibility
  const showActions = showPlanificar || showReplanificar

  return (
    <PlanningOperationsKpiCard
      label={item.label}
      otCount={summary.taskCount}
      durationLabel={durationLabel}
      backgroundColor={item.color}
      isActive={isActive}
      onClick={onClick}
      ariaLabel={`${item.label}: ${summary.taskCount} OT, ${durationLabel}. Filtrar cuadrilla.`}
      actions={
        showActions ? (
          <>
            {showPlanificar ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 bg-white/95 px-2 text-[11px] font-semibold text-foreground hover:bg-white"
                disabled={isProcessing}
                onClick={(event) => {
                  event.stopPropagation()
                  onPlan?.()
                }}
              >
                {isProcessing ? "..." : "Planificar"}
              </Button>
            ) : null}
            {showReplanificar ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-white/70 bg-white/10 px-2 text-[11px] font-semibold text-white hover:bg-white/20 hover:text-white"
                disabled={isProcessing}
                onClick={(event) => {
                  event.stopPropagation()
                  onModify?.()
                }}
              >
                {isProcessing ? "..." : "Replanificar"}
              </Button>
            ) : null}
          </>
        ) : null
      }
    />
  )
}

export function PlanningOperationalSummary({
  programmedCount,
  crewSummaries,
  crewIdsInOrder,
  crewNamesById,
  activeCrewFilterId,
  crewPlanningButtonsById,
  isEditingMode = false,
  processingCrewId = null,
  crewActionError = null,
  onSelectAll,
  onSelectCrew,
  onPlanCrew,
  onModifyCrew,
  className,
}: PlanningOperationalSummaryProps) {
  const crewLegendItems = buildPlanningCrewLegendItems(
    crewIdsInOrder,
    crewNamesById
  )
  const summariesByCrewId = new Map(
    crewSummaries.map((summary) => [summary.crew.id, summary] as const)
  )

  return (
    <section className={cn("w-full", className)}>
      <div className="flex w-full gap-2">
        <PlanningOperationsKpiCard
          label="OT Programadas"
          otCount={programmedCount}
          backgroundColor={PLANNING_KPI_PROGRAMMED_COLOR}
          isActive={activeCrewFilterId == null}
          onClick={onSelectAll}
          ariaLabel={`OT Programadas: ${programmedCount}. Mostrar todas las órdenes.`}
        />

        {crewLegendItems.map((item) => {
          const summary = summariesByCrewId.get(item.crewId)
          if (!summary) {
            return null
          }

          const buttonVisibility = crewPlanningButtonsById[item.crewId]
          if (!buttonVisibility) {
            return null
          }

          return (
            <PlanningCrewOperationsKpiCard
              key={item.crewId}
              item={item}
              summary={summary}
              isActive={activeCrewFilterId === item.crewId}
              buttonVisibility={buttonVisibility}
              isProcessing={processingCrewId === item.crewId}
              onClick={() => onSelectCrew(item.crewId)}
              onPlan={
                onPlanCrew ? () => onPlanCrew(item.crewId) : undefined
              }
              onModify={
                onModifyCrew ? () => onModifyCrew(item.crewId) : undefined
              }
            />
          )
        })}
      </div>

      {crewActionError ? (
        <p
          className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {crewActionError}
        </p>
      ) : null}
    </section>
  )
}

export { PLANNING_CREW_PIN_COLORS }
