"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import {
  COMMERCIAL_TIMELINE_PAGE_SIZE,
  type CommercialActivityStats,
} from "@/lib/commercial/timeline"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createCommercialActivity,
  deleteCommercialActivity,
  getCommercialActivityStats,
  listCommercialActivitiesByOpportunity,
  listCommercialActivityTypes,
  updateCommercialActivity,
} from "@/lib/supabase/commercial-activities.browser"
import type {
  CommercialActivityListItem,
  CommercialActivityType,
} from "@/lib/types/commercial-activities"
import type {
  CreateCommercialActivityPayload,
  UpdateCommercialActivityPayload,
} from "@/lib/types/supabase/commercial-activities"

type MutationResult<T> = {
  success: boolean
  message?: string
  data?: T
}

type CommercialActivitiesContextValue = {
  activities: CommercialActivityListItem[]
  types: CommercialActivityType[]
  stats: CommercialActivityStats
  isReady: boolean
  hasMore: boolean
  isLoadingMore: boolean
  highlightedActivityId: string | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  createActivity: (
    input: Omit<
      CreateCommercialActivityPayload,
      "companyId" | "createdBy" | "employeeId"
    >
  ) => Promise<MutationResult<CommercialActivityListItem>>
  updateActivity: (input: {
    id: string
    payload: Omit<UpdateCommercialActivityPayload, "updatedBy">
  }) => Promise<MutationResult<CommercialActivityListItem>>
  deleteActivity: (
    id: string
  ) => Promise<MutationResult<CommercialActivityListItem | null>>
  duplicateActivity: (
    activity: CommercialActivityListItem
  ) => Promise<MutationResult<CommercialActivityListItem>>
}

const EMPTY_STATS: CommercialActivityStats = {
  total: 0,
  pending: 0,
  completed: 0,
}

const CommercialActivitiesContext =
  createContext<CommercialActivitiesContextValue | null>(null)

function adjustStatsForCreate(
  stats: CommercialActivityStats,
  status: CommercialActivityListItem["status"]
): CommercialActivityStats {
  return {
    total: stats.total + 1,
    pending: stats.pending + (status === "pending" ? 1 : 0),
    completed: stats.completed + (status === "completed" ? 1 : 0),
  }
}

function adjustStatsForDelete(
  stats: CommercialActivityStats,
  status: CommercialActivityListItem["status"]
): CommercialActivityStats {
  return {
    total: Math.max(0, stats.total - 1),
    pending: Math.max(0, stats.pending - (status === "pending" ? 1 : 0)),
    completed: Math.max(0, stats.completed - (status === "completed" ? 1 : 0)),
  }
}

function adjustStatsForUpdate(
  stats: CommercialActivityStats,
  previous: CommercialActivityListItem["status"],
  next: CommercialActivityListItem["status"]
): CommercialActivityStats {
  if (previous === next) return stats
  return {
    total: stats.total,
    pending:
      stats.pending -
      (previous === "pending" ? 1 : 0) +
      (next === "pending" ? 1 : 0),
    completed:
      stats.completed -
      (previous === "completed" ? 1 : 0) +
      (next === "completed" ? 1 : 0),
  }
}

export function CommercialActivitiesProvider({
  opportunityId,
  children,
}: {
  opportunityId: string
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [activities, setActivities] = useState<CommercialActivityListItem[]>(
    []
  )
  const [types, setTypes] = useState<CommercialActivityType[]>([])
  const [stats, setStats] = useState<CommercialActivityStats>(EMPTY_STATS)
  const [isReady, setIsReady] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [highlightedActivityId, setHighlightedActivityId] = useState<
    string | null
  >(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const actorEmployeeId = useMemo(
    () => (sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null),
    [sessionUser]
  )

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }
  }, [])

  const highlightActivity = useCallback(
    (id: string) => {
      clearHighlightTimer()
      setHighlightedActivityId(id)
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedActivityId(null)
        highlightTimeoutRef.current = null
      }, 2000)
    },
    [clearHighlightTimer]
  )

  useEffect(() => {
    return () => clearHighlightTimer()
  }, [clearHighlightTimer])

  const refresh = useCallback(async () => {
    if (!companyId || !opportunityId) {
      setActivities([])
      setStats(EMPTY_STATS)
      setHasMore(false)
      setIsReady(true)
      return
    }

    const [activitiesResult, typesResult, statsResult] = await Promise.all([
      listCommercialActivitiesByOpportunity(companyId, opportunityId, {
        limit: COMMERCIAL_TIMELINE_PAGE_SIZE,
        offset: 0,
      }),
      listCommercialActivityTypes(),
      getCommercialActivityStats(companyId, opportunityId),
    ])

    if (activitiesResult.data) {
      setActivities(activitiesResult.data)
      setHasMore(Boolean(activitiesResult.hasMore))
    }
    if (typesResult.data) {
      setTypes(typesResult.data)
    }
    if (statsResult.data) {
      setStats(statsResult.data)
    }
    setIsReady(true)
  }, [companyId, opportunityId])

  useEffect(() => {
    if (!isAuthReady) return
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      await refresh()
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthReady, refresh])

  const loadMore = useCallback(async () => {
    if (!companyId || !opportunityId || isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      const result = await listCommercialActivitiesByOpportunity(
        companyId,
        opportunityId,
        {
          limit: COMMERCIAL_TIMELINE_PAGE_SIZE,
          offset: activities.length,
        }
      )

      if (result.error || !result.data) return

      setActivities((current) => {
        const existingIds = new Set(current.map((entry) => entry.id))
        const appended = result.data!.filter(
          (entry) => !existingIds.has(entry.id)
        )
        return [...current, ...appended]
      })
      setHasMore(Boolean(result.hasMore))
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    activities.length,
    companyId,
    hasMore,
    isLoadingMore,
    opportunityId,
  ])

  const createActivity = useCallback(
    async (
      input: Omit<
        CreateCommercialActivityPayload,
        "companyId" | "createdBy" | "employeeId"
      >
    ): Promise<MutationResult<CommercialActivityListItem>> => {
      if (!companyId) {
        return { success: false, message: "Empresa no resuelta." }
      }

      const result = await createCommercialActivity({
        ...input,
        companyId,
        employeeId: actorEmployeeId,
        createdBy: actorEmployeeId,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo crear la actividad.",
        }
      }

      setActivities((current) => [result.data!, ...current])
      setStats((current) => adjustStatsForCreate(current, result.data!.status))
      highlightActivity(result.data.id)
      return { success: true, data: result.data }
    },
    [actorEmployeeId, companyId, highlightActivity]
  )

  const updateActivity = useCallback(
    async (input: {
      id: string
      payload: Omit<UpdateCommercialActivityPayload, "updatedBy">
    }): Promise<MutationResult<CommercialActivityListItem>> => {
      const previous = activities.find((entry) => entry.id === input.id)
      const result = await updateCommercialActivity(input.id, {
        ...input.payload,
        updatedBy: actorEmployeeId,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo actualizar la actividad.",
        }
      }

      setActivities((current) =>
        current.map((entry) =>
          entry.id === result.data!.id ? result.data! : entry
        )
      )
      if (previous && previous.status !== result.data.status) {
        setStats((current) =>
          adjustStatsForUpdate(current, previous.status, result.data!.status)
        )
      }
      return { success: true, data: result.data }
    },
    [actorEmployeeId, activities]
  )

  const deleteActivity = useCallback(
    async (
      id: string
    ): Promise<MutationResult<CommercialActivityListItem | null>> => {
      const previous = activities.find((entry) => entry.id === id)
      const result = await deleteCommercialActivity(id, actorEmployeeId)
      if (result.error) {
        return {
          success: false,
          message: result.error.message ?? "No se pudo eliminar la actividad.",
        }
      }

      setActivities((current) => current.filter((entry) => entry.id !== id))
      if (previous) {
        setStats((current) => adjustStatsForDelete(current, previous.status))
      }
      return { success: true, data: null }
    },
    [actorEmployeeId, activities]
  )

  const duplicateActivity = useCallback(
    async (
      activity: CommercialActivityListItem
    ): Promise<MutationResult<CommercialActivityListItem>> => {
      return createActivity({
        opportunityId: activity.opportunityId,
        activityTypeCode: activity.activityTypeCode,
        title: activity.title,
        description: activity.description,
        status: activity.status,
        scheduledAt: null,
        completedAt: null,
        metadata: activity.metadata ?? {},
      })
    },
    [createActivity]
  )

  const value = useMemo(
    () => ({
      activities,
      types,
      stats,
      isReady,
      hasMore,
      isLoadingMore,
      highlightedActivityId,
      refresh,
      loadMore,
      createActivity,
      updateActivity,
      deleteActivity,
      duplicateActivity,
    }),
    [
      activities,
      types,
      stats,
      isReady,
      hasMore,
      isLoadingMore,
      highlightedActivityId,
      refresh,
      loadMore,
      createActivity,
      updateActivity,
      deleteActivity,
      duplicateActivity,
    ]
  )

  return (
    <CommercialActivitiesContext.Provider value={value}>
      {children}
    </CommercialActivitiesContext.Provider>
  )
}

function useCommercialActivitiesContext() {
  const context = useContext(CommercialActivitiesContext)
  if (!context) {
    throw new Error(
      "Commercial activity hooks must be used within CommercialActivitiesProvider."
    )
  }
  return context
}

export function useCommercialActivities() {
  const {
    activities,
    isReady,
    refresh,
    hasMore,
    isLoadingMore,
    loadMore,
    stats,
    highlightedActivityId,
  } = useCommercialActivitiesContext()
  return {
    data: activities,
    isLoading: !isReady,
    refetch: refresh,
    hasMore,
    isLoadingMore,
    loadMore,
    stats,
    highlightedActivityId,
  }
}

export function useCommercialActivityTypes() {
  const { types, isReady } = useCommercialActivitiesContext()
  return {
    data: types,
    isLoading: !isReady,
  }
}

export function useCreateCommercialActivity() {
  const { createActivity } = useCommercialActivitiesContext()
  return { mutateAsync: createActivity }
}

export function useUpdateCommercialActivity() {
  const { updateActivity } = useCommercialActivitiesContext()
  return { mutateAsync: updateActivity }
}

export function useDeleteCommercialActivity() {
  const { deleteActivity } = useCommercialActivitiesContext()
  return { mutateAsync: deleteActivity }
}

export function useDuplicateCommercialActivity() {
  const { duplicateActivity } = useCommercialActivitiesContext()
  return { mutateAsync: duplicateActivity }
}
