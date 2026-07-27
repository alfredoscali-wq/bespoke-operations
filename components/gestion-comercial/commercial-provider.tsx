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
  createCommercialOpportunity,
  createCommercialPerson,
  deleteCommercialOpportunity,
  getCommercialOpportunityById,
  getCommercialPersonById,
  listCommercialOpportunities,
  listCommercialPeople,
  updateCommercialOpportunity,
} from "@/lib/supabase/commercial.browser"
import type {
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  CreateCommercialOpportunityPayload,
  CreateCommercialPersonPayload,
  UpdateCommercialOpportunityPayload,
} from "@/lib/types/supabase/commercial"

type MutationResult<T> = {
  success: boolean
  message?: string
  data?: T
}

type CommercialContextValue = {
  people: CommercialPerson[]
  opportunities: CommercialOpportunityListItem[]
  isReady: boolean
  refresh: () => Promise<void>
  createPerson: (
    input: Omit<CreateCommercialPersonPayload, "companyId" | "createdBy">
  ) => Promise<MutationResult<CommercialPerson>>
  createOpportunity: (
    input: Omit<CreateCommercialOpportunityPayload, "companyId" | "createdBy">
  ) => Promise<MutationResult<CommercialOpportunity>>
  updateOpportunity: (
    id: string,
    input: Omit<UpdateCommercialOpportunityPayload, "updatedBy">
  ) => Promise<MutationResult<CommercialOpportunity>>
  deleteOpportunity: (id: string) => Promise<MutationResult<CommercialOpportunity>>
  getPerson: (id: string) => Promise<CommercialPerson | null>
  getOpportunity: (id: string) => Promise<CommercialOpportunity | null>
}

const CommercialContext = createContext<CommercialContextValue | null>(null)

export function CommercialProvider({ children }: { children: React.ReactNode }) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [people, setPeople] = useState<CommercialPerson[]>([])
  const [opportunities, setOpportunities] = useState<
    CommercialOpportunityListItem[]
  >([])
  const [isReady, setIsReady] = useState(false)

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

  const refresh = useCallback(async () => {
    if (!companyId) {
      setPeople([])
      setOpportunities([])
      setIsReady(true)
      return
    }

    const [peopleResult, opportunitiesResult] = await Promise.all([
      listCommercialPeople(companyId),
      listCommercialOpportunities(companyId),
    ])

    if (peopleResult.data) {
      setPeople(peopleResult.data)
    }
    if (opportunitiesResult.data) {
      setOpportunities(opportunitiesResult.data)
    }
    setIsReady(true)
  }, [companyId])

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

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

  const createPerson = useCallback(
    async (
      input: Omit<CreateCommercialPersonPayload, "companyId" | "createdBy">
    ): Promise<MutationResult<CommercialPerson>> => {
      if (!companyId) {
        return { success: false, message: "Empresa no resuelta." }
      }

      const result = await createCommercialPerson({
        ...input,
        companyId,
        createdBy: actorEmployeeId,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo crear el prospecto.",
        }
      }

      setPeople((current) => [result.data!, ...current])
      return { success: true, data: result.data }
    },
    [actorEmployeeId, companyId]
  )

  const createOpportunity = useCallback(
    async (
      input: Omit<CreateCommercialOpportunityPayload, "companyId" | "createdBy">
    ): Promise<MutationResult<CommercialOpportunity>> => {
      if (!companyId) {
        return { success: false, message: "Empresa no resuelta." }
      }

      const result = await createCommercialOpportunity({
        ...input,
        companyId,
        createdBy: actorEmployeeId,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo crear la oportunidad.",
        }
      }

      await refresh()
      return { success: true, data: result.data }
    },
    [actorEmployeeId, companyId, refresh]
  )

  const updateOpportunity = useCallback(
    async (
      id: string,
      input: Omit<UpdateCommercialOpportunityPayload, "updatedBy">
    ): Promise<MutationResult<CommercialOpportunity>> => {
      const result = await updateCommercialOpportunity(id, {
        ...input,
        updatedBy: actorEmployeeId,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo actualizar la oportunidad.",
        }
      }

      await refresh()
      return { success: true, data: result.data }
    },
    [actorEmployeeId, refresh]
  )

  const deleteOpportunity = useCallback(
    async (id: string): Promise<MutationResult<CommercialOpportunity>> => {
      const result = await deleteCommercialOpportunity(id, actorEmployeeId)

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo eliminar la oportunidad.",
        }
      }

      setOpportunities((current) =>
        current.filter((opportunity) => opportunity.id !== id)
      )
      return { success: true, data: result.data }
    },
    [actorEmployeeId]
  )

  const getPerson = useCallback(async (id: string) => {
    const cached = people.find((person) => person.id === id)
    if (cached) return cached

    const result = await getCommercialPersonById(id)
    return result.data
  }, [people])

  const getOpportunity = useCallback(
    async (id: string) => {
      const cached = opportunities.find((opportunity) => opportunity.id === id)
      if (cached) return cached

      const result = await getCommercialOpportunityById(id)
      return result.data
    },
    [opportunities]
  )

  const value = useMemo<CommercialContextValue>(
    () => ({
      people,
      opportunities,
      isReady,
      refresh,
      createPerson,
      createOpportunity,
      updateOpportunity,
      deleteOpportunity,
      getPerson,
      getOpportunity,
    }),
    [
      people,
      opportunities,
      isReady,
      refresh,
      createPerson,
      createOpportunity,
      updateOpportunity,
      deleteOpportunity,
      getPerson,
      getOpportunity,
    ]
  )

  return (
    <CommercialContext.Provider value={value}>
      {children}
    </CommercialContext.Provider>
  )
}

function useCommercialContext(): CommercialContextValue {
  const context = useContext(CommercialContext)
  if (!context) {
    throw new Error("Commercial hooks must be used within CommercialProvider.")
  }
  return context
}

/** Domain list hook (Context; project does not use React Query). */
export function useCommercialPeople() {
  const { people, isReady, refresh } = useCommercialContext()
  return {
    data: people,
    isLoading: !isReady,
    refetch: refresh,
  }
}

export function useCommercialPerson(personId: string | null | undefined) {
  const { people, isReady } = useCommercialContext()
  const data = personId
    ? (people.find((person) => person.id === personId) ?? null)
    : null

  return {
    data,
    isLoading: Boolean(personId) && !isReady,
  }
}

export function useCommercialOpportunities() {
  const { opportunities, isReady, refresh } = useCommercialContext()
  return {
    data: opportunities,
    isLoading: !isReady,
    refetch: refresh,
  }
}

export function useCommercialOpportunity(
  opportunityId: string | null | undefined
) {
  const { opportunities, isReady } = useCommercialContext()
  const data = opportunityId
    ? (opportunities.find((opportunity) => opportunity.id === opportunityId) ??
      null)
    : null

  return {
    data,
    isLoading: Boolean(opportunityId) && !isReady,
  }
}

export function useCreateCommercialPerson() {
  const { createPerson } = useCommercialContext()
  return { mutateAsync: createPerson }
}

export function useCreateOpportunity() {
  const { createOpportunity } = useCommercialContext()
  return { mutateAsync: createOpportunity }
}

export function useUpdateOpportunity() {
  const { updateOpportunity } = useCommercialContext()
  return {
    mutateAsync: (input: {
      id: string
      payload: Omit<UpdateCommercialOpportunityPayload, "updatedBy">
    }) => updateOpportunity(input.id, input.payload),
  }
}

export function useDeleteOpportunity() {
  const { deleteOpportunity } = useCommercialContext()
  return { mutateAsync: deleteOpportunity }
}
