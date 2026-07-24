"use client"

import { useMemo } from "react"
import {
  Activity,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  MessageSquare,
  PlayCircle,
  Users,
} from "lucide-react"

import { buildOperationalIntelligenceDashboard } from "@/lib/activity/operational-intelligence-dashboard"
import type { ActivityViewerEntry } from "@/lib/activity/activity-viewer-types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

type ActivityExecutiveDashboardProps = {
  entries: ActivityViewerEntry[]
  isLoading: boolean
  onSelectEntry?: (entry: ActivityViewerEntry) => void
}

function RankListEmpty({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>
}

export function ActivityExecutiveDashboard({
  entries,
  isLoading,
  onSelectEntry,
}: ActivityExecutiveDashboardProps) {
  const dashboard = useMemo(
    () => buildOperationalIntelligenceDashboard(entries),
    [entries]
  )

  const { kpis } = dashboard

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <LayoutDashboard className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Dashboard Ejecutivo
          </h2>
          <p className="text-xs text-muted-foreground">
            Indicadores derivados de los {dashboard.periodEventCount} eventos
            cargados
            {dashboard.todayEventCount !== dashboard.periodEventCount
              ? ` · ${dashboard.todayEventCount} de hoy`
              : ""}
            . Sin consultas adicionales al servidor.
          </p>
        </div>
      </div>

      <KpiCardGrid layout="wide" className="xl:grid-cols-3 2xl:grid-cols-5">
        <FilterableKpiCard
          label="Eventos hoy"
          value={kpis.eventsToday}
          icon={Activity}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="Eventos última hora"
          value={kpis.eventsLastHour}
          icon={Clock3}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="Usuarios activos"
          value={kpis.activeUsersToday}
          icon={Users}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="Áreas activas"
          value={kpis.activeAreasToday}
          icon={Building2}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="Módulos activos hoy"
          value={kpis.modulesActiveToday}
          icon={Boxes}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="OT creadas"
          value={kpis.tasksCreatedToday}
          icon={ClipboardList}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="OT iniciadas"
          value={kpis.tasksStartedToday}
          icon={PlayCircle}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="OT finalizadas"
          value={kpis.tasksFinishedToday}
          icon={CheckCircle2}
          compact
          isLoading={isLoading}
          disabled
        />
        <FilterableKpiCard
          label="Consultas atendidas"
          value={kpis.consultationsAttendedToday}
          icon={MessageSquare}
          compact
          isLoading={isLoading}
          disabled
        />
      </KpiCardGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top empleados</CardTitle>
            <CardDescription>
              Mayor actividad en el período cargado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RankListEmpty message="Calculando ranking..." />
            ) : dashboard.topEmployees.length === 0 ? (
              <RankListEmpty message="Sin empleados con actividad en los eventos cargados." />
            ) : (
              <ul className="divide-y divide-border">
                {dashboard.topEmployees.map((employee, index) => (
                  <li
                    key={employee.employeeKey}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        <span className="mr-2 text-xs text-muted-foreground">
                          #{index + 1}
                        </span>
                        {employee.employeeName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        OT {employee.otEvents} · Consultas{" "}
                        {employee.consultationEvents}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {employee.totalEvents}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actividad por área</CardTitle>
            <CardDescription>
              Eventos agrupados por área operativa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RankListEmpty message="Calculando áreas..." />
            ) : dashboard.activityByArea.length === 0 ? (
              <RankListEmpty message="Sin áreas con actividad en los eventos cargados." />
            ) : (
              <ul className="divide-y divide-border">
                {dashboard.activityByArea.map((area) => (
                  <li
                    key={area.areaKey}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {area.areaLabel}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {area.totalEvents}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acciones más frecuentes</CardTitle>
            <CardDescription>
              Ranking de acciones en el período cargado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RankListEmpty message="Calculando acciones..." />
            ) : dashboard.topActions.length === 0 ? (
              <RankListEmpty message="Sin acciones en los eventos cargados." />
            ) : (
              <ul className="divide-y divide-border">
                {dashboard.topActions.map((action, index) => (
                  <li
                    key={action.action}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      <span className="mr-2 text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                      {action.actionLabel}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {action.totalEvents}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <CardDescription>
              Últimos eventos cargados · solo lectura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RankListEmpty message="Cargando feed..." />
            ) : dashboard.recentFeed.length === 0 ? (
              <RankListEmpty message="Sin eventos recientes cargados." />
            ) : (
              <ul className="divide-y divide-border">
                {dashboard.recentFeed.map((item) => {
                  const entry = entries.find((candidate) => candidate.id === item.id)
                  return (
                    <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        className="w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent"
                        disabled={!entry || !onSelectEntry}
                        onClick={() => {
                          if (entry && onSelectEntry) onSelectEntry(entry)
                        }}
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.timeLabel}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {item.employeeName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.actionLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
