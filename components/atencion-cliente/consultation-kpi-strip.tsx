"use client"

import {
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  Headphones,
  Inbox,
  Phone,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMemo } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import type {
  SharedInboxOperationalCategory,
  SharedInboxQuery,
  SharedInboxStatusFilter,
} from "@/lib/customer-atenciones/shared-inbox"
import type { VisualTone } from "@/lib/ui/visual-tokens"

type KpiStripCard = {
  key: string
  label: string
  icon: LucideIcon
  tone: VisualTone
  hint?: string
} & (
  | { kind: "informational" }
  | { kind: "status"; statusFilter: SharedInboxStatusFilter }
  | { kind: "category"; category: SharedInboxOperationalCategory }
)

/**
 * Compact KPI strip for the workbench. Every card reuses an existing filter
 * (status filter or operational category); no new filtering logic is added.
 */
const KPI_STRIP_CARDS: KpiStripCard[] = [
  {
    key: "nuevas",
    label: "Consultas Recibidas Hoy",
    icon: Inbox,
    tone: "blue",
    hint: "Total de consultas registradas durante la jornada.",
    kind: "informational",
  },
  {
    key: "en_gestion",
    label: "En Gestión",
    icon: CircleDot,
    tone: "orange",
    hint: "Consultas tomadas por un operador (de la bandeja actual)",
    kind: "status",
    statusFilter: "en_gestion",
  },
  {
    key: "accion_cliente",
    label: "Acción del Cliente",
    icon: ClipboardList,
    tone: "violet",
    hint: "Espera de acción externa (no histórico)",
    kind: "status",
    statusFilter: "pendiente",
  },
  {
    key: "accion_tecnica",
    label: "Acción de Técnica",
    icon: Headphones,
    tone: "violet",
    kind: "category",
    category: "tecnica",
  },
  {
    key: "accion_administracion",
    label: "Acción de Administración",
    icon: FileText,
    tone: "amber",
    kind: "category",
    category: "administracion",
  },
  {
    key: "accion_ventas",
    label: "Acción de Ventas",
    icon: Phone,
    tone: "blue",
    kind: "category",
    category: "contactar_cliente",
  },
  {
    key: "generar_ot",
    label: "OT por Generar",
    icon: Wrench,
    tone: "gray",
    kind: "category",
    category: "generar_ot",
  },
  {
    key: "resueltas_hoy",
    label: "Resueltas Hoy",
    icon: CheckCircle2,
    tone: "green",
    hint: "Cerradas en el día seleccionado",
    kind: "status",
    statusFilter: "resueltas_hoy",
  },
]

const INDICATOR_KPI_KEYS = ["nuevas", "resueltas_hoy", "generar_ot"] as const

const WORK_QUEUE_KPI_KEYS = [
  "accion_cliente",
  "accion_tecnica",
  "accion_administracion",
  "accion_ventas",
] as const

type ConsultationKpiStripProps = {
  query: SharedInboxQuery
  onQueryChange: (query: SharedInboxQuery) => void
}

export function ConsultationKpiStrip({
  query,
  onQueryChange,
}: ConsultationKpiStripProps) {
  const {
    sharedInboxKpis,
    sharedInboxOperationalCounts,
    sharedInboxRows,
    isSharedInboxDashboardLoading,
  } = useAtencionCliente()

  // Presentational count only: "En gestión" over the rows already loaded for
  // the inbox (there is no dedicated backend KPI for this status).
  const enGestionCount = useMemo(
    () => sharedInboxRows.filter((row) => row.status === "en_gestion").length,
    [sharedInboxRows]
  )

  function resolveValue(card: KpiStripCard): number {
    if (card.kind === "category") {
      return sharedInboxOperationalCounts[card.category]
    }

    if (card.key === "nuevas") {
      return sharedInboxKpis.nuevas
    }

    if (card.key === "accion_cliente") {
      return sharedInboxKpis.pendientes
    }

    if (card.key === "resueltas_hoy") {
      return sharedInboxKpis.resueltas_hoy
    }

    return enGestionCount
  }

  function resolveIsActive(card: KpiStripCard): boolean {
    if (card.kind === "status") {
      return (
        query.statusFilter === card.statusFilter && !query.operationalCategory
      )
    }

    if (card.kind === "category") {
      return query.operationalCategory === card.category
    }

    return false
  }

  function handleClick(card: KpiStripCard) {
    if (card.kind === "status") {
      // Same behavior as the status chips: set filter, clear category.
      onQueryChange({
        ...query,
        statusFilter: card.statusFilter,
        operationalCategory: null,
      })
      return
    }

    if (card.kind === "category") {
      // Sticky filter, same behavior the operational cards had before.
      onQueryChange({
        ...query,
        statusFilter: "all",
        operationalCategory: card.category,
      })
    }
  }

  function getKpiCard(key: string): KpiStripCard {
    const card = KPI_STRIP_CARDS.find((item) => item.key === key)

    if (!card) {
      throw new Error(`KPI card not found: ${key}`)
    }

    return card
  }

  function renderKpiCard(card: KpiStripCard, compact: boolean) {
    return (
      <FilterableKpiCard
        key={card.key}
        compact={compact}
        label={card.label}
        value={
          isSharedInboxDashboardLoading
            ? "…"
            : resolveValue(card).toLocaleString("es-AR")
        }
        icon={card.icon}
        tone={card.tone}
        hint={!compact && card.hint ? card.hint : undefined}
        isActive={resolveIsActive(card)}
        isLoading={isSharedInboxDashboardLoading}
        onClick={
          card.kind === "informational" ? undefined : () => handleClick(card)
        }
        ariaLabel={card.hint ? `${card.label}: ${card.hint}` : card.label}
        cardClassName={
          compact
            ? "[&_p:first-child]:overflow-visible [&_p:first-child]:whitespace-normal [&_p:first-child]:text-clip"
            : "min-h-[8.25rem]"
        }
      />
    )
  }

  return (
    <section className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-card/40 p-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Indicadores</h2>
          <p className="text-xs text-muted-foreground">¿Cómo está el día?</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {INDICATOR_KPI_KEYS.map((key) => renderKpiCard(getKpiCard(key), false))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Bandejas de Trabajo
          </h2>
          <p className="text-xs text-muted-foreground">
            ¿Dónde tengo trabajo pendiente?
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {WORK_QUEUE_KPI_KEYS.map((key) => renderKpiCard(getKpiCard(key), true))}
        </div>
      </div>
    </section>
  )
}
