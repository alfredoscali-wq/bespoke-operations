"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"

import { AutomaticReportsHistoryPanel } from "@/components/reportes/automatic/automatic-reports-history-panel"
import { AutomaticReportsSettingsPanel } from "@/components/configuracion/automatic-reports-settings-panel"
import { WeeklyAutomaticReportCard } from "@/components/reportes/automatic/weekly-automatic-report-card"
import { ReportesSectionNav } from "@/components/reportes/reportes-section-nav"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const automaticReportTabs = ["resumen", "historial", "configuracion"] as const

type AutomaticReportTab = (typeof automaticReportTabs)[number]

function resolveAutomaticReportTab(value: string | null): AutomaticReportTab {
  if (value && automaticReportTabs.includes(value as AutomaticReportTab)) {
    return value as AutomaticReportTab
  }

  return "resumen"
}

export function AutomaticReportsModule() {
  const searchParams = useSearchParams()
  const defaultTab = useMemo(
    () => resolveAutomaticReportTab(searchParams.get("tab")),
    [searchParams]
  )

  return (
    <div className="space-y-6">
      <ReportesSectionNav />

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Reportes Automáticos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generación programada y manual del reporte semanal ejecutivo.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <TabsList variant="line" className="w-full min-w-max justify-start">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <WeeklyAutomaticReportCard />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <AutomaticReportsHistoryPanel />
        </TabsContent>

        <TabsContent value="configuracion" className="mt-4">
          <AutomaticReportsSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
