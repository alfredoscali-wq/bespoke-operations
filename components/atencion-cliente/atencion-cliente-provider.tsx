"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import {
  DEFAULT_ATENCION_PAGE_SIZE,
  type CustomerAtencionListQuery,
} from "@/lib/customer-atenciones/atencion-list"
import {
  buildNewConsultationCreationFields,
  validateNewConsultationInput,
} from "@/lib/customer-atenciones/consultation"
import type {
  SharedInboxKpiSummary,
  SharedInboxOperationalCounts,
  SharedInboxQuery,
} from "@/lib/customer-atenciones/shared-inbox"
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
  loadSharedInboxBundle,
  listEmployeeAtencionesToday,
} from "@/lib/supabase/customer-atenciones.browser"
import {
  deferConsultationManagement,
  resolveConsultationManagement,
  startConsultationManagement,
  type ConsultationManagementMutationResult,
} from "@/lib/supabase/customer-atenciones-management.browser"
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
import { searchCustomers as searchCustomersInSupabase } from "@/lib/supabase/customers.browser"
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
}

const EMPTY_SHARED_INBOX_OPERATIONAL_COUNTS: SharedInboxOperationalCounts = {
  retenciones: 0,
  administracion: 0,
  tecnica: 0,
  contactar_cliente: 0,
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
  sharedInboxRows: CustomerAtencionInboxRow[]
  sharedInboxQuery: SharedInboxQuery
  isSharedInboxLoading: boolean
  loadAtencionPage: (query: CustomerAtencionListQuery) => Promise<void>
  loadSharedInbox: (query: SharedInboxQuery) => Promise<void>
  refreshSharedInbox: () => Promise<void>
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
  resolveConsultation: (
    atencionId: string,
    resolution: string
  ) => Promise<ConsultationManagementMutationResult>
  deferConsultation: (
    atencionId: string,
    nextStep: CustomerAtencionNextStep,
    detail?: string
  ) => Promise<ConsultationManagementMutationResult>
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
  const [sharedInboxRows, setSharedInboxRows] = useState<CustomerAtencionInboxRow[]>(
    []
  )
  const [sharedInboxQuery, setSharedInboxQuery] = useState<SharedInboxQuery>({
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: null,
  })
  const [isSharedInboxLoading, setIsSharedInboxLoading] = useState(true)
  const atencionCacheRef = useRef<Map<string, CustomerAtencion>>(new Map())
  const seguimientoCacheRef = useRef<Map<string, CustomerSeguimiento>>(new Map())
  const retencionCacheRef = useRef<Map<string, CustomerRetencion>>(new Map())
  const recuperacionCacheRef = useRef<Map<string, CustomerRecuperacion>>(new Map())

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
    async (query: SharedInboxQuery) => {
      if (!isAuthReady || !companyId) {
        return
      }

      setIsSharedInboxLoading(true)
      setSharedInboxQuery(query)

      try {
        const referenceDate = new Date()
        const bundleResult = await loadSharedInboxBundle(
          companyId,
          query,
          referenceDate
        )

        setSharedInboxKpis(bundleResult.data?.kpis ?? EMPTY_SHARED_INBOX_KPIS)
        setSharedInboxOperationalCounts(
          bundleResult.data?.operationalCounts ??
            EMPTY_SHARED_INBOX_OPERATIONAL_COUNTS
        )
        setSharedInboxRows(bundleResult.data?.rows ?? [])
      } finally {
        setIsSharedInboxLoading(false)
      }
    },
    [companyId, isAuthReady]
  )

  const refreshSharedInbox = useCallback(async () => {
    await loadSharedInbox(sharedInboxQuery)
  }, [loadSharedInbox, sharedInboxQuery])

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
        listPendingSeguimientosForEmployee(
          companyId,
          employeeId,
          referenceDate
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

      const result = await loadCustomerSeguimientoById(id, companyId)

      if (!result.data) {
        return null
      }

      seguimientoCacheRef.current.set(id, result.data)
      return result.data
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
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId) {
        return { success: false, message: "Empresa no disponible." }
      }

      if (!employeeId) {
        return {
          success: false,
          message: "No se pudo identificar al empleado que registra la atención.",
        }
      }

      const validationError = validateNewConsultationInput(input)

      if (validationError) {
        return { success: false, message: validationError }
      }

      const creation = buildNewConsultationCreationFields(input)

      if ("error" in creation) {
        return { success: false, message: creation.error }
      }

      const result = await createCustomerAtencion({
        companyId,
        customerId: input.customerId,
        attendedByEmployeeId: employeeId,
        channel: input.channel,
        motivo: input.motivo,
        detail: input.detail,
        resolution: creation.resolution,
        resultado: creation.resultado,
        status: creation.status,
        nextStep: creation.nextStep,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo registrar la atención.",
        }
      }

      atencionCacheRef.current.set(result.data.id, result.data)

      await Promise.all([
        loadAtencionPage({ ...listQuery, page: 1 }),
        refreshDashboard(),
        refreshSharedInbox(),
      ])

      return {
        success: true,
        atencion: result.data,
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
      mutation: () => Promise<ConsultationManagementMutationResult>
    ): Promise<ConsultationManagementMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return {
          success: false,
          message: DEMO_RESTRICTED_DIALOG_MESSAGE,
        }
      }

      const result = await mutation()

      if (result.success) {
        await Promise.all([
          refreshAtencionById(atencionId),
          refreshSharedInbox(),
        ])
      }

      return result
    },
    [isReadOnly, openRestrictedDialog, refreshAtencionById, refreshSharedInbox]
  )

  const startConsultationManagementHandler = useCallback(
    async (atencionId: string) => {
      return runConsultationManagementMutation(atencionId, () =>
        startConsultationManagement(atencionId)
      )
    },
    [runConsultationManagementMutation]
  )

  const resolveConsultationHandler = useCallback(
    async (atencionId: string, resolution: string) => {
      return runConsultationManagementMutation(atencionId, () =>
        resolveConsultationManagement(atencionId, resolution)
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
      return runConsultationManagementMutation(atencionId, () =>
        deferConsultationManagement(atencionId, nextStep, detail)
      )
    },
    [runConsultationManagementMutation]
  )

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
      sharedInboxRows,
      sharedInboxQuery,
      isSharedInboxLoading,
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
      resolveConsultation: resolveConsultationHandler,
      deferConsultation: deferConsultationHandler,
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
      refreshSharedInbox,
      resolveConsultationHandler,
      resolveRetencion,
      searchCustomers,
      sharedInboxKpis,
      sharedInboxOperationalCounts,
      sharedInboxQuery,
      sharedInboxRows,
      startConsultationManagementHandler,
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

export { createBrowserCustomerAtencionesClient }
