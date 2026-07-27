"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Clock3,
  FolderOpen,
  Inbox,
  Sparkles,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { COMMERCIAL_ACTIVITY_TYPE_ICONS } from "@/components/gestion-comercial/commercial-activity-icons"
import { CommercialModuleHero } from "@/components/gestion-comercial/commercial-module-hero"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import {
  CommercialEmptyState,
  CommercialSectionCard,
} from "@/components/gestion-comercial/commercial-ui"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import {
  buildCommercialOpportunitiesHref,
} from "@/lib/commercial/opportunity-list-views"
import type { CommercialHomeDesk } from "@/lib/types/commercial-home"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KPI_TONE_STYLES, STATUS_BADGE_BASE, STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

function formatShortDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatDayOnly(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function SummaryChip({
  tone,
  value,
  label,
}: {
  tone: VisualTone
  value: number
  label: string
}) {
  return (
    <span
      className={cn(
        STATUS_BADGE_BASE,
        STATUS_TONE_STYLES[tone],
        "inline-flex items-center gap-1.5 tabular-nums"
      )}
    >
      <span className="text-sm font-semibold leading-none">{value}</span>
      <span className="font-medium opacity-90">{label}</span>
    </span>
  )
}

function resolveJourneyStatus(desk: CommercialHomeDesk): {
  tone: VisualTone
  label: string
} {
  if (
    desk.daySummary.commitmentsOverdue > 0 ||
    desk.overdueCommitments.length > 0
  ) {
    return { tone: "red", label: "Hay pendientes" }
  }
  if (
    desk.newDerivations.length > 0 ||
    desk.daySummary.commitmentsToday > 0 ||
    desk.daySummary.newOpportunities > 0
  ) {
    return { tone: "yellow", label: "Requiere atención" }
  }
  return { tone: "green", label: "Todo al día" }
}

function CommercialHomeContent() {
  const router = useRouter()
  const { sessionUser } = useAuth()
  const { data: people } = useCommercialPeople()
  const [desk, setDesk] = useState<CommercialHomeDesk | null>(null)
  const [greeting, setGreeting] = useState("Buenos días")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const displayName = useMemo(() => {
    const raw = sessionUser?.displayName?.trim() || "vendedor"
    return raw.split(/\s+/)[0] || raw
  }, [sessionUser?.displayName])

  const journey = useMemo(
    () => (desk ? resolveJourneyStatus(desk) : null),
    [desk]
  )

  const loadDesk = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/gestion-comercial/home")
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        greeting?: string
        desk?: CommercialHomeDesk
      } | null
      if (!response.ok || !payload?.success || !payload.desk) {
        setError(payload?.message ?? "No se pudo cargar el escritorio.")
        setDesk(null)
        return
      }
      setGreeting(payload.greeting ?? "Buenos días")
      setDesk(payload.desk)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDesk()
  }, [loadDesk])

  function openDossier(opportunityId: string) {
    router.push(`/gestion-comercial/${opportunityId}`)
  }

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    setDrawerOpen(false)
    router.push(`/gestion-comercial/${opportunity.id}`)
  }

  if (isLoading && !desk) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CommercialModuleHero
        active="inicio"
        title={`${greeting} ${displayName}`}
        description="Tu bandeja de trabajo comercial del día."
        onNewOpportunity={() => setDrawerOpen(true)}
      >
        <div className="flex flex-wrap items-center gap-2">
          {journey ? (
            <span
              className={cn(
                STATUS_BADGE_BASE,
                STATUS_TONE_STYLES[journey.tone],
                "inline-flex w-fit items-center gap-1.5"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  journey.tone === "green" && "bg-emerald-600",
                  journey.tone === "yellow" && "bg-amber-600",
                  journey.tone === "red" && "bg-red-600"
                )}
                aria-hidden
              />
              {journey.label}
            </span>
          ) : null}
          {desk ? (
            <>
              <SummaryChip
                tone="orange"
                value={desk.daySummary.newOpportunities}
                label="Nuevas"
              />
              <SummaryChip
                tone="green"
                value={desk.daySummary.commitmentsToday}
                label="Hoy"
              />
              <SummaryChip
                tone="red"
                value={desk.daySummary.commitmentsOverdue}
                label="Vencidos"
              />
            </>
          ) : null}
        </div>
      </CommercialModuleHero>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CommercialSectionCard
          title="Nuevas derivaciones"
          description="Consultas derivadas desde Atención al Cliente sin abrir."
          icon={Inbox}
          accent="blue"
        >
          {!desk?.newDerivations.length ? (
            <CommercialEmptyState
              icon={Inbox}
              title="No hay nuevas derivaciones."
              description="Excelente, ya revisaste todas las oportunidades."
            />
          ) : (
            <ul className="divide-y">
              {desk.newDerivations.map((item) => (
                <li
                  key={item.opportunityId}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {item.personName}
                    </p>
                    {item.companyName ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.companyName}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(item.derivedAt)} · {item.derivedByName}
                    </p>
                    <p className="text-xs text-foreground/80">{item.reason}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() => openDossier(item.opportunityId)}
                  >
                    <FolderOpen className="size-3.5" />
                    Abrir expediente
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CommercialSectionCard>

        <CommercialSectionCard
          title="Compromisos vencidos"
          description="Requieren actividad para ponerse al día."
          icon={AlertTriangle}
          accent="red"
        >
          {!desk?.overdueCommitments.length ? (
            <CommercialEmptyState
              icon={AlertTriangle}
              title="Sin compromisos vencidos."
              description="Estás al día con tus seguimientos pendientes."
            />
          ) : (
            <ul className="divide-y">
              {desk.overdueCommitments.map((item) => (
                <li
                  key={item.commitmentId}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {item.personName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.title}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3" />
                      {formatDayOnly(item.dueAt)}
                      {item.daysOverdue != null
                        ? ` · ${item.daysOverdue} día${item.daysOverdue === 1 ? "" : "s"} de atraso`
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() =>
                      router.push(
                        `/gestion-comercial/${item.opportunityId}?action=activity`
                      )
                    }
                  >
                    Registrar actividad
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CommercialSectionCard>
      </div>

      <CommercialSectionCard
        title="Compromisos de hoy"
        description="Agenda comercial del día, ordenada por horario."
        icon={CalendarDays}
        accent="amber"
      >
        {!desk?.todayCommitments.length ? (
          <CommercialEmptyState
            icon={CalendarDays}
            title="No hay compromisos para hoy."
            description="Tu agenda del día está libre."
          />
        ) : (
          <ul className="divide-y">
            {desk.todayCommitments.map((item) => (
              <li
                key={item.commitmentId}
                className="flex cursor-pointer items-start gap-3 py-3 first:pt-0 last:pb-0"
                onClick={() => openDossier(item.opportunityId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    openDossier(item.opportunityId)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/[0.08]">
                  <CalendarDays className="size-4 text-amber-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatShortDate(item.dueAt)}
                  </p>
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.personName}
                    {item.opportunityCode ? ` · ${item.opportunityCode}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CommercialSectionCard>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <CommercialSectionCard title="Resumen comercial" icon={BarChart3} accent="violet">
          {desk ? (
            <div className="grid grid-cols-2 gap-2.5">
              <FilterableKpiCard
                compact
                label="Oportunidades activas"
                value={desk.kpis.activeOpportunities}
                icon={BarChart3}
                tone="violet"
                href={buildCommercialOpportunitiesHref("active")}
              />
              <FilterableKpiCard
                compact
                label="Ganadas este mes"
                value={desk.kpis.wonThisMonth}
                icon={Sparkles}
                tone="green"
                href={buildCommercialOpportunitiesHref("won_month")}
              />
              <FilterableKpiCard
                compact
                label="Perdidas este mes"
                value={desk.kpis.lostThisMonth}
                icon={AlertTriangle}
                tone="red"
                href={buildCommercialOpportunitiesHref("lost_month")}
              />
              <FilterableKpiCard
                compact
                label="Sin actividad +7 días"
                value={desk.kpis.inactiveOver7Days}
                icon={Clock3}
                tone="amber"
                href={buildCommercialOpportunitiesHref("inactive_7d")}
              />
            </div>
          ) : null}
        </CommercialSectionCard>

        <CommercialSectionCard title="Actividad reciente" icon={Clock3} accent="slate">
          {!desk?.recentActivity.length ? (
            <CommercialEmptyState
              icon={Clock3}
              title="Todavía no hay actividad comercial."
              description="Cuando registres gestiones, aparecerán aquí."
            />
          ) : (
            <ul className="space-y-2.5">
              {desk.recentActivity.map((item) => {
                const Icon =
                  COMMERCIAL_ACTIVITY_TYPE_ICONS[
                    item.activityTypeCode as CommercialActivityTypeCode
                  ] ?? Sparkles
                return (
                  <li key={item.id} className="flex gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        KPI_TONE_STYLES.neutral.icon
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-3.5",
                          KPI_TONE_STYLES.neutral.iconColor
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-md text-left transition-colors hover:bg-muted/40"
                      onClick={() => openDossier(item.opportunityId)}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.personName}
                        {item.opportunityCode ? ` · ${item.opportunityCode}` : ""}
                        {" · "}
                        {item.employeeName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatShortDate(item.occurredAt)} ·{" "}
                        {item.activityTypeLabel}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CommercialSectionCard>
      </div>

      <CommercialNewOpportunityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        people={people}
        onCreated={handleCreated}
      />
    </div>
  )
}

export function CommercialHomeModule() {
  return (
    <EmployeesProvider>
      <CommercialProvider>
        <CommercialHomeContent />
      </CommercialProvider>
    </EmployeesProvider>
  )
}
