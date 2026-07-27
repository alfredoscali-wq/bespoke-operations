"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CalendarDays,
  FolderOpen,
  MapPinned,
  Plus,
  Sparkles,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { COMMERCIAL_ACTIVITY_TYPE_ICONS } from "@/components/gestion-comercial/commercial-activity-icons"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import type { CommercialHomeDesk } from "@/lib/types/commercial-home"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"
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

function HomeSection({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>
  )
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
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting} {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu bandeja de trabajo comercial del día.
          </p>
          {desk ? (
            <p className="mt-2 text-sm text-foreground">
              <span className="font-medium">{desk.daySummary.newOpportunities}</span>{" "}
              nuevas ·{" "}
              <span className="font-medium">
                {desk.daySummary.commitmentsToday}
              </span>{" "}
              compromisos hoy ·{" "}
              <span
                className={cn(
                  "font-medium",
                  desk.daySummary.commitmentsOverdue > 0 && "text-destructive"
                )}
              >
                {desk.daySummary.commitmentsOverdue}
              </span>{" "}
              vencidos
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus className="size-4" />
            Nueva oportunidad
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/gestion-comercial/oportunidades">Oportunidades</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/gestion-comercial/mapa" className="gap-2">
              <MapPinned className="size-4" />
              Territorio
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/gestion-comercial/oportunidades">Pipeline</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <HomeSection
          title="Nuevas derivaciones"
          description="Consultas derivadas desde Atención al Cliente sin abrir."
        >
          {!desk?.newDerivations.length ? (
            <EmptyHint>No hay derivaciones pendientes.</EmptyHint>
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
                    className="shrink-0 gap-1.5"
                    onClick={() => openDossier(item.opportunityId)}
                  >
                    <FolderOpen className="size-3.5" />
                    Abrir expediente
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </HomeSection>

        <HomeSection
          title="Compromisos vencidos"
          description="Requieren actividad para ponerse al día."
        >
          {!desk?.overdueCommitments.length ? (
            <EmptyHint>Sin compromisos vencidos.</EmptyHint>
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
                    className="shrink-0"
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
        </HomeSection>
      </div>

      <HomeSection
        title="Compromisos de hoy"
        description="Agenda comercial del día, ordenada por horario."
      >
        {!desk?.todayCommitments.length ? (
          <EmptyHint>No hay compromisos para hoy.</EmptyHint>
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
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <CalendarDays className="size-4 text-muted-foreground" />
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
      </HomeSection>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <HomeSection title="Resumen comercial">
          {desk ? (
            <dl className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Oportunidades activas",
                  value: desk.kpis.activeOpportunities,
                },
                {
                  label: "Ganadas este mes",
                  value: desk.kpis.wonThisMonth,
                },
                {
                  label: "Perdidas este mes",
                  value: desk.kpis.lostThisMonth,
                },
                {
                  label: "Sin actividad +7 días",
                  value: desk.kpis.inactiveOver7Days,
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-md border px-3 py-2.5"
                >
                  <dt className="text-[11px] text-muted-foreground">
                    {kpi.label}
                  </dt>
                  <dd className="mt-0.5 text-xl font-semibold tracking-tight">
                    {kpi.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </HomeSection>

        <HomeSection title="Actividad reciente">
          {!desk?.recentActivity.length ? (
            <EmptyHint>Todavía no hay actividad comercial.</EmptyHint>
          ) : (
            <ul className="space-y-3">
              {desk.recentActivity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    {(() => {
                      const Icon =
                        COMMERCIAL_ACTIVITY_TYPE_ICONS[
                          item.activityTypeCode as CommercialActivityTypeCode
                        ] ?? Sparkles
                      return (
                        <Icon className="size-3.5 text-muted-foreground" />
                      )
                    })()}
                  </div>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
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
              ))}
            </ul>
          )}
        </HomeSection>
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
