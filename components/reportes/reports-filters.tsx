"use client"

import { useState } from "react"

import { AnalysisDateRangePicker } from "@/lib/analysis/components/analysis-date-range-picker"
import {
  analysisDateRangeToReportFilters,
  createDefaultAnalysisDateRange,
  reportFiltersToAnalysisDateRange,
  resolveAnalysisDateRange,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range"
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
import { useReports } from "@/components/reportes/reports-provider"
import {
  DEFAULT_REPORT_FILTERS,
  type ReportFilters,
} from "@/lib/reports/report-filters"
import { WORK_ORDER_SERVICE_TYPE_OPTIONS } from "@/lib/tasks/work-order"

function normalizeOptionalFilter(value: string): string | undefined {
  return value === "all" ? undefined : value
}

function toPickerValue(filters: ReportFilters): AnalysisDateRangeValue {
  const mapped = reportFiltersToAnalysisDateRange(filters)
  if (mapped.preset === "custom" && mapped.dateFrom && mapped.dateTo) {
    // URL/custom seeds show the concrete range label.
    return mapped
  }
  if (mapped.preset !== "custom") {
    return resolveAnalysisDateRange({ preset: mapped.preset })
  }
  return createDefaultAnalysisDateRange()
}

export function ReportsFilters() {
  const { filters, setFilters, localityOptions, crews } = useReports()
  const [period, setPeriod] = useState<AnalysisDateRangeValue>(() =>
    toPickerValue(filters)
  )

  function update<K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K]
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function handlePeriodChange(next: AnalysisDateRangeValue) {
    setPeriod(next)
    setFilters((current) => analysisDateRangeToReportFilters(next, current))
  }

  return (
    <QuickFilterBar>
      <QuickFilterField label="Período">
        <AnalysisDateRangePicker
          id="reportes-period"
          value={period}
          onChange={handlePeriodChange}
          triggerClassName="w-full"
        />
      </QuickFilterField>

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
          onClick={() => {
            const next = createDefaultAnalysisDateRange()
            setPeriod(next)
            setFilters(
              analysisDateRangeToReportFilters(next, DEFAULT_REPORT_FILTERS)
            )
          }}
        >
          Restablecer
        </button>
      </QuickFilterField>
    </QuickFilterBar>
  )
}
