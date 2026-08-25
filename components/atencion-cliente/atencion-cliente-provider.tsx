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
import { QueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth/auth-provider"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { mapQuickCustomerToCreatePayload } from "@/lib/customers/quick-customer"
import {
  DEFAULT_ATENCION_PAGE_SIZE,
  type CustomerAtencionListQuery,
} from "@/lib/customer-atenciones/atencion-list"
import {
  buildNewConsultationCreationFields,
  validateNewConsultationInput,
} from "@/lib/customer-atenciones/consultation"
import {
  buildCaseClosedActivity,
  buildCaseCreatedActivity,
  buildFollowUpCreatedActivity,
} from "@/lib/customer-atenciones/customer-activity-events"
import { requestRegisterCustomerActivity } from "@/lib/customer-atenciones/register-customer-activity.client"
import {
  beginCustomerServiceInboxProfile,
  finishCustomerServiceInboxProfile,
} from "@/lib/customer-service/performance"
import {
  beginAtcBreakdown,
  finalizeAtcBreakdown,
  measureAtcBreakdownPhase,
  type AtcBreakdownAction,
} from "@/lib/customer-service/performance/breakdown"
import {
  installAtcClientQueryInvalidationPatch,
  measureAtcClientSpan,
  trackAtcQueryInvalidation,
} from "@/lib/customer-service/performance/client-profiler"
import { startPerformanceTrace } from "@/lib/performance"
import type {
  SharedInboxHistoricalDaySummary,
  SharedInboxKpiSummary,
  SharedInboxOperationalCounts,
  SharedInboxQuery,
  SharedInboxStatusFilterCounts,
  SharedInboxWorkTrayCounts,
} from "@/lib/customer-atenciones/shared-inbox"
import {
  computeHistoricalDaySummary,
  normalizeSharedInboxCreatedDate,
  normalizeSharedInboxSearch,
  resolveSharedInboxReferenceDate,
} from "@/lib/customer-atenciones/shared-inbox"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import {
  filterAgendaForTodayView,
  filterAgendaForWeekView,
} from "@/lib/customer-seguimientos/agenda"
import {
  canMarkCustomerRetencionReadyForRetiro,
  canViewAssignedCustomerRetenciones,
} from "@/lib/customer-retenciones/access"
import { canViewEquipoIndividualReport } from "@/lib/atencion-cliente-equipo/access"
import {
  buildJornadaEntries,
  type JornadaEntry,
} from "@/lib/customer-seguimientos/jornada"
import type { AtencionClienteKpiSummary } from "@/lib/customer-seguimientos/kpis"
import {
  blockDemoWrite,
  DEMO_WRITE_BLOCKED_MUTATION_RESULT,
} from "@/lib/demo/demo-write-block"
import { DEMO_RESTRICTED_DIALOG_MESSAGE } from "@/lib/demo/constants"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createCustomerAtencion,
  getOperatorActiveManagement,
  listSharedInboxConsultations,
  loadSharedInboxBundle,
  listEmployeeAtencionesToday,
} from "@/lib/supabase/customer-atenciones.browser"
import {
  cancelConsultationManagement,
  deferConsultationManagement,
  deriveConsultationToCommercial,
  releaseExpiredConsultationManagements,
  resolveConsultationManagement,
  startConsultationManagement,
  touchConsultationManagementActivity,
  updateMorosoTrackingManagement,
  registerConsultationInteractionManagement,
  linkConsultationOtManagement,
  permanentDeleteConsultationManagement,
  type ConsultationHardDeleteMutationResult,
  type ConsultationManagementMutationResult,
  type ConsultationInteractionMutationResult,
  type MorosoTrackingMutationResult,
  type OtLinkMutationResult,
} from "@/lib/supabase/customer-atenciones-management.browser"
import {
  CONSULTATION_HARD_DELETE_SUCCESS_MESSAGE,
} from "@/lib/customer-atenciones/consultation-hard-delete"
import {
  findOperatorActiveManagement,
  type OperatorActiveManagement,
} from "@/lib/customer-atenciones/consultation-exclusive-management"
import {
  createBrowserCustomerAtencionesClient,
  getCustomerAtencionById as loadCustomerAtencionById,
  listAtencionPage,
} from "@/lib/supabase/customer-atenciones.browser"
import {
  createCustomerRetencion,
  deriveCustomerRetencionToAdministration,
  finalizeRetainedCustomerRetencion,
  getActiveRetencionesCount,
  getCustomerRetencionById as loadCustomerRetencionById,
  listAssignedRetencionesForCompany,
  listAtencionClienteAssignees,
  listActiveRetencionesForEmployee,
  listRetencionJornadaRowsForEmployeeToday,
  markCustomerRetencionReadyForRetiro,
} from "@/lib/supabase/customer-retenciones.browser"
import {
  createCustomerSeguimiento,
  getAtencionClienteDashboardSummary,
  getCustomerSeguimientoById as loadCustomerSeguimientoById,
  listCompletedSeguimientosToday,
  listPendingSeguimientosForEmployee,
  markCustomerSeguimientoCompleted,
} from "@/lib/supabase/customer-seguimientos.browser"
import { searchCustomers as searchCustomersInSupabase, createCustomer as createCustomerInSupabase } from "@/lib/supabase/customers.browser"
import {
  createCustomerRecuperacion,
  getCustomerRecuperacionById as loadCustomerRecuperacionById,
  getRecuperacionesTodayCount,
  listRecuperacionesForEmployee,
  listRecuperacionesTodayForEmployee,
} from "@/lib/supabase/customer-recuperaciones.browser"
import { mapNewCustomerRecuperacionInputToPayload } from "@/lib/supabase/customer-recuperaciones.mapper"
import { createClient } from "@/lib/supabase/client"
import type { Customer } from "@/lib/types/customers"
import type {
  CustomerAtencion,
  CustomerAtencionInboxRow,
  CustomerAtencionListPage,
  CustomerAtencionNextStep,
  NewCustomerAtencionInput,
} from "@/lib/types/customer-atenciones"
import type {
  AtencionClienteAssigneeOption,
  CustomerRetencion,
  CustomerRetencionActiveRow,
  CustomerRetencionSupervisionRow,
  NewCustomerRetencionInput,
  ResolveCustomerRetencionInput,
} from "@/lib/types/customer-retenciones"
import type {
  CustomerRecuperacion,
  CustomerRecuperacionActivityRow,
  NewCustomerRecuperacionInput,
} from "@/lib/types/customer-recuperaciones"
import type {
  CompleteCustomerSeguimientoInput,
  CompleteCustomerSeguimientoWithFollowUpInput,
  CustomerSeguimiento,
  CustomerSeguimientoAgendaRow,
} from "@/lib/types/customer-seguimientos"

type AtencionMutationResult = {
  success: boolean
  message?: string
  atencion?: CustomerAtencion
  seguimiento?: CustomerSeguimiento
}

type SeguimientoMutationResult = {
  success: boolean
  message?: string
  seguimiento?: CustomerSeguimiento
  nextSeguimiento?: CustomerSeguimiento
}

type RetencionMutationResult = {
  success: boolean
  message?: string
  retencion?: CustomerRetencion
}

type RecuperacionMutationResult = {
  success: boolean
  message?: string
  recuperacion?: CustomerRecuperacion
}

const EMPTY_SUMMARY: AtencionClienteKpiSummary = {
  atencionesHoy: 0,
  resueltas: 0,
  seguimientosPendientes: 0,
  retencionesActivas: 0,
  recuperosHoy: 0,
}

const EMPTY_SHARED_INBOX_KPIS: SharedInboxKpiSummary = {
  nuevas: 0,
  para_resolver: 0,
  pendientes: 0,
  resueltas_hoy: 0,
  consulta_comercial: 0,
  consulta_tv: 0,
}

const EMPTY_SHARED_INBOX_OPERATIONAL_COUNTS: SharedInboxOperationalCounts = {
  retenciones: 0,
  administracion: 0,
  morosos: 0,
  tecnica: 0,
  contactar_cliente: 0,
  generar_ot: 0,
}

const EMPTY_SHARED_INBOX_WORK_TRAY_COUNTS: SharedInboxWorkTrayCounts = {
  por_tomar: 0,
  en_gestion: 0,
  espera_cliente: 0,
  retenciones: 0,
  tecnica: 0,
  administracion: 0,
  morosos: 0,
  ventas: 0,
  generar_ot: 0,
}

const EMPTY_SHARED_INBOX_STATUS_FILTER_COUNTS: SharedInboxStatusFilterCounts = {
  all: 0,
  pendiente: 0,
  para_resolver: 0,
  resueltas_hoy: 0,
}

type AtencionClienteContextValue = {
  listPage: CustomerAtencionListPage | null
  isListLoading: boolean
  isReady: boolean
  listQuery: CustomerAtencionListQuery
  dashboardSummary: AtencionClienteKpiSummary
  isDashboardLoading: boolean
  pendingSeguimientos: CustomerSeguimientoAgendaRow[]
  pendingRetenciones: CustomerRetencionActiveRow[]
  assignedRetenciones: CustomerRetencionSupervisionRow[]
  myRecuperaciones: CustomerRecuperacionActivityRow[]
  jornadaEntries: JornadaEntry[]
  canMarkRetencionReadyForRetiro: boolean
  canViewAssignedRetenciones: boolean
  canViewEquipoReport: boolean
  sharedInboxKpis: SharedInboxKpiSummary
  sharedInboxOperationalCounts: SharedInboxOperationalCounts
  sharedInboxWorkTrayCounts: SharedInboxWorkTrayCounts
  sharedInboxStatusFilterCounts: SharedInboxStatusFilterCounts
  sharedInboxRows: CustomerAtencionInboxRow[]
  sharedInboxHistoricalDaySummary: SharedInboxHistoricalDaySummary | null
  sharedInboxQuery: SharedInboxQuery
  isSharedInboxLoading: boolean
  isSharedInboxDashboardLoading: boolean
  /** RC 3.2.3 — the operator's single active en_gestion (if any). */
  myActiveManagement: OperatorActiveManagement | null
  refreshMyActiveManagement: () => Promise<void>
  loadAtencionPage: (query: CustomerAtencionListQuery) => Promise<void>
  loadSharedInbox: (
    query: SharedInboxQuery,
    options?: { mode?: "full" | "fast" }
  ) => Promise<void>
  /**
   * Sprint 28.2 — default `fast` (rows + tray/status/operational from discovery).
   * Pass `{ mode: "full" }` to force dashboard/KPI bundle reload.
   */
  refreshSharedInbox: (options?: { mode?: "full" | "fast" }) => Promise<void>
  refreshDashboard: () => Promise<void>
  fetchAtencionById: (id: string) => Promise<CustomerAtencion | null>
  fetchSeguimientoById: (id: string) => Promise<CustomerSeguimiento | null>
  fetchRetencionById: (id: string) => Promise<CustomerRetencion | null>
  fetchRecuperacionById: (id: string) => Promise<CustomerRecuperacion | null>
  searchCustomers: (query: string, limit?: number) => Promise<Customer[]>
  listAssignees: () => Promise<AtencionClienteAssigneeOption[]>
  createAtencion: (input: NewCustomerAtencionInput) => Promise<AtencionMutationResult>
  refreshAtencionById: (id: string) => Promise<CustomerAtencion | null>
  startConsultationManagement: (
    atencionId: string
  ) => Promise<ConsultationManagementMutationResult>
  cancelConsultationManagement: (
    atencionId: string
  ) => Promise<ConsultationManagementMutationResult>
  touchConsultationManagementActivity: (
    atencionId: string
  ) => Promise<ConsultationManagementMutationResult>
  resolveConsultation: (
    atencionId: string,
    resolution: string,
    followUpActions?: string[]
  ) => Promise<ConsultationManagementMutationResult>
  deferConsultation: (
    atencionId: string,
    nextStep: CustomerAtencionNextStep,
    detail?: string
  ) => Promise<ConsultationManagementMutationResult>
  updateMorosoTracking: (
    atencionId: string,
    trackingStatus: string
  ) => Promise<MorosoTrackingMutationResult>
  registerConsultationInteraction: (
    atencionId: string,
    input: {
      interactionKind: string
      interactionResult?: string | null
      detail?: string
      nextActionAt?: string | null
      clientInteraction?: {
        medio: string
        resultado: string
        observations?: string | null
        nextStep?: string | null
        customerId?: string | null
      } | null
    }
  ) => Promise<ConsultationInteractionMutationResult>
  linkConsultationOt: (
    atencionId: string,
    taskId: string
  ) => Promise<OtLinkMutationResult>
  permanentDeleteConsultation: (
    atencionId: string
  ) => Promise<ConsultationHardDeleteMutationResult>
  actionFeedback: string | null
  clearActionFeedback: () => void
  currentEmployeeId: string
  createRetencion: (
    input: NewCustomerRetencionInput
  ) => Promise<RetencionMutationResult>
  resolveRetencion: (
    id: string,
    input: ResolveCustomerRetencionInput
  ) => Promise<RetencionMutationResult>
  markRetencionReadyForRetiro: (id: string) => Promise<RetencionMutationResult>
  createRecuperacion: (
    input: NewCustomerRecuperacionInput
  ) => Promise<RecuperacionMutationResult>
  completeSeguimiento: (
    id: string,
    input: CompleteCustomerSeguimientoInput
  ) => Promise<SeguimientoMutationResult>
  completeSeguimientoWithFollowUp: (
    id: string,
    input: CompleteCustomerSeguimientoWithFollowUpInput
  ) => Promise<SeguimientoMutationResult>
  getAgendaItems: (view: "hoy" | "semana") => CustomerSeguimientoAgendaRow[]
}

const AtencionClienteContext = createContext<AtencionClienteContextValue | null>(
  null
)

export function AtencionClienteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [listPage, setListPage] = useState<CustomerAtencionListPage | null>(null)
  const [listQuery, setListQuery] = useState<CustomerAtencionListQuery>({
    page: 1,
    pageSize: DEFAULT_ATENCION_PAGE_SIZE,
    search: "",
  })
  const [isListLoading, setIsListLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [dashboardSummary, setDashboardSummary] =
    useState<AtencionClienteKpiSummary>(EMPTY_SUMMARY)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [pendingSeguimientos, setPendingSeguimientos] = useState<
    CustomerSeguimientoAgendaRow[]
  >([])
  const [pendingRetenciones, setPendingRetenciones] = useState<
    CustomerRetencionActiveRow[]
  >([])
  const [assignedRetenciones, setAssignedRetenciones] = useState<
    CustomerRetencionSupervisionRow[]
  >([])
  const [myRecuperaciones, setMyRecuperaciones] = useState<
    CustomerRecuperacionActivityRow[]
  >([])
  const [jornadaEntries, setJornadaEntries] = useState<JornadaEntry[]>([])
  const [sharedInboxKpis, setSharedInboxKpis] =
    useState<SharedInboxKpiSummary>(EMPTY_SHARED_INBOX_KPIS)
  const [sharedInboxOperationalCounts, setSharedInboxOperationalCounts] =
    useState<SharedInboxOperationalCounts>(EMPTY_SHARED_INBOX_OPERATIONAL_COUNTS)
  const [sharedInboxWorkTrayCounts, setSharedInboxWorkTrayCounts] =
    useState<SharedInboxWorkTrayCounts>(EMPTY_SHARED_INBOX_WORK_TRAY_COUNTS)
  const [sharedInboxStatusFilterCounts, setSharedInboxStatusFilterCounts] =
    useState<SharedInboxStatusFilterCounts>(
      EMPTY_SHARED_INBOX_STATUS_FILTER_COUNTS
    )
  const [sharedInboxRows, setSharedInboxRows] = useState<CustomerAtencionInboxRow[]>(
    []
  )
  const [myActiveManagement, setMyActiveManagement] =
    useState<OperatorActiveManagement | null>(null)
  const [
    sharedInboxHistoricalDaySummary,
    setSharedInboxHistoricalDaySummary,
  ] = useState<SharedInboxHistoricalDaySummary | null>(null)
  const [sharedInboxQuery, setSharedInboxQuery] = useState<SharedInboxQuery>({
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: null,
    workTray: null,
    createdDate: toLocalDateOnly(),
    search: "",
  })
  const [isSharedInboxLoading, setIsSharedInboxLoading] = useState(true)
  const [isSharedInboxDashboardLoading, setIsSharedInboxDashboardLoading] =
    useState(true)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const atencionCacheRef = useRef<Map<string, CustomerAtencion>>(new Map())
  const seguimientoCacheRef = useRef<Map<string, CustomerSeguimiento>>(new Map())
  const retencionCacheRef = useRef<Map<string, CustomerRetencion>>(new Map())
  const recuperacionCacheRef = useRef<Map<string, CustomerRecuperacion>>(new Map())
  const sharedInboxDashboardLoadedRef = useRef(false)
  /** Sprint 28.3 — releaseExpired at most once per provider mount (enter / F5). */
  const hasReleasedExpiredThisMountRef = useRef(false)
  /** Sprint 34.0 — prevent overlapping background release sweeps. */
  const releaseExpiredInFlightRef = useRef(false)
  const sharedInboxQueryRef = useRef(sharedInboxQuery)
  sharedInboxQueryRef.current = sharedInboxQuery
  const loadSharedInboxRef = useRef<
    (
      query: SharedInboxQuery,
      options?: { mode?: "full" | "fast" }
    ) => Promise<void>
  >(async () => {})

  useEffect(() => {
    installAtcClientQueryInvalidationPatch(QueryClient)
  }, [])

  /**
   * Sprint 34.0 — releaseExpired never blocks first paint / inbox load.
   * After the sweep, fast-refresh rows only when something was released.
   */
  const runReleaseExpiredInBackground = useCallback(
    async (reason: string) => {
      if (releaseExpiredInFlightRef.current) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[ATC ReleaseExpired]",
            "caller",
            `${reason}:skipped(inFlight)`,
            Date.now()
          )
        }
        return
      }

      releaseExpiredInFlightRef.current = true
      const now = () =>
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()
      const wallStarted = now()
      let startMs: number | null = null
      let rpcMs: number | null = null
      let refreshMs: number | null = null

      try {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[ATC ReleaseExpired]",
            "caller",
            reason,
            typeof window !== "undefined" ? window.location.pathname : "(ssr)",
            Date.now()
          )
        }

        startMs = now() - wallStarted
        const rpcStarted = now()
        const result = await releaseExpiredConsultationManagements()
        rpcMs = now() - rpcStarted

        if (result.success && result.releasedCount > 0) {
          const refreshStarted = now()
          await loadSharedInboxRef.current(sharedInboxQueryRef.current, {
            mode: "fast",
          })
          refreshMs = now() - refreshStarted
        } else if (process.env.NODE_ENV === "development") {
          console.log(
            "[ATC ReleaseExpired]",
            "background",
            "skip fast refresh (no releases)",
            result.success ? result.releasedCount : result.message,
            Date.now()
          )
        }
      } finally {
        releaseExpiredInFlightRef.current = false
        if (process.env.NODE_ENV === "development") {
          const totalMs = now() - wallStarted
          const pad = (label: string) => label.padEnd(22, ".")
          const fmt = (value: number | null) =>
            value == null ? "—" : `${Math.round(value)} ms`
          console.info(
            [
              "[ATC RELEASE BACKGROUND]",
              "",
              `${pad("Start")} ${fmt(startMs)}`,
              `${pad("RPC")} ${fmt(rpcMs)}`,
              `${pad("Refresh")} ${fmt(refreshMs)}`,
              "",
              `${pad("TOTAL")} ${fmt(totalMs)}`,
            ].join("\n")
          )
        }
      }
    },
    []
  )
  const runReleaseExpiredInBackgroundRef = useRef(runReleaseExpiredInBackground)
  runReleaseExpiredInBackgroundRef.current = runReleaseExpiredInBackground


  function createJornadaDashboardQuery(referenceDate: Date): SharedInboxQuery {
    return {
      statusFilter: "all",
      motivo: "all",
      channel: "all",
      operationalCategory: null,
      workTray: null,
      createdDate: toLocalDateOnly(referenceDate),
      search: "",
    }
  }

  const employeeId = sessionUser?.employeeId?.trim() ?? ""
  const canMarkRetencionReadyForRetiro = canMarkCustomerRetencionReadyForRetiro(
    sessionUser?.roleCode
  )
  const canViewAssignedRetenciones = canViewAssignedCustomerRetenciones(
    sessionUser?.roleCode
  )
  const canViewEquipoReport = canViewEquipoIndividualReport(sessionUser?.roleCode)

  const loadAtencionPage = useCallback(
    async (query: CustomerAtencionListQuery) => {
      if (!isAuthReady || !companyId) {
        return
      }

      setIsListLoading(true)
      setListQuery(query)

      try {
        const result = await listAtencionPage(companyId, query)

        if (result.data) {
          setListPage(result.data)
        } else {
          setListPage({
            items: [],
            total: 0,
            page: query.page,
            pageSize: query.pageSize ?? DEFAULT_ATENCION_PAGE_SIZE,
          })
        }
      } finally {
        setIsListLoading(false)
        setIsReady(true)
      }
    },
    [companyId, isAuthReady]
  )

  const loadSharedInbox = useCallback(
    async (
      query: SharedInboxQuery,
      options?: { mode?: "full" | "fast" }
    ) => {
      if (!isAuthReady || !companyId) {
        return
      }

      const mode = options?.mode ?? "full"
      const isFast = mode === "fast"

      setIsSharedInboxLoading(true)
      setSharedInboxQuery(query)
      const perfSession = beginCustomerServiceInboxProfile()

      try {
        await measureAtcClientSpan(
          "inboxLoad",
          async () => {
            // Sprint 28.3 / 34.0 — releaseExpired is NOT a recurrent cost and
            // must not block first paint:
            // - once per provider mount (enter / F5) on the first non-fast load
            // - optional 5-minute timer (see effect below)
            // - runs in background; inbox load continues immediately
            // Fast mutation refresh never runs it.
            if (isFast) {
              if (process.env.NODE_ENV === "development") {
                console.log(
                  "[ATC FastRefresh]",
                  "loadSharedInbox",
                  "mode=fast",
                  "skip releaseExpired + dashboard bundle",
                  Date.now()
                )
              }
            } else if (!hasReleasedExpiredThisMountRef.current) {
              hasReleasedExpiredThisMountRef.current = true
              void runReleaseExpiredInBackgroundRef.current(
                "loadSharedInbox:initialMount"
              )
            } else if (process.env.NODE_ENV === "development") {
              console.log(
                "[ATC ReleaseExpired]",
                "caller",
                "loadSharedInbox:skipped(alreadyRanThisMount)",
                Date.now()
              )
            }

            const referenceDate = new Date()
            const jornadaQuery = createJornadaDashboardQuery(referenceDate)
            const shouldLoadDashboard =
              !isFast && !sharedInboxDashboardLoadedRef.current
            const createdDate =
              normalizeSharedInboxCreatedDate(query.createdDate) ??
              toLocalDateOnly(referenceDate)
            const searching = Boolean(normalizeSharedInboxSearch(query.search))
            const isHistoricalDay =
              createdDate !== toLocalDateOnly(referenceDate) && !searching

            if (shouldLoadDashboard) {
              setIsSharedInboxDashboardLoading(true)
            }

            const [dashboardResult, rowsResult, historicalRowsResult] =
              await Promise.all([
                shouldLoadDashboard
                  ? loadSharedInboxBundle(companyId, jornadaQuery, referenceDate)
                  : Promise.resolve(null),
                listSharedInboxConsultations(companyId, query, referenceDate),
                isHistoricalDay
                  ? listSharedInboxConsultations(
                      companyId,
                      {
                        ...jornadaQuery,
                        createdDate,
                      },
                      referenceDate
                    )
                  : Promise.resolve(null),
              ])

            if (dashboardResult) {
              setSharedInboxKpis(
                dashboardResult.data?.kpis ?? EMPTY_SHARED_INBOX_KPIS
              )
              setSharedInboxOperationalCounts(
                dashboardResult.data?.operationalCounts ??
                  EMPTY_SHARED_INBOX_OPERATIONAL_COUNTS
              )
              sharedInboxDashboardLoadedRef.current = true
            } else if (rowsResult.data?.operationalCounts) {
              // Sprint 28.2 fast path — operational from list discovery (0 extra queries).
              setSharedInboxOperationalCounts(rowsResult.data.operationalCounts)
            }

            setSharedInboxRows(rowsResult.data?.rows ?? [])
            setSharedInboxWorkTrayCounts(
              rowsResult.data?.workTrayCounts ??
                EMPTY_SHARED_INBOX_WORK_TRAY_COUNTS
            )
            setSharedInboxStatusFilterCounts(
              rowsResult.data?.statusFilterCounts ??
                EMPTY_SHARED_INBOX_STATUS_FILTER_COUNTS
            )

            if (employeeId) {
              void getOperatorActiveManagement(companyId, employeeId).then(
                (activeResult) => {
                  if (activeResult.data) {
                    setMyActiveManagement(
                      findOperatorActiveManagement(
                        [activeResult.data],
                        employeeId
                      )
                    )
                  } else {
                    setMyActiveManagement(null)
                  }
                }
              )
            }

            if (historicalRowsResult?.data && isHistoricalDay) {
              setSharedInboxHistoricalDaySummary(
                computeHistoricalDaySummary(
                  historicalRowsResult.data.rows,
                  createdDate,
                  resolveSharedInboxReferenceDate(
                    { createdDate },
                    referenceDate
                  )
                )
              )
            } else {
              setSharedInboxHistoricalDaySummary(null)
            }
          },
          { reason: isFast ? "loadSharedInbox:fast" : "loadSharedInbox" }
        )
      } finally {
        finishCustomerServiceInboxProfile(perfSession)
        setIsSharedInboxLoading(false)
        setIsSharedInboxDashboardLoading(false)
      }
    },
    [companyId, employeeId, isAuthReady]
  )
  loadSharedInboxRef.current = loadSharedInbox

  // Sprint 28.3 — periodic sweep while ATC provider is mounted (enter keeps locks honest).
  // Sprint 34.0 — still background; fast-refresh only when releases occurred.
  useEffect(() => {
    if (!isAuthReady || !companyId) {
      return
    }

    const RELEASE_EXPIRED_INTERVAL_MS = 5 * 60_000
    const intervalId = window.setInterval(() => {
      void runReleaseExpiredInBackgroundRef.current("provider.interval-5m")
    }, RELEASE_EXPIRED_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [companyId, isAuthReady])

  const refreshMyActiveManagement = useCallback(async () => {
    if (!isAuthReady || !companyId || !employeeId) {
      setMyActiveManagement(null)
      return
    }

    const result = await getOperatorActiveManagement(companyId, employeeId)
    if (result.error || !result.data) {
      setMyActiveManagement(null)
      return
    }

    setMyActiveManagement(
      findOperatorActiveManagement([result.data], employeeId)
    )
  }, [companyId, employeeId, isAuthReady])

  const refreshSharedInbox = useCallback(
    async (options?: { mode?: "full" | "fast" }) => {
      // Sprint 28.2 — mutations default to fast (rows only).
      // Full mode forces KPI/dashboard bundle (enter / F5 / explicit).
      const mode = options?.mode ?? "fast"
      if (mode === "full") {
        sharedInboxDashboardLoadedRef.current = false
      }
      trackAtcQueryInvalidation(
        ["customer_atenciones", "shared-inbox", sharedInboxQuery],
        { log: false }
      )
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[ATC FastRefresh]",
          "refreshSharedInbox",
          `mode=${mode}`,
          Date.now()
        )
      }
      await loadSharedInbox(sharedInboxQuery, { mode })
    },
    [loadSharedInbox, sharedInboxQuery]
  )

  const refreshDashboard = useCallback(async () => {
    if (!isAuthReady || !companyId || !employeeId) {
      setDashboardSummary(EMPTY_SUMMARY)
      setPendingSeguimientos([])
      setPendingRetenciones([])
      setAssignedRetenciones([])
      setMyRecuperaciones([])
      setJornadaEntries([])
      setIsDashboardLoading(false)
      return
    }

    setIsDashboardLoading(true)
    const referenceDate = new Date()

    try {
      const [
        summaryResult,
        pendingResult,
        pendingRetencionesResult,
        retencionesCountResult,
        atencionesResult,
        seguimientosResult,
        retencionesResult,
        assignedRetencionesResult,
        recuperacionesResult,
        recuperacionesTodayResult,
        recuperacionesCountResult,
      ] = await Promise.all([
        getAtencionClienteDashboardSummary(companyId, employeeId, referenceDate),
        measureAtcClientSpan(
          "seguimientos",
          () =>
            listPendingSeguimientosForEmployee(
              companyId,
              employeeId,
              referenceDate
            ),
          { reason: "useCustomerSeguimientos.pending" }
        ),
        listActiveRetencionesForEmployee(companyId, employeeId),
        getActiveRetencionesCount(companyId, employeeId),
        listEmployeeAtencionesToday(companyId, employeeId, referenceDate),
        listCompletedSeguimientosToday(companyId, employeeId, referenceDate),
        listRetencionJornadaRowsForEmployeeToday(
          companyId,
          employeeId,
          referenceDate
        ),
        canViewAssignedRetenciones
          ? listAssignedRetencionesForCompany(companyId)
          : Promise.resolve({ data: [], error: null }),
        listRecuperacionesForEmployee(companyId, employeeId),
        listRecuperacionesTodayForEmployee(companyId, employeeId, referenceDate),
        getRecuperacionesTodayCount(companyId, employeeId, referenceDate),
      ])

      setDashboardSummary({
        ...(summaryResult.data ?? {
          atencionesHoy: 0,
          resueltas: 0,
          seguimientosPendientes: 0,
          recuperosHoy: 0,
        }),
        retencionesActivas: retencionesCountResult.data ?? 0,
        recuperosHoy: recuperacionesCountResult.data ?? 0,
      })
      setPendingSeguimientos(pendingResult.data ?? [])
      setPendingRetenciones(pendingRetencionesResult.data ?? [])
      setAssignedRetenciones(assignedRetencionesResult.data ?? [])
      setMyRecuperaciones(recuperacionesResult.data ?? [])

      const atenciones = atencionesResult.data ?? []
      const customerIds = [
        ...new Set([
          ...atenciones.map((atencion) => atencion.customerId),
          ...(pendingResult.data ?? []).map((item) => item.customerId),
          ...(seguimientosResult.data ?? []).map((item) => item.customerId),
          ...(retencionesResult.data ?? []).map((item) => item.customerId),
        ]),
      ]

      const customerNameById = new Map<string, string>()
      if (customerIds.length > 0) {
        const { data: customers } = await createClient()
          .from("customers")
          .select("id, name")
          .eq("company_id", companyId)
          .in("id", customerIds)
          .is("deleted_at", null)

        for (const customer of customers ?? []) {
          customerNameById.set(customer.id, customer.name)
        }
      }

      setJornadaEntries(
        buildJornadaEntries({
          atenciones: atenciones.map((atencion) => ({
            atencion,
            customerName:
              customerNameById.get(atencion.customerId) ?? "Cliente",
          })),
          seguimientos: seguimientosResult.data ?? [],
          retenciones: retencionesResult.data ?? [],
          recuperaciones: recuperacionesTodayResult.data ?? [],
        })
      )
    } finally {
      setIsDashboardLoading(false)
    }
  }, [canViewAssignedRetenciones, companyId, employeeId, isAuthReady])

  const fetchAtencionById = useCallback(
    async (id: string) => {
      const cached = atencionCacheRef.current.get(id)
      if (cached) {
        return cached
      }

      if (!companyId) {
        return null
      }

      const result = await loadCustomerAtencionById(id, companyId)

      if (!result.data) {
        return null
      }

      atencionCacheRef.current.set(id, result.data)
      return result.data
    },
    [companyId]
  )

  const refreshAtencionById = useCallback(
    async (id: string) => {
      if (!companyId) {
        return null
      }

      const result = await loadCustomerAtencionById(id, companyId)

      if (!result.data) {
        atencionCacheRef.current.delete(id)
        return null
      }

      atencionCacheRef.current.set(id, result.data)
      return result.data
    },
    [companyId]
  )

  const fetchSeguimientoById = useCallback(
    async (id: string) => {
      const cached = seguimientoCacheRef.current.get(id)
      if (cached) {
        return cached
      }

      if (!companyId) {
        return null
      }

      return measureAtcClientSpan(
        "seguimientos",
        async () => {
          const result = await loadCustomerSeguimientoById(id, companyId)

          if (!result.data) {
            return null
          }

          seguimientoCacheRef.current.set(id, result.data)
          return result.data
        },
        { reason: "fetchSeguimientoById" }
      )
    },
    [companyId]
  )

  const fetchRetencionById = useCallback(
    async (id: string) => {
      const cached = retencionCacheRef.current.get(id)
      if (cached) {
        return cached
      }

      if (!companyId) {
        return null
      }

      const result = await loadCustomerRetencionById(id, companyId)

      if (!result.data) {
        return null
      }

      retencionCacheRef.current.set(id, result.data)
      return result.data
    },
    [companyId]
  )

  const fetchRecuperacionById = useCallback(
    async (id: string) => {
      const cached = recuperacionCacheRef.current.get(id)
      if (cached) {
        return cached
      }

      if (!companyId) {
        return null
      }

      const result = await loadCustomerRecuperacionById(id, companyId)

      if (!result.data) {
        return null
      }

      recuperacionCacheRef.current.set(id, result.data)
      return result.data
    },
    [companyId]
  )

  const listAssignees = useCallback(async () => {
    if (!companyId) {
      return []
    }

    const result = await listAtencionClienteAssignees(companyId)
    return result.data ?? []
  }, [companyId])

  const searchCustomers = useCallback(
    async (query: string, limit = 8) => {
      if (!companyId) {
        return []
      }

      const result = await searchCustomersInSupabase(companyId, query, limit)
      return result.data ?? []
    },
    [companyId]
  )

  const createAtencion = useCallback(
    async (input: NewCustomerAtencionInput): Promise<AtencionMutationResult> => {
      const perf = startPerformanceTrace("ATENCION CREATE", {
        layer: "frontend",
      })
      try {
        if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
          perf.finish({ Note: "demo_blocked" })
          return DEMO_WRITE_BLOCKED_MUTATION_RESULT
        }

        if (!companyId) {
          perf.finish({ Note: "missing_company" })
          return { success: false, message: "Empresa no disponible." }
        }

        if (!employeeId) {
          perf.finish({ Note: "missing_employee" })
          return {
            success: false,
            message:
              "No se pudo identificar al empleado que registra la atención.",
          }
        }

        const validationError = perf.spanSync("Validate", () =>
          validateNewConsultationInput(input)
        )

        if (validationError) {
          perf.finish({ Note: "validation_error" })
          return { success: false, message: validationError }
        }

        const creation = perf.spanSync("Build fields", () =>
          buildNewConsultationCreationFields(input)
        )

        if ("error" in creation) {
          perf.finish({ Note: "build_error" })
          return { success: false, message: creation.error }
        }

        let customerId = input.customerId?.trim() ?? ""

        if (input.quickCustomer) {
          const customerResult = await perf.span("Create customer", () =>
            createCustomerInSupabase(
              mapQuickCustomerToCreatePayload(input.quickCustomer!, companyId)
            )
          )

          if (customerResult.error || !customerResult.data) {
            perf.finish({ Note: "customer_create_failed" })
            return {
              success: false,
              message:
                customerResult.error?.message ??
                "No se pudo registrar al cliente.",
            }
          }

          customerId = customerResult.data.id
        }

        const result = await perf.span("Insert atencion", () =>
          createCustomerAtencion({
            companyId,
            customerId,
            attendedByEmployeeId: employeeId,
            channel: input.channel,
            motivo: input.motivo,
            detail: input.detail,
            resolution: creation.resolution,
            resultado: creation.resultado,
            status: creation.status,
            nextStep: creation.nextStep,
          })
        )

        if (result.error || !result.data) {
          perf.finish({ Note: "insert_failed" })
          return {
            success: false,
            message:
              result.error?.message ?? "No se pudo registrar la atención.",
          }
        }

        let atencion = result.data
        atencionCacheRef.current.set(atencion.id, atencion)

        void requestRegisterCustomerActivity({
          entityId: atencion.id,
          ...buildCaseCreatedActivity({
            customerId: atencion.customerId,
            motivo: atencion.motivo,
            canal: atencion.channel,
            estadoInicial: atencion.status,
            nextStep: atencion.nextStep ?? null,
          }),
        })

        if (atencion.status === "resuelta") {
          void requestRegisterCustomerActivity({
            entityId: atencion.id,
            ...buildCaseClosedActivity({
              resultado: atencion.resultado,
              motivoCierre: atencion.resolution || null,
            }),
          })
        }

        if (atencion.nextStep === "contactar_cliente") {
          const deriveResult = await perf.span("Commercial derive", () =>
            deriveConsultationToCommercial(atencion.id, input.detail)
          )
          if (!deriveResult.success) {
            console.error("[COMMERCIAL DERIVATION]", deriveResult.message)
          } else {
            const refreshed = await perf.span("Reload atencion", () =>
              loadCustomerAtencionById(atencion.id, companyId)
            )
            if (refreshed.data) {
              atencion = refreshed.data
              atencionCacheRef.current.set(atencion.id, atencion)
              if (atencion.status === "resuelta") {
                void requestRegisterCustomerActivity({
                  entityId: atencion.id,
                  ...buildCaseClosedActivity({
                    resultado: atencion.resultado,
                    motivoCierre: atencion.resolution || null,
                  }),
                })
              }
            }
          }
        }

        await perf.span("Refresh lists", () =>
          Promise.all([
            loadAtencionPage({ ...listQuery, page: 1 }),
            refreshDashboard(),
            refreshSharedInbox(),
          ])
        )

        perf.finish()
        return {
          success: true,
          atencion,
        }
      } catch (error) {
        perf.fail(error)
        throw error
      }
    },
    [
      companyId,
      employeeId,
      isReadOnly,
      listQuery,
      loadAtencionPage,
      openRestrictedDialog,
      refreshDashboard,
      refreshSharedInbox,
    ]
  )

  const runConsultationManagementMutation = useCallback(
    async (
      atencionId: string,
      mutation: () => Promise<ConsultationManagementMutationResult>,
      breakdownAction?: AtcBreakdownAction
    ): Promise<ConsultationManagementMutationResult> => {
      const perf = startPerformanceTrace("ATENCION MANAGEMENT", {
        layer: "frontend",
      })
      try {
        if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
          perf.finish({ Note: "demo_blocked" })
          return {
            success: false,
            message: DEMO_RESTRICTED_DIALOG_MESSAGE,
          }
        }

        if (breakdownAction) {
          beginAtcBreakdown(breakdownAction)
        }

        const result = await measureAtcBreakdownPhase("rpc", () =>
          perf.span("Server mutation", () => mutation())
        )

        if (result.success) {
          // Sprint 28.0 — inbox once here. Detail UI calls loadDetail
          // (refreshAtencionById + events + attachments) via reloadAfterAction.
          // Do not refreshAtencionById here: that duplicated the atencion fetch.
          await measureAtcBreakdownPhase("refreshInbox", () =>
            perf.span("Refresh UI", () => refreshSharedInbox())
          )
        } else if (breakdownAction) {
          // No detail reload follows a failed mutation — close the breakdown now.
          void finalizeAtcBreakdown()
        }

        perf.finish()
        return result
      } catch (error) {
        if (breakdownAction) {
          void finalizeAtcBreakdown()
        }
        perf.fail(error)
        throw error
      }
    },
    [isReadOnly, openRestrictedDialog, refreshSharedInbox]
  )

  const startConsultationManagementHandler = useCallback(
    async (atencionId: string) => {
      return runConsultationManagementMutation(
        atencionId,
        () => startConsultationManagement(atencionId),
        "start-management"
      )
    },
    [runConsultationManagementMutation]
  )

  const cancelConsultationManagementHandler = useCallback(
    async (atencionId: string) => {
      return runConsultationManagementMutation(atencionId, () =>
        cancelConsultationManagement(atencionId)
      )
    },
    [runConsultationManagementMutation]
  )

  const touchConsultationManagementActivityHandler = useCallback(
    async (atencionId: string) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return {
          success: false as const,
          message: DEMO_RESTRICTED_DIALOG_MESSAGE,
        }
      }

      return touchConsultationManagementActivity(atencionId)
    },
    [isReadOnly, openRestrictedDialog]
  )

  const resolveConsultationHandler = useCallback(
    async (
      atencionId: string,
      resolution: string,
      followUpActions: string[] = []
    ) => {
      return runConsultationManagementMutation(
        atencionId,
        () =>
          resolveConsultationManagement(
            atencionId,
            resolution,
            followUpActions
          ),
        "resolve"
      )
    },
    [runConsultationManagementMutation]
  )

  const deferConsultationHandler = useCallback(
    async (
      atencionId: string,
      nextStep: CustomerAtencionNextStep,
      detail?: string
    ) => {
      return runConsultationManagementMutation(
        atencionId,
        () => deferConsultationManagement(atencionId, nextStep, detail),
        "defer"
      )
    },
    [runConsultationManagementMutation]
  )

  const updateMorosoTrackingHandler = useCallback(
    async (
      atencionId: string,
      trackingStatus: string
    ): Promise<MorosoTrackingMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return {
          success: false,
          message: DEMO_RESTRICTED_DIALOG_MESSAGE,
        }
      }

      const result = await updateMorosoTrackingManagement(
        atencionId,
        trackingStatus
      )

      if (result.success) {
        // No reloadAfterAction caller — refresh atencion cache for subsequent reads.
        // Inbox refresh keeps bandeja row fields in sync; bandeja category unchanged.
        await Promise.all([
          refreshAtencionById(atencionId),
          refreshSharedInbox(),
        ])
      }

      return result
    },
    [
      isReadOnly,
      openRestrictedDialog,
      refreshAtencionById,
      refreshSharedInbox,
    ]
  )

  const registerConsultationInteractionHandler = useCallback(
    async (
      atencionId: string,
      input: {
        interactionKind: string
        interactionResult?: string | null
        detail?: string
        nextActionAt?: string | null
        clientInteraction?: {
          medio: string
          resultado: string
          observations?: string | null
          nextStep?: string | null
          customerId?: string | null
        } | null
      }
    ): Promise<ConsultationInteractionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return {
          success: false,
          message: DEMO_RESTRICTED_DIALOG_MESSAGE,
        }
      }

      const result = await registerConsultationInteractionManagement(
        atencionId,
        {
          interactionKind: input.interactionKind,
          interactionResult: input.interactionResult,
          detail: input.detail ?? "",
          nextActionAt: input.nextActionAt,
          clientInteraction: input.clientInteraction,
        }
      )

      if (result.success) {
        // Sprint 28.0 — inbox once; detail reloadAfterAction owns atencion+events+attachments.
        await refreshSharedInbox()
        setActionFeedback(
          result.managementReleased
            ? "Interacción registrada. La consulta permanece en su bandeja."
            : "Interacción registrada correctamente."
        )
      }

      return result
    },
    [isReadOnly, openRestrictedDialog, refreshSharedInbox]
  )

  const linkConsultationOtHandler = useCallback(
    async (
      atencionId: string,
      taskId: string
    ): Promise<OtLinkMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return {
          success: false,
          message: DEMO_RESTRICTED_DIALOG_MESSAGE,
        }
      }

      const result = await linkConsultationOtManagement(atencionId, taskId)

      if (result.success) {
        // No panel reloadAfterAction path — keep cache + bandeja in sync.
        await Promise.all([
          refreshAtencionById(atencionId),
          refreshSharedInbox(),
        ])
      }

      return result
    },
    [
      isReadOnly,
      openRestrictedDialog,
      refreshAtencionById,
      refreshSharedInbox,
    ]
  )

  const permanentDeleteConsultationHandler = useCallback(
    async (
      atencionId: string
    ): Promise<ConsultationHardDeleteMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return {
          success: false,
          message: DEMO_RESTRICTED_DIALOG_MESSAGE,
        }
      }

      const result = await permanentDeleteConsultationManagement(atencionId)

      if (result.success) {
        setActionFeedback(CONSULTATION_HARD_DELETE_SUCCESS_MESSAGE)
        await Promise.all([refreshSharedInbox(), refreshDashboard()])
      }

      return result
    },
    [isReadOnly, openRestrictedDialog, refreshDashboard, refreshSharedInbox]
  )

  const clearActionFeedback = useCallback(() => {
    setActionFeedback(null)
  }, [])

  const createRetencion = useCallback(
    async (input: NewCustomerRetencionInput): Promise<RetencionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId || !employeeId) {
        return { success: false, message: "Sesión no disponible." }
      }

      if (!input.detail.trim()) {
        return {
          success: false,
          message: "Completá el detalle de la solicitud.",
        }
      }

      const result = await createCustomerRetencion({
        companyId,
        customerId: input.customerId,
        assignedEmployeeId: employeeId,
        assignedByEmployeeId: employeeId,
        motivoBaja: input.motivoBaja,
        detail: input.detail,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo iniciar la gestión de baja.",
        }
      }

      retencionCacheRef.current.set(result.data.id, result.data)
      await refreshDashboard()

      return { success: true, retencion: result.data }
    },
    [companyId, employeeId, isReadOnly, openRestrictedDialog, refreshDashboard]
  )

  const resolveRetencion = useCallback(
    async (
      id: string,
      input: ResolveCustomerRetencionInput
    ): Promise<RetencionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId || !employeeId) {
        return { success: false, message: "Sesión no disponible." }
      }

      if (!input.resolution.trim()) {
        return {
          success: false,
          message: "Completá las observaciones de la gestión.",
        }
      }

      const result =
        input.resultado === "retenido"
          ? await finalizeRetainedCustomerRetencion(
              id,
              {
                status: "finalizada",
                resultado: "retenido",
                resolution: input.resolution,
                completedAt: new Date().toISOString(),
                completedByEmployeeId: employeeId,
              },
              companyId
            )
          : await deriveCustomerRetencionToAdministration(
              id,
              {
                status: "pendiente_administracion",
                resultado: "persiste_baja",
                resolution: input.resolution,
                administrationPendingAt: new Date().toISOString(),
              },
              companyId
            )

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo registrar la gestión.",
        }
      }

      retencionCacheRef.current.set(id, result.data)
      await refreshDashboard()

      return { success: true, retencion: result.data }
    },
    [companyId, employeeId, isReadOnly, openRestrictedDialog, refreshDashboard]
  )

  const markRetencionReadyForRetiroHandler = useCallback(
    async (id: string): Promise<RetencionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!canMarkRetencionReadyForRetiro) {
        return {
          success: false,
          message: "No tenés permiso para marcar listo para retiro.",
        }
      }

      if (!companyId) {
        return { success: false, message: "Sesión no disponible." }
      }

      const result = await markCustomerRetencionReadyForRetiro(
        id,
        { status: "pendiente_retiro" },
        companyId
      )

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo marcar listo para retiro.",
        }
      }

      retencionCacheRef.current.set(id, result.data)
      await refreshDashboard()

      return { success: true, retencion: result.data }
    },
    [
      canMarkRetencionReadyForRetiro,
      companyId,
      isReadOnly,
      openRestrictedDialog,
      refreshDashboard,
    ]
  )

  const createRecuperacion = useCallback(
    async (
      input: NewCustomerRecuperacionInput
    ): Promise<RecuperacionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId || !employeeId) {
        return { success: false, message: "Sesión no disponible." }
      }

      if (!input.offer.trim()) {
        return {
          success: false,
          message: "Completá la oferta o promoción realizada.",
        }
      }

      if (!input.observation.trim()) {
        return {
          success: false,
          message: "Completá la observación de la gestión.",
        }
      }

      if (input.mode === "existing" && !input.customerId) {
        return {
          success: false,
          message: "Seleccioná un cliente existente.",
        }
      }

      if (input.mode === "manual") {
        if (
          !input.manualCustomerName.trim() ||
          !input.manualZone.trim() ||
          !input.manualPhone.trim()
        ) {
          return {
            success: false,
            message: "Completá nombre, zona y teléfono para la carga manual.",
          }
        }
      }

      const result = await createCustomerRecuperacion(
        mapNewCustomerRecuperacionInputToPayload(input, companyId, employeeId)
      )

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo registrar la gestión de recupero.",
        }
      }

      recuperacionCacheRef.current.set(result.data.id, result.data)
      await refreshDashboard()

      return { success: true, recuperacion: result.data }
    },
    [companyId, employeeId, isReadOnly, openRestrictedDialog, refreshDashboard]
  )

  const completeSeguimiento = useCallback(
    async (
      id: string,
      input: CompleteCustomerSeguimientoInput
    ): Promise<SeguimientoMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId || !employeeId) {
        return { success: false, message: "Sesión no disponible." }
      }

      const result = await markCustomerSeguimientoCompleted(
        id,
        {
          completionAction: input.completionAction,
          completedAt: new Date().toISOString(),
          completedByEmployeeId: employeeId,
          status: "completado",
        },
        companyId
      )

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo completar el seguimiento.",
        }
      }

      seguimientoCacheRef.current.set(id, result.data)
      await refreshDashboard()

      return { success: true, seguimiento: result.data }
    },
    [companyId, employeeId, isReadOnly, openRestrictedDialog, refreshDashboard]
  )

  const completeSeguimientoWithFollowUp = useCallback(
    async (
      id: string,
      input: CompleteCustomerSeguimientoWithFollowUpInput
    ): Promise<SeguimientoMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId || !employeeId) {
        return { success: false, message: "Sesión no disponible." }
      }

      const currentResult = await loadCustomerSeguimientoById(id, companyId)
      const current = currentResult.data

      if (!current) {
        return { success: false, message: "Seguimiento no encontrado." }
      }

      const completeResult = await markCustomerSeguimientoCompleted(
        id,
        {
          completionAction: input.completionAction,
          completedAt: new Date().toISOString(),
          completedByEmployeeId: employeeId,
          status: "completado",
        },
        companyId
      )

      if (completeResult.error || !completeResult.data) {
        return {
          success: false,
          message:
            completeResult.error?.message ??
            "No se pudo completar el seguimiento actual.",
        }
      }

      const nextResult = await createCustomerSeguimiento({
        companyId,
        customerId: current.customerId,
        assignedEmployeeId: employeeId,
        sourceAtencionId: current.sourceAtencionId,
        previousSeguimientoId: current.id,
        scheduledDate: input.nextScheduledDate,
        scheduledTime: input.nextScheduledTime ?? null,
        observation: input.nextObservation,
      })

      if (nextResult.error || !nextResult.data) {
        return {
          success: false,
          message:
            nextResult.error?.message ??
            "El seguimiento actual se completó, pero no se pudo crear el próximo.",
          seguimiento: completeResult.data,
        }
      }

      seguimientoCacheRef.current.set(id, completeResult.data)
      seguimientoCacheRef.current.set(nextResult.data.id, nextResult.data)

      if (nextResult.data.sourceAtencionId) {
        void requestRegisterCustomerActivity({
          entityId: nextResult.data.sourceAtencionId,
          ...buildFollowUpCreatedActivity({
            seguimientoId: nextResult.data.id,
            tipo: "seguimiento",
            resultado: null,
            nextStep: null,
          }),
        })
      }

      await refreshDashboard()

      return {
        success: true,
        seguimiento: completeResult.data,
        nextSeguimiento: nextResult.data,
      }
    },
    [companyId, employeeId, isReadOnly, openRestrictedDialog, refreshDashboard]
  )

  const getAgendaItems = useCallback(
    (view: "hoy" | "semana") => {
      const referenceDate = new Date()

      if (view === "hoy") {
        return filterAgendaForTodayView(pendingSeguimientos, referenceDate)
      }

      return filterAgendaForWeekView(pendingSeguimientos, referenceDate)
    },
    [pendingSeguimientos]
  )

  const value = useMemo(
    () => ({
      listPage,
      isListLoading,
      isReady,
      listQuery,
      dashboardSummary,
      isDashboardLoading,
      pendingSeguimientos,
      pendingRetenciones,
      assignedRetenciones,
      myRecuperaciones,
      jornadaEntries,
      canMarkRetencionReadyForRetiro,
      canViewAssignedRetenciones,
      canViewEquipoReport,
      sharedInboxKpis,
      sharedInboxOperationalCounts,
      sharedInboxWorkTrayCounts,
      sharedInboxStatusFilterCounts,
      sharedInboxRows,
      sharedInboxHistoricalDaySummary,
      sharedInboxQuery,
      isSharedInboxLoading,
      isSharedInboxDashboardLoading,
      myActiveManagement,
      refreshMyActiveManagement,
      loadAtencionPage,
      loadSharedInbox,
      refreshSharedInbox,
      refreshDashboard,
      fetchAtencionById,
      refreshAtencionById,
      fetchSeguimientoById,
      fetchRetencionById,
      fetchRecuperacionById,
      searchCustomers,
      listAssignees,
      createAtencion,
      startConsultationManagement: startConsultationManagementHandler,
      cancelConsultationManagement: cancelConsultationManagementHandler,
      touchConsultationManagementActivity:
        touchConsultationManagementActivityHandler,
      resolveConsultation: resolveConsultationHandler,
      deferConsultation: deferConsultationHandler,
      updateMorosoTracking: updateMorosoTrackingHandler,
      registerConsultationInteraction: registerConsultationInteractionHandler,
      linkConsultationOt: linkConsultationOtHandler,
      permanentDeleteConsultation: permanentDeleteConsultationHandler,
      actionFeedback,
      clearActionFeedback,
      currentEmployeeId: employeeId,
      createRetencion,
      resolveRetencion,
      markRetencionReadyForRetiro: markRetencionReadyForRetiroHandler,
      createRecuperacion,
      completeSeguimiento,
      completeSeguimientoWithFollowUp,
      getAgendaItems,
    }),
    [
      assignedRetenciones,
      canMarkRetencionReadyForRetiro,
      canViewAssignedRetenciones,
      canViewEquipoReport,
      completeSeguimiento,
      completeSeguimientoWithFollowUp,
      createAtencion,
      deferConsultationHandler,
      updateMorosoTrackingHandler,
      registerConsultationInteractionHandler,
      linkConsultationOtHandler,
      permanentDeleteConsultationHandler,
      actionFeedback,
      clearActionFeedback,
      dashboardSummary,
      employeeId,
      fetchAtencionById,
      fetchRecuperacionById,
      fetchRetencionById,
      fetchSeguimientoById,
      getAgendaItems,
      isDashboardLoading,
      isListLoading,
      isReady,
      isSharedInboxLoading,
      isSharedInboxDashboardLoading,
      jornadaEntries,
      listAssignees,
      listPage,
      listQuery,
      loadAtencionPage,
      loadSharedInbox,
      markRetencionReadyForRetiroHandler,
      myRecuperaciones,
      pendingRetenciones,
      pendingSeguimientos,
      refreshAtencionById,
      refreshDashboard,
      refreshMyActiveManagement,
      refreshSharedInbox,
      resolveConsultationHandler,
      resolveRetencion,
      searchCustomers,
      sharedInboxKpis,
      sharedInboxOperationalCounts,
      sharedInboxWorkTrayCounts,
      sharedInboxStatusFilterCounts,
      sharedInboxQuery,
      sharedInboxRows,
      sharedInboxHistoricalDaySummary,
      myActiveManagement,
      startConsultationManagementHandler,
      cancelConsultationManagementHandler,
      touchConsultationManagementActivityHandler,
      createRecuperacion,
      createRetencion,
    ]
  )

  return (
    <AtencionClienteContext.Provider value={value}>
      {children}
    </AtencionClienteContext.Provider>
  )
}

export function useAtencionCliente() {
  const context = useContext(AtencionClienteContext)

  if (!context) {
    throw new Error("useAtencionCliente debe usarse dentro de AtencionClienteProvider.")
  }

  return context
}

export function useAtencionClienteOptional() {
  return useContext(AtencionClienteContext)
}

export { createBrowserCustomerAtencionesClient }
