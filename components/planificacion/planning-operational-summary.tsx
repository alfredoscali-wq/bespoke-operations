"use client"



import {

  buildPlanningCrewLegendItems,

  PLANNING_CREW_PIN_COLORS,

  type PlanningCrewLegendItem,

} from "@/lib/planificacion/planning-map-markers"

import type { CrewPlanningStatus } from "@/lib/planificacion/planning-crew-state"

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

  crewPlanningStatusById: Record<string, CrewPlanningStatus>

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

  footer?: React.ReactNode

}



function PlanningOperationsKpiCard({

  label,

  otCount,

  durationLabel,

  backgroundColor,

  isActive,

  onClick,

  ariaLabel,

  footer,

}: PlanningOperationsKpiCardProps) {

  return (

    <div

      className={cn(

        "flex min-h-[8.5rem] min-w-0 flex-1 flex-col rounded-xl text-white transition-all duration-200",

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

          "flex min-h-0 flex-1 flex-col rounded-xl p-4 text-left transition-all duration-200",

          durationLabel ? "justify-between" : "justify-center gap-3",

          "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"

        )}

      >

        <p className="truncate text-sm font-semibold uppercase tracking-wide">

          {label}

        </p>

        <p className="text-4xl font-bold leading-none tabular-nums">

          {otCount} OT

        </p>

        {durationLabel ? (

          <p className="text-base font-medium">⏱ {durationLabel}</p>

        ) : null}

      </button>

      {footer ? <div className="px-4 pb-4 pt-0">{footer}</div> : null}

    </div>

  )

}



function PlanningCrewOperationsKpiCard({

  item,

  summary,

  isActive,

  planningStatus,

  isEditingMode,

  isProcessing,

  onClick,

  onPlan,

  onModify,

}: {

  item: PlanningCrewLegendItem

  summary: PlanningCrewSummary

  isActive: boolean

  planningStatus: CrewPlanningStatus

  isEditingMode: boolean

  isProcessing: boolean

  onClick: () => void

  onPlan?: () => void

  onModify?: () => void

}) {

  const durationLabel = formatPlanningEstimatedDurationDetailed(

    summary.estimatedMinutes

  )

  const isPlanned = planningStatus === "planned"

  const showActions = summary.taskCount > 0



  return (

    <PlanningOperationsKpiCard

      label={item.label}

      otCount={summary.taskCount}

      durationLabel={durationLabel}

      backgroundColor={item.color}

      isActive={isActive}

      onClick={onClick}

      ariaLabel={`${item.label}: ${summary.taskCount} OT, ${durationLabel}. Filtrar cuadrilla.`}

      footer={

        showActions ? (

          <div className="flex flex-col gap-2">

            {isPlanned ? (

              <p className="text-center text-xs font-semibold text-white/95">

                ✓ Planificada

              </p>

            ) : null}

            <Button

              type="button"

              size="sm"

              variant="secondary"

              className="h-8 w-full bg-white/95 text-xs font-semibold text-foreground hover:bg-white"

              disabled={isProcessing}

              onClick={(event) => {

                event.stopPropagation()

                if (isPlanned) {

                  onModify?.()

                } else {

                  onPlan?.()

                }

              }}

            >

              {isProcessing

                ? isPlanned

                  ? "Modificando..."

                  : "Planificando..."

                : isPlanned

                  ? "Modificar"

                  : "Planificar"}

            </Button>

          </div>

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

  crewPlanningStatusById,

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



          const planningStatus = crewPlanningStatusById[item.crewId]

          if (!planningStatus) {

            return null

          }



          return (

            <PlanningCrewOperationsKpiCard

              key={item.crewId}

              item={item}

              summary={summary}

              isActive={activeCrewFilterId === item.crewId}

              planningStatus={planningStatus}

              isEditingMode={isEditingMode}

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


