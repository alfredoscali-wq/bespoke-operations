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
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { canWriteSubscriptions } from "@/lib/subscriptions/permissions"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import {
  createTvPlan,
  listTvCatalogPlans,
  listTvCommercialServiceOptions,
  listTvDeskSummary,
  listTvSubscribers,
  setTvPlanActive,
  updateTvPlan,
} from "@/lib/supabase/subscriptions.browser"
import {
  DEFAULT_TV_LIST_PAGE_SIZE,
  EMPTY_TV_DESK_FILTERS,
  TV_KPI_ACTIVE_STATUS,
  type TvCommercialServiceOption,
  type TvDeskSummary,
  type TvListStatusFilter,
  type TvSelectedCommercialFilter,
  type TvSelectedPlanFilter,
} from "@/lib/subscriptions/tv-plans"
import type {
  TvCatalogPlan,
  TvSubscriberListPage,
} from "@/lib/types/subscriptions"

type SubscriptionsContextValue = {
  plans: TvCatalogPlan[]
  summary: TvDeskSummary | null
  commercialOptions: TvCommercialServiceOption[]
  list: TvSubscriberListPage | null
  selectedPlan: TvSelectedPlanFilter
  selectedCommercialId: TvSelectedCommercialFilter
  statusFilter: TvListStatusFilter
  search: string
  page: number
  isSummaryReady: boolean
  isListLoading: boolean
  canWrite: boolean
  error: string | null
  setSelectedPlan: (plan: TvSelectedPlanFilter) => void
  setSelectedPlanFilter: (plan: TvSelectedPlanFilter) => void
  setSelectedCommercialId: (id: TvSelectedCommercialFilter) => void
  setStatusFilter: (status: TvListStatusFilter) => void
  setSearch: (value: string) => void
  setPage: (page: number) => void
  clearFilters: () => void
  createPlan: (draft: TvPlanWriteDraft) => Promise<string | null>
  updatePlan: (id: string, draft: TvPlanWriteDraft) => Promise<string | null>
  togglePlanActive: (plan: TvCatalogPlan) => Promise<string | null>
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(
  null
)

export function SubscriptionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const canWrite = canWriteSubscriptions(sessionUser?.systemRole)
  const [plans, setPlans] = useState<TvCatalogPlan[]>([])
  const [summary, setSummary] = useState<TvDeskSummary | null>(null)
  const [commercialOptions, setCommercialOptions] = useState<
    TvCommercialServiceOption[]
  >([])
  const [list, setList] = useState<TvSubscriberListPage | null>(null)
  const [selectedPlan, setSelectedPlanState] =
    useState<TvSelectedPlanFilter>("all")
  const [selectedCommercialId, setSelectedCommercialState] =
    useState<TvSelectedCommercialFilter>("all")
  const [statusFilter, setStatusFilterState] =
    useState<TvListStatusFilter>(TV_KPI_ACTIVE_STATUS)
  const [searchInput, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPageState] = useState(1)
  const [isSummaryReady, setIsSummaryReady] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [isListLoading, setIsListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deskEpoch, setDeskEpoch] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const setSelectedPlan = useCallback((plan: TvSelectedPlanFilter) => {
    setSelectedPlanState(plan)
    setSelectedCommercialState("all")
    setStatusFilterState(TV_KPI_ACTIVE_STATUS)
    setPageState(1)
  }, [])

  const setSelectedPlanFilter = useCallback((plan: TvSelectedPlanFilter) => {
    setSelectedPlanState(plan)
    setSelectedCommercialState("all")
    setPageState(1)
  }, [])

  const setSelectedCommercialId = useCallback(
    (id: TvSelectedCommercialFilter) => {
      setSelectedCommercialState(id)
      setPageState(1)
    },
    []
  )

  const setStatusFilter = useCallback((status: TvListStatusFilter) => {
    setStatusFilterState(status)
    setPageState(1)
  }, [])

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next))
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedPlanState(EMPTY_TV_DESK_FILTERS.selectedPlan)
    setSelectedCommercialState(EMPTY_TV_DESK_FILTERS.selectedCommercialId)
    setStatusFilterState(EMPTY_TV_DESK_FILTERS.status)
    setSearch(EMPTY_TV_DESK_FILTERS.search)
    setDebouncedSearch(EMPTY_TV_DESK_FILTERS.search)
    setPageState(1)
  }, [])

  useEffect(() => {
    setPageState(1)
  }, [debouncedSearch])

  const reloadDesk = useCallback(() => {
    setDeskEpoch((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!isAuthReady) return
    if (!companyId) {
      setPlans([])
      setSummary(null)
      setCommercialOptions([])
      setIsSummaryReady(true)
      setCatalogLoaded(true)
      return
    }

    let cancelled = false
    setIsSummaryReady(false)
    setCatalogLoaded(false)
    void (async () => {
      const [catalogResult, summaryResult, commercialResult] = await Promise.all([
        listTvCatalogPlans(companyId),
        listTvDeskSummary(companyId),
        listTvCommercialServiceOptions(companyId),
      ])
      if (cancelled) return
      if (catalogResult.error) {
        setError(catalogResult.error.message)
        setPlans([])
      } else {
        setPlans(catalogResult.data ?? [])
      }
      if (summaryResult.error) {
        setError(summaryResult.error.message)
        setSummary(null)
      } else {
        setSummary(summaryResult.data)
        if (!catalogResult.error) setError(null)
      }
      if (commercialResult.error) {
        setCommercialOptions([])
      } else {
        setCommercialOptions(commercialResult.data ?? [])
      }
      setIsSummaryReady(true)
      setCatalogLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, deskEpoch])

  useEffect(() => {
    if (!isAuthReady || !companyId || !catalogLoaded) {
      setList(null)
      return
    }

    let cancelled = false
    setIsListLoading(true)
    void (async () => {
      const result = await listTvSubscribers({
        companyId,
        plans,
        selectedPlan,
        selectedCommercialId,
        status: statusFilter,
        search: debouncedSearch,
        page,
        pageSize: DEFAULT_TV_LIST_PAGE_SIZE,
      })
      if (cancelled) return
      if (result.error) {
        setError(result.error.message)
        setList(null)
      } else {
        setList(result.data)
      }
      setIsListLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [
    companyId,
    isAuthReady,
    plans,
    selectedPlan,
    selectedCommercialId,
    statusFilter,
    debouncedSearch,
    page,
    catalogLoaded,
  ])

  const createPlan = useCallback(
    async (draft: TvPlanWriteDraft) => {
      const result = await createTvPlan(draft)
      if (result.error) return result.error.message
      reloadDesk()
      return null
    },
    [reloadDesk]
  )

  const updatePlan = useCallback(
    async (id: string, draft: TvPlanWriteDraft) => {
      const result = await updateTvPlan(id, draft)
      if (result.error) return result.error.message
      reloadDesk()
      return null
    },
    [reloadDesk]
  )

  const togglePlanActive = useCallback(
    async (plan: TvCatalogPlan) => {
      const result = await setTvPlanActive(plan.id, !plan.isActive)
      if (result.error) return result.error.message
      reloadDesk()
      return null
    },
    [reloadDesk]
  )

  const value = useMemo<SubscriptionsContextValue>(
    () => ({
      plans,
      summary,
      commercialOptions,
      list,
      selectedPlan,
      selectedCommercialId,
      statusFilter,
      search: searchInput,
      page,
      isSummaryReady,
      isListLoading,
      canWrite,
      error,
      setSelectedPlan,
      setSelectedPlanFilter,
      setSelectedCommercialId,
      setStatusFilter,
      setSearch,
      setPage,
      clearFilters,
      createPlan,
      updatePlan,
      togglePlanActive,
    }),
    [
      plans,
      summary,
      commercialOptions,
      list,
      selectedPlan,
      selectedCommercialId,
      statusFilter,
      searchInput,
      page,
      isSummaryReady,
      isListLoading,
      canWrite,
      error,
      setSelectedPlan,
      setSelectedPlanFilter,
      setSelectedCommercialId,
      setStatusFilter,
      setPage,
      clearFilters,
      createPlan,
      updatePlan,
      togglePlanActive,
    ]
  )

  return (
    <SubscriptionsContext.Provider value={value}>
      {children}
    </SubscriptionsContext.Provider>
  )
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext)
  if (!context) {
    throw new Error(
      "useSubscriptions debe usarse dentro de SubscriptionsProvider."
    )
  }
  return context
}
