"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createCommercialActivity,
  deleteCommercialActivity,
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
  isReady: boolean
  refresh: () => Promise<void>
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
}

const CommercialActivitiesContext =
  createContext<CommercialActivitiesContextValue | null>(null)

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
  const [isReady, setIsReady] = useState(false)

  const actorEmployeeId = useMemo(
    () => (sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null),
    [sessionUser]
  )

  const refresh = useCallback(async () => {
    if (!companyId || !opportunityId) {
      setActivities([])
      setIsReady(true)
      return
    }

    const [activitiesResult, typesResult] = await Promise.all([
      listCommercialActivitiesByOpportunity(companyId, opportunityId),
      listCommercialActivityTypes(),
    ])

    if (activitiesResult.data) {
      setActivities(activitiesResult.data)
    }
    if (typesResult.data) {
      setTypes(typesResult.data)
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
      return { success: true, data: result.data }
    },
    [actorEmployeeId, companyId]
  )

  const updateActivity = useCallback(
    async (input: {
      id: string
      payload: Omit<UpdateCommercialActivityPayload, "updatedBy">
    }): Promise<MutationResult<CommercialActivityListItem>> => {
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
      return { success: true, data: result.data }
    },
    [actorEmployeeId]
  )

  const deleteActivity = useCallback(
    async (
      id: string
    ): Promise<MutationResult<CommercialActivityListItem | null>> => {
      const result = await deleteCommercialActivity(id, actorEmployeeId)
      if (result.error) {
        return {
          success: false,
          message: result.error.message ?? "No se pudo eliminar la actividad.",
        }
      }

      setActivities((current) => current.filter((entry) => entry.id !== id))
      return { success: true, data: null }
    },
    [actorEmployeeId]
  )

  const value = useMemo(
    () => ({
      activities,
      types,
      isReady,
      refresh,
      createActivity,
      updateActivity,
      deleteActivity,
    }),
    [
      activities,
      types,
      isReady,
      refresh,
      createActivity,
      updateActivity,
      deleteActivity,
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
  const { activities, isReady, refresh } = useCommercialActivitiesContext()
  return {
    data: activities,
    isLoading: !isReady,
    refetch: refresh,
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
