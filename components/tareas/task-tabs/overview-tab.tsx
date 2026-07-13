"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Building2,
  Calendar,
  Clock,
  FileText,
  FolderKanban,
  MapPin,
  Phone,
  User,
  Users,
} from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import type { Task } from "@/lib/types/tasks"
import {
  getOperationalStepsProgress,
  hasOperationalSteps,
  isOperationalStepComplete,
} from "@/lib/operational-steps/utils"
import { listTaskEvidencePhotos } from "@/lib/supabase/task-photos.browser"
import type { TaskPhoto } from "@/lib/types/task-photos"
import { resolveTaskCrewDisplayName, taskHasCrew } from "@/lib/tasks/crew-relation"
import { formatTaskDate } from "@/lib/tasks/constants"
import {
  formatContractedPlanLabel,
  formatAmountToCollectDisplay,
  formatWorkOrderPaymentMethodLabel,
  isNewInstallationTask,
} from "@/lib/tasks/commercial-plan"
import { isWorkOrderTask, resolveInstallationIpForDisplay } from "@/lib/tasks/work-order"
import { isCambioDomicilioTask } from "@/lib/tasks/cambio-domicilio"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import { OverdueTaskInfoPanel } from "@/components/tareas/overdue-task-info-panel"
import { WorkOrderCambioDomicilioDetail } from "@/components/tareas/work-order-cambio-domicilio-detail"
import {
  WorkOrderDualTechnologyDetail,
  WorkOrderFtthInstallationDetail,
} from "@/components/tareas/work-order-technology-state-detail"
import { taskRequiresFtthInstallation } from "@/lib/tasks/ftth-installation"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import { TaskEvidenceSummary } from "@/components/evidencias/task-evidence-summary"
import { TaskMaterialsPanel } from "@/components/materiales/task-materials-panel"
import { TaskReferencePhotosSection } from "@/components/tareas/task-reference-photos-section"
import { TaskEvidencePhotosGallery } from "@/components/tareas/task-evidence-photos-gallery"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TaskOperationalCategoryBadge } from "@/components/tareas/task-operational-badge"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"
import {
  getLocationDisplayText,
  getLocationHref,
  hasResolvedCoordinates,
} from "@/lib/location"

type TaskOverviewTabProps = {
  task: Task
}

export function TaskOverviewTab({ task }: TaskOverviewTabProps) {
  const { projects } = useProjects()
  const { getCrew } = useCrews()
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const usesOperationalSteps = hasOperationalSteps(liveTask)
  const steps = liveTask.operationalSteps ?? []
  const [stepPhotos, setStepPhotos] = useState<TaskPhoto[]>([])

  useEffect(() => {
    if (!usesOperationalSteps) {
      setStepPhotos([])
      return
    }

    let cancelled = false

    async function loadPhotos() {
      const result = await listTaskEvidencePhotos(task.id)
      if (cancelled) return
      setStepPhotos(result.data ?? [])
    }

    void loadPhotos()

    return () => {
      cancelled = true
    }
  }, [task.id, usesOperationalSteps])

  const stepPhotoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const photo of stepPhotos) {
      if (!photo.operationalStepId) continue
      counts[photo.operationalStepId] =
        (counts[photo.operationalStepId] ?? 0) + 1
    }
    return counts
  }, [stepPhotos])

  const completedSteps = useMemo(
    () =>
      steps.filter((step) => isOperationalStepComplete(step, stepPhotoCounts))
        .length,
    [stepPhotoCounts, steps]
  )
  const operationalProgress = getOperationalStepsProgress(steps, stepPhotoCounts)

  const isService = isFieldServiceTask(liveTask)

  const relatedProject = projects.find(
    (project) =>
      project.id === liveTask.projectId || project.code === liveTask.projectCode
  )
  const relatedCrew = liveTask.crewId
    ? getCrew(liveTask.crewId)
    : undefined
  const crewDisplayName = resolveTaskCrewDisplayName(liveTask, getCrew)

  const supervisorValue =
    liveTask.supervisor || "Sin supervisor asignado"
  const supervisorHint =
    taskHasCrew(liveTask) && liveTask.supervisor
      ? "Asignado por cuadrilla"
      : undefined

  const sharedLocationText = liveTask.sharedLocation?.trim()
  const crewObservations = liveTask.observationsForCrew?.trim()
  const gpsLoaded = hasResolvedCoordinates(
    liveTask.latitude,
    liveTask.longitude
  )
  const sharedLocationDisplay = getLocationDisplayText(
    liveTask.sharedLocation,
    liveTask.latitude,
    liveTask.longitude
  )
  const sharedLocationHref = getLocationHref(
    liveTask.sharedLocation,
    liveTask.latitude,
    liveTask.longitude
  )
  const hasCrewInfo =
    isWorkOrderTask(liveTask) ||
    Boolean(sharedLocationText) ||
    Boolean(crewObservations) ||
    gpsLoaded

  const sharedInfoItems = [
    {
      icon: User,
      label: "Supervisor",
      value: supervisorValue,
      hint: supervisorHint,
    },
    {
      icon: Users,
      label: "Cuadrilla",
      value: relatedCrew ? (
        <Link
          href={`/cuadrillas/${relatedCrew.id}`}
          className="font-medium text-primary hover:underline"
        >
          {crewDisplayName}
        </Link>
      ) : taskHasCrew(liveTask) ? (
        crewDisplayName
      ) : (
        "Sin cuadrilla asignada"
      ),
    },
    {
      icon: Calendar,
      label: "Fecha de inicio",
      value: formatTaskDate(liveTask.startDate),
    },
    {
      icon: Calendar,
      label: "Fecha límite",
      value: formatTaskDate(liveTask.dueDate),
    },
    {
      icon: Clock,
      label: "Duración estimada",
      value: liveTask.estimatedDuration || "—",
    },
  ]

  const obraInfoItems = [
    {
      icon: FolderKanban,
      label: "Obra",
      value: (
        <div>
          <p className="font-mono text-xs text-primary">{liveTask.projectCode}</p>
          <p className="text-sm">{liveTask.projectName}</p>
        </div>
      ),
    },
    ...sharedInfoItems,
  ]

  const serviceInfoItems = [
    {
      icon: Building2,
      label: "Cliente Operativo",
      value: liveTask.customerCompany || "—",
    },
    {
      icon: User,
      label: "Cliente Final",
      value: liveTask.customerName || "—",
    },
    {
      icon: Phone,
      label: "Teléfono",
      value: liveTask.customerPhone ? (
        <WhatsAppLink phone={liveTask.customerPhone} />
      ) : (
        "—"
      ),
    },
    ...(liveTask.customerDni?.trim()
      ? [
          {
            icon: FileText,
            label: "DNI / CUIT",
            value: liveTask.customerDni.trim(),
          },
        ]
      : []),
    {
      icon: MapPin,
      label: "Dirección",
      value: liveTask.serviceAddress || "—",
    },
    {
      icon: FileText,
      label: "Número de Orden",
      value: liveTask.workOrderNumber || "—",
    },
    ...sharedInfoItems,
  ]

  const infoItems = isService ? serviceInfoItems : obraInfoItems
  const installationIp = resolveInstallationIpForDisplay(liveTask)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">
              {liveTask.code}
            </span>
            <TaskOperationBadge task={liveTask} />
            <TaskTypeBadge type={liveTask.type} />
            {isWorkOrderTask(liveTask) ? (
              <TaskOperationalCategoryBadge task={liveTask} />
            ) : (
              <TaskStatusBadge status={liveTask.status} />
            )}
            <TaskPriorityBadge priority={liveTask.priority} />
          </div>
          <CardTitle className="text-lg">{liveTask.title}</CardTitle>
          <CardDescription>{liveTask.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {isTaskVencida(liveTask) ? (
            <div className="mb-4">
              <OverdueTaskInfoPanel task={liveTask} compact />
            </div>
          ) : null}

          {isCambioDomicilioTask(liveTask) ? (
            <div className="mb-4">
              <WorkOrderCambioDomicilioDetail task={liveTask} />
            </div>
          ) : null}

          {liveTask.serviceType === "cambio-tecnologia" ? (
            <div className="mb-4">
              <WorkOrderDualTechnologyDetail task={liveTask} />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {infoItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <div className="text-sm font-medium text-foreground">
                      {typeof item.value === "string" ? item.value : item.value}
                    </div>
                    {"hint" in item && item.hint ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.hint}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          {hasCrewInfo && (
            <div className="mt-4 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Información para la Cuadrilla
              </p>
              <div className="mt-3 space-y-3 text-sm">
                {gpsLoaded && sharedLocationDisplay ? (
                  <div className="space-y-1">
                    <p className="text-green-600 dark:text-green-500">
                      ✅ GPS cargado
                    </p>
                    {sharedLocationHref ? (
                      <a
                        href={sharedLocationHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-medium text-primary hover:underline"
                      >
                        {sharedLocationDisplay}
                      </a>
                    ) : (
                      <p className="break-all font-medium">
                        {sharedLocationDisplay}
                      </p>
                    )}
                  </div>
                ) : sharedLocationDisplay ? (
                  <p className="break-all font-medium text-muted-foreground">
                    {sharedLocationDisplay}
                  </p>
                ) : null}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Observaciones para la cuadrilla
                  </p>
                  <p className="whitespace-pre-wrap font-medium">
                    {crewObservations || "Sin observaciones"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isService && (
            <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Obra relacionada</p>
              <Link
                href={
                  relatedProject ? `/obras/${relatedProject.id}` : "/obras"
                }
                className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <MapPin className="size-3.5" />
                Ver obra {liveTask.projectCode}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {taskRequiresFtthInstallation(liveTask) ? (
          <WorkOrderFtthInstallationDetail task={liveTask} />
        ) : isNewInstallationTask(liveTask) &&
          (liveTask.contractedPlan || installationIp) ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Información comercial</CardTitle>
              <CardDescription>Datos comerciales de la instalación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {liveTask.contractedPlan ? (
                <div>
                  <p className="text-xs text-muted-foreground">Plan contratado</p>
                  <p className="text-base font-semibold">
                    {formatContractedPlanLabel(liveTask.contractedPlan) ?? "—"}
                  </p>
                </div>
              ) : null}
              {installationIp ? (
                <div>
                  <p className="text-xs text-muted-foreground">
                    IP de Instalación
                  </p>
                  <p className="text-base font-semibold">{installationIp}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {isWorkOrderTask(liveTask) &&
        (liveTask.amountToCollect != null || liveTask.paymentMethod) ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Importe a cobrar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {liveTask.amountToCollect != null ? (
                <p className="text-base font-semibold">
                  {formatAmountToCollectDisplay(liveTask.amountToCollect)}
                </p>
              ) : null}
              {liveTask.paymentMethod ? (
                <div>
                  <p className="text-xs text-muted-foreground">Medio de pago</p>
                  <p className="text-sm font-medium">
                    {formatWorkOrderPaymentMethodLabel(liveTask.paymentMethod)}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {usesOperationalSteps ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Progreso operativo</CardTitle>
              <CardDescription>
                Avance por pasos operativos con evidencia fotográfica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {operationalProgress}%
                </span>
              </div>
              <Progress value={operationalProgress} className="h-2.5" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {completedSteps} de {steps.length} pasos completados. Cada paso
                requiere una foto de evidencia para considerarse listo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Progreso del checklist</CardTitle>
              <CardDescription>Avance de entregables obligatorios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {liveTask.progress}%
                </span>
              </div>
              <Progress value={liveTask.progress} className="h-2.5" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {liveTask.checklist.filter((item) => item.completed).length} de{" "}
                {liveTask.checklist.length} elementos completados. Los ítems
                marcados como obligatorios deben estar listos antes de
                solicitar el cierre.
              </p>
            </CardContent>
          </Card>
        )}

        {!usesOperationalSteps ? (
          <>
            <TaskEvidenceSummary taskId={liveTask.id} />
            <TaskEvidencePhotosGallery taskId={liveTask.id} />
          </>
        ) : null}
        <TaskReferencePhotosSection taskId={liveTask.id} />
        <TaskMaterialsPanel taskId={liveTask.id} />
      </div>
    </div>
  )
}
