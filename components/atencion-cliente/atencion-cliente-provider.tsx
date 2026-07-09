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
  filterAgendaForTodayView,
  filterAgendaForWeekView,
} from "@/lib/customer-seguimientos/agenda"
import { canAssignCustomerRetencion, canViewAssignedCustomerRetenciones } from "@/lib/customer-retenciones/access"
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
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createCustomerAtencionWithSeguimiento,
  listEmployeeAtencionesToday,
} from "@/lib/supabase/customer-atenciones.browser"
import {
  createBrowserCustomerAtencionesClient,
  getCustomerAtencionById as loadCustomerAtencionById,
  listAtencionPage,
} from "@/lib/supabase/customer-atenciones.browser"
import {
  createCustomerRetencion,
  getActiveRetencionesCount,
  getCustomerRetencionById as loadCustomerRetencionById,
  listAssignedRetencionesForCompany,
  listAtencionClienteAssignees,
  listCompletedRetencionesToday,
  listPendingRetencionesForEmployee,
  markCustomerRetencionCompleted,
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
  CustomerAtencionListPage,
  NewCustomerAtencionInput,
} from "@/lib/types/customer-atenciones"
import type {
  AtencionClienteAssigneeOption,
  CompleteCustomerRetencionInput,
  CustomerRetencion,
  CustomerRetencionActiveRow,
  CustomerRetencionSupervisionRow,
  NewCustomerRetencionInput,
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
  canAssignRetencion: boolean
  canViewAssignedRetenciones: boolean
  canViewEquipoReport: boolean
  loadAtencionPage: (query: CustomerAtencionListQuery) => Promise<void>
  refreshDashboard: () => Promise<void>
  fetchAtencionById: (id: string) => Promise<CustomerAtencion | null>
  fetchSeguimientoById: (id: string) => Promise<CustomerSeguimiento | null>
  fetchRetencionById: (id: string) => Promise<CustomerRetencion | null>
  fetchRecuperacionById: (id: string) => Promise<CustomerRecuperacion | null>
  searchCustomers: (query: string, limit?: number) => Promise<Customer[]>
  listAssignees: () => Promise<AtencionClienteAssigneeOption[]>
  createAtencion: (input: NewCustomerAtencionInput) => Promise<AtencionMutationResult>
  assignRetencion: (
    input: NewCustomerRetencionInput
  ) => Promise<RetencionMutationResult>
  completeRetencion: (
    id: string,
    input: CompleteCustomerRetencionInput
  ) => Promise<RetencionMutationResult>
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
  const atencionCacheRef = useRef<Map<string, CustomerAtencion>>(new Map())
  const seguimientoCacheRef = useRef<Map<string, CustomerSeguimiento>>(new Map())
  const retencionCacheRef = useRef<Map<string, CustomerRetencion>>(new Map())
  const recuperacionCacheRef = useRef<Map<string, CustomerRecuperacion>>(new Map())

  const employeeId = sessionUser?.employeeId?.trim() ?? ""
  const canAssignRetencion = canAssignCustomerRetencion(sessionUser?.roleCode)
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
        listPendingRetencionesForEmployee(companyId, employeeId),
        getActiveRetencionesCount(companyId, employeeId),
        listEmployeeAtencionesToday(companyId, employeeId, referenceDate),
        listCompletedSeguimientosToday(companyId, employeeId, referenceDate),
        listCompletedRetencionesToday(companyId, employeeId, referenceDate),
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

      const resultado = input.resultado ?? "resuelta"
      const needsSeguimiento =
        resultado === "requiere_seguimiento" && Boolean(input.seguimiento)

      if (resultado === "requiere_seguimiento" && !input.seguimiento) {
        return {
          success: false,
          message: "Completá los datos del seguimiento programado.",
        }
      }

      const result = await createCustomerAtencionWithSeguimiento(
        {
          companyId,
          customerId: input.customerId,
          attendedByEmployeeId: employeeId,
          channel: input.channel,
          motivo: input.motivo,
          detail: input.detail,
          resolution: input.resolution,
          resultado,
        },
        needsSeguimiento && input.seguimiento
          ? {
              companyId,
              customerId: input.customerId,
              assignedEmployeeId: employeeId,
              scheduledDate: input.seguimiento.scheduledDate,
              scheduledTime: input.seguimiento.scheduledTime ?? null,
              observation: input.seguimiento.observation,
            }
          : null
      )

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo registrar la atención.",
        }
      }

      atencionCacheRef.current.set(result.data.atencion.id, result.data.atencion)
      if (result.data.seguimiento) {
        seguimientoCacheRef.current.set(
          result.data.seguimiento.id,
          result.data.seguimiento
        )
      }

      await Promise.all([
        loadAtencionPage({ ...listQuery, page: 1 }),
        refreshDashboard(),
      ])

      return {
        success: true,
        atencion: result.data.atencion,
        seguimiento: result.data.seguimiento,
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
    ]
  )

  const assignRetencion = useCallback(
    async (input: NewCustomerRetencionInput): Promise<RetencionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!canAssignRetencion) {
        return {
          success: false,
          message: "No tenés permiso para asignar retenciones.",
        }
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
        assignedEmployeeId: input.assignedEmployeeId,
        assignedByEmployeeId: employeeId,
        motivoBaja: input.motivoBaja,
        detail: input.detail,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo asignar la retención.",
        }
      }

      retencionCacheRef.current.set(result.data.id, result.data)
      await refreshDashboard()

      return { success: true, retencion: result.data }
    },
    [
      canAssignRetencion,
      companyId,
      employeeId,
      isReadOnly,
      openRestrictedDialog,
      refreshDashboard,
    ]
  )

  const completeRetencion = useCallback(
    async (
      id: string,
      input: CompleteCustomerRetencionInput
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
          message: "Completá las observaciones finales.",
        }
      }

      const result = await markCustomerRetencionCompleted(
        id,
        {
          status: "finalizada",
          resultado: input.resultado,
          resolution: input.resolution,
          completedAt: new Date().toISOString(),
          completedByEmployeeId: employeeId,
        },
        companyId
      )

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo finalizar la retención.",
        }
      }

      retencionCacheRef.current.set(id, result.data)
      await refreshDashboard()

      return { success: true, retencion: result.data }
    },
    [companyId, employeeId, isReadOnly, openRestrictedDialog, refreshDashboard]
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
      canAssignRetencion,
      canViewAssignedRetenciones,
      canViewEquipoReport,
      loadAtencionPage,
      refreshDashboard,
      fetchAtencionById,
      fetchSeguimientoById,
      fetchRetencionById,
      fetchRecuperacionById,
      searchCustomers,
      listAssignees,
      createAtencion,
      assignRetencion,
      completeRetencion,
      createRecuperacion,
      completeSeguimiento,
      completeSeguimientoWithFollowUp,
      getAgendaItems,
    }),
    [
      assignRetencion,
      assignedRetenciones,
      canAssignRetencion,
      canViewAssignedRetenciones,
      canViewEquipoReport,
      completeRetencion,
      completeSeguimiento,
      completeSeguimientoWithFollowUp,
      createAtencion,
      createRecuperacion,
      dashboardSummary,
      fetchAtencionById,
      fetchRecuperacionById,
      fetchRetencionById,
      fetchSeguimientoById,
      getAgendaItems,
      isDashboardLoading,
      isListLoading,
      isReady,
      jornadaEntries,
      listAssignees,
      listPage,
      listQuery,
      loadAtencionPage,
      myRecuperaciones,
      pendingRetenciones,
      pendingSeguimientos,
      refreshDashboard,
      searchCustomers,
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
