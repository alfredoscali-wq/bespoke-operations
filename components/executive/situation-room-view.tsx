"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  BriefcaseBusiness,
  Building2,
  Clock3,
  Contact,
  Headset,
  ListChecks,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import type {
  ExecutiveBrief,
  ExecutiveProductionBlock,
} from "@/lib/executive"
import {
  formatSituationRoomActionLabel,
  resolveSituationRoomMovementVisual,
} from "@/lib/executive/situation-room-activity-story"
import {
  contextualizeAnalysisHref,
  hrefForRelevantActivity,
  hrefForSituationRoomAlert,
  hrefForSituationRoomMetric,
  mergeAnalysisNavContext,
} from "@/lib/analysis/smart-navigation"
import type { AnalysisNavContext } from "@/lib/analysis/smart-navigation/types"
import {
  moduleColorVar,
  type ModuleColorId,
} from "@/lib/ui/module-colors"
import { cn } from "@/lib/utils"

function formatActiveTime(ms: number): string {
  if (ms <= 0) return "—"
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, "0")}m`
}

function formatStamp(value: string | null): string {
  if (!value) return "—"
  return `${formatActivityTimelineDate(value)} ${formatActivityTimelineTime(value)}`
}

type MetricVisual = {
  icon: LucideIcon
  moduleColor: ModuleColorId
  description: string
}

const GENERAL_METRIC_VISUAL: Record<string, MetricVisual> = {
  employees_active: {
    icon: Users,
    moduleColor: "people",
    description: "Personas con actividad en el período",
  },
  crews_active: {
    icon: UsersRound,
    moduleColor: "people",
    description: "Cuadrillas con movimiento operativo",
  },
  projects_active: {
    icon: Building2,
    moduleColor: "ops",
    description: "Obras con actividad registrada",
  },
  workorders_executed: {
    icon: ListChecks,
    moduleColor: "work",
    description: "Órdenes de trabajo finalizadas",
  },
  consultations_attended: {
    icon: Headset,
    moduleColor: "attention",
    description: "Consultas tomadas por atención",
  },
  sales_completed: {
    icon: BriefcaseBusiness,
    moduleColor: "commercial",
    description: "Ventas concretadas",
  },
  customers_new: {
    icon: Contact,
    moduleColor: "customers",
    description: "Clientes incorporados",
  },
  active_time: {
    icon: Clock3,
    moduleColor: "intelligence",
    description: "Ventana entre primera y última actividad",
  },
}

type AreaVisual = {
  icon: LucideIcon
  moduleColor: ModuleColorId
  action?: { href: string; label: string }
}

const AREA_VISUAL: Record<string, AreaVisual> = {
  attention: {
    icon: Headset,
    moduleColor: "attention",
    action: { href: "/atencion-cliente", label: "Ver detalle" },
  },
  operations: {
    icon: ListChecks,
    moduleColor: "work",
    action: { href: "/operations/planificacion", label: "Ver planificación" },
  },
  commercial: {
    icon: BriefcaseBusiness,
    moduleColor: "commercial",
    action: { href: "/gestion-comercial", label: "Ver comercial" },
  },
  company: {
    icon: Building2,
    moduleColor: "ops",
    action: { href: "/clientes", label: "Ver clientes" },
  },
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

function ModuleIcon({
  icon: Icon,
  moduleColor,
}: {
  icon: LucideIcon
  moduleColor: ModuleColorId
}) {
  return (
    <Icon
      className="size-4 shrink-0"
      style={{ color: moduleColorVar(moduleColor) }}
      aria-hidden
    />
  )
}

function buildEstadoGeneralCards(brief: ExecutiveBrief): Array<{
  id: string
  label: string
  value: string | number
  visual: MetricVisual
}> {
  const cards: Array<{
    id: string
    label: string
    value: string | number
    visual: MetricVisual
  }> = []

  for (const item of brief.generalState) {
    const visual = GENERAL_METRIC_VISUAL[item.id]
    if (!visual) continue
    cards.push({
      id: item.id,
      label: item.label,
      value: item.value,
      visual,
    })
  }

  const customersNew = brief.production
    .flatMap((block) => block.metrics)
    .find((metric) => metric.id === "customers_new")

  if (customersNew && !cards.some((card) => card.id === "customers_new")) {
    const visual = GENERAL_METRIC_VISUAL.customers_new
    cards.push({
      id: customersNew.id,
      label: "Clientes nuevos",
      value: customersNew.value,
      visual,
    })
  }

  cards.push({
    id: "active_time",
    label: "Tiempo activo",
    value: formatActiveTime(brief.activeTimeMs),
    visual: GENERAL_METRIC_VISUAL.active_time,
  })

  return cards
}

function areaActionHref(
  block: ExecutiveProductionBlock,
  navContext: AnalysisNavContext
): { href: string; label: string } | null {
  const visual = AREA_VISUAL[block.id]
  if (!visual?.action) return null
  return {
    href: contextualizeAnalysisHref(
      visual.action.href,
      navContext,
      "situation-room"
    ),
    label: visual.action.label,
  }
}

export function SituationRoomView({
  brief,
  isLoading,
  employeeNamesById = {},
  navContext = {},
  className,
}: {
  brief: ExecutiveBrief | null
  isLoading?: boolean
  /** Resolved client-side from the existing employees list (no new API). */
  employeeNamesById?: Record<string, string>
  navContext?: AnalysisNavContext
  className?: string
}) {
  if (isLoading || !brief) {
    return (
      <div className={cn("space-y-8", className)}>
        <p className="text-sm text-muted-foreground">
          Cargando Sala de Situación…
        </p>
      </div>
    )
  }

  const estadoGeneral = buildEstadoGeneralCards(brief)

  return (
    <div className={cn("space-y-10", className)}>
      {/* 2. Resumen Ejecutivo — narrativa primero */}
      <section className="space-y-6 rounded-xl border bg-card px-6 py-6 shadow-sm sm:px-8 sm:py-7">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resumen ejecutivo
          </p>
          <p className="max-w-4xl text-base leading-relaxed text-foreground sm:text-lg">
            {brief.narrative}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">Inicio</p>
            <p className="text-sm font-medium tabular-nums text-foreground">
              {formatStamp(brief.firstEventAt)}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">Última actividad</p>
            <p className="text-sm font-medium tabular-nums text-foreground">
              {formatStamp(brief.lastEventAt)}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">Tiempo activo</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatActiveTime(brief.activeTimeMs)}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Estado General — grilla uniforme de métricas */}
      <Section
        title="Estado general"
        description="Indicadores principales de la empresa"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {estadoGeneral.map((card) => {
            const Icon = card.visual.icon
            const href = contextualizeAnalysisHref(
              hrefForSituationRoomMetric(card.id),
              navContext,
              "situation-room"
            )
            return (
              <Link
                key={card.id}
                href={href}
                className="flex min-h-[7.5rem] flex-col rounded-xl border bg-card px-4 py-3.5 shadow-sm transition hover:border-foreground/20"
              >
                <ModuleIcon
                  icon={Icon}
                  moduleColor={card.visual.moduleColor}
                />
                <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {card.value}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  {card.label}
                </p>
                <p className="mt-auto pt-2 text-[11px] leading-snug text-muted-foreground">
                  {card.visual.description}
                </p>
              </Link>
            )
          })}
        </div>
      </Section>

      {/* 4. Producción por Área */}
      <Section
        title="Producción por área"
        description="Resultados agrupados por operación de negocio"
      >
        {brief.production.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin producción registrada en esta fecha.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {brief.production.map((block) => {
              const visual = AREA_VISUAL[block.id] ?? {
                icon: Building2 as LucideIcon,
                moduleColor: "system" as ModuleColorId,
              }
              const action = areaActionHref(block, navContext)
              const Icon = visual.icon

              return (
                <article
                  key={block.id}
                  className="flex flex-col rounded-xl border bg-card px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <ModuleIcon
                      icon={Icon}
                      moduleColor={visual.moduleColor}
                    />
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      {block.title}
                    </h3>
                  </div>

                  <ul className="mt-4 flex-1 space-y-2.5">
                    {block.metrics.map((metric) => (
                      <li
                        key={metric.id}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {metric.label}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {metric.value}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {action ? (
                    <div className="mt-5 border-t pt-3">
                      <Link
                        href={action.href}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {action.label}
                      </Link>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </Section>

      {/* 5. Estado Operativo */}
      <Section title="Estado operativo">
        {brief.operationalAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin novedades críticas.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {brief.operationalAlerts.map((alert) => {
              const href = contextualizeAnalysisHref(
                hrefForSituationRoomAlert(alert.id),
                navContext,
                "situation-room"
              )
              return (
                <Link
                  key={alert.id}
                  href={href}
                  className="rounded-xl border bg-card px-4 py-3 shadow-sm transition hover:border-foreground/20"
                >
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">
                    {alert.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {alert.label}
                  </p>
                  <p className="mt-2 text-xs font-medium text-foreground">
                    Investigar →
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </Section>

      {/* 6. Últimos movimientos */}
      <Section
        title="Últimos movimientos"
        description="Actividad reciente de la empresa."
      >
        {brief.relevantActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin movimientos relevantes en esta fecha.
          </p>
        ) : (
          <ul className="rounded-xl border bg-card shadow-sm">
            {brief.relevantActivity.map((item) => {
              const visual = resolveSituationRoomMovementVisual(item)
              const Icon = visual.icon
              const actorName =
                (item.employeeId &&
                  employeeNamesById[item.employeeId]?.trim()) ||
                "—"
              const target = hrefForRelevantActivity(item)
              const href = contextualizeAnalysisHref(
                target.path,
                mergeAnalysisNavContext(navContext, {
                  taskId: target.taskId,
                  employeeId: target.employeeId,
                }),
                "situation-room"
              )

              return (
                <li key={item.id} className="border-b last:border-b-0">
                  <Link
                    href={href}
                    className="grid grid-cols-[1.25rem_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-muted/30 sm:gap-x-4 sm:px-5"
                  >
                    <Icon
                      className="size-3.5 shrink-0"
                      style={{ color: moduleColorVar(visual.moduleColor) }}
                      aria-hidden
                    />
                    <p className="min-w-0 truncate text-sm text-foreground">
                      {formatSituationRoomActionLabel(item)}
                    </p>
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">
                      {actorName}
                    </p>
                    <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {formatActivityTimelineTime(item.createdAt)}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
