"use client"

import { CheckCircle2, ClipboardList, Headset, ShieldCheck, UserPlus } from "lucide-react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  ATENCION_CLIENTE_KPI_LABELS,
  ATENCION_CLIENTE_KPI_ORDER,
  ATENCION_CLIENTE_KPI_TONE,
  getAtencionClienteKpiValue,
  mapKpiKeyToDashboardFilter,
  type AtencionClienteDashboardFilter,
} from "@/lib/customer-seguimientos/kpis"

const KPI_ICONS = {
  atenciones_hoy: Headset,
  resueltas: CheckCircle2,
  seguimientos_pendientes: ClipboardList,
  retenciones_activas: ShieldCheck,
  recuperos_hoy: UserPlus,
} as const

type AtencionClienteSummaryProps = {
  dashboardFilter: AtencionClienteDashboardFilter
  onDashboardFilterChange: (filter: AtencionClienteDashboardFilter) => void
}

export function AtencionClienteSummary({
  dashboardFilter,
  onDashboardFilterChange,
}: AtencionClienteSummaryProps) {
  const { dashboardSummary, isDashboardLoading } = useAtencionCliente()

  return (
    <KpiCardGrid layout="standard">
      {ATENCION_CLIENTE_KPI_ORDER.map((kpi) => {
        const Icon = KPI_ICONS[kpi]
        const activeFilter = mapKpiKeyToDashboardFilter(kpi, dashboardFilter)

        return (
          <FilterableKpiCard
            key={kpi}
            label={ATENCION_CLIENTE_KPI_LABELS[kpi]}
            value={
              isDashboardLoading
                ? "…"
                : getAtencionClienteKpiValue(dashboardSummary, kpi)
            }
            icon={Icon}
            tone={ATENCION_CLIENTE_KPI_TONE[kpi]}
            isActive={activeFilter !== "none"}
            isLoading={isDashboardLoading}
            onClick={() => onDashboardFilterChange(activeFilter)}
          />
        )
      })}
    </KpiCardGrid>
  )
}
