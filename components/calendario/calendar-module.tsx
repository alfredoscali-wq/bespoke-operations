"use client"

import { Suspense } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { CalendarEventDetailSheet } from "@/components/calendario/calendar-event-detail-sheet"
import { CalendarKpiSheet } from "@/components/calendario/calendar-kpi-sheet"
import { CalendarLegend } from "@/components/calendario/calendar-legend"
import { CalendarOperationalAlerts } from "@/components/calendario/calendar-operational-alerts"
import { CalendarQuickFiltersBar } from "@/components/calendario/calendar-quick-filters"
import {
  CalendarProvider,
  useCalendar,
} from "@/components/calendario/calendar-provider"
import { CalendarSummaryCards } from "@/components/calendario/calendar-summary-cards"
import {
  CalendarUIProvider,
  useCalendarUI,
} from "@/components/calendario/calendar-ui-provider"
import { CalendarViewSelector } from "@/components/calendario/calendar-view-selector"
import { CalendarWeekView } from "@/components/calendario/calendar-week-view"
import { formatWeekRangeLabel } from "@/lib/calendar/calendar-utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function CalendarModuleContent() {
  const {
    weekStart,
    summary,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
  } = useCalendar()

  const { viewMode, setViewMode, quickFilters, setQuickFilters, projectFilterLabel } =
    useCalendarUI()

  return (
    <div className="space-y-8">
      {projectFilterLabel && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Calendario filtrado por obra
            </p>
            <p className="text-sm text-muted-foreground">{projectFilterLabel}</p>
          </div>
          <Link
            href="/operations/calendar"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver calendario completo
          </Link>
        </div>
      )}

      <CalendarOperationalAlerts />

      <CalendarSummaryCards summary={summary} />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Vista semanal
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatWeekRangeLabel(weekStart)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
                className="gap-1"
              >
                <ChevronLeft className="size-4" />
                Semana anterior
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
                className="gap-1"
              >
                Semana siguiente
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <CalendarViewSelector value={viewMode} onChange={setViewMode} />
        </CardHeader>

        <CardContent className="space-y-5 px-6 py-5">
          <CalendarQuickFiltersBar
            filters={quickFilters}
            onChange={setQuickFilters}
          />
          <CalendarLegend />
          <CalendarWeekView />
        </CardContent>
      </Card>

      <CalendarEventDetailSheet />
      <CalendarKpiSheet />
    </div>
  )
}

export function CalendarModule() {
  return (
    <CalendarProvider>
      <Suspense fallback={null}>
        <CalendarUIProvider>
          <CalendarModuleContent />
        </CalendarUIProvider>
      </Suspense>
    </CalendarProvider>
  )
}
