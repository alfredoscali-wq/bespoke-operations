"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Radar } from "lucide-react"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import { fetchOperationsIntelligence } from "@/lib/activity/fetch-operations-intelligence.client"
import {
  canAccessOperationsIntelligence,
  OPERATIONS_INTELLIGENCE_AREAS,
  type OperationsIntelligenceAreaCard,
  type OperationsIntelligenceAreaId,
  type OperationsIntelligenceSummary,
} from "@/lib/activity/operations-intelligence"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
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

const ALL_VALUE = "__all__"

const EMPTY_SUMMARY: OperationsIntelligenceSummary = {
  employeesWithActivity: 0,
  totalEvents: 0,
  firstEventAt: null,
  lastEventAt: null,
  areasWithActivity: 0,
}

function formatStamp(value: string | null): string {
  if (!value) return "—"
  return `${formatActivityTimelineDate(value)} ${formatActivityTimelineTime(value)}`
}

export function OperationsIntelligenceModule() {
  const router = useRouter()
  const { sessionUser } = useAuth()
  const allowed = canAccessOperationsIntelligence(sessionUser?.systemRole)

  const [date, setDate] = useState(() => todayDateInputValue())
  const [areaFilter, setAreaFilter] = useState<"" | OperationsIntelligenceAreaId>(
    ""
  )
  const [search, setSearch] = useState("")
  const [summary, setSummary] =
    useState<OperationsIntelligenceSummary>(EMPTY_SUMMARY)
  const [areas, setAreas] = useState<OperationsIntelligenceAreaCard[]>([])
  const [isLoading, setIsLoading] = useState(allowed)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return

    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return

      setIsLoading(true)
      setError(null)

      const result = await fetchOperationsIntelligence(date)
      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setSummary(EMPTY_SUMMARY)
        setAreas([])
        setIsLoading(false)
        return
      }

      setSummary(result.data.summary)
      setAreas(result.data.areas)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [allowed, date])

  const visibleAreas = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es")
    return areas.filter((area) => {
      if (areaFilter && area.areaId !== areaFilter) return false
      if (needle && !area.label.toLocaleLowerCase("es").includes(needle)) {
        return false
      }
      return true
    })
  }, [areaFilter, areas, search])

  const openWorkforceForArea = (areaId: OperationsIntelligenceAreaId) => {
    const params = new URLSearchParams({
      date,
      opsArea: areaId,
    })
    router.push(`/activity/workforce-monitor?${params.toString()}`)
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          Operations Intelligence
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Solo administración, supervisión y gerencia pueden acceder a este
          centro.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Radar className="size-6 text-muted-foreground" />
            Operations Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visión consolidada de la jornada por área. Datos exclusivos del
            Activity Engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/activity/workforce-monitor">Workforce Monitor</Link>
          </Button>
          {sessionUser?.systemRole === "administrador" ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/activity/timeline">Timeline Global</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Filtros</h2>
            <p className="text-xs text-muted-foreground">
              Empresa → Área → Empleado → Reporte Diario
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAreaFilter("")
              setSearch("")
            }}
          >
            Limpiar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ops-intel-date">Fecha</Label>
            <Input
              id="ops-intel-date"
              type="date"
              className="h-9 bg-background"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <Select
              value={areaFilter || ALL_VALUE}
              onValueChange={(value) =>
                setAreaFilter(
                  value === ALL_VALUE
                    ? ""
                    : (value as OperationsIntelligenceAreaId)
                )
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                {OPERATIONS_INTELLIGENCE_AREAS.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ops-intel-search">Buscador</Label>
            <Input
              id="ops-intel-search"
              className="h-9 bg-background"
              placeholder="Buscar área…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <SummaryField
          label="Empleados con actividad"
          value={isLoading ? "…" : String(summary.employeesWithActivity)}
        />
        <SummaryField
          label="Total de eventos"
          value={isLoading ? "…" : String(summary.totalEvents)}
        />
        <SummaryField
          label="Primer evento registrado"
          value={isLoading ? "…" : formatStamp(summary.firstEventAt)}
        />
        <SummaryField
          label="Último evento registrado"
          value={isLoading ? "…" : formatStamp(summary.lastEventAt)}
        />
        <SummaryField
          label="Áreas con actividad"
          value={isLoading ? "…" : String(summary.areasWithActivity)}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando Operations Intelligence…
        </div>
      ) : null}

      {!isLoading && visibleAreas.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
          No hay áreas para los filtros seleccionados.
        </div>
      ) : null}

      {!isLoading && visibleAreas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleAreas.map((area) => (
            <button
              key={area.areaId}
              type="button"
              onClick={() => openWorkforceForArea(area.areaId)}
              className={cn(
                "rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
                "hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {area.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Abrir Workforce Monitor
                  </p>
                </div>
                <span className="rounded-md border bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {area.eventCount}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Metric
                  label="Empleados activos"
                  value={String(area.activeEmployees)}
                />
                <Metric
                  label="Total eventos"
                  value={String(area.eventCount)}
                />
                <Metric
                  label="Primer evento"
                  value={formatStamp(area.firstEventAt)}
                />
                <Metric
                  label="Último evento"
                  value={formatStamp(area.lastEventAt)}
                />
                <Metric label="Clientes" value={String(area.modules.customers)} />
                <Metric
                  label="Solicitudes"
                  value={String(area.modules.requests)}
                />
                <Metric label="OT" value={String(area.modules.workOrders)} />
                <Metric
                  label="Atenciones"
                  value={String(area.modules.attentions)}
                />
                <Metric
                  label="Actividades comerciales"
                  value={String(area.modules.commercialActivities)}
                />
                <Metric label="Obras" value={String(area.modules.projects)} />
                <Metric
                  label="Configuraciones"
                  value={String(area.modules.settings)}
                />
              </dl>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-2.5 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
