export const PLANNING_OPERATIONAL_POLL_INTERVAL_MS = 15_000

export const PLANNING_OPERATIONAL_POLL_REFRESH_TARGETS = [
  "tasks",
  "activeIncidents",
  "pendingClosure",
] as const

export type PlanningOperationalPollState = {
  isVisible: boolean
  isRefreshing: boolean
}

export function shouldSkipPlanningOperationalPoll(
  state: PlanningOperationalPollState
): boolean {
  if (!state.isVisible) {
    return true
  }

  if (state.isRefreshing) {
    return true
  }

  return false
}

export function shouldTriggerPlanningOperationalPollOnVisibility(
  visibilityState: string
): boolean {
  return visibilityState === "visible"
}

export function shouldInvalidateTaskDetailOnPlanningRefresh(options?: {
  silent?: boolean
}): boolean {
  return !options?.silent
}

export function shouldShowPlanningIncidentsLoaderOnRefresh(options?: {
  silent?: boolean
}): boolean {
  return !options?.silent
}

export function createPlanningOperationalPollGuard() {
  let isRefreshing = false

  return {
    get isRefreshing() {
      return isRefreshing
    },
    tryBegin(): boolean {
      if (isRefreshing) {
        return false
      }

      isRefreshing = true
      return true
    },
    end() {
      isRefreshing = false
    },
  }
}
