"use client"

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
} from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskAdminMetricCard } from "@/components/tareas/task-admin-metric-card"
import { TaskAdminOperationalChecklist } from "@/components/tareas/task-admin-operational-checklist"
import { WorkOrderCambioDomicilioDetail } from "@/components/tareas/work-order-cambio-domicilio-detail"
import { WorkOrderDualTechnologyDetail } from "@/components/tareas/work-order-technology-state-detail"
import { isCambioDomicilioTask } from "@/lib/tasks/cambio-domicilio"
import {
  formatAmountToCollectDisplay,
  formatContractedPlanLabel,
} from "@/lib/tasks/commercial-plan"
import { formatTaskDate } from "@/lib/tasks/constants"
import {
  resolveFinalTechnologyFromTask,
  resolveTechnologyLabel,
} from "@/lib/tasks/ftth-installation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import {
  getLocationDisplayText,
  getLocationHref,
  hasResolvedCoordinates,
} from "@/lib/location"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminInfoPanelProps = {
  task: Task
  embedded?: boolean
}

type TaskAdminInfoPanelContentProps = {
  task: Task
  embedded?: boolean
  relatedProject?: Project | null
}

function TaskAdminInfoPanelContent({
  task,
  embedded = false,
  relatedProject = null,
}: TaskAdminInfoPanelContentProps) {
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const isService = isFieldServiceTask(liveTask)

  const supervisorValue =
    liveTask.supervisor || "Sin supervisor asignado"
  const supervisorHint =
    liveTask.supervisor && liveTask.crewId
      ? "Asignado por cuadrilla"
      : undefined

  const sharedLocationText = liveTask.sharedLocation?.trim()
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
  const hasGpsInfo =
    isWorkOrderTask(liveTask) ||
    Boolean(sharedLocationText) ||
    gpsLoaded

  const sharedInfoItems = [
    {
      icon: User,
      label: "Supervisor",
      value: supervisorValue,
      hint: supervisorHint,
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
  const technologyLabel =
    resolveTechnologyLabel(resolveFinalTechnologyFromTask(liveTask)) ?? "—"
  const planLabel = formatContractedPlanLabel(liveTask.contractedPlan) ?? "—"
  const amountLabel =
    isWorkOrderTask(liveTask) && liveTask.amountToCollect != null
      ? formatAmountToCollectDisplay(liveTask.amountToCollect)
      : "—"

  return (
    <div className="space-y-4 lg:col-span-2">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          {isWorkOrderTask(liveTask) ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <TaskAdminMetricCard
                icon="📡"
                label="Tecnología"
                value={technologyLabel}
              />
              <TaskAdminMetricCard
                icon="📦"
                label="Plan contratado"
                value={planLabel}
              />
              <TaskAdminMetricCard
                icon="💰"
                label="Importe a cobrar"
                value={amountLabel}
              />
            </div>
          ) : null}

          {isCambioDomicilioTask(liveTask) ? (
            <div className="mb-4">
              <WorkOrderCambioDomicilioDetail
                task={liveTask}
                showInstallationFields={false}
              />
            </div>
          ) : null}

          {liveTask.serviceType === "cambio-tecnologia" ? (
            <div className="mb-4">
              <WorkOrderDualTechnologyDetail
                task={liveTask}
                showInstallationFields={false}
              />
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

        {!isService && !embedded ? (
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
        ) : null}
        </CardContent>
      </Card>

      {hasGpsInfo ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">GPS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
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
            </div>
          </CardContent>
        </Card>
      ) : null}

      <TaskAdminOperationalChecklist task={liveTask} />
    </div>
  )
}

function TaskAdminInfoPanelWithProjects({ task }: { task: Task }) {
  const { projects } = useProjects()
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const relatedProject =
    projects.find(
      (project) =>
        project.id === liveTask.projectId ||
        project.code === liveTask.projectCode
    ) ?? null

  return (
    <TaskAdminInfoPanelContent
      task={task}
      relatedProject={relatedProject}
    />
  )
}

export function TaskAdminInfoPanel({
  task,
  embedded = false,
}: TaskAdminInfoPanelProps) {
  if (embedded) {
    return <TaskAdminInfoPanelContent task={task} embedded />
  }

  return <TaskAdminInfoPanelWithProjects task={task} />
}
