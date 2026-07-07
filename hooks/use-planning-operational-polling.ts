"use client"

import { useCallback, useEffect, useRef } from "react"

import type { TaskMutationResult } from "@/components/tareas/tasks-provider/types"
import {
  PLANNING_OPERATIONAL_POLL_INTERVAL_MS,
  createPlanningOperationalPollGuard,
  shouldSkipPlanningOperationalPoll,
  shouldTriggerPlanningOperationalPollOnVisibility,
} from "@/lib/planificacion/planning-operational-polling"

type RefreshTasksFromServer = (options?: {
  silent?: boolean
}) => Promise<TaskMutationResult>

type RefreshActiveIncidents = (options?: {
  silent?: boolean
}) => Promise<void>

type UsePlanningOperationalPollingOptions = {
  enabled?: boolean
  refreshTasksFromServer: RefreshTasksFromServer
  refreshActiveIncidents: RefreshActiveIncidents
}

export function usePlanningOperationalPolling({
  enabled = true,
  refreshTasksFromServer,
  refreshActiveIncidents,
}: UsePlanningOperationalPollingOptions) {
  const guardRef = useRef(createPlanningOperationalPollGuard())
  const refreshTasksRef = useRef(refreshTasksFromServer)
  const refreshIncidentsRef = useRef(refreshActiveIncidents)

  useEffect(() => {
    refreshTasksRef.current = refreshTasksFromServer
    refreshIncidentsRef.current = refreshActiveIncidents
  }, [refreshActiveIncidents, refreshTasksFromServer])

  const runRefresh = useCallback(async () => {
    const guard = guardRef.current
    const isVisible =
      typeof document === "undefined"
        ? true
        : document.visibilityState === "visible"

    if (
      shouldSkipPlanningOperationalPoll({
        isVisible,
        isRefreshing: guard.isRefreshing,
      })
    ) {
      return
    }

    if (!guard.tryBegin()) {
      return
    }

    try {
      await Promise.all([
        refreshTasksRef.current({ silent: true }),
        refreshIncidentsRef.current({ silent: true }),
      ])
    } finally {
      guard.end()
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const intervalId = window.setInterval(() => {
      void runRefresh()
    }, PLANNING_OPERATIONAL_POLL_INTERVAL_MS)

    function handleVisibilityChange() {
      if (
        shouldTriggerPlanningOperationalPollOnVisibility(document.visibilityState)
      ) {
        void runRefresh()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, runRefresh])

  return { refreshNow: runRefresh }
}
