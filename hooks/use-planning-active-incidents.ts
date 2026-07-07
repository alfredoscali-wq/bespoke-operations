"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchActiveOperationsIncidents } from "@/lib/operations/incidents/fetch-operations-incidents.client"
import { sortIncidentsOldestFirst } from "@/lib/planificacion/planning-incidents"
import type { IncidentSummary } from "@/lib/types/task-incidents"

type UsePlanningActiveIncidentsOptions = {
  enabled?: boolean
}

export function usePlanningActiveIncidents(
  options: UsePlanningActiveIncidentsOptions = {}
) {
  const enabled = options.enabled ?? true
  const [incidents, setIncidents] = useState<IncidentSummary[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) {
      return
    }

    const silent = options?.silent === true

    if (!silent) {
      setIsLoading(true)
    }

    try {
      const data = await fetchActiveOperationsIncidents()
      setIncidents(sortIncidentsOldestFirst(data))
      setError(null)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "No fue posible cargar las incidencias activas."
      )
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    incidents,
    activeCount: incidents.length,
    isLoading,
    error,
    refresh,
  }
}
