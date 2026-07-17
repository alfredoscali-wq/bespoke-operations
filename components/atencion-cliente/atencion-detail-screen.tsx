"use client"

import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Clock3,
  FolderOpen,
  Info,
  Trash2,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { AdministrationResultDialog } from "@/components/atencion-cliente/administration-result-dialog"
import {
  ConsultationDecisionCenter,
  type ConsultationDecisionAction,
} from "@/components/atencion-cliente/consultation-decision-center"
import { ConsultationEventsTimeline } from "@/components/atencion-cliente/consultation-events-timeline"
import { ConsultationPermanentDeleteDialog } from "@/components/atencion-cliente/consultation-permanent-delete-dialog"
import { ConsultationSituationSummaryCard } from "@/components/atencion-cliente/consultation-situation-summary-card"
import { RetentionResultDialog } from "@/components/atencion-cliente/retention-result-dialog"
import { TechnicalResultDialog } from "@/components/atencion-cliente/technical-result-dialog"
import { MorosoTrackingBlock } from "@/components/atencion-cliente/moroso-tracking-block"
import { OtLinkBlock } from "@/components/atencion-cliente/ot-link-block"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"
import { canDeleteCustomerAtencionConsultation } from "@/lib/customer-atenciones/consultation-hard-delete"
import {
  isActiveAdministrationConsultationForEmployee,
  isAdministrationConsultation,
} from "@/lib/customer-atenciones/administration-flow"
import {
  canStartConsultationManagement,
  isConsultationManagedByAnotherEmployee,
  isConsultationManagedByEmployee,
} from "@/lib/customer-atenciones/consultation-management"
import {
  isActiveRetentionConsultationForEmployee,
  isRetentionConsultation,
} from "@/lib/customer-atenciones/retention-flow"
import {
  isActiveTechnicalConsultationForEmployee,
  isTechnicalConsultation,
} from "@/lib/customer-atenciones/technical-flow"
import { isMorosoConsultation } from "@/lib/customer-atenciones/moroso-flow"
import {
  buildConsultationSituationSummary,
  buildConsultationSituationNarrative,
  buildConsultationTimelineCards,
  describeNextStepSituation,
  formatConsultationExpedienteCode,
  formatConsultationIngressDateTime,
  formatConsultationRelativeAge,
  formatConsultationSituationBand,
} from "@/lib/customer-atenciones/consultation-expediente"
import {
  CUSTOMER_ATENCION_NEXT_STEP_OPTIONS,
  formatCustomerAtencionChannelLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import {
  formatCustomerAddressLabel,
} from "@/lib/customers/format"
import { listCustomerAtencionEventsByAtencionId } from "@/lib/supabase/customer-atencion-events.browser"
import { getCustomerById } from "@/lib/supabase/customers.browser"
import { getEmployeeById } from "@/lib/supabase/employees.browser"
import type { CustomerAtencionEvent } from "@/lib/types/customer-atencion-events"
import type {
  CustomerAtencion,
  CustomerAtencionNextStep,
} from "@/lib/types/customer-atenciones"
import type { Customer } from "@/lib/types/customers"
import type { Employee } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type AtencionDetailScreenProps = {
  atencionId: string
  /**
   * "page" keeps the standalone detail page layout (default).
   * "panel" renders the same logic inside the workbench side panel:
   * compact header with close button, client block and timeline before actions.
   */
  presentation?: "page" | "panel"
  /** Panel mode: request the parent to close the side panel. */
  onRequestClose?: () => void
  /** Panel mode: notify the parent that consultation data changed. */
  onDataChanged?: () => void
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function formatEmployeeName(employee: Employee | null | undefined): string {
  if (!employee) {
    return "—"
  }

  return `${employee.firstName} ${employee.lastName}`.trim() || "—"
}

/** Expandable Level-2 action forms in the panel action center (UX 2.5). */
type PanelFormActionId = "resolve" | "moroso_tracking" | "link_ot"

export function AtencionDetailScreen({
  atencionId,
  presentation = "page",
  onRequestClose,
  onDataChanged,
}: AtencionDetailScreenProps) {
  const isPanel = presentation === "panel"
  const router = useRouter()
  const isSystemAdministrator = useIsSystemAdministrator()
  const {
    refreshAtencionById,
    currentEmployeeId,
    startConsultationManagement,
    resolveConsultation,
    deferConsultation,
    permanentDeleteConsultation,
  } = useAtencionCliente()
  const [atencion, setAtencion] = useState<CustomerAtencion | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [creatorEmployee, setCreatorEmployee] = useState<Employee | null>(null)
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null)
  const [events, setEvents] = useState<CustomerAtencionEvent[]>([])
  const [eventEmployeeNamesById, setEventEmployeeNamesById] = useState<
    Record<string, string>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [isDeferring, setIsDeferring] = useState(false)
  const [resolution, setResolution] = useState("")
  const [deferNextStep, setDeferNextStep] = useState<CustomerAtencionNextStep | "">(
    ""
  )
  const [isRetentionDialogOpen, setIsRetentionDialogOpen] = useState(false)
  const [isAdministrationDialogOpen, setIsAdministrationDialogOpen] =
    useState(false)
  const [isTechnicalDialogOpen, setIsTechnicalDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPanelAction, setSelectedPanelAction] =
    useState<PanelFormActionId | null>(null)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)

    try {
      const loadedAtencion = await refreshAtencionById(atencionId)

      if (!loadedAtencion) {
        setAtencion(null)
        return
      }

      const [customerResult, creatorResult, activeResult, eventsResult] =
        await Promise.all([
          getCustomerById(loadedAtencion.customerId),
          getEmployeeById(loadedAtencion.attendedByEmployeeId),
          loadedAtencion.activeManagementEmployeeId
            ? getEmployeeById(loadedAtencion.activeManagementEmployeeId)
            : Promise.resolve({ data: null, error: null }),
          listCustomerAtencionEventsByAtencionId(
            loadedAtencion.companyId,
            loadedAtencion.id
          ),
        ])

      const loadedEvents = eventsResult.data ?? []
      const uniqueEmployeeIds = [
        ...new Set(loadedEvents.map((event) => event.employeeId)),
      ]
      const employeeResults = await Promise.all(
        uniqueEmployeeIds.map(async (employeeId) => {
          const result = await getEmployeeById(employeeId)
          return [employeeId, formatEmployeeName(result.data)] as const
        })
      )

      setAtencion(loadedAtencion)
      setCustomer(customerResult.data)
      setCreatorEmployee(creatorResult.data)
      setActiveEmployee(activeResult.data)
      setEvents(loadedEvents)
      setEventEmployeeNamesById(Object.fromEntries(employeeResults))
    } finally {
      setIsLoading(false)
    }
  }, [atencionId, refreshAtencionById])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    setSelectedPanelAction(null)
    setResolution("")
    setActionError(null)
  }, [atencionId])

  const reloadAfterAction = useCallback(async () => {
    setSelectedPanelAction(null)
    await loadDetail()
    onDataChanged?.()
  }, [loadDetail, onDataChanged])

  function togglePanelFormAction(actionId: PanelFormActionId) {
    setSelectedPanelAction((current) =>
      current === actionId ? null : actionId
    )
  }

  async function handleStartManagement() {
    setActionError(null)
    setIsStarting(true)

    try {
      const result = await startConsultationManagement(atencionId)

      if (!result.success) {
        setActionError(result.message)
        await reloadAfterAction()
        return
      }

      await reloadAfterAction()
    } finally {
      setIsStarting(false)
    }
  }

  async function handleResolve() {
    setActionError(null)

    if (!resolution.trim()) {
      setActionError("Completá la resolución de la consulta.")
      return
    }

    setIsResolving(true)

    try {
      const result = await resolveConsultation(atencionId, resolution)

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setResolution("")
      await reloadAfterAction()
    } finally {
      setIsResolving(false)
    }
  }

  async function handleDefer() {
    setActionError(null)

    if (!deferNextStep) {
      setActionError("Seleccioná el próximo paso para continuar después.")
      return
    }

    setIsDeferring(true)

    try {
      const result = await deferConsultation(atencionId, deferNextStep)

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setDeferNextStep("")
      await reloadAfterAction()
    } finally {
      setIsDeferring(false)
    }
  }

  async function handleDeferTo(nextStep: CustomerAtencionNextStep) {
    setActionError(null)
    setIsDeferring(true)

    try {
      const result = await deferConsultation(atencionId, nextStep)

      if (!result.success) {
        setActionError(result.message)
        return
      }

      await reloadAfterAction()
    } finally {
      setIsDeferring(false)
    }
  }

  if (isLoading) {
    return (
      <p className={isPanel ? "p-4 text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
        Cargando consulta…
      </p>
    )
  }

  if (!atencion) {
    if (isPanel) {
      return (
        <p className="p-4 text-sm text-muted-foreground">
          No se encontró la consulta.
        </p>
      )
    }

    notFound()
  }

  const isManagedByCurrentEmployee = isConsultationManagedByEmployee(
    atencion,
    currentEmployeeId
  )
  const isActiveRetention = isActiveRetentionConsultationForEmployee(
    atencion,
    currentEmployeeId
  )
  const isActiveAdministration = isActiveAdministrationConsultationForEmployee(
    atencion,
    currentEmployeeId
  )
  const isActiveTechnical = isActiveTechnicalConsultationForEmployee(
    atencion,
    currentEmployeeId
  )
  const isManagedByAnother = isConsultationManagedByAnotherEmployee(
    atencion,
    currentEmployeeId
  )
  const canStart = canStartConsultationManagement(atencion.status)
  const canDelete = canDeleteCustomerAtencionConsultation(
    isSystemAdministrator ? "administrador" : null
  )
  const isGeneralManagement =
    isManagedByCurrentEmployee &&
    !isActiveRetention &&
    !isActiveAdministration &&
    !isActiveTechnical
  const situationSummary = buildConsultationSituationSummary(atencion, events)
  const situationNarrative = buildConsultationSituationNarrative(
    atencion,
    events,
    (employeeId) => eventEmployeeNamesById[employeeId] ?? "—"
  )
  const timelineCards = buildConsultationTimelineCards(events, {
    motivo: atencion.motivo,
    detail: atencion.detail,
    resolution: atencion.resolution,
  })
  const lastActorName = situationSummary.lastActorEmployeeId
    ? (eventEmployeeNamesById[situationSummary.lastActorEmployeeId] ?? "—")
    : "—"

  const customerAddressLabel = customer
    ? formatCustomerAddressLabel(customer)
    : null

  const nextStepSituation = describeNextStepSituation(atencion.nextStep)
  const nextStepValue = (
    <span className="inline-flex flex-wrap items-center gap-2">
      {nextStepSituation ? (
        <span>
          {nextStepSituation.responsibleAreaLabel}
          {nextStepSituation.managementTypeLabel
            ? ` · ${nextStepSituation.managementTypeLabel}`
            : ""}
        </span>
      ) : (
        "—"
      )}
      {isRetentionConsultation(atencion) ? (
        <Badge
          variant="outline"
          className="border-rose-200 bg-rose-500/10 text-rose-800"
        >
          Retención
        </Badge>
      ) : null}
      {isAdministrationConsultation(atencion) ? (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-500/10 text-amber-800"
        >
          Administración
        </Badge>
      ) : null}
      {isTechnicalConsultation(atencion) ? (
        <Badge
          variant="outline"
          className="border-violet-200 bg-violet-500/10 text-violet-800"
        >
          Técnica
        </Badge>
      ) : null}
      {isMorosoConsultation(atencion) ? (
        <Badge
          variant="outline"
          className="border-orange-200 bg-orange-500/10 text-orange-800"
        >
          Morosos
        </Badge>
      ) : null}
    </span>
  )

  const expedienteCode = formatConsultationExpedienteCode(atencion.id)
  const relativeAge = formatConsultationRelativeAge(atencion.createdAt)
  const situationBandParagraphs =
    formatConsultationSituationBand(situationNarrative)

  let decisionPrimary: ConsultationDecisionAction | null = null
  const decisionSecondary: ConsultationDecisionAction[] = []
  const decisionAdministrative: ConsultationDecisionAction[] = canDelete
    ? [
        {
          id: "delete",
          label: "Eliminar consulta",
          onClick: () => setIsDeleteDialogOpen(true),
        },
      ]
    : []

  let decisionStatusMessage: ReactNode = null

  if (atencion.status === "resuelta" && !canDelete) {
    decisionStatusMessage =
      "Esta consulta ya está resuelta. No hay acciones disponibles."
  } else if (isManagedByAnother) {
    decisionStatusMessage = (
      <>
        <p>
          Esta consulta está siendo gestionada por{" "}
          <span className="font-semibold text-slate-800">
            {formatEmployeeName(activeEmployee)}
          </span>
          {nextStepSituation
            ? ` (${nextStepSituation.responsibleAreaLabel})`
            : null}
          .
        </p>
        <p className="mt-1">Actualmente la gestión se encuentra en curso.</p>
      </>
    )
  } else if (atencion.status !== "resuelta") {
    if (canStart) {
      decisionPrimary = {
        id: "start",
        label: isStarting ? "Iniciando…" : "Iniciar gestión",
        onClick: () => {
          void handleStartManagement()
        },
        disabled: isStarting,
      }
    } else if (isActiveRetention) {
      decisionPrimary = {
        id: "retention_result",
        label: "Registrar respuesta",
        onClick: () => setIsRetentionDialogOpen(true),
      }
    } else if (isActiveAdministration) {
      decisionPrimary = {
        id: "admin_result",
        label: "Registrar respuesta",
        onClick: () => setIsAdministrationDialogOpen(true),
      }
      if (isMorosoConsultation(atencion)) {
        decisionSecondary.push({
          id: "moroso_tracking",
          label: "Registrar gestión de morosos",
          onClick: () => togglePanelFormAction("moroso_tracking"),
          active: selectedPanelAction === "moroso_tracking",
        })
      }
    } else if (isActiveTechnical) {
      decisionPrimary = {
        id: "technical_result",
        label: "Registrar respuesta",
        onClick: () => setIsTechnicalDialogOpen(true),
      }
    } else if (atencion.nextStep === "generar_ot") {
      decisionPrimary = {
        id: "link_ot",
        label: atencion.linkedTaskId ? "Ver OT vinculada" : "Generar OT",
        onClick: () => togglePanelFormAction("link_ot"),
        active: selectedPanelAction === "link_ot",
      }
      if (isGeneralManagement) {
        decisionSecondary.push(
          {
            id: "resolve",
            label: "Resolver consulta",
            onClick: () => togglePanelFormAction("resolve"),
            active: selectedPanelAction === "resolve",
          },
          {
            id: "contactar",
            label: "Contactar cliente",
            onClick: () => {
              void handleDeferTo("seguimiento_cliente")
            },
            disabled: isDeferring,
          },
          {
            id: "esperar",
            label: "Esperar cliente",
            onClick: () => {
              void handleDeferTo("esperar_cliente")
            },
            disabled: isDeferring,
          },
          {
            id: "derivar_tecnica",
            label: "Derivar a Técnica",
            onClick: () => {
              void handleDeferTo("resolver_consulta_tecnica")
            },
            disabled: isDeferring,
          },
          {
            id: "derivar_admin_facturacion",
            label: "Derivar a Administración — Facturación",
            onClick: () => {
              void handleDeferTo("derivar_admin_facturacion")
            },
            disabled: isDeferring,
          },
          {
            id: "derivar_admin_morosos",
            label: "Derivar a Administración — Morosos",
            onClick: () => {
              void handleDeferTo("derivar_admin_morosos")
            },
            disabled: isDeferring,
          },
          {
            id: "derivar_admin_gestion",
            label: "Derivar a Administración — Gestión",
            onClick: () => {
              void handleDeferTo("derivar_admin_gestion")
            },
            disabled: isDeferring,
          },
          {
            id: "derivar_ventas",
            label: "Derivar a Ventas",
            onClick: () => {
              void handleDeferTo("contactar_cliente")
            },
            disabled: isDeferring,
          }
        )
      }
    } else if (isGeneralManagement) {
      const primaryByNextStep: Partial<
        Record<
          NonNullable<CustomerAtencion["nextStep"]>,
          { id: string; label: string; run: () => void }
        >
      > = {
        seguimiento_cliente: {
          id: "contactar",
          label: "Contactar cliente",
          run: () => {
            void handleDeferTo("seguimiento_cliente")
          },
        },
        esperar_cliente: {
          id: "esperar",
          label: "Esperar cliente",
          run: () => {
            void handleDeferTo("esperar_cliente")
          },
        },
      }

      const contextualPrimary = atencion.nextStep
        ? primaryByNextStep[atencion.nextStep]
        : null

      if (contextualPrimary) {
        decisionPrimary = {
          id: contextualPrimary.id,
          label: contextualPrimary.label,
          onClick: contextualPrimary.run,
          disabled: isDeferring,
        }
        decisionSecondary.push({
          id: "resolve",
          label: "Resolver consulta",
          onClick: () => togglePanelFormAction("resolve"),
          active: selectedPanelAction === "resolve",
        })
      } else {
        decisionPrimary = {
          id: "resolve",
          label: "Resolver consulta",
          onClick: () => togglePanelFormAction("resolve"),
          active: selectedPanelAction === "resolve",
        }
      }

      const pushSecondary = (
        id: string,
        label: string,
        run: () => void,
        options?: { active?: boolean; disabled?: boolean }
      ) => {
        if (decisionPrimary?.id === id) return
        if (decisionSecondary.some((action) => action.id === id)) return
        decisionSecondary.push({
          id,
          label,
          onClick: run,
          active: options?.active,
          disabled: options?.disabled,
        })
      }

      if (!contextualPrimary) {
        pushSecondary(
          "contactar",
          "Contactar cliente",
          () => {
            void handleDeferTo("seguimiento_cliente")
          },
          { disabled: isDeferring }
        )
        pushSecondary(
          "esperar",
          "Esperar cliente",
          () => {
            void handleDeferTo("esperar_cliente")
          },
          { disabled: isDeferring }
        )
      } else if (contextualPrimary.id === "contactar") {
        pushSecondary(
          "esperar",
          "Esperar cliente",
          () => {
            void handleDeferTo("esperar_cliente")
          },
          { disabled: isDeferring }
        )
      } else if (contextualPrimary.id === "esperar") {
        pushSecondary(
          "contactar",
          "Contactar cliente",
          () => {
            void handleDeferTo("seguimiento_cliente")
          },
          { disabled: isDeferring }
        )
      }

      if (atencion.nextStep !== "realizar_retencion") {
        pushSecondary(
          "retencion",
          "Realizar retención",
          () => {
            void handleDeferTo("realizar_retencion")
          },
          { disabled: isDeferring }
        )
      }
      if (atencion.nextStep !== "resolver_consulta_tecnica") {
        pushSecondary(
          "derivar_tecnica",
          "Derivar a Técnica",
          () => {
            void handleDeferTo("resolver_consulta_tecnica")
          },
          { disabled: isDeferring }
        )
      }
      if (atencion.nextStep !== "derivar_admin_facturacion") {
        pushSecondary(
          "derivar_admin_facturacion",
          "Derivar a Administración — Facturación",
          () => {
            void handleDeferTo("derivar_admin_facturacion")
          },
          { disabled: isDeferring }
        )
      }
      if (atencion.nextStep !== "derivar_admin_morosos") {
        pushSecondary(
          "derivar_admin_morosos",
          "Derivar a Administración — Morosos",
          () => {
            void handleDeferTo("derivar_admin_morosos")
          },
          { disabled: isDeferring }
        )
      }
      if (atencion.nextStep !== "derivar_admin_gestion") {
        pushSecondary(
          "derivar_admin_gestion",
          "Derivar a Administración — Gestión",
          () => {
            void handleDeferTo("derivar_admin_gestion")
          },
          { disabled: isDeferring }
        )
      }
      if (atencion.nextStep !== "contactar_cliente") {
        pushSecondary(
          "derivar_ventas",
          "Derivar a Ventas",
          () => {
            void handleDeferTo("contactar_cliente")
          },
          { disabled: isDeferring }
        )
      }
      pushSecondary(
        "generar_ot",
        "Generar OT",
        () => {
          void handleDeferTo("generar_ot")
        },
        { disabled: isDeferring }
      )

      if (isMorosoConsultation(atencion)) {
        pushSecondary(
          "moroso_tracking",
          "Registrar gestión de morosos",
          () => togglePanelFormAction("moroso_tracking"),
          { active: selectedPanelAction === "moroso_tracking" }
        )
      }
    } else if (isMorosoConsultation(atencion)) {
      decisionPrimary = {
        id: "moroso_tracking",
        label: "Registrar gestión de morosos",
        onClick: () => togglePanelFormAction("moroso_tracking"),
        active: selectedPanelAction === "moroso_tracking",
      }
    }
  }

  const resolveForm =
    selectedPanelAction === "resolve" && isGeneralManagement ? (
      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-3">
        <Label htmlFor="consultation-resolution-panel">Resolución</Label>
        <Textarea
          id="consultation-resolution-panel"
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          rows={3}
          placeholder="Qué se hizo para resolver la consulta"
        />
        <Button
          size="sm"
          className="w-full"
          onClick={handleResolve}
          disabled={isResolving}
        >
          {isResolving ? "Guardando…" : "Finalizar gestión"}
        </Button>
      </div>
    ) : null

  const morosoForm =
    selectedPanelAction === "moroso_tracking" &&
    isMorosoConsultation(atencion) &&
    atencion.status !== "resuelta" ? (
      <MorosoTrackingBlock
        atencionId={atencion.id}
        trackingStatus={atencion.morosoTrackingStatus}
      />
    ) : null

  const otForm =
    selectedPanelAction === "link_ot" &&
    atencion.nextStep === "generar_ot" &&
    atencion.status !== "resuelta" ? (
      <OtLinkBlock
        atencionId={atencion.id}
        linkedTaskId={atencion.linkedTaskId}
        linkedTaskCode={atencion.linkedTaskCode}
        otLinkedAt={atencion.otLinkedAt}
      />
    ) : null

  const decisionPrimaryDetail =
    !isManagedByAnother && atencion.status !== "resuelta"
      ? (decisionPrimary?.id === "resolve" && resolveForm) ||
        (decisionPrimary?.id === "link_ot" && otForm) ||
        (decisionPrimary?.id === "moroso_tracking" && morosoForm) ||
        null
      : null

  const decisionDetail =
    !isManagedByAnother && atencion.status !== "resuelta" ? (
      <>
        {decisionPrimary?.id !== "resolve" ? resolveForm : null}
        {decisionPrimary?.id !== "moroso_tracking" ? morosoForm : null}
        {decisionPrimary?.id !== "link_ot" ? otForm : null}
      </>
    ) : null

  if (isPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 bg-white">
          {/* pr-14 keeps the close button fully independent */}
          <header className="px-5 pt-3.5 pb-3.5 pr-14 sm:px-6 sm:pr-14">
            <p className="text-[10px] font-medium tracking-[0.08em] text-slate-400 uppercase">
              Expediente de Atención
            </p>

            <div className="mt-3 grid grid-cols-1 items-start gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-10 lg:gap-14">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-sky-700 uppercase">
                  <UserRound className="size-3.5" aria-hidden />
                  Cliente
                </p>
                {customer ? (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="truncate text-[15px] leading-tight font-bold text-slate-900">
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="text-slate-900 hover:text-sky-700 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </p>
                    <p className="truncate text-[12px] leading-snug text-slate-500">
                      Nº {customer.customerNumber || "—"}
                      {customer.phone?.trim()
                        ? ` | ${customer.phone.trim()}`
                        : ""}
                    </p>
                    <p className="truncate text-[12px] leading-snug text-slate-500">
                      {customerAddressLabel || "Sin dirección"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[15px] text-slate-400">—</p>
                )}
              </div>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-sky-700 uppercase">
                  <FolderOpen className="size-3.5" aria-hidden />
                  Consulta
                </p>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[15px] leading-tight font-bold text-slate-900">
                    {expedienteCode}
                  </p>
                  <p className="truncate text-[12px] leading-snug text-slate-500">
                    {formatCustomerAtencionMotivoLabel(atencion.motivo)}
                  </p>
                  <p className="truncate text-[12px] leading-snug text-slate-500">
                    {formatConsultationIngressDateTime(atencion.createdAt)}
                  </p>
                  <p className="truncate text-[12px] leading-snug text-slate-500">
                    Registrada por {formatEmployeeName(creatorEmployee)}
                  </p>
                </div>
              </div>

              <div className="flex justify-start sm:justify-end sm:pt-0.5">
                <p className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap text-slate-500">
                  <Clock3 className="size-3.5 shrink-0" aria-hidden />
                  {relativeAge}
                </p>
              </div>
            </div>
          </header>

          <div className="flex items-start gap-2.5 bg-sky-50/90 px-5 py-3.5 pr-14 sm:px-6 sm:pr-14">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <Info className="size-3" aria-hidden />
            </span>
            <div className="min-w-0 max-w-3xl space-y-1">
              {situationBandParagraphs.map((paragraph, index) => {
                if (index === 0) {
                  const marker = situationNarrative.statusEmphasis
                  const [before, after] = paragraph.split(marker)
                  return (
                    <p
                      key={paragraph}
                      className="text-[13px] leading-snug text-slate-700"
                    >
                      {before}
                      <span className="font-bold text-slate-900">{marker}</span>
                      {after}
                    </p>
                  )
                }

                return (
                  <p
                    key={paragraph}
                    className="text-[12px] leading-snug text-slate-600"
                  >
                    {paragraph}
                  </p>
                )
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4 sm:px-6">
          <ConsultationEventsTimeline
            cards={timelineCards}
            employeeNamesById={eventEmployeeNamesById}
            presentation="panel"
          />

          <ConsultationDecisionCenter
            statusMessage={decisionStatusMessage}
            primary={decisionPrimary}
            primaryDetail={decisionPrimaryDetail}
            secondary={decisionSecondary}
            detail={decisionDetail}
            administrative={decisionAdministrative}
          />

          {actionError ? (
            <p className="mt-3 text-sm text-destructive">{actionError}</p>
          ) : null}
        </div>

        <ConsultationPermanentDeleteDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={async () => {
            setActionError(null)
            const result = await permanentDeleteConsultation(atencionId)
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            onDataChanged?.()
            onRequestClose?.()
            return { success: true }
          }}
        />

        <RetentionResultDialog
          open={isRetentionDialogOpen}
          onOpenChange={setIsRetentionDialogOpen}
          onResolve={async (resolutionText) => {
            setActionError(null)
            const result = await resolveConsultation(atencionId, resolutionText)
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            await reloadAfterAction()
            return { success: true }
          }}
          onDefer={async (nextStep, detail) => {
            setActionError(null)
            const result = await deferConsultation(
              atencionId,
              nextStep as CustomerAtencionNextStep,
              detail
            )
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            await reloadAfterAction()
            return { success: true }
          }}
        />

        <AdministrationResultDialog
          open={isAdministrationDialogOpen}
          onOpenChange={setIsAdministrationDialogOpen}
          onResolve={async (resolutionText) => {
            setActionError(null)
            const result = await resolveConsultation(atencionId, resolutionText)
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            await reloadAfterAction()
            return { success: true }
          }}
          onDefer={async (nextStep, detail) => {
            setActionError(null)
            const result = await deferConsultation(
              atencionId,
              nextStep as CustomerAtencionNextStep,
              detail
            )
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            await reloadAfterAction()
            return { success: true }
          }}
        />

        <TechnicalResultDialog
          open={isTechnicalDialogOpen}
          onOpenChange={setIsTechnicalDialogOpen}
          onResolve={async (resolutionText) => {
            setActionError(null)
            const result = await resolveConsultation(atencionId, resolutionText)
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            await reloadAfterAction()
            return { success: true }
          }}
          onDefer={async (nextStep, detail) => {
            setActionError(null)
            const result = await deferConsultation(
              atencionId,
              nextStep as CustomerAtencionNextStep,
              detail
            )
            if (!result.success) {
              setActionError(result.message)
              return { success: false, message: result.message }
            }
            await reloadAfterAction()
            return { success: true }
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/atencion-cliente" aria-label="Volver a la bandeja">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Detalle de Consulta
            </h1>
            <p className="text-sm text-muted-foreground">
              Creada el {new Date(atencion.createdAt).toLocaleString("es-AR")}
            </p>
          </div>
        </div>
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="size-4" />
            Eliminar consulta
          </Button>
        ) : null}
      </div>

      <ConsultationSituationSummaryCard
        summary={situationSummary}
        narrative={situationNarrative}
        status={atencion.status}
        lastActorName={lastActorName}
      />

      <Card>
        <CardHeader>
          <CardTitle>Información general</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <DetailField
            label="Cliente"
            value={
              customer ? (
                <Link
                  href={`/clientes/${customer.id}`}
                  className="text-primary hover:underline"
                >
                  {customer.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailField
            label="Creada por"
            value={formatEmployeeName(creatorEmployee)}
          />
          <DetailField
            label="Canal"
            value={formatCustomerAtencionChannelLabel(atencion.channel)}
          />
          <DetailField
            label="Motivo"
            value={formatCustomerAtencionMotivoLabel(atencion.motivo)}
          />
          <DetailField
            label="Estado actual"
            value={formatCustomerAtencionStatusLabel(atencion.status)}
          />
          <DetailField
            label="Área responsable"
            value={nextStepSituation?.responsibleAreaLabel ?? "—"}
          />
          {nextStepSituation?.managementTypeLabel ? (
            <DetailField
              label="Tipo de gestión"
              value={nextStepSituation.managementTypeLabel}
            />
          ) : null}
          <DetailField label="Estado de la gestión" value={nextStepValue} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailField label="Detalle" value={atencion.detail} />
        </CardContent>
      </Card>

      {atencion.status === "resuelta" ? (
        <Card>
          <CardHeader>
            <CardTitle>Resolución</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailField label="Qué se hizo" value={atencion.resolution} />
          </CardContent>
        </Card>
      ) : null}

      {isMorosoConsultation(atencion) && atencion.status !== "resuelta" ? (
        <MorosoTrackingBlock
          atencionId={atencion.id}
          trackingStatus={atencion.morosoTrackingStatus}
        />
      ) : null}

      {atencion.nextStep === "generar_ot" && atencion.status !== "resuelta" ? (
        <OtLinkBlock
          atencionId={atencion.id}
          linkedTaskId={atencion.linkedTaskId}
          linkedTaskCode={atencion.linkedTaskCode}
          otLinkedAt={atencion.otLinkedAt}
        />
      ) : null}

      {isManagedByAnother ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión activa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              En gestión por{" "}
              <span className="font-medium text-foreground">
                {formatEmployeeName(activeEmployee)}
              </span>
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {canStart ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta consulta está disponible en la bandeja compartida.
            </p>
            <Button onClick={handleStartManagement} disabled={isStarting}>
              {isStarting ? "Iniciando…" : "Iniciar gestión"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isActiveRetention ? (
        <Card>
          <CardHeader>
            <CardTitle>Retención en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Estás gestionando un intento de retención
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
              .
            </p>
            <Button onClick={() => setIsRetentionDialogOpen(true)}>
              Registrar resultado de retención
            </Button>
          </CardContent>
        </Card>
      ) : isActiveAdministration ? (
        <Card>
          <CardHeader>
            <CardTitle>Administración en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Estás gestionando esta consulta administrativa
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
              .
            </p>
            <Button onClick={() => setIsAdministrationDialogOpen(true)}>
              Registrar resultado administrativo
            </Button>
          </CardContent>
        </Card>
      ) : isActiveTechnical ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión técnica en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Estás gestionando esta consulta técnica
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
              .
            </p>
            <Button onClick={() => setIsTechnicalDialogOpen(true)}>
              Registrar resultado técnico
            </Button>
          </CardContent>
        </Card>
      ) : isManagedByCurrentEmployee ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Estás gestionando esta consulta
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
              .
            </p>

            <div className="space-y-2">
              <Label htmlFor="consultation-resolution">Resolución</Label>
              <Textarea
                id="consultation-resolution"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={3}
                placeholder="Qué se hizo para resolver la consulta"
              />
              <Button onClick={handleResolve} disabled={isResolving}>
                {isResolving ? "Guardando…" : "Resolver Consulta"}
              </Button>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="consultation-defer-next-step">Próximo paso</Label>
              <Select
                value={deferNextStep}
                onValueChange={(value) =>
                  setDeferNextStep(value as CustomerAtencionNextStep)
                }
              >
                <SelectTrigger id="consultation-defer-next-step" className="w-full">
                  <SelectValue placeholder="Seleccionar próximo paso" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_ATENCION_NEXT_STEP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleDefer}
                disabled={isDeferring}
              >
                {isDeferring ? "Guardando…" : "Definir próximo paso"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConsultationEventsTimeline
        cards={timelineCards}
        employeeNamesById={eventEmployeeNamesById}
      />

      <ConsultationPermanentDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={async () => {
          setActionError(null)
          const result = await permanentDeleteConsultation(atencionId)
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          router.push("/atencion-cliente")
          return { success: true }
        }}
      />

      <RetentionResultDialog
        open={isRetentionDialogOpen}
        onOpenChange={setIsRetentionDialogOpen}
        onResolve={async (resolutionText) => {
          setActionError(null)
          const result = await resolveConsultation(atencionId, resolutionText)
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          await reloadAfterAction()
          return { success: true }
        }}
        onDefer={async (nextStep, detail) => {
          setActionError(null)
          const result = await deferConsultation(
            atencionId,
            nextStep as CustomerAtencionNextStep,
            detail
          )
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          await reloadAfterAction()
          return { success: true }
        }}
      />

      <AdministrationResultDialog
        open={isAdministrationDialogOpen}
        onOpenChange={setIsAdministrationDialogOpen}
        onResolve={async (resolutionText) => {
          setActionError(null)
          const result = await resolveConsultation(atencionId, resolutionText)
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          await reloadAfterAction()
          return { success: true }
        }}
        onDefer={async (nextStep, detail) => {
          setActionError(null)
          const result = await deferConsultation(
            atencionId,
            nextStep as CustomerAtencionNextStep,
            detail
          )
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          await reloadAfterAction()
          return { success: true }
        }}
      />

      <TechnicalResultDialog
        open={isTechnicalDialogOpen}
        onOpenChange={setIsTechnicalDialogOpen}
        onResolve={async (resolutionText) => {
          setActionError(null)
          const result = await resolveConsultation(atencionId, resolutionText)
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          await reloadAfterAction()
          return { success: true }
        }}
        onDefer={async (nextStep, detail) => {
          setActionError(null)
          const result = await deferConsultation(
            atencionId,
            nextStep as CustomerAtencionNextStep,
            detail
          )
          if (!result.success) {
            setActionError(result.message)
            return { success: false, message: result.message }
          }
          await reloadAfterAction()
          return { success: true }
        }}
      />

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}
    </div>
  )
}
