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
import type { CommercialCreateOpportunityBundleInput } from "@/lib/commercial/create-opportunity"
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
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"

type MutationResult<T> = {
  success: boolean
  message?: string
  data?: T
  notice?: string | null
  matchedExistingPerson?: boolean
}

type CreateOpportunityWithPersonResult = MutationResult<{
  person: CommercialPerson
  opportunity: CommercialOpportunityListItem
}>

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
  createOpportunityWithPerson: (
    input: CommercialCreateOpportunityBundleInput
  ) => Promise<CreateOpportunityWithPersonResult>
  prependOpportunity: (opportunity: CommercialOpportunityListItem) => void
  upsertPerson: (person: CommercialPerson) => void
  upsertOpportunity: (opportunity: CommercialOpportunity) => void
  updatePerson: (input: {
    id: string
    payload: Omit<UpdateCommercialPersonPayload, "updatedBy">
  }) => Promise<MutationResult<CommercialPerson>>
  updateOpportunity: (
    id: string,
    input: Omit<UpdateCommercialOpportunityPayload, "updatedBy">
  ) => Promise<MutationResult<CommercialOpportunity>>
  deleteOpportunity: (id: string) => Promise<MutationResult<CommercialOpportunity>>
  getPerson: (id: string) => Promise<CommercialPerson | null>
  getOpportunity: (id: string) => Promise<CommercialOpportunity | null>
  loadDossier: (opportunityId: string) => Promise<{
    success: boolean
    message?: string
    opportunity?: CommercialOpportunity
    person?: CommercialPerson
  }>
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
          message: result.error?.message ?? "No se pudo crear la persona.",
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
            result.error?.message ?? "No se pudo crear el cliente.",
        }
      }

      await refresh()
      return { success: true, data: result.data }
    },
    [actorEmployeeId, companyId, refresh]
  )

  const upsertPerson = useCallback((person: CommercialPerson) => {
    setPeople((current) => {
      const without = current.filter((entry) => entry.id !== person.id)
      return [person, ...without]
    })
  }, [])

  const prependOpportunity = useCallback(
    (opportunity: CommercialOpportunityListItem) => {
      setOpportunities((current) => {
        const without = current.filter((entry) => entry.id !== opportunity.id)
        return [opportunity, ...without]
      })
    },
    []
  )

  const upsertOpportunity = useCallback(
    (opportunity: CommercialOpportunity) => {
      setOpportunities((current) => {
        const existing = current.find((entry) => entry.id === opportunity.id)
        const mapped: CommercialOpportunityListItem = {
          ...opportunity,
          personDisplayName:
            existing?.personDisplayName ??
            opportunity.personDisplayName ??
            "Persona",
        }
        const without = current.filter((entry) => entry.id !== opportunity.id)
        return [mapped, ...without]
      })
    },
    []
  )

  const updatePerson = useCallback(
    async (input: {
      id: string
      payload: Omit<UpdateCommercialPersonPayload, "updatedBy">
    }): Promise<MutationResult<CommercialPerson>> => {
      const response = await fetch(
        `/api/gestion-comercial/people/${input.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.payload),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        person?: CommercialPerson
      } | null

      if (!response.ok || !payload?.success || !payload.person) {
        return {
          success: false,
          message: payload?.message ?? "No se pudo actualizar la persona.",
        }
      }

      upsertPerson(payload.person)
      return { success: true, data: payload.person }
    },
    [upsertPerson]
  )

  const createOpportunityWithPerson = useCallback(
    async (
      input: CommercialCreateOpportunityBundleInput
    ): Promise<CreateOpportunityWithPersonResult> => {
      const response = await fetch(
        "/api/gestion-comercial/opportunities/with-person",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      )

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        notice?: string | null
        matchedExistingPerson?: boolean
        person?: CommercialPerson
        opportunity?: CommercialOpportunityListItem
      } | null

      if (!response.ok || !payload?.success || !payload.person || !payload.opportunity) {
        return {
          success: false,
          message: payload?.message ?? "No se pudo crear el cliente.",
        }
      }

      upsertPerson(payload.person)
      prependOpportunity(payload.opportunity)

      return {
        success: true,
        data: {
          person: payload.person,
          opportunity: payload.opportunity,
        },
        notice: payload.notice ?? null,
        matchedExistingPerson: Boolean(payload.matchedExistingPerson),
        message: payload.message,
      }
    },
    [prependOpportunity, upsertPerson]
  )

  const updateOpportunity = useCallback(
    async (
      id: string,
      input: Omit<UpdateCommercialOpportunityPayload, "updatedBy">
    ): Promise<MutationResult<CommercialOpportunity>> => {
      const response = await fetch(
        `/api/gestion-comercial/opportunities/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        opportunity?: CommercialOpportunity
      } | null

      if (!response.ok || !payload?.success || !payload.opportunity) {
        return {
          success: false,
          message:
            payload?.message ?? "No se pudo actualizar el cliente.",
        }
      }

      upsertOpportunity(payload.opportunity)
      return { success: true, data: payload.opportunity }
    },
    [upsertOpportunity]
  )

  const deleteOpportunity = useCallback(
    async (id: string): Promise<MutationResult<CommercialOpportunity>> => {
      const result = await deleteCommercialOpportunity(id, actorEmployeeId)

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo eliminar el cliente.",
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

  const loadDossier = useCallback(
    async (opportunityId: string) => {
      const opportunityResult = await getCommercialOpportunityById(opportunityId)
      if (opportunityResult.error || !opportunityResult.data) {
        return {
          success: false as const,
          message:
            opportunityResult.error?.message ?? "Cliente no encontrado.",
        }
      }

      const personResult = await getCommercialPersonById(
        opportunityResult.data.personId
      )
      if (personResult.error || !personResult.data) {
        return {
          success: false as const,
          message: personResult.error?.message ?? "Persona no encontrada.",
        }
      }

      upsertPerson(personResult.data)
      upsertOpportunity(opportunityResult.data)

      return {
        success: true as const,
        opportunity: opportunityResult.data,
        person: personResult.data,
      }
    },
    [upsertOpportunity, upsertPerson]
  )

  const value = useMemo<CommercialContextValue>(
    () => ({
      people,
      opportunities,
      isReady,
      refresh,
      createPerson,
      createOpportunity,
      createOpportunityWithPerson,
      prependOpportunity,
      upsertPerson,
      upsertOpportunity,
      updatePerson,
      updateOpportunity,
      deleteOpportunity,
      getPerson,
      getOpportunity,
      loadDossier,
    }),
    [
      people,
      opportunities,
      isReady,
      refresh,
      createPerson,
      createOpportunity,
      createOpportunityWithPerson,
      prependOpportunity,
      upsertPerson,
      upsertOpportunity,
      updatePerson,
      updateOpportunity,
      deleteOpportunity,
      getPerson,
      getOpportunity,
      loadDossier,
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

export function useCreateOpportunityWithPerson() {
  const { createOpportunityWithPerson } = useCommercialContext()
  return { mutateAsync: createOpportunityWithPerson }
}

export function useUpdateCommercialPerson() {
  const { updatePerson } = useCommercialContext()
  return { mutateAsync: updatePerson }
}

export function useCommercialContextLoad() {
  const { loadDossier, upsertPerson, upsertOpportunity } =
    useCommercialContext()
  return {
    loadDossier,
    upsertPersonLocal: upsertPerson,
    upsertOpportunityLocal: upsertOpportunity,
  }
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
