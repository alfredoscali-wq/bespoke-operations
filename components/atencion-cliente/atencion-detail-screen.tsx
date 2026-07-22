"use client"

import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Clock3,
  FolderOpen,
  Trash2,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { AdministrationResultDialog } from "@/components/atencion-cliente/administration-result-dialog"
import { ExclusiveManagementDialog } from "@/components/atencion-cliente/exclusive-management-dialog"
import { LockedConsultationDialog } from "@/components/atencion-cliente/locked-consultation-dialog"
import {
  ConsultationDecisionCenter,
  type ConsultationAssistantOption,
  type ConsultationDecisionAction,
} from "@/components/atencion-cliente/consultation-decision-center"
import { ConsultationEventsTimeline } from "@/components/atencion-cliente/consultation-events-timeline"
import { ConsultationPermanentDeleteDialog } from "@/components/atencion-cliente/consultation-permanent-delete-dialog"
import { ConsultationSituationSummaryCard } from "@/components/atencion-cliente/consultation-situation-summary-card"
import { RetentionResultDialog } from "@/components/atencion-cliente/retention-result-dialog"
import { TechnicalResultDialog } from "@/components/atencion-cliente/technical-result-dialog"
import { ConsultationContactActivityBlock } from "@/components/atencion-cliente/consultation-contact-activity-block"
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
  buildLockedConsultationInfo,
  parseLockedManagementFromError,
  type LockedConsultationInfo,
} from "@/lib/customer-atenciones/consultation-management-lock"
import {
  detectManagementAssistantReturn,
  getManagementAssistantDetailPlaceholder,
  getManagementAssistantNextStepMessage,
  getManagementAssistantOptionLabel,
  getManagementAssistantOptionsAfterAreaReturn,
  getManagementAssistantOptionsAfterTecnica,
  MANAGEMENT_ASSISTANT_INITIAL_OPTIONS,
  managementAssistantOptionRequiresDetail,
  managementAssistantOptionShowsFollowUp,
  managementAssistantOptionToNextStep,
  type ManagementAssistantOptionId,
} from "@/lib/customer-atenciones/consultation-management-assistant"
import {
  CONSULTATION_FOLLOW_UP_ACTION_OPTIONS,
  type ConsultationFollowUpAction,
} from "@/lib/customer-atenciones/consultation-follow-up"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  /** RC 3.2.3 — notify parent to show exclusive-management dialog. */
  onExclusiveManagementBlocked?: () => void
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
  onExclusiveManagementBlocked,
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
    myActiveManagement,
    refreshMyActiveManagement,
    cancelConsultationManagement,
    touchConsultationManagementActivity,
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
  const [exclusiveDialogOpen, setExclusiveDialogOpen] = useState(false)
  const [isCancellingExclusive, setIsCancellingExclusive] = useState(false)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false)
  const [lockedInfo, setLockedInfo] = useState<LockedConsultationInfo | null>(
    null
  )
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
  const [selectedAssistantOptionId, setSelectedAssistantOptionId] =
    useState<ManagementAssistantOptionId | null>(null)
  /** RC 3.2.0 — optional post-resolve follow-up (default: no). */
  const [followUpNeeded, setFollowUpNeeded] = useState(false)
  const [selectedFollowUpActions, setSelectedFollowUpActions] = useState<
    ConsultationFollowUpAction[]
  >([])

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
    setSelectedAssistantOptionId(null)
    setResolution("")
    setActionError(null)
  }, [atencionId])

  // RC 3.2.5 — keep exclusive lock alive while the operator works the expediente.
  useEffect(() => {
    if (
      !atencion ||
      atencion.id !== atencionId ||
      !currentEmployeeId ||
      !isConsultationManagedByEmployee(atencion, currentEmployeeId)
    ) {
      return
    }

    let cancelled = false

    async function touch() {
      const result = await touchConsultationManagementActivity(atencionId)
      if (cancelled || result.success) {
        return
      }
      if (result.code === "CONSULTATION_MANAGEMENT_ACTOR_MISMATCH") {
        await loadDetail()
      }
    }

    void touch()
    const intervalId = window.setInterval(() => {
      void touch()
    }, 2 * 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    atencion,
    atencionId,
    currentEmployeeId,
    loadDetail,
    touchConsultationManagementActivity,
  ])

  const reloadAfterAction = useCallback(async () => {
    setSelectedPanelAction(null)
    setSelectedAssistantOptionId(null)
    await loadDetail()
    onDataChanged?.()
  }, [loadDetail, onDataChanged])

  function notifyExclusiveManagementBlocked() {
    if (onExclusiveManagementBlocked) {
      onExclusiveManagementBlocked()
      return
    }
    setExclusiveDialogOpen(true)
  }

  function openLockedConsultationDialog(info: LockedConsultationInfo) {
    setLockedInfo(info)
    setLockedDialogOpen(true)
  }

  async function handleStartManagement() {
    setActionError(null)

    if (
      atencion &&
      isConsultationManagedByAnotherEmployee(atencion, currentEmployeeId)
    ) {
      openLockedConsultationDialog(
        buildLockedConsultationInfo({
          managerEmployeeId: atencion.activeManagementEmployeeId,
          managerName:
            formatEmployeeName(activeEmployee) === "—"
              ? "Otro operador"
              : formatEmployeeName(activeEmployee),
          startedAt: atencion.activeManagementStartedAt,
        })
      )
      return
    }

    // RC 3.2.3 — block a second concurrent management for this operator.
    if (
      myActiveManagement &&
      myActiveManagement.atencionId !== atencionId
    ) {
      notifyExclusiveManagementBlocked()
      return
    }

    setIsStarting(true)

    try {
      const result = await startConsultationManagement(atencionId)

      if (!result.success) {
        if (result.code === "CONSULTATION_OPERATOR_ALREADY_MANAGING") {
          await refreshMyActiveManagement()
          notifyExclusiveManagementBlocked()
          return
        }
        if (result.code === "CONSULTATION_ALREADY_IN_MANAGEMENT") {
          const parsed = parseLockedManagementFromError(result.message)
          openLockedConsultationDialog(
            buildLockedConsultationInfo({
              managerEmployeeId:
                parsed.managerEmployeeId ??
                atencion?.activeManagementEmployeeId,
              managerName:
                formatEmployeeName(activeEmployee) === "—"
                  ? "Otro operador"
                  : formatEmployeeName(activeEmployee),
              startedAt:
                parsed.startedAt ?? atencion?.activeManagementStartedAt,
            })
          )
          await reloadAfterAction()
          return
        }
        setActionError(result.message)
        await reloadAfterAction()
        return
      }

      // Ownership is required for defer/resolve; historial hides gestion_iniciada.
      // RC 3.2.2 — assistant / area form appears immediately after start.
      await reloadAfterAction()
    } finally {
      setIsStarting(false)
    }
  }

  async function handleResolve() {
    setActionError(null)

    if (!resolution.trim()) {
      setActionError("Completá el detalle de la gestión.")
      return
    }

    if (followUpNeeded && selectedFollowUpActions.length === 0) {
      setActionError("Seleccioná al menos una acción posterior.")
      return
    }

    setIsResolving(true)

    try {
      const result = await resolveConsultation(
        atencionId,
        resolution,
        followUpNeeded ? selectedFollowUpActions : []
      )

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setResolution("")
      setFollowUpNeeded(false)
      setSelectedFollowUpActions([])
      setSelectedAssistantOptionId(null)
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

    if (!resolution.trim()) {
      setActionError("Completá el detalle de la gestión.")
      return
    }

    setIsDeferring(true)

    try {
      const result = await deferConsultation(
        atencionId,
        deferNextStep,
        resolution.trim()
      )

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setDeferNextStep("")
      setResolution("")
      await reloadAfterAction()
    } finally {
      setIsDeferring(false)
    }
  }

  async function handleDeferTo(
    nextStep: CustomerAtencionNextStep,
    detail: string
  ) {
    setActionError(null)

    if (!detail.trim()) {
      setActionError("Completá el detalle de la gestión.")
      return
    }

    setIsDeferring(true)

    try {
      const result = await deferConsultation(
        atencionId,
        nextStep,
        detail.trim()
      )

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setResolution("")
      setSelectedAssistantOptionId(null)
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
  const areaReturn = detectManagementAssistantReturn(atencion, events)
  const responsiblePersonName = activeEmployee
    ? formatEmployeeName(activeEmployee)
    : undefined

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
  let decisionPrimary: ConsultationDecisionAction | null = null
  let assistantOptionIds: ManagementAssistantOptionId[] = []
  let showGuidedAssistant = false
  /** RC 3.2.2 — area result forms render inline in the expediente (no modal gate). */
  let showAreaResultInline = false

  if (atencion.status === "resuelta" || atencion.linkedTaskId) {
    decisionStatusMessage =
      atencion.linkedTaskId
        ? "Consulta resuelta. Se generó una Orden de Trabajo; el seguimiento continúa en Operaciones."
        : "Esta consulta ya está resuelta. No hay gestiones pendientes."
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
  } else {
    if (canStart) {
      const startAsContinue =
        Boolean(areaReturn) ||
        events.some(
          (event) =>
            event.actionType === "consulta_pendiente" ||
            event.actionType === "gestion_registrada" ||
            event.actionType === "proximo_paso_cambiado"
        )

      decisionPrimary = {
        id: "start",
        label: isStarting
          ? "Iniciando…"
          : startAsContinue
            ? "Continuar gestión"
            : "Iniciar gestión",
        onClick: () => {
          void handleStartManagement()
        },
        disabled: isStarting,
      }
    } else if (isActiveRetention || isActiveAdministration || isActiveTechnical) {
      // RC 3.2.2 — no intermediate "Registrar gestión" modal; form is inline.
      showAreaResultInline = true
      if (isActiveAdministration && isMorosoConsultation(atencion)) {
        assistantOptionIds = ["moroso_tracking"]
        showGuidedAssistant = true
      }
    } else if (isGeneralManagement) {
      // RC 3.2.2 — assistant opens immediately while managing (no Continuar gate).
      showGuidedAssistant = true

      if (areaReturn?.kind === "tecnica") {
        assistantOptionIds = getManagementAssistantOptionsAfterTecnica(
          atencion.nextStep
        )
      } else if (areaReturn) {
        assistantOptionIds = getManagementAssistantOptionsAfterAreaReturn(
          areaReturn.kind,
          atencion.nextStep
        )
      } else if (atencion.nextStep === "generar_ot") {
        assistantOptionIds = [
          "link_ot",
          "resolve",
          "esperar_cliente",
          "seguimiento_cliente",
          "resolver_consulta_tecnica",
        ]
      } else {
        assistantOptionIds = [...MANAGEMENT_ASSISTANT_INITIAL_OPTIONS]
        if (isMorosoConsultation(atencion)) {
          // Debt follow-up stays in Morosos; do not offer Espera Cliente.
          assistantOptionIds = assistantOptionIds.filter(
            (id) => id !== "esperar_cliente"
          )
        }
      }
    } else if (isMorosoConsultation(atencion) && isManagedByCurrentEmployee) {
      showGuidedAssistant = true
      assistantOptionIds = ["resolve", "derivar_admin_gestion", "realizar_retencion"]
    }
  }

  const effectiveAssistantOptionId =
    selectedAssistantOptionId &&
    assistantOptionIds.includes(selectedAssistantOptionId)
      ? selectedAssistantOptionId
      : null

  const assistantOptions: ConsultationAssistantOption[] = showGuidedAssistant
    ? assistantOptionIds.map((id) => ({
        id,
        label: getManagementAssistantOptionLabel(id, {
          afterTecnica: areaReturn?.kind === "tecnica",
        }),
        selected: effectiveAssistantOptionId === id,
        disabled: isDeferring || isResolving,
        onSelect: () => {
          setSelectedAssistantOptionId(id)
          setActionError(null)
          setResolution("")
          if (id !== "resolve") {
            setFollowUpNeeded(false)
            setSelectedFollowUpActions([])
          }
          if (id === "link_ot") {
            setSelectedPanelAction("link_ot")
          } else if (id === "moroso_tracking") {
            setSelectedPanelAction("moroso_tracking")
          } else {
            setSelectedPanelAction(id === "resolve" ? "resolve" : null)
          }
        },
      }))
    : []

  const nextStepMessage =
    effectiveAssistantOptionId != null
      ? effectiveAssistantOptionId === "resolve" &&
        followUpNeeded &&
        selectedFollowUpActions.includes("generar_ot")
        ? "La consulta quedará cerrada. Quedará registrada la necesidad de generar una Orden de Trabajo."
        : getManagementAssistantNextStepMessage(effectiveAssistantOptionId)
      : null

  async function handleRegisterManagement() {
    if (!effectiveAssistantOptionId) {
      setActionError("Seleccioná cómo continúa esta atención.")
      return
    }

    if (managementAssistantOptionRequiresDetail(effectiveAssistantOptionId)) {
      if (!resolution.trim()) {
        setActionError("Completá el detalle de la gestión.")
        return
      }
    }

    if (effectiveAssistantOptionId === "resolve") {
      await handleResolve()
      return
    }

    if (effectiveAssistantOptionId === "link_ot") {
      setSelectedPanelAction("link_ot")
      return
    }

    if (effectiveAssistantOptionId === "moroso_tracking") {
      setSelectedPanelAction("moroso_tracking")
      return
    }

    const nextStep = managementAssistantOptionToNextStep(
      effectiveAssistantOptionId
    )
    if (!nextStep) {
      setActionError("No se pudo determinar el próximo paso.")
      return
    }

    await handleDeferTo(nextStep, resolution)
  }

  const managementDetailOptionId =
    effectiveAssistantOptionId != null &&
    managementAssistantOptionRequiresDetail(effectiveAssistantOptionId) &&
    (isGeneralManagement || showGuidedAssistant)
      ? effectiveAssistantOptionId
      : null

  const managementDetailForm = managementDetailOptionId ? (
      <div className="space-y-3">
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <Label htmlFor="consultation-management-detail">
            Detalle de la gestión
          </Label>
          <Textarea
            id="consultation-management-detail"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            rows={4}
            placeholder={getManagementAssistantDetailPlaceholder(
              managementDetailOptionId
            )}
          />
        </div>

        {managementAssistantOptionShowsFollowUp(managementDetailOptionId) ? (
          <div className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[13px] font-semibold text-slate-900">
              ¿Es necesario realizar alguna acción adicional?
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="radio"
                  name="consultation-follow-up-needed"
                  checked={!followUpNeeded}
                  onChange={() => {
                    setFollowUpNeeded(false)
                    setSelectedFollowUpActions([])
                  }}
                  className="size-3.5 accent-sky-600"
                />
                No
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="radio"
                  name="consultation-follow-up-needed"
                  checked={followUpNeeded}
                  onChange={() => setFollowUpNeeded(true)}
                  className="size-3.5 accent-sky-600"
                />
                Sí
              </label>
            </div>

            {followUpNeeded ? (
              <div className="mt-2 space-y-2 border-t border-slate-200/80 pt-2">
                {CONSULTATION_FOLLOW_UP_ACTION_OPTIONS.map((action) => {
                  const checked = selectedFollowUpActions.includes(action.id)
                  return (
                    <label
                      key={action.id}
                      className="flex cursor-pointer items-start gap-2.5 text-[13px] text-slate-800"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const isOn = value === true
                          setSelectedFollowUpActions((current) => {
                            if (isOn) {
                              return current.includes(action.id)
                                ? current
                                : [...current, action.id]
                            }
                            return current.filter((id) => id !== action.id)
                          })
                        }}
                        className="mt-0.5"
                      />
                      <span className="leading-snug font-medium">
                        {action.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null

  const followUpContactForm =
    (isMorosoConsultation(atencion) || isRetentionConsultation(atencion)) &&
    atencion.status !== "resuelta" &&
    (isManagedByCurrentEmployee || showGuidedAssistant) ? (
      <ConsultationContactActivityBlock
        atencionId={atencion.id}
        workTrayLabel={
          isMorosoConsultation(atencion) ? "Morosos" : "Retenciones"
        }
        onRegistered={reloadAfterAction}
      />
    ) : null

  const morosoProcessForm =
    isMorosoConsultation(atencion) &&
    atencion.status !== "resuelta" &&
    (isManagedByCurrentEmployee || showGuidedAssistant) ? (
      <MorosoTrackingBlock
        atencionId={atencion.id}
        trackingStatus={atencion.morosoTrackingStatus}
      />
    ) : null

  const circuitFollowUpSection =
    followUpContactForm || morosoProcessForm ? (
      <div className="space-y-3">
        {followUpContactForm}
        {morosoProcessForm}
      </div>
    ) : null

  const technicalHistoryForOt = events
    .filter(
      (event) =>
        (event.actionType === "consulta_pendiente" ||
          event.actionType === "gestion_registrada") &&
        Boolean(event.detail?.trim())
    )
    .slice(-3)
    .map((event) => event.detail!.trim())
    .join(" · ")

  const needsOtCreation =
    Boolean(atencion.linkedTaskId) ||
    atencion.nextStep === "generar_ot" ||
    Boolean(atencion.followUpActions?.includes("generar_ot"))

  const otLinkBlock = needsOtCreation ? (
    <OtLinkBlock
      atencionId={atencion.id}
      customerId={atencion.customerId}
      motivoLabel={formatCustomerAtencionMotivoLabel(atencion.motivo)}
      initialObservations={atencion.detail}
      technicalHistory={technicalHistoryForOt || atencion.resolution || null}
      linkedTaskId={atencion.linkedTaskId}
      linkedTaskCode={atencion.linkedTaskCode}
      otLinkedAt={atencion.otLinkedAt}
    />
  ) : null

  const otForm = null

  const handleAreaResultResolve = async (resolutionText: string) => {
    setActionError(null)
    const result = await resolveConsultation(atencionId, resolutionText)
    if (!result.success) {
      setActionError(result.message)
      return { success: false, message: result.message }
    }
    await reloadAfterAction()
    return { success: true }
  }

  const handleAreaResultDefer = async (nextStep: string, detail: string) => {
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
  }

  const areaInlineResultForm =
    showAreaResultInline && isPanel ? (
      isActiveRetention ? (
        <RetentionResultDialog
          presentation="inline"
          open
          onOpenChange={() => undefined}
          onResolve={handleAreaResultResolve}
          onDefer={handleAreaResultDefer}
        />
      ) : isActiveAdministration ? (
        <AdministrationResultDialog
          presentation="inline"
          open
          onOpenChange={() => undefined}
          onResolve={handleAreaResultResolve}
          onDefer={handleAreaResultDefer}
        />
      ) : isActiveTechnical ? (
        <TechnicalResultDialog
          presentation="inline"
          open
          onOpenChange={() => undefined}
          onResolve={handleAreaResultResolve}
          onDefer={handleAreaResultDefer}
        />
      ) : null
    ) : null

  const assistantDetail =
    !isManagedByAnother && atencion.status !== "resuelta" ? (
      <>
        {managementDetailForm}
        {circuitFollowUpSection}
        {otForm}
        {areaInlineResultForm}
      </>
    ) : null

  const assistantDetailReady =
    effectiveAssistantOptionId != null &&
    managementAssistantOptionRequiresDetail(effectiveAssistantOptionId)
      ? Boolean(resolution.trim()) &&
        !(
          managementAssistantOptionShowsFollowUp(effectiveAssistantOptionId) &&
          followUpNeeded &&
          selectedFollowUpActions.length === 0
        )
      : true

  const assistantConfirm: ConsultationDecisionAction | null =
    showGuidedAssistant &&
    effectiveAssistantOptionId &&
    effectiveAssistantOptionId !== "link_ot" &&
    effectiveAssistantOptionId !== "moroso_tracking"
      ? {
          id: "register",
          label: isResolving || isDeferring ? "Registrando…" : "Registrar gestión",
          onClick: () => {
            void handleRegisterManagement()
          },
          disabled:
            isResolving || isDeferring || !assistantDetailReady,
        }
      : null

  const flowContextBanner =
    areaReturn && isGeneralManagement && atencion.status !== "resuelta" ? (
      <div className="rounded-md border border-violet-200/80 bg-violet-50/70 px-3 py-2.5">
        <p className="text-[13px] font-semibold text-violet-900">
          {areaReturn.headline}
        </p>
        <p className="mt-1 text-[12px] text-slate-600">
          {areaReturn.dateTime}
          {areaReturn.actorEmployeeId
            ? ` · ${eventEmployeeNamesById[areaReturn.actorEmployeeId] ?? "Operador"}`
            : null}
        </p>
        {areaReturn.summary ? (
          <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-snug text-slate-700">
            {areaReturn.summary}
          </p>
        ) : null}
      </div>
    ) : null

  const currentStateBlock = (
    <ConsultationSituationSummaryCard
      summary={situationSummary}
      status={atencion.status}
      nextStep={atencion.nextStep}
      linkedTaskId={atencion.linkedTaskId}
      narrative={situationNarrative}
      lastActorName={lastActorName}
      initialObservations={atencion.detail}
      responsiblePersonName={responsiblePersonName}
      presentation="panel"
    />
  )

  const exclusiveManagementDialog =
    !onExclusiveManagementBlocked && myActiveManagement ? (
      <ExclusiveManagementDialog
        open={exclusiveDialogOpen}
        onOpenChange={setExclusiveDialogOpen}
        active={myActiveManagement}
        isCancelling={isCancellingExclusive}
        onContinue={() => {
          setExclusiveDialogOpen(false)
          if (myActiveManagement.atencionId !== atencionId) {
            router.push(
              `/atencion-cliente/${myActiveManagement.atencionId}`
            )
          }
        }}
        onCancelActive={() => {
          void (async () => {
            setIsCancellingExclusive(true)
            try {
              const result = await cancelConsultationManagement(
                myActiveManagement.atencionId
              )
              if (result.success) {
                setExclusiveDialogOpen(false)
                await refreshMyActiveManagement()
                await reloadAfterAction()
              } else {
                setActionError(result.message)
              }
            } finally {
              setIsCancellingExclusive(false)
            }
          })()
        }}
      />
    ) : null

  const lockedConsultationDialog = lockedInfo ? (
    <LockedConsultationDialog
      open={lockedDialogOpen}
      onOpenChange={setLockedDialogOpen}
      lock={lockedInfo}
    />
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-4 sm:px-6">
          <ConsultationDecisionCenter
            currentState={currentStateBlock}
            flowContext={flowContextBanner}
            statusMessage={decisionStatusMessage}
            title={
              canStart
                ? "Para comenzar"
                : showGuidedAssistant || showAreaResultInline
                  ? "¿Cómo continúa esta atención?"
                  : "Gestión en curso"
            }
            primary={decisionPrimary}
            options={assistantOptions}
            nextStepMessage={nextStepMessage}
            detail={assistantDetail}
            confirm={assistantConfirm}
            administrative={decisionAdministrative}
          />

          {otLinkBlock ? <div className="mt-4">{otLinkBlock}</div> : null}

          {actionError ? (
            <p className="mt-3 text-sm text-destructive">{actionError}</p>
          ) : null}

          <div className="mt-6">
            <ConsultationEventsTimeline
              cards={timelineCards}
              employeeNamesById={eventEmployeeNamesById}
              presentation="panel"
            />
          </div>
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

        {exclusiveManagementDialog}
        {lockedConsultationDialog}
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
        nextStep={atencion.nextStep}
        linkedTaskId={atencion.linkedTaskId}
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

      {otLinkBlock}

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
              <Label htmlFor="consultation-resolution">
                Detalle de la gestión
              </Label>
              <Textarea
                id="consultation-resolution"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={3}
                placeholder="Describa cómo fue resuelta la consulta."
              />
              <Button
                onClick={handleResolve}
                disabled={isResolving || !resolution.trim()}
              >
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
                disabled={
                  isDeferring || !resolution.trim() || !deferNextStep
                }
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

      {exclusiveManagementDialog}
      {lockedConsultationDialog}
    </div>
  )
}
