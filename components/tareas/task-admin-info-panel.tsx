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
import { WorkOrderCambioDomicilioDetail } from "@/components/tareas/work-order-cambio-domicilio-detail"
import { WorkOrderDualTechnologyDetail } from "@/components/tareas/work-order-technology-state-detail"
import { isCambioDomicilioTask } from "@/lib/tasks/cambio-domicilio"
import { formatTaskDate } from "@/lib/tasks/constants"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import { isFieldServiceTask } from "@/lib/tasks/utils"
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
}

export function TaskAdminInfoPanel({ task }: TaskAdminInfoPanelProps) {
  const { projects } = useProjects()
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const isService = isFieldServiceTask(liveTask)

  const relatedProject = projects.find(
    (project) =>
      project.id === liveTask.projectId || project.code === liveTask.projectCode
  )

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

  return (
    <Card className="shadow-sm lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">Información administrativa</CardTitle>
      </CardHeader>
      <CardContent>
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

        {hasGpsInfo && (
          <div className="mt-4 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-medium text-muted-foreground">GPS</p>
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
  )
}
