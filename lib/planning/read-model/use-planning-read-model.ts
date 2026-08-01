"use client"

/**
 * Consumes PlanningReadModel via memory cache + existing React Query client.
 */

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { buildPlanningReadModel } from "@/lib/planning/read-model/builder"
import {
  buildPlanningReadCacheKey,
  getOrBuildPlanningReadModel,
} from "@/lib/planning/read-model/cache"
import { PLANNING_READ_QUERY_DEFAULTS } from "@/lib/planning/read-model/defaults"
import { planningQueryKeys } from "@/lib/planning/read-model/keys"
import type { PlanningReadModel } from "@/lib/planning/read-model/types"
import type { IncidentSummary } from "@/lib/types/task-incidents"

export type UsePlanningReadModelParams = {
  date: string
  crewFilterId: string | null
  overdueFilterActive: boolean
  dayConfigRevision: number
  activeIncidents: IncidentSummary[]
  activeIncidentsCount: number
}

/**
 * Single read entry for Planning UI.
 * Sources providers once at this boundary; children must use the returned model.
 */
export function usePlanningReadModel(
  params: UsePlanningReadModelParams
): PlanningReadModel {
  const { tasks } = useTasks()
  const { crews } = useCrews()
  const { employees } = useEmployees()
  const queryClient = useQueryClient()

  const input = useMemo(
    () => ({
      date: params.date,
      crewFilterId: params.crewFilterId,
      overdueFilterActive: params.overdueFilterActive,
      dayConfigRevision: params.dayConfigRevision,
      tasks: [...tasks],
      crews: [...crews],
      employees: [...employees],
      activeIncidents: [...params.activeIncidents],
      activeIncidentsCount: params.activeIncidentsCount,
    }),
    [
      params.date,
      params.crewFilterId,
      params.overdueFilterActive,
      params.dayConfigRevision,
      params.activeIncidents,
      params.activeIncidentsCount,
      tasks,
      crews,
      employees,
    ]
  )

  const cacheKey = useMemo(() => buildPlanningReadCacheKey(input), [input])
  const queryKey = planningQueryKeys.readModel(cacheKey)

  const model = useMemo(() => {
    const next = getOrBuildPlanningReadModel(cacheKey, () =>
      buildPlanningReadModel(input)
    )
    queryClient.setQueryData(queryKey, next)
    return next
  }, [cacheKey, input, queryClient, queryKey])

  // Register with existing RQ client for stale/gc policy without refetch chatter.
  useQuery({
    queryKey,
    queryFn: () => model,
    initialData: model,
    ...PLANNING_READ_QUERY_DEFAULTS,
  })

  return model
}
