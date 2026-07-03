"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  HardHat,
  ListChecks,
  PauseCircle,
  Radio,
  UserCheck,
  Users,
} from "lucide-react"

import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton"
import { DashboardDayOperations } from "@/components/dashboard/dashboard-day-operations"
import { DashboardExecutiveSummary } from "@/components/dashboard/dashboard-executive-summary"
import { DashboardOperationalAlerts } from "@/components/dashboard/dashboard-operational-alerts"
import { DashboardOperationalHeader } from "@/components/dashboard/dashboard-operational-header"
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity"
import { DashboardRrhhSummary } from "@/components/dashboard/dashboard-rrhh-summary"
import { DashboardStatusSection } from "@/components/dashboard/dashboard-status-section"
import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEvidence } from "@/components/evidencias/evidence-provider"
import { useProjects } from "@/components/obras/projects-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  buildCrewsStatusKpis,
  buildDayOperations,
  buildExecutiveSummary,
  buildOperationalAlerts,
  buildProjectsStatusKpis,
  buildRecentOperationalActivity,
  buildTasksStatusKpis,
  countOperationalIncidents,
} from "@/lib/data/dashboard"
import { TASK_STATUS_DASHBOARD_TONE } from "@/lib/tasks/status-visual"
import { profileShowsDashboardSection } from "@/lib/operations/operational-profile"

const PROJECT_ICONS = {
  active: Building2,
  planned: ListChecks,
  "pending-closure": PauseCircle,
  closed: CheckCircle2,
} as const

const PROJECT_TONES = {
  active: "green",
  planned: "blue",
  "pending-closure": "yellow",
  closed: "yellow",
} as const

const TASK_ICONS = {
  programada: CircleDot,
  asignada: UserCheck,
  vencida: AlertTriangle,
  "en-curso": Clock,
  incidencia: AlertTriangle,
  "pendiente-cierre": ClipboardCheck,
  "en-aprobacion": ClipboardCheck,
  finalizada: CheckCircle2,
  cerrada: Ban,
} as const

const TASK_TONES = TASK_STATUS_DASHBOARD_TONE

const CREW_ICONS = {
  active: Users,
  field: HardHat,
  reduced: Radio,
  "not-operational": Ban,
} as const

const CREW_TONES = {
  active: "green",
  field: "blue",
  reduced: "yellow",
  "not-operational": "red",
} as const

export function DashboardPageClient() {
  const [isHydrating, setIsHydrating] = useState(true)
  const { profile } = useOperationalProfile()
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const { evidence } = useEvidence()
  const { crews } = useCrews()
  const { records: availabilityRecords } = useAvailability()
  const { getEmployee } = useEmployees()

  useEffect(() => {
    setIsHydrating(false)
  }, [])

  const crewAvailabilityContext = useMemo(
    () => ({
      availabilityRecords,
      getEmployee,
    }),
    [availabilityRecords, getEmployee]
  )

  const alerts = useMemo(
    () =>
      buildOperationalAlerts({
        projects,
        tasks,
        crews,
        crewAvailabilityContext,
      }),
    [projects, tasks, crews, crewAvailabilityContext]
  )

  const incidentsCount = useMemo(
    () => countOperationalIncidents(alerts),
    [alerts]
  )

  const executiveSummary = useMemo(
    () =>
      buildExecutiveSummary({
        projects,
        tasks,
        crews,
        alertsCount: incidentsCount,
        crewAvailabilityContext,
      }),
    [projects, tasks, crews, incidentsCount, crewAvailabilityContext]
  )

  const dayOperations = useMemo(
    () => buildDayOperations({ tasks, evidence }),
    [tasks, evidence]
  )

  const projectsStatus = useMemo(
    () => buildProjectsStatusKpis(projects),
    [projects]
  )

  const tasksStatus = useMemo(
    () => buildTasksStatusKpis(tasks),
    [tasks]
  )

  const crewsStatus = useMemo(
    () =>
      buildCrewsStatusKpis({
        crews,
        tasks,
        crewAvailabilityContext,
      }),
    [crews, tasks, crewAvailabilityContext]
  )

  const recentActivity = useMemo(
    () =>
      buildRecentOperationalActivity({
        projects,
        tasks,
        evidence,
        crews,
        crewAvailabilityContext,
      }),
    [projects, tasks, evidence, crews, crewAvailabilityContext]
  )

  const show = (section: Parameters<typeof profileShowsDashboardSection>[1]) =>
    profileShowsDashboardSection(profile, section)

  if (isHydrating) {
    return <DashboardPageSkeleton />
  }

  return (
    <div className="space-y-8">
      {profile !== "rrhh" ? <DashboardOperationalHeader /> : null}

      {show("rrhh-summary") ? <DashboardRrhhSummary /> : null}

      {show("executive-summary") ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Resumen Ejecutivo
            </h3>
          </div>
          <DashboardExecutiveSummary kpis={executiveSummary} />
        </section>
      ) : null}

      {show("operational-alerts") ? (
        <DashboardOperationalAlerts alerts={alerts} />
      ) : null}

      {show("day-operations") ? (
        <DashboardDayOperations metrics={dayOperations} />
      ) : null}

      {show("projects-status") ? (
        <DashboardStatusSection
          title="Estado de Obras"
          description="Distribución operativa del portafolio de obras"
          kpis={projectsStatus}
          icons={PROJECT_ICONS}
          tones={PROJECT_TONES}
        />
      ) : null}

      {show("tasks-status") ? (
        <DashboardStatusSection
          title="Estado de Órdenes de Trabajo"
          description="Seguimiento operativo por estado de ciclo de vida"
          kpis={tasksStatus}
          icons={TASK_ICONS}
          tones={TASK_TONES}
          layout="wide"
        />
      ) : null}

      {show("crews-status") ? (
        <DashboardStatusSection
          title="Estado de Cuadrillas"
          description="Disponibilidad y despliegue operativo de cuadrillas"
          kpis={crewsStatus}
          icons={CREW_ICONS}
          tones={CREW_TONES}
        />
      ) : null}

      {show("recent-activity") ? (
        <DashboardRecentActivity items={recentActivity} />
      ) : null}
    </div>
  )
}
