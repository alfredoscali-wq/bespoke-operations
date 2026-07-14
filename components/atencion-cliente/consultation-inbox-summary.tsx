"use client"

import {
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Inbox,
} from "lucide-react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  mapSharedInboxKpiToStatusFilter,
  type SharedInboxKpiKey,
  type SharedInboxStatusFilter,
} from "@/lib/customer-atenciones/shared-inbox"

const KPI_ORDER: SharedInboxKpiKey[] = [
  "nuevas",
  "para_resolver",
  "pendientes",
  "resueltas_hoy",
]

const KPI_LABELS: Record<SharedInboxKpiKey, string> = {
  nuevas: "Ingresadas Hoy",
  para_resolver: "Para resolver",
  pendientes: "Pendientes",
  resueltas_hoy: "Resueltas hoy",
}

const KPI_HINTS: Partial<Record<SharedInboxKpiKey, string>> = {
  nuevas: "Volumen de entrada del día seleccionado (informativo)",
  para_resolver: "Trabajo pendiente interno (no histórico)",
  pendientes: "Espera de acción externa (no histórico)",
  resueltas_hoy: "Cerradas en el día seleccionado",
}

const KPI_ICONS = {
  nuevas: Inbox,
  para_resolver: CircleDot,
  pendientes: ClipboardList,
  resueltas_hoy: CheckCircle2,
} as const

const KPI_TONES = {
  nuevas: "blue",
  para_resolver: "amber",
  pendientes: "violet",
  resueltas_hoy: "green",
} as const satisfies Record<SharedInboxKpiKey, "blue" | "amber" | "violet" | "green">

/** Ingresadas Hoy is informational — does not filter the inbox. */
const INFORMATIONAL_KPI_KEYS = new Set<SharedInboxKpiKey>(["nuevas"])

type ConsultationInboxSummaryProps = {
  activeFilter: SharedInboxStatusFilter
  onFilterChange: (filter: SharedInboxStatusFilter) => void
}

function isKpiActive(
  kpi: SharedInboxKpiKey,
  activeFilter: SharedInboxStatusFilter
): boolean {
  if (INFORMATIONAL_KPI_KEYS.has(kpi)) {
    return false
  }

  return mapSharedInboxKpiToStatusFilter(kpi) === activeFilter
}

export function ConsultationInboxSummary({
  activeFilter,
  onFilterChange,
}: ConsultationInboxSummaryProps) {
  const { sharedInboxKpis, isSharedInboxLoading } = useAtencionCliente()

  return (
    <KpiCardGrid layout="standard">
      {KPI_ORDER.map((kpi) => {
        const Icon = KPI_ICONS[kpi]
        const isInformational = INFORMATIONAL_KPI_KEYS.has(kpi)

        return (
          <FilterableKpiCard
            key={kpi}
            label={KPI_LABELS[kpi]}
            value={
              isSharedInboxLoading
                ? "…"
                : sharedInboxKpis[kpi].toLocaleString("es-AR")
            }
            icon={Icon}
            tone={KPI_TONES[kpi]}
            hint={KPI_HINTS[kpi]}
            isActive={isKpiActive(kpi, activeFilter)}
            isLoading={isSharedInboxLoading}
            onClick={
              isInformational
                ? undefined
                : () => onFilterChange(mapSharedInboxKpiToStatusFilter(kpi))
            }
          />
        )
      })}
    </KpiCardGrid>
  )
}
