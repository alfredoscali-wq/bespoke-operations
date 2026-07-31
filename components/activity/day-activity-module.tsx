"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { BookOpen, Download, Loader2, MoreHorizontal, Printer } from "lucide-react"

import { DayGestionCard } from "@/components/activity/day-gestion-card"
import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import {
  ACTIVITY_TIMELINE_PAGE_SIZE,
  type ActivityTimelineEvent,
} from "@/lib/activity/activity-timeline-types"
import {
  exportDayActivityExecutivePdf,
  exportDayActivityGestionesCsv,
} from "@/lib/activity/day-activity-export"
import {
  DAY_ACTIVITY_PERIOD_OPTIONS,
  getDayActivityPeriodCopy,
  getDayActivityPeriodStoreServerSnapshot,
  getDayActivityPeriodStoreSnapshot,
  resolveDayActivityPeriodRange,
  saveDayActivityPeriodSelection,
  subscribeDayActivityPeriodStore,
  type DayActivityPeriodPreset,
} from "@/lib/activity/day-activity-period"
import {
  DAY_ACTIVITY_QUICK_FILTERS,
  matchesDayActivityFilter,
  type DayActivityFilterId,
} from "@/lib/activity/day-activity-ux"
import {
  buildDayGestiones,
  collectCustomerIdsFromEvents,
  type DayGestion,
} from "@/lib/activity/day-gestiones"
import { fetchActivityTimeline } from "@/lib/activity/fetch-activity-timeline.client"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { buildExecutiveBrief, type ExecutiveBrief } from "@/lib/executive"
import { indicatorCount, INDICATOR_IDS } from "@/lib/indicators"
import { useAuth } from "@/components/auth/auth-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import { listEmployees } from "@/lib/supabase/employees.browser"
import { createClient } from "@/lib/supabase/client"
import type { Employee } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const NONE_VALUE = "__none__"

type ExecutiveKpi = {
  id: DayActivityFilterId
  label: string
  value: number
}

async function fetchAllEmployeePeriodEvents(
  employeeId: string,
  dateFromInput: string,
  dateToInput: string
): Promise<
  | { success: true; items: ActivityTimelineEvent[] }
  | { success: false; message: string }
> {
  const dateFrom = toTimelineDateFromInput(dateFromInput)
  const dateTo = toTimelineDateToInput(dateToInput)
  const items: ActivityTimelineEvent[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const result = await fetchActivityTimeline({
      scope: "employee",
      employeeId,
      dateFrom,
      dateTo,
      order: "ASC",
      limit: ACTIVITY_TIMELINE_PAGE_SIZE,
      offset,
      includeStats: false,
    })
    if (!result.success) {
      return { success: false, message: result.message }
    }
    const seen = new Set(items.map((item) => item.id))
    for (const item of result.data.items) {
      if (!seen.has(item.id)) items.push(item)
    }
    hasMore = result.data.hasMore
    offset = items.length
    if (result.data.items.length === 0) break
  }

  return { success: true, items }
}

async function resolveCustomerNames(
  customerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (customerIds.length === 0) return map

  const client = createClient()
  const { data, error } = await client
    .from("customers")
    .select("id, name")
    .in("id", customerIds)

  if (error || !data) return map
  for (const row of data) {
    if (typeof row.id === "string" && typeof row.name === "string") {
      map.set(row.id, row.name)
    }
  }
  return map
}

function formatActiveTime(ms: number): string {
  if (ms <= 0) return "—"
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours}h ${String(minutes).padStart(2, "0")}m`
}

function formatStamp(value: string | null): string {
  if (!value) return "—"
  return formatActivityTimelineTime(value)
}

function resolvePeriodStatus(
  brief: ExecutiveBrief,
  scopeNoun: string
): string {
  if (brief.operationalAlerts.length > 0) return "Con pendientes"
  if (brief.generalState.some((item) => item.value > 0) || brief.firstEventAt) {
    return scopeNoun === "día" ? "Activa" : "Con actividad"
  }
  return "Sin actividad"
}

function buildExecutiveKpis(brief: ExecutiveBrief): ExecutiveKpi[] {
  const get = (id: string) => indicatorCount(brief.snapshot, id)
  const attended = get(INDICATOR_IDS.ATTENTIONS_CREATED)
  const resolved = get(INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const pending = Math.max(0, attended - resolved)

  return [
    { id: "all", label: "Consultas atendidas", value: attended },
    { id: "resolved", label: "Resueltas", value: resolved },
    { id: "pending", label: "Pendientes", value: pending },
    {
      id: "transferred",
      label: "Derivadas",
      value: get(INDICATOR_IDS.ATTENTIONS_TRANSFERRED),
    },
    {
      id: "workorders",
      label: "OT generadas",
      value: get(INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED),
    },
    {
      id: "retentions",
      label: "Retenciones",
      value: get(INDICATOR_IDS.RETENTIONS),
    },
    {
      id: "sales",
      label: "Ventas",
      value: get(INDICATOR_IDS.COMMERCIAL_COMPLETED),
    },
    {
      id: "new_customers",
      label: "Clientes nuevos",
      value: get(INDICATOR_IDS.CUSTOMERS_CREATED),
    },
  ]
}

function buildProductionNarrative(
  employeeName: string,
  brief: ExecutiveBrief,
  narrativePrefix: string
): string {
  const get = (id: string) => indicatorCount(brief.snapshot, id)
  const attended = get(INDICATOR_IDS.ATTENTIONS_CREATED)
  const resolved = get(INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const transferred = get(INDICATOR_IDS.ATTENTIONS_TRANSFERRED)
  const ot = get(INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED)
  const retentions = get(INDICATOR_IDS.RETENTIONS)
  const sales = get(INDICATOR_IDS.COMMERCIAL_COMPLETED)
  const customers = get(INDICATOR_IDS.CUSTOMERS_CREATED)

  const clauses: string[] = []
  if (attended > 0) {
    clauses.push(
      `atendió ${attended} consulta${attended === 1 ? "" : "s"}`
    )
  }
  if (resolved > 0) clauses.push(`resolvió ${resolved}`)
  if (transferred > 0) {
    clauses.push(`derivó ${transferred} al área correspondiente`)
  }
  if (ot > 0) {
    clauses.push(
      `generó ${ot} orden${ot === 1 ? "" : "es"} de trabajo`
    )
  }
  if (retentions > 0) {
    clauses.push(
      `registró ${retentions} retención${retentions === 1 ? "" : "es"}`
    )
  }
  if (sales > 0) {
    clauses.push(`concretó ${sales} venta${sales === 1 ? "" : "s"}`)
  }
  if (customers > 0) {
    clauses.push(
      `incorporó ${customers} cliente${customers === 1 ? "" : "s"} nuevo${customers === 1 ? "" : "s"}`
    )
  }

  if (clauses.length === 0) {
    return `${narrativePrefix} ${employeeName} no registró producción relevante.`
  }
  if (clauses.length === 1) {
    return `${narrativePrefix} ${employeeName} ${clauses[0]}.`
  }
  const last = clauses[clauses.length - 1]!
  const head = clauses.slice(0, -1).join(", ")
  return `${narrativePrefix} ${employeeName} ${head} y ${last}.`
}

function formatRangeLabel(fromInput: string, toInput: string): string {
  if (fromInput === toInput) {
    return formatActivityTimelineDate(`${fromInput}T12:00:00`) || fromInput
  }
  const from =
    formatActivityTimelineDate(`${fromInput}T12:00:00`) || fromInput
  const to = formatActivityTimelineDate(`${toInput}T12:00:00`) || toInput
  return `${from} → ${to}`
}

export function DayActivityModule() {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const allowed = canAccessOperationsIntelligence(sessionUser?.systemRole)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState("")
  const period = useSyncExternalStore(
    subscribeDayActivityPeriodStore,
    getDayActivityPeriodStoreSnapshot,
    getDayActivityPeriodStoreServerSnapshot
  )
  const [gestiones, setGestiones] = useState<DayGestion[]>([])
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] =
    useState<DayActivityFilterId>("all")

  const periodRange = useMemo(
    () => resolveDayActivityPeriodRange(period),
    [period]
  )
  const periodCopy = useMemo(
    () => getDayActivityPeriodCopy(period, periodRange),
    [period, periodRange]
  )

  useEffect(() => {
    if (!companyId || !allowed || !isAuthReady) return
    let cancelled = false
    void listEmployees(companyId).then((result) => {
      if (cancelled) return
      if (result.error || !result.data) {
        setEmployees([])
        return
      }
      setEmployees(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [allowed, companyId, isAuthReady])

  useEffect(() => {
    if (!allowed || !employeeId) return

    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setIsLoading(true)
      setError(null)
      setActiveFilter("all")

      const result = await fetchAllEmployeePeriodEvents(
        employeeId,
        periodRange.dateFromInput,
        periodRange.dateToInput
      )
      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setGestiones([])
        setBrief(null)
        setIsLoading(false)
        return
      }

      const employee = employees.find((item) => item.id === employeeId)
      const name = employee ? getEmployeeDisplayName(employee) : undefined

      const nextBrief = buildExecutiveBrief({
        scope: {
          kind: "employee",
          id: employeeId,
          label: name,
        },
        date: periodRange.dateToInput,
        events: result.items,
      })

      const customerIds = collectCustomerIdsFromEvents(result.items)
      const customerNames = await resolveCustomerNames(customerIds)
      if (cancelled) return

      const employeeNames = new Map<string, string>()
      if (name) employeeNames.set(employeeId, name)

      setBrief(nextBrief)
      setGestiones(
        buildDayGestiones(result.items, {
          customers: customerNames,
          employees: employeeNames,
        })
      )
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [
    allowed,
    employeeId,
    employees,
    periodRange.dateFromInput,
    periodRange.dateToInput,
  ])

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === employeeId) ?? null,
    [employeeId, employees]
  )

  const showResults = Boolean(employeeId && brief && !isLoading)
  const displayBrief = employeeId ? brief : null
  const kpis = displayBrief ? buildExecutiveKpis(displayBrief) : []

  const filteredGestiones = useMemo(() => {
    const source = employeeId ? gestiones : []
    if (activeFilter === "all") return source
    return source.filter((gestion) =>
      matchesDayActivityFilter(gestion, activeFilter)
    )
  }, [activeFilter, employeeId, gestiones])

  const totalGestiones = employeeId ? gestiones.length : 0
  const employeeName = selectedEmployee
    ? getEmployeeDisplayName(selectedEmployee)
    : "El empleado"

  const productionNarrative =
    displayBrief != null
      ? buildProductionNarrative(
          employeeName,
          displayBrief,
          periodCopy.narrativePrefix
        )
      : null

  const activeFilterLabel =
    DAY_ACTIVITY_QUICK_FILTERS.find((item) => item.id === activeFilter)
      ?.label ?? ""

  function toggleFilter(next: DayActivityFilterId) {
    setActiveFilter((current) => (current === next ? "all" : next))
  }

  function updatePreset(preset: DayActivityPeriodPreset) {
    saveDayActivityPeriodSelection({
      ...period,
      preset,
      customFrom:
        preset === "custom"
          ? period.customFrom || periodRange.dateFromInput
          : period.customFrom,
      customTo:
        preset === "custom"
          ? period.customTo || periodRange.dateToInput
          : period.customTo,
    })
  }

  function handleExportPdf() {
    if (!displayBrief || !productionNarrative) return
    exportDayActivityExecutivePdf({
      employeeName,
      periodLabel: periodCopy.periodLabel,
      periodRangeLabel: formatRangeLabel(
        periodRange.dateFromInput,
        periodRange.dateToInput
      ),
      productionTitle: periodCopy.productionTitle,
      statusLabel: resolvePeriodStatus(displayBrief, periodCopy.scopeNoun),
      startedAt: formatStamp(displayBrief.firstEventAt),
      lastActivityAt: formatStamp(displayBrief.lastEventAt),
      activeTimeLabel: formatActiveTime(displayBrief.activeTimeMs),
      briefNarrative: displayBrief.narrative,
      productionNarrative,
      kpis: kpis.map((kpi) => ({ label: kpi.label, value: kpi.value })),
      gestiones: filteredGestiones,
      filterLabel: activeFilter === "all" ? "" : activeFilterLabel,
    })
  }

  function handleExportCsv() {
    exportDayActivityGestionesCsv(filteredGestiones, {
      employeeName,
      periodLabel: periodCopy.periodLabel,
    })
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
        <BookOpen className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Actividad de la Jornada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administración, supervisión y gerencia pueden acceder.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 print:max-w-none">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Actividad de la Jornada
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ¿Cómo trabajó esta persona en el período?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <MoreHorizontal className="size-3.5" />
                Más acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showResults ? (
                <>
                  <DropdownMenuItem onClick={handleExportPdf}>
                    <Download className="mr-2 size-3.5" />
                    Informe Ejecutivo (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()}>
                    <Printer className="mr-2 size-3.5" />
                    Imprimir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCsv}>
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href="/activity/timeline">Auditoría técnica</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        <div className="space-y-1.5">
          <Label>Empleado</Label>
          <Select
            value={employeeId || NONE_VALUE}
            onValueChange={(value) =>
              setEmployeeId(value === NONE_VALUE ? "" : value)
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Seleccionar empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Seleccionar…</SelectItem>
              {[...employees]
                .sort((a, b) =>
                  getEmployeeDisplayName(a).localeCompare(
                    getEmployeeDisplayName(b),
                    "es"
                  )
                )
                .map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {getEmployeeDisplayName(employee)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Período</Label>
          <Select
            value={period.preset}
            onValueChange={(value) =>
              updatePreset(value as DayActivityPeriodPreset)
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_ACTIVITY_PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {period.preset === "custom" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="jornada-from">Desde</Label>
              <Input
                id="jornada-from"
                type="date"
                className="h-9 bg-background"
                value={period.customFrom || periodRange.dateFromInput}
                onChange={(event) =>
                  saveDayActivityPeriodSelection({
                    ...period,
                    preset: "custom",
                    customFrom: event.target.value,
                    customTo: period.customTo || periodRange.dateToInput,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jornada-to">Hasta</Label>
              <Input
                id="jornada-to"
                type="date"
                className="h-9 bg-background"
                value={period.customTo || periodRange.dateToInput}
                onChange={(event) =>
                  saveDayActivityPeriodSelection({
                    ...period,
                    preset: "custom",
                    customFrom: period.customFrom || periodRange.dateFromInput,
                    customTo: event.target.value,
                  })
                }
              />
            </div>
          </>
        ) : null}
      </div>

      {!employeeId ? (
        <p className="text-sm text-muted-foreground print:hidden">
          Seleccioná un empleado para ver cómo trabajó en el período.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive print:hidden">
          {error}
        </div>
      ) : null}

      {employeeId && isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
          <Loader2 className="size-4 animate-spin" />
          Cargando actividad…
        </div>
      ) : null}

      {showResults && displayBrief ? (
        <article className="space-y-8" data-report="day-activity">
          <section
            className="space-y-4 rounded-xl border bg-card px-5 py-4 shadow-sm"
            data-report-section="executive-panel"
          >
            <header>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Panel ejecutivo
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {displayBrief.narrative}
              </p>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <HeaderField label="Empleado" value={employeeName} />
              <HeaderField
                label="Período"
                value={formatRangeLabel(
                  periodRange.dateFromInput,
                  periodRange.dateToInput
                )}
              />
              <HeaderField
                label="Estado"
                value={resolvePeriodStatus(
                  displayBrief,
                  periodCopy.scopeNoun
                )}
              />
              <HeaderField
                label="Hora de inicio"
                value={formatStamp(displayBrief.firstEventAt)}
              />
              <HeaderField
                label="Última actividad"
                value={formatStamp(displayBrief.lastEventAt)}
              />
              <HeaderField
                label="Tiempo activo"
                value={formatActiveTime(displayBrief.activeTimeMs)}
              />
            </div>
            {selectedEmployee ? (
              <Button
                asChild
                variant="link"
                className="h-auto px-0 text-sm print:hidden"
              >
                <Link href={`/rrhh/${selectedEmployee.id}`}>Ver empleado</Link>
              </Button>
            ) : null}
          </section>

          <section className="space-y-3" data-report-section="kpis">
            <h2 className="text-sm font-semibold tracking-tight">
              {periodCopy.productionTitle}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {kpis.map((kpi) => {
                const isActive =
                  kpi.id === "all"
                    ? activeFilter === "all"
                    : activeFilter === kpi.id
                return (
                  <button
                    key={kpi.id}
                    type="button"
                    onClick={() => {
                      if (kpi.id === "all") {
                        setActiveFilter("all")
                        return
                      }
                      toggleFilter(kpi.id)
                    }}
                    className={cn(
                      "rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors",
                      "hover:bg-muted/40 print:hover:bg-card",
                      isActive
                        ? "border-foreground/40 ring-1 ring-foreground/20"
                        : null
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                      {kpi.value}
                    </p>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground print:hidden">
              Tocá un indicador para filtrar las gestiones. Tocá de nuevo para
              ver todas.
            </p>
          </section>

          {productionNarrative ? (
            <section
              className="rounded-xl border bg-muted/30 px-5 py-4"
              data-report-section="production-summary"
            >
              <h2 className="text-sm font-semibold tracking-tight">
                Resumen de producción
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {productionNarrative}
              </p>
            </section>
          ) : null}

          <section
            className="space-y-2 print:hidden"
            data-report-section="filters"
          >
            <div className="flex flex-wrap gap-2">
              {DAY_ACTIVITY_QUICK_FILTERS.map((filter) => {
                const selected = activeFilter === filter.id
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => {
                      if (filter.id === "all") {
                        setActiveFilter("all")
                        return
                      }
                      toggleFilter(filter.id)
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-3" data-report-section="activity-list">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Gestiones realizadas
              </h2>
              <p className="text-xs text-muted-foreground">
                {activeFilter === "all"
                  ? `${totalGestiones} en el período`
                  : `${filteredGestiones.length} de ${totalGestiones} · filtro activo`}
              </p>
            </div>
            {filteredGestiones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay gestiones para este filtro.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredGestiones.map((gestion) => (
                  <DayGestionCard key={gestion.id} gestion={gestion} />
                ))}
              </div>
            )}
          </section>
        </article>
      ) : null}
    </div>
  )
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
