"use client"

import {
  ClipboardList,
  Clock3,
  Headset,
  Radio,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useEmployeeReports } from "@/components/reportes/empleado/employee-reports-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import type { VisualTone } from "@/lib/ui/visual-tokens"

const KPI_ICONS: Record<string, LucideIcon> = {
  ot_asignadas: ClipboardList,
  ot_finalizadas: ShieldCheck,
  ot_pendientes: Clock3,
  ot_canceladas: ClipboardList,
  ot_reprogramadas: Clock3,
  ot_vencidas: Clock3,
  tiempo_promedio_ot: Clock3,
  incidencias_creadas: Wrench,
  pendientes_cierre: Clock3,
  ot_fibra: Radio,
  ot_wireless: Radio,
  instalaciones: Wrench,
  services: Wrench,
  cambios_domicilio: Wrench,
  cambios_tecnologia: Radio,
  consultas: Headset,
  resueltas: ShieldCheck,
  pendientes: Clock3,
  derivadas: ClipboardList,
  ot_generadas: ClipboardList,
  retenciones: ShieldCheck,
  ventas_derivadas: Users,
  tiempo_promedio: Clock3,
  clientes_contactados: Users,
  ventas_cerradas: ShieldCheck,
  ventas_perdidas: ClipboardList,
  monto_vendido: ClipboardList,
  conversion: ClipboardList,
  tiempo_promedio_cierre: Clock3,
  clientes_derivados: Users,
  empleados_creados: Users,
  usuarios_activados: Users,
  disponibilidades_cargadas: ClipboardList,
  cuadrillas_administradas: Users,
  ot_aprobadas: ShieldCheck,
  ot_rechazadas: ClipboardList,
  tiempo_promedio_aprobacion: Clock3,
}

const KPI_TONES: Record<string, VisualTone> = {
  ot_finalizadas: "green",
  resueltas: "green",
  ventas_cerradas: "green",
  ot_aprobadas: "green",
  ot_vencidas: "amber",
  pendientes_cierre: "amber",
  pendientes: "amber",
  ot_canceladas: "neutral",
  ot_rechazadas: "orange",
  incidencias_creadas: "orange",
  consultas: "blue",
  ot_asignadas: "blue",
}

export function EmployeeReportKpiSection() {
  const { report, isLoading, activeKpiKey, setActiveKpiKey } =
    useEmployeeReports()

  if (!isLoading && (!report || report.kpis.length === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay indicadores específicos para el área de este empleado en el
        período seleccionado.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Indicadores del área
          </h3>
          <p className="text-xs text-muted-foreground">
            Hacé click en un KPI para filtrar el listado inferior.
          </p>
        </div>
        {activeKpiKey ? (
          <button
            type="button"
            className="text-xs text-primary hover:underline print:hidden"
            onClick={() => setActiveKpiKey(null)}
          >
            Limpiar filtro
          </button>
        ) : null}
      </div>

      <KpiCardGrid layout="operational">
        {(report?.kpis ?? Array.from({ length: 8 }).map((_, index) => ({
          key: `skeleton-${index}`,
          label: "…",
          value: "—",
          numericValue: 0,
        }))).map((item) => {
          const Icon = KPI_ICONS[item.key] ?? ClipboardList
          const isActive = activeKpiKey === item.key

          return (
            <FilterableKpiCard
              key={item.key}
              label={item.label}
              value={item.value}
              icon={Icon}
              tone={KPI_TONES[item.key] ?? "neutral"}
              compact
              isLoading={isLoading}
              isActive={isActive}
              onClick={() =>
                setActiveKpiKey((current) =>
                  current === item.key ? null : item.key
                )
              }
            />
          )
        })}
      </KpiCardGrid>
    </div>
  )
}
