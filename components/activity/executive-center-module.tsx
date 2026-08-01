"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Compass,
  Loader2,
  MoreHorizontal,
  Share2,
  Printer,
  Download,
} from "lucide-react"

import { AnalysisBreadcrumb } from "@/components/analysis/analysis-breadcrumb"
import { useAnalysisNavContext } from "@/components/analysis/use-analysis-nav-context"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { AnalysisDateRangePicker } from "@/lib/analysis/components/analysis-date-range-picker"
import {
  analysisDateRangeFocusDate,
  createDefaultAnalysisDateRange,
  resolveAnalysisDateRange,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range"
import { prepareExecutiveCenterExport } from "@/lib/analysis/executive-center/export"
import type {
  ExecutiveAttentionSeverity,
  ExecutiveDomainStatus,
} from "@/lib/analysis/executive-center/types"
import {
  buildAnalysisBreadcrumb,
  contextualizeAnalysisHref,
} from "@/lib/analysis/smart-navigation"
import { useExecutiveCenterQuery } from "@/lib/analysis/react-query"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { moduleColorVar } from "@/lib/ui/module-colors"
import { cn } from "@/lib/utils"

function severityClass(severity: ExecutiveAttentionSeverity): string {
  if (severity === "critical") {
    return "border-red-200 bg-red-50/80 text-red-950"
  }
  if (severity === "important") {
    return "border-amber-200 bg-amber-50/80 text-amber-950"
  }
  return "border-emerald-200 bg-emerald-50/70 text-emerald-950"
}

function severityDot(severity: ExecutiveAttentionSeverity): string {
  if (severity === "critical") return "🔴"
  if (severity === "important") return "🟠"
  return "🟢"
}

function domainStatusClass(status: ExecutiveDomainStatus): string {
  if (status === "alert") return "text-red-700"
  if (status === "watch") return "text-amber-700"
  return "text-emerald-700"
}

export function ExecutiveCenterModule() {
  const { sessionUser, isAuthReady } = useAuth()
  const { context, replaceContext } = useAnalysisNavContext("executive-center")
  const [period, setPeriod] = useState<AnalysisDateRangeValue>(() => {
    const seed = context.date?.trim()
    if (seed) {
      return resolveAnalysisDateRange({
        preset: "custom",
        dateFrom: seed,
        dateTo: seed,
      })
    }
    return createDefaultAnalysisDateRange()
  })
  const date = analysisDateRangeFocusDate(period)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const canAccess = canAccessOperationsIntelligence(sessionUser?.systemRole)
  const query = useExecutiveCenterQuery(date, isAuthReady && canAccess)
  const model = query.data?.model ?? null

  const navContext = useMemo(
    () => ({ ...context, date }),
    [context, date]
  )

  const crumbs = useMemo(
    () =>
      buildAnalysisBreadcrumb({
        currentStep: "executive-center",
        context: navContext,
      }),
    [navContext]
  )

  function handlePeriodChange(next: AnalysisDateRangeValue) {
    setPeriod(next)
    replaceContext({ date: analysisDateRangeFocusDate(next) })
    setExportMessage(null)
  }

  function handleExport(format: "pdf" | "share" | "print") {
    if (!model) return
    const result = prepareExecutiveCenterExport({ format, model })
    setExportMessage(result.message)
  }

  function linkTo(bareHref: string) {
    return contextualizeAnalysisHref(bareHref, navContext, "executive-center")
  }

  if (!isAuthReady) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando sesión…
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        Solo administración, supervisión y gerencia pueden acceder al Centro
        Ejecutivo.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <AnalysisBreadcrumb crumbs={crumbs} className="mb-3" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Compass
                className="size-6"
                style={{ color: moduleColorVar("intelligence") }}
              />
              <h1 className="text-2xl font-semibold tracking-tight">
                Centro Ejecutivo
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              ¿Qué necesita mi atención ahora?
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="executive-center-period">Período</Label>
              <AnalysisDateRangePicker
                id="executive-center-period"
                value={period}
                onChange={handlePeriodChange}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <MoreHorizontal className="size-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <Download className="size-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("share")}>
                  <Share2 className="size-4" />
                  Compartir
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("print")}>
                  <Printer className="size-4" />
                  Impresión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {exportMessage ? (
          <p className="mt-3 text-xs text-muted-foreground">{exportMessage}</p>
        ) : null}
      </header>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Preparando prioridades del día…
        </div>
      ) : null}

      {query.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error instanceof Error
            ? query.error.message
            : "No se pudo cargar el Centro Ejecutivo."}
        </div>
      ) : null}

      {model ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Atención inmediata
            </h2>
            {model.attention.length === 0 ? (
              <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                No hay prioridades críticas en este momento.
              </p>
            ) : (
              <div className="space-y-3">
                {model.attention.map((item) => (
                  <article
                    key={item.id}
                    className={cn(
                      "rounded-xl border p-4 shadow-sm",
                      severityClass(item.severity)
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium">
                          {severityDot(item.severity)} {item.severityLabel}
                        </p>
                        <p className="text-sm font-medium leading-snug">
                          {item.title}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={linkTo(item.href)}>
                          {item.hrefLabel}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Lo mejor de la jornada
            </h2>
            {model.wins.length === 0 ? (
              <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                Todavía no hay logros destacados para esta fecha.
              </p>
            ) : (
              <div className="space-y-3">
                {model.wins.map((win) => (
                  <article
                    key={win.id}
                    className="rounded-xl border bg-card p-4 text-sm shadow-sm"
                  >
                    {win.title}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Estado general
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {model.domains.map((domain) => (
                <Link
                  key={domain.id}
                  href={linkTo(domain.href)}
                  className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-foreground/20"
                >
                  <p className="text-sm font-semibold tracking-tight">
                    {domain.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium",
                      domainStatusClass(domain.status)
                    )}
                  >
                    {domain.statusLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tendencia: {domain.trendLabel}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {domain.primaryLabel}
                  </p>
                  <p className="text-lg font-semibold tracking-tight">
                    {domain.primaryValue}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Decisiones sugeridas
            </h2>
            <div className="space-y-3">
              {model.decisions.map((decision) => (
                <article
                  key={decision.id}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="max-w-2xl text-sm leading-relaxed">
                      {decision.recommendation}
                    </p>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={linkTo(decision.href)}>
                        {decision.hrefLabel}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
