"use client"

import { useMemo, useState } from "react"
import {
  Download,
  Factory,
  Loader2,
  MoreHorizontal,
  Printer,
  Share2,
} from "lucide-react"

import { AnalysisBreadcrumb } from "@/components/analysis/analysis-breadcrumb"
import { useAnalysisNavContext } from "@/components/analysis/use-analysis-nav-context"
import { CrewsDossierView } from "@/components/activity/crews-dossier-view"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { AnalysisDateRangePicker } from "@/lib/analysis/components/analysis-date-range-picker"
import { prepareCrewsExport } from "@/lib/analysis/crews/export"
import {
  createDefaultAnalysisDateRange,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range"
import { useCrewsQuery } from "@/lib/analysis/react-query"
import {
  buildAnalysisBreadcrumb,
  hrefPlanning,
} from "@/lib/analysis/smart-navigation"
import { moduleColorVar } from "@/lib/ui/module-colors"

export function CrewsModule() {
  const { sessionUser, isAuthReady } = useAuth()
  const { context, replaceContext } = useAnalysisNavContext("cuadrillas")
  const [period, setPeriod] = useState<AnalysisDateRangeValue>(() =>
    createDefaultAnalysisDateRange()
  )
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(
    () => context.crewId?.trim() || null
  )
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const canAccess = canAccessOperationsIntelligence(sessionUser?.systemRole)
  const query = useCrewsQuery(period, Boolean(isAuthReady && canAccess))

  const model = query.data?.model ?? null
  const dossier =
    model && selectedCrewId
      ? model.dossiersByCrewId[selectedCrewId] ?? null
      : null

  const navContext = useMemo(
    () => ({
      ...context,
      date: model?.period.focusDate ?? context.date,
      crewId: selectedCrewId ?? undefined,
      crewName: dossier?.crewName ?? context.crewName,
    }),
    [context, model?.period.focusDate, selectedCrewId, dossier?.crewName]
  )

  const crumbs = useMemo(
    () =>
      buildAnalysisBreadcrumb({
        currentStep: "cuadrillas",
        context: navContext,
        leafLabel: dossier?.crewName,
      }),
    [navContext, dossier?.crewName]
  )

  function selectCrew(crewId: string, crewName: string) {
    setSelectedCrewId(crewId)
    replaceContext({
      date: model?.period.focusDate,
      crewId,
      crewName,
    })
  }

  function clearCrew() {
    setSelectedCrewId(null)
    replaceContext({
      date: model?.period.focusDate,
      crewId: "",
      crewName: "",
    })
  }

  function planningHref(taskId: string) {
    return hrefPlanning({ ...navContext, taskId }, "cuadrillas")
  }

  function handleExport(format: "pdf" | "csv" | "print" | "share") {
    if (!model) return
    const result = prepareCrewsExport({
      format,
      model,
      selectedCrewId,
    })
    setExportMessage(result.message)
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
        Solo administración, supervisión y gerencia pueden acceder a Cuadrillas.
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
              <Factory
                className="size-6"
                style={{ color: moduleColorVar("work") }}
              />
              <h1 className="text-2xl font-semibold tracking-tight">
                Cuadrillas
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Expediente operativo completo de cada equipo de trabajo.
            </p>
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
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <Download className="size-4" />
                CSV
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
        {exportMessage ? (
          <p className="mt-3 text-xs text-muted-foreground">{exportMessage}</p>
        ) : null}
      </header>

      {!dossier ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="crews-period">Período</Label>
              <AnalysisDateRangePicker
                id="crews-period"
                value={period}
                onChange={(next) => {
                  setPeriod(next)
                  setSelectedCrewId(null)
                }}
              />
            </div>
          </div>

          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando cuadrillas…
            </div>
          ) : null}

          {query.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {query.error instanceof Error
                ? query.error.message
                : "No se pudo cargar Cuadrillas."}
            </div>
          ) : null}

          {model ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Ranking de Cuadrillas
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuadrilla</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead className="text-right">Cumplimiento</TableHead>
                      <TableHead className="text-right">Min/OT</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.ranking.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No hay cuadrillas para el período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      model.ranking.map((row) => (
                        <TableRow key={row.crewId}>
                          <TableCell className="font-medium">
                            {row.crewName}
                          </TableCell>
                          <TableCell>{row.statusLabel}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.finishedOt}/{row.assignedOt}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.compliance}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.avgMinutesPerOt}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                selectCrew(row.crewId, row.crewName)
                              }
                            >
                              Abrir expediente →
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <div className="space-y-1">
              <Label htmlFor="crews-period-dossier">Período</Label>
              <AnalysisDateRangePicker
                id="crews-period-dossier"
                value={period}
                onChange={setPeriod}
              />
            </div>
          </div>
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Actualizando expediente…
            </div>
          ) : null}
          <CrewsDossierView
            dossier={dossier}
            period={
              model?.period ?? {
                preset: period.preset,
                dateFrom: period.dateFrom,
                dateTo: period.dateTo,
                focusDate: period.dateTo,
              }
            }
            onBack={clearCrew}
            planningHref={planningHref}
          />
        </>
      )}
    </div>
  )
}
