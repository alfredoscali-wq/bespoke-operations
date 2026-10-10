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
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { clampAbnetPadronPage } from "@/lib/subscriptions/abnet-tv-padron-exclusions"
import {
  abnetPadronCustomerNumber,
  matchesAbnetPadronFilters,
  summarizeAbnetTvPadron,
  type AbnetTvKind,
  type AbnetTvPadronRow,
  type AbnetTvPadronSummary,
} from "@/lib/subscriptions/abnet-tv-padron"
import type { LatamBatchClient } from "@/lib/integrations/latam-tv/lookup-state"
import { canWriteSubscriptions } from "@/lib/subscriptions/permissions"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import { abnetPadronRowWithTvPlan } from "@/lib/subscriptions/abnet-tv-plan-choice"
import {
  matchesTvCommercialDeskFilters,
  summarizeTvCommercialDesk,
  uniqueCustomerCount,
  type TvCommercialDeskSummary,
} from "@/lib/subscriptions/tv-commercial-desk"
import {
  DEFAULT_TV_LIST_PAGE_SIZE,
  type TvConditionFilter,
  type TvPackFilter,
  type TvTierFilter,
} from "@/lib/subscriptions/tv-plans"
import {
  createTvPlan,
  listTvCatalogPlans,
  listTvCommercialDesk,
  setTvPlanActive,
  updateTvPlan,
} from "@/lib/supabase/subscriptions.browser"
import type { TvCatalogPlan, TvSubscriberRow } from "@/lib/types/subscriptions"

type PadronList = {
  items: AbnetTvPadronRow[]
  total: number
  uniqueCustomers: number
  page: number
  pageSize: number
}

type CommercialDeskList = {
  items: TvSubscriberRow[]
  total: number
  uniqueCustomers: number
  page: number
  pageSize: number
}

type SubscriptionsContextValue = {
  plans: TvCatalogPlan[]
  summary: AbnetTvPadronSummary | null
  list: PadronList | null
  tvKind: "all" | AbnetTvKind
  jubiladoOnly: boolean
  statusFilter: string
  duplicatesOnly: boolean
  search: string
  page: number
  isSummaryReady: boolean
  isListLoading: boolean
  canWrite: boolean
  error: string | null
  showPadronView: (
    view:
      | "all"
      | "basica"
      | "full"
      | "pack"
      | "jubilado"
      | "Activa"
      | "Morosa"
      | "Pendiente"
      | "Inactiva"
  ) => void
  setTvKind: (kind: "all" | AbnetTvKind) => void
  setJubiladoOnly: (value: boolean) => void
  setStatusFilter: (status: string) => void
  setDuplicatesOnly: (value: boolean) => void
  setSearch: (value: string) => void
  setPage: (page: number) => void
  clearFilters: () => void
  createPlan: (draft: TvPlanWriteDraft) => Promise<string | null>
  updatePlan: (id: string, draft: TvPlanWriteDraft) => Promise<string | null>
  togglePlanActive: (plan: TvCatalogPlan) => Promise<string | null>
  removePadronRow: (row: AbnetTvPadronRow) => Promise<string | null>
  updatePadronTvPlan: (
    row: AbnetTvPadronRow,
    kind: "basica" | "pack" | "full"
  ) => Promise<string | null>
  refreshDesk: () => void
  deskList: CommercialDeskList | null
  deskSummary: TvCommercialDeskSummary | null
  deskTvTier: TvTierFilter
  deskPack: TvPackFilter
  deskCondition: TvConditionFilter
  deskSearch: string
  isDeskReady: boolean
  deskError: string | null
  setDeskTvTier: (tier: TvTierFilter) => void
  setDeskPack: (pack: TvPackFilter) => void
  setDeskCondition: (condition: TvConditionFilter) => void
  setDeskSearch: (value: string) => void
  setDeskPage: (page: number) => void
  clearDeskFilters: () => void
  latamByNumber: Record<string, LatamBatchClient>
  rememberLatam: (number: string, client: LatamBatchClient) => void
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
  const [padronRows, setPadronRows] = useState<AbnetTvPadronRow[]>([])
  const [tvKind, setTvKindState] = useState<"all" | AbnetTvKind>("all")
  const [jubiladoOnly, setJubiladoOnlyState] = useState(false)
  const [statusFilter, setStatusFilterState] = useState("all")
  const [duplicatesOnly, setDuplicatesOnlyState] = useState(false)
  const [searchInput, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPageState] = useState(1)
  const [isSummaryReady, setIsSummaryReady] = useState(false)
  const [isListLoading, setIsListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deskRows, setDeskRows] = useState<TvSubscriberRow[]>([])
  const [deskTvTier, setDeskTvTierState] = useState<TvTierFilter>("all")
  const [deskPack, setDeskPackState] = useState<TvPackFilter>("all")
  const [deskCondition, setDeskConditionState] = useState<TvConditionFilter>("all")
  const [deskSearchInput, setDeskSearch] = useState("")
  const [debouncedDeskSearch, setDebouncedDeskSearch] = useState("")
  const [deskPage, setDeskPageState] = useState(1)
  const [isDeskReady, setIsDeskReady] = useState(false)
  const [deskError, setDeskError] = useState<string | null>(null)
  const [deskEpoch, setDeskEpoch] = useState(0)
  const [latamByNumber, setLatamByNumber] = useState<Record<string, LatamBatchClient>>({})
  const latamRequested = useRef(new Set<string>())

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedDeskSearch(deskSearchInput)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [deskSearchInput])

  const showPadronView = useCallback(
    (
      view:
        | "all"
        | "basica"
        | "full"
        | "pack"
        | "jubilado"
        | "Activa"
        | "Morosa"
        | "Pendiente"
        | "Inactiva"
    ) => {
      setTvKindState(
        view === "basica" || view === "full" || view === "pack" ? view : "all"
      )
      setJubiladoOnlyState(view === "jubilado")
      setStatusFilterState(
        view === "Activa" ||
          view === "Morosa" ||
          view === "Pendiente" ||
          view === "Inactiva"
          ? view
          : "all"
      )
      setDuplicatesOnlyState(false)
      setSearch("")
      setDebouncedSearch("")
      setPageState(1)
    },
    []
  )

  const setTvKind = useCallback((kind: "all" | AbnetTvKind) => {
    setTvKindState(kind)
    setPageState(1)
  }, [])
  const setJubiladoOnly = useCallback((value: boolean) => {
    setJubiladoOnlyState(value)
    setPageState(1)
  }, [])
  const setStatusFilter = useCallback((status: string) => {
    setStatusFilterState(status)
    setPageState(1)
  }, [])
  const setDuplicatesOnly = useCallback((value: boolean) => {
    setDuplicatesOnlyState(value)
    setPageState(1)
  }, [])
  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next))
  }, [])
  const setDeskTvTier = useCallback((tier: TvTierFilter) => {
    setDeskTvTierState(tier)
    setDeskPageState(1)
  }, [])
  const setDeskPack = useCallback((pack: TvPackFilter) => {
    setDeskPackState(pack)
    setDeskPageState(1)
  }, [])
  const setDeskCondition = useCallback((condition: TvConditionFilter) => {
    setDeskConditionState(condition)
    setDeskPageState(1)
  }, [])
  const setDeskPage = useCallback((next: number) => {
    setDeskPageState(Math.max(1, next))
  }, [])
  const clearDeskFilters = useCallback(() => {
    setDeskTvTierState("all")
    setDeskPackState("all")
    setDeskConditionState("all")
    setDeskSearch("")
    setDebouncedDeskSearch("")
    setDeskPageState(1)
  }, [])
  const clearFilters = useCallback(() => {
    setTvKindState("all")
    setJubiladoOnlyState(false)
    setStatusFilterState("all")
    setDuplicatesOnlyState(false)
    setSearch("")
    setDebouncedSearch("")
    setPageState(1)
  }, [])

  useEffect(() => {
    setPageState(1)
  }, [debouncedSearch])

  useEffect(() => {
    setDeskPageState(1)
  }, [debouncedDeskSearch])

  const reloadDesk = useCallback(() => {
    setDeskEpoch((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!isAuthReady) return
    if (!companyId) {
      setPlans([])
      setPadronRows([])
      setDeskRows([])
      setDeskError(null)
      setIsSummaryReady(true)
      setIsDeskReady(true)
      setIsListLoading(false)
      return
    }

    let cancelled = false
    setIsSummaryReady(false)
    setIsDeskReady(false)
    setIsListLoading(true)
    void (async () => {
      const [catalogResult, padronResponse, deskResult] = await Promise.all([
        listTvCatalogPlans(companyId),
        fetch("/api/subscriptions/abnet-padron"),
        listTvCommercialDesk(companyId).catch(() => ({
          data: null,
          error: {
            code: "UNKNOWN",
            message: "No se pudo leer los abonos con TV.",
          },
        })),
      ])
      if (cancelled) return
      if (deskResult.error) {
        setDeskError(deskResult.error.message)
        setDeskRows([])
      } else {
        setDeskRows(deskResult.data ?? [])
        setDeskError(null)
      }
      setIsDeskReady(true)
      if (catalogResult.error) {
        setError(catalogResult.error.message)
        setPlans([])
      } else {
        setPlans(catalogResult.data ?? [])
      }
      const contentType = padronResponse.headers.get("content-type") ?? ""
      if (!contentType.toLowerCase().includes("application/json")) {
        setError("No se pudo leer el padrón de TV.")
        setPadronRows([])
      } else {
        try {
          const body = (await padronResponse.json()) as {
            success?: boolean
            message?: string
            rows?: AbnetTvPadronRow[]
          }
          if (!padronResponse.ok || !body.success) {
            setError(body.message ?? "No se pudo leer el padrón de TV.")
            setPadronRows([])
          } else {
            setPadronRows(body.rows ?? [])
            if (!catalogResult.error) setError(null)
          }
        } catch {
          setError("No se pudo leer el padrón de TV.")
          setPadronRows([])
        }
      }
      setIsSummaryReady(true)
      setIsListLoading(false)
    })().catch(() => {
      if (cancelled) return
      setError("No se pudo leer el padrón de TV.")
      setPadronRows([])
      setDeskRows([])
      setDeskError("No se pudo leer los abonos con TV.")
      setIsSummaryReady(true)
      setIsDeskReady(true)
      setIsListLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, deskEpoch])

  const summary = useMemo(
    () => (isSummaryReady ? summarizeAbnetTvPadron(padronRows) : null),
    [padronRows, isSummaryReady]
  )

  const filteredRows = useMemo(
    () =>
      padronRows.filter((row) =>
        matchesAbnetPadronFilters(row, {
          tvKind,
          jubilado: jubiladoOnly,
          status: statusFilter,
          duplicatesOnly,
          search: debouncedSearch,
        })
      ),
    [padronRows, tvKind, jubiladoOnly, statusFilter, duplicatesOnly, debouncedSearch]
  )

  const filteredDeskRows = useMemo(
    () =>
      deskRows.filter((row) =>
        matchesTvCommercialDeskFilters(row, {
          tvTier: deskTvTier,
          pack: deskPack,
          condition: deskCondition,
          selectedCommercialId: "all",
          status: "all",
          search: debouncedDeskSearch,
        })
      ),
    [deskRows, deskTvTier, deskPack, deskCondition, debouncedDeskSearch]
  )

  const deskSummary = useMemo(
    () => (isDeskReady ? summarizeTvCommercialDesk(deskRows) : null),
    [deskRows, isDeskReady]
  )

  const deskList = useMemo<CommercialDeskList | null>(() => {
    if (!isDeskReady) return null
    const safePage = clampAbnetPadronPage(
      deskPage,
      filteredDeskRows.length,
      DEFAULT_TV_LIST_PAGE_SIZE
    )
    const from = (safePage - 1) * DEFAULT_TV_LIST_PAGE_SIZE
    return {
      items: filteredDeskRows.slice(from, from + DEFAULT_TV_LIST_PAGE_SIZE),
      total: filteredDeskRows.length,
      uniqueCustomers: uniqueCustomerCount(filteredDeskRows),
      page: safePage,
      pageSize: DEFAULT_TV_LIST_PAGE_SIZE,
    }
  }, [filteredDeskRows, isDeskReady, deskPage])

  const list = useMemo<PadronList | null>(() => {
    if (!isSummaryReady) return null
    const safePage = clampAbnetPadronPage(
      page,
      filteredRows.length,
      DEFAULT_TV_LIST_PAGE_SIZE
    )
    const from = (safePage - 1) * DEFAULT_TV_LIST_PAGE_SIZE
    const numbers = new Set(filteredRows.map((row) => row.abnetCustomerNumber))
    return {
      items: filteredRows.slice(from, from + DEFAULT_TV_LIST_PAGE_SIZE),
      total: filteredRows.length,
      uniqueCustomers: numbers.size,
      page: safePage,
      pageSize: DEFAULT_TV_LIST_PAGE_SIZE,
    }
  }, [filteredRows, isSummaryReady, page])

  const pageNumbers = useMemo(() => {
    const numbers = new Set<string>()
    for (const row of list?.items ?? []) {
      const number = abnetPadronCustomerNumber(row.abnetCustomerNumber)
      if (number) numbers.add(number)
    }
    return [...numbers]
  }, [list])

  useEffect(() => {
    const missing = pageNumbers.filter((number) => !latamRequested.current.has(number))
    if (missing.length === 0) return
    for (const number of missing) latamRequested.current.add(number)
    let cancelled = false
    let applied = false
    const params = new URLSearchParams({ latam: missing.join(",") })
    void fetch(`/api/subscriptions/abnet-padron?${params}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          success?: boolean
          clients?: Record<string, LatamBatchClient>
        } | null
        if (cancelled) return
        applied = true
        const clients = response.ok && body?.success ? body.clients ?? {} : null
        setLatamByNumber((current) => {
          const next = { ...current }
          for (const number of missing) {
            next[number] = clients?.[number] ?? {
              phase: "unavailable",
              identifier: null,
              iptvId: null,
              username: null,
              planName: null,
            }
          }
          return next
        })
      })
      .catch(() => {
        if (cancelled) return
        applied = true
        setLatamByNumber((current) => {
          const next = { ...current }
          for (const number of missing) {
            next[number] = {
              phase: "unavailable",
              identifier: null,
              iptvId: null,
              username: null,
              planName: null,
            }
          }
          return next
        })
      })
    return () => {
      cancelled = true
      if (!applied) {
        for (const number of missing) latamRequested.current.delete(number)
      }
    }
  }, [pageNumbers])

  useEffect(() => {
    if (!list || list.page === page) return
    setPageState(list.page)
  }, [list, page])

  useEffect(() => {
    if (!deskList || deskList.page === deskPage) return
    setDeskPageState(deskList.page)
  }, [deskList, deskPage])

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
  const removePadronRow = useCallback(async (row: AbnetTvPadronRow) => {
    const response = await fetch(
      `/api/subscriptions/tv-padron/${row.sourceRow}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: row.source,
          abnetCustomerNumber: row.abnetCustomerNumber,
        }),
      }
    )
    const body = (await response.json().catch(() => null)) as {
      success?: boolean
      message?: string
    } | null
    if (!response.ok || !body?.success) {
      return body?.message ?? "No se pudo eliminar la fila del padrón de TV."
    }
    const refreshed = await fetch("/api/subscriptions/abnet-padron")
    const refreshedBody = (await refreshed.json().catch(() => null)) as {
      success?: boolean
      rows?: AbnetTvPadronRow[]
    } | null
    if (refreshed.ok && refreshedBody?.success) {
      setPadronRows(refreshedBody.rows ?? [])
    } else {
      setPadronRows((current) =>
        current.filter(
          (item) =>
            item.source !== row.source || item.sourceRow !== row.sourceRow
        )
      )
    }
    return null
  }, [])

  const updatePadronTvPlan = useCallback(
    async (row: AbnetTvPadronRow, kind: "basica" | "pack" | "full") => {
      const response = await fetch(`/api/subscriptions/tv-padron/${row.sourceRow}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: row.source,
          abnetCustomerNumber: row.abnetCustomerNumber,
          tvKind: kind,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
      } | null
      if (!response.ok || !body?.success) {
        return body?.message ?? "LATAM confirmó el plan, pero no se pudo actualizar esta fila del padrón."
      }
      setPadronRows((current) =>
        current.map((item) =>
          item.source === row.source && item.sourceRow === row.sourceRow
            ? abnetPadronRowWithTvPlan(item, kind)
            : item
        )
      )
      return null
    },
    []
  )

  const rememberLatam = useCallback((number: string, client: LatamBatchClient) => {
    setLatamByNumber((current) =>
      current[number]?.phase === client.phase &&
      current[number]?.identifier === client.identifier &&
      current[number]?.planName === client.planName &&
      current[number]?.iptvId === client.iptvId
        ? current
        : { ...current, [number]: client }
    )
  }, [])

  const value = useMemo<SubscriptionsContextValue>(
    () => ({
      plans,
      summary,
      list,
      tvKind,
      jubiladoOnly,
      statusFilter,
      duplicatesOnly,
      search: searchInput,
      page,
      isSummaryReady,
      isListLoading,
      canWrite,
      error,
      showPadronView,
      setTvKind,
      setJubiladoOnly,
      setStatusFilter,
      setDuplicatesOnly,
      setSearch,
      setPage,
      clearFilters,
      createPlan,
      updatePlan,
      togglePlanActive,
      removePadronRow,
      updatePadronTvPlan,
      refreshDesk: reloadDesk,
      deskList,
      deskSummary,
      deskTvTier,
      deskPack,
      deskCondition,
      deskSearch: deskSearchInput,
      isDeskReady,
      deskError,
      setDeskTvTier,
      setDeskPack,
      setDeskCondition,
      setDeskSearch,
      setDeskPage,
      clearDeskFilters,
      latamByNumber,
      rememberLatam,
    }),
    [
      plans,
      summary,
      list,
      tvKind,
      jubiladoOnly,
      statusFilter,
      duplicatesOnly,
      searchInput,
      page,
      isSummaryReady,
      isListLoading,
      canWrite,
      error,
      showPadronView,
      setTvKind,
      setJubiladoOnly,
      setStatusFilter,
      setDuplicatesOnly,
      setPage,
      clearFilters,
      createPlan,
      updatePlan,
      togglePlanActive,
      removePadronRow,
      updatePadronTvPlan,
      reloadDesk,
      deskList,
      deskSummary,
      deskTvTier,
      deskPack,
      deskCondition,
      deskSearchInput,
      isDeskReady,
      deskError,
      setDeskTvTier,
      setDeskPack,
      setDeskCondition,
      setDeskPage,
      clearDeskFilters,
      latamByNumber,
      rememberLatam,
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
