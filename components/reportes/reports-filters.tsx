"use client"

import { Input } from "@/components/ui/input"
import {
  QuickFilterBar,
  QuickFilterField,
} from "@/components/ui/quick-filter-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useReports } from "@/components/reportes/reports-provider"
import {
  DEFAULT_REPORT_FILTERS,
  type ReportFilters,
  type ReportPeriod,
} from "@/lib/reports/report-filters"
import { formatReportPeriodLabel } from "@/lib/reports/report-utils"
import { WORK_ORDER_SERVICE_TYPE_OPTIONS } from "@/lib/tasks/work-order"

const PERIOD_OPTIONS: ReportPeriod[] = [
  "today",
  "week",
  "month",
  "last30",
  "custom",
]

function normalizeOptionalFilter(value: string): string | undefined {
  return value === "all" ? undefined : value
}

export function ReportsFilters() {
  const { filters, setFilters, localityOptions } = useReports()
  const { crews } = useCrews()

  function update<K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K]
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <QuickFilterBar>
      <QuickFilterField label="Período">
        <Select
          value={filters.period}
          onValueChange={(value) =>
            update("period", value as ReportPeriod)
          }
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((period) => (
              <SelectItem key={period} value={period}>
                {formatReportPeriodLabel(period)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </QuickFilterField>

      {filters.period === "custom" ? (
        <>
          <QuickFilterField label="Desde">
            <Input
              type="date"
              value={filters.startDate ?? ""}
              onChange={(event) => update("startDate", event.target.value)}
              className="h-9 bg-background"
            />
          </QuickFilterField>
          <QuickFilterField label="Hasta">
            <Input
              type="date"
              value={filters.endDate ?? ""}
              onChange={(event) => update("endDate", event.target.value)}
              className="h-9 bg-background"
            />
          </QuickFilterField>
        </>
      ) : null}

      <QuickFilterField label="Cuadrilla">
        <Select
          value={filters.crewId ?? "all"}
          onValueChange={(value) =>
            update("crewId", normalizeOptionalFilter(value))
          }
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todas las cuadrillas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuadrillas</SelectItem>
            {[...crews]
              .sort((left, right) =>
                left.name.localeCompare(right.name, "es")
              )
              .map((crew) => (
                <SelectItem key={crew.id} value={crew.id}>
                  {crew.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </QuickFilterField>

      <QuickFilterField label="Tipo de trabajo">
        <Select
          value={filters.serviceType ?? "all"}
          onValueChange={(value) =>
            update("serviceType", normalizeOptionalFilter(value))
          }
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {WORK_ORDER_SERVICE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </QuickFilterField>

      <QuickFilterField label="Localidad">
        <Select
          value={filters.locality ?? "all"}
          onValueChange={(value) =>
            update("locality", normalizeOptionalFilter(value))
          }
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todas las localidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las localidades</SelectItem>
            {localityOptions.map((locality) => (
              <SelectItem key={locality} value={locality}>
                {locality}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </QuickFilterField>

      <QuickFilterField label="Acciones" className="min-w-[120px] flex-none">
        <button
          type="button"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          onClick={() => setFilters(DEFAULT_REPORT_FILTERS)}
        >
          Restablecer
        </button>
      </QuickFilterField>
    </QuickFilterBar>
  )
}
