"use client"

import { useQuery } from "@tanstack/react-query"

import { drainAnalysisTimelineEvents } from "@/lib/analysis/queries/drain-timeline-events"
import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"
import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"

export type JornadaPeriodEventsResult = {
  items: ActivityTimelineEvent[]
}

/**
 * Actividad de la Jornada — one cached download per employee + period.
 * Drains timeline pages at max size (batch), never per-event queries.
 */
export function useJornadaPeriodEventsQuery(
  input: {
    employeeId: string
    dateFromInput: string
    dateToInput: string
  },
  enabled: boolean
) {
  return useQuery({
    queryKey: analysisQueryKeys.jornada({
      employeeId: input.employeeId,
      dateFrom: input.dateFromInput,
      dateTo: input.dateToInput,
    }),
    queryFn: async (): Promise<JornadaPeriodEventsResult> => {
      const items = await drainAnalysisTimelineEvents({
        scope: { kind: "employee", employeeId: input.employeeId },
        dateFromInput: input.dateFromInput,
        dateToInput: input.dateToInput,
      })
      return { items }
    },
    enabled: Boolean(
      enabled && input.employeeId && input.dateFromInput && input.dateToInput
    ),
  })
}
