"use client"

import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { ArrowLeft, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { AdministrationResultDialog } from "@/components/atencion-cliente/administration-result-dialog"
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
  buildConsultationTimelineCards,
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
  formatCustomerStatusLabel,
  formatCustomerTechnologyLabel,
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

  const reloadAfterAction = useCallback(async () => {
    await loadDetail()
    onDataChanged?.()
  }, [loadDetail, onDataChanged])

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

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando consulta…</p>
  }

  if (!atencion) {
    if (isPanel) {
      return (
        <p className="text-sm text-muted-foreground">
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
  const situationSummary = buildConsultationSituationSummary(atencion, events)
  const timelineCards = buildConsultationTimelineCards(events)
  const lastActorName = situationSummary.lastActorEmployeeId
    ? (eventEmployeeNamesById[situationSummary.lastActorEmployeeId] ?? "—")
    : "—"

  const customerAddressLabel = customer
    ? formatCustomerAddressLabel(customer)
    : null
  const customerTechnologyLabel = customer
    ? formatCustomerTechnologyLabel(customer.technology)
    : null

  return (
    <div className={isPanel ? "space-y-4" : "space-y-6"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {isPanel ? null : (
            <Button variant="outline" size="icon" asChild>
              <Link href="/atencion-cliente" aria-label="Volver a la bandeja">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          )}
          <div className="min-w-0">
            <h1
              className={
                isPanel
                  ? "truncate text-lg font-semibold tracking-tight"
                  : "text-2xl font-semibold tracking-tight"
              }
            >
              Detalle de Consulta
            </h1>
            <p className="text-sm text-muted-foreground">
              Creada el {new Date(atencion.createdAt).toLocaleString("es-AR")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canDelete ? (
            isPanel ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                aria-label="Eliminar consulta"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" />
                Eliminar consulta
              </Button>
            )
          ) : null}
          {isPanel ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRequestClose}
              aria-label="Cerrar detalle"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <ConsultationSituationSummaryCard
        summary={situationSummary}
        lastActorName={lastActorName}
      />

      {isPanel && customer ? (
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Nombre"
              value={
                <Link
                  href={`/clientes/${customer.id}`}
                  className="text-primary hover:underline"
                >
                  {customer.name}
                </Link>
              }
            />
            {customer.customerNumber ? (
              <DetailField label="Nº de cliente" value={customer.customerNumber} />
            ) : null}
            {customer.phone ? (
              <DetailField label="Teléfono" value={customer.phone} />
            ) : null}
            {customerAddressLabel ? (
              <DetailField label="Dirección" value={customerAddressLabel} />
            ) : null}
            {customerTechnologyLabel ? (
              <DetailField label="Tecnología" value={customerTechnologyLabel} />
            ) : null}
            {customer.contractedPlan ? (
              <DetailField label="Plan" value={customer.contractedPlan} />
            ) : null}
            <DetailField
              label="Estado del servicio"
              value={formatCustomerStatusLabel(customer.status)}
            />
          </CardContent>
        </Card>
      ) : null}

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
            label="Estado"
            value={formatCustomerAtencionStatusLabel(atencion.status)}
          />
          <DetailField
            label="Próximo paso"
            value={
              <span className="inline-flex flex-wrap items-center gap-2">
                {atencion.nextStep
                  ? formatCustomerAtencionNextStepLabel(atencion.nextStep)
                  : "—"}
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
            }
          />
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

      {isPanel ? (
        <ConsultationEventsTimeline
          cards={timelineCards}
          employeeNamesById={eventEmployeeNamesById}
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

      {isPanel ? null : (
        <ConsultationEventsTimeline
          cards={timelineCards}
          employeeNamesById={eventEmployeeNamesById}
        />
      )}

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
          if (isPanel) {
            onDataChanged?.()
            onRequestClose?.()
          } else {
            router.push("/atencion-cliente")
          }
          return { success: true }
        }}
      />

      <RetentionResultDialog
        open={isRetentionDialogOpen}
        onOpenChange={setIsRetentionDialogOpen}
        onResolve={async (resolution) => {
          setActionError(null)
          const result = await resolveConsultation(atencionId, resolution)
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
        onResolve={async (resolution) => {
          setActionError(null)
          const result = await resolveConsultation(atencionId, resolution)
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
        onResolve={async (resolution) => {
          setActionError(null)
          const result = await resolveConsultation(atencionId, resolution)
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
