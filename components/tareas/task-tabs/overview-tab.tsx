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
  Users,
} from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useProjects } from "@/components/obras/projects-provider"
import type { Task } from "@/lib/types/tasks"
import { resolveTaskCrewDisplayName, taskHasCrew } from "@/lib/tasks/crew-relation"
import { formatTaskDate } from "@/lib/tasks/constants"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import { TaskEvidenceSummary } from "@/components/evidencias/task-evidence-summary"
import { TaskMaterialsPanel } from "@/components/materiales/task-materials-panel"
import { TaskReferencePhotosGallery } from "@/components/tareas/task-reference-photos-gallery"
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
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import {
  getSharedLocationDisplayText,
  getSharedLocationHref,
  hasLoadedGps,
} from "@/lib/utils/shared-location"

type TaskOverviewTabProps = {
  task: Task
}

export function TaskOverviewTab({ task }: TaskOverviewTabProps) {
  const { projects } = useProjects()
  const { getCrew } = useCrews()
  const isService = isFieldServiceTask(task)

  const relatedProject = projects.find(
    (project) =>
      project.id === task.projectId || project.code === task.projectCode
  )
  const relatedCrew = task.crewId
    ? getCrew(task.crewId)
    : undefined
  const crewDisplayName = resolveTaskCrewDisplayName(task, getCrew)

  const supervisorValue =
    task.supervisor || "Sin supervisor asignado"
  const supervisorHint =
    taskHasCrew(task) && task.supervisor ? "Asignado por cuadrilla" : undefined

  const sharedLocationText = task.sharedLocation?.trim()
  const crewObservations = task.observationsForCrew?.trim()
  const gpsLoaded = hasLoadedGps(
    task.sharedLocation,
    task.latitude,
    task.longitude
  )
  const sharedLocationDisplay = getSharedLocationDisplayText(
    task.sharedLocation,
    task.latitude,
    task.longitude
  )
  const sharedLocationHref = getSharedLocationHref(
    task.sharedLocation,
    task.latitude,
    task.longitude
  )
  const hasCrewInfo =
    isWorkOrderTask(task) ||
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
      ) : taskHasCrew(task) ? (
        crewDisplayName
      ) : (
        "Sin cuadrilla asignada"
      ),
    },
    {
      icon: Calendar,
      label: "Fecha de inicio",
      value: formatTaskDate(task.startDate),
    },
    {
      icon: Calendar,
      label: "Fecha límite",
      value: formatTaskDate(task.dueDate),
    },
    {
      icon: Clock,
      label: "Duración estimada",
      value: task.estimatedDuration || "—",
    },
  ]

  const obraInfoItems = [
    {
      icon: FolderKanban,
      label: "Proyecto",
      value: (
        <div>
          <p className="font-mono text-xs text-primary">{task.projectCode}</p>
          <p className="text-sm">{task.projectName}</p>
        </div>
      ),
    },
    ...sharedInfoItems,
  ]

  const serviceInfoItems = [
    {
      icon: Building2,
      label: "Cliente Operativo",
      value: task.customerCompany || "—",
    },
    {
      icon: User,
      label: "Cliente Final",
      value: task.customerName || "—",
    },
    {
      icon: Phone,
      label: "Teléfono",
      value: task.customerPhone ? (
        <WhatsAppLink phone={task.customerPhone} />
      ) : (
        "—"
      ),
    },
    {
      icon: MapPin,
      label: "Dirección",
      value: task.serviceAddress || "—",
    },
    {
      icon: FileText,
      label: "Número de Orden",
      value: task.workOrderNumber || "—",
    },
    ...sharedInfoItems,
  ]

  const infoItems = isService ? serviceInfoItems : obraInfoItems

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">
              {task.code}
            </span>
            <TaskOperationBadge task={task} />
            <TaskTypeBadge type={task.type} />
            {isWorkOrderTask(task) ? (
              <TaskOperationalCategoryBadge task={task} />
            ) : (
              <TaskStatusBadge status={task.status} />
            )}
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <CardTitle className="text-lg">{task.title}</CardTitle>
          <CardDescription>{task.description}</CardDescription>
        </CardHeader>
        <CardContent>
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
                Ver proyecto {task.projectCode}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Progreso del checklist</CardTitle>
            <CardDescription>Avance de entregables obligatorios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {task.progress}%
              </span>
            </div>
            <Progress value={task.progress} className="h-2.5" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {task.checklist.filter((item) => item.completed).length} de{" "}
              {task.checklist.length} elementos completados. Los ítems marcados
              como obligatorios deben estar listos antes de finalizar la tarea.
            </p>
          </CardContent>
        </Card>

        <TaskEvidenceSummary taskId={task.id} />
        <TaskReferencePhotosGallery taskId={task.id} />
        <TaskMaterialsPanel taskId={task.id} />
      </div>
    </div>
  )
}
