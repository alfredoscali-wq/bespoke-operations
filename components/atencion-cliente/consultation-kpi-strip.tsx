"use client"

import {
  BriefcaseBusiness,
  CircleCheckBig,
  ClipboardPlus,
  Clock3,
  Inbox,
  LayoutList,
  PhoneCall,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useMemo } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import {
  getVisibleOperationalWorkTrays,
  isSharedInboxUiWorkTray,
  SHARED_INBOX_WORK_TRAY_LABELS,
  type SharedInboxOperationalCategory,
  type SharedInboxQuery,
  type SharedInboxStatusFilter,
  type SharedInboxWorkTray,
} from "@/lib/customer-atenciones/shared-inbox"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KPI_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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
 * RC 3.0.6 / 3.0.7 — KPI icons + ultra-dense area work trays.
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
    key: "resueltas_hoy",
    label: "Resueltas Hoy",
    icon: CircleCheckBig,
    tone: "green",
    hint: "Cerradas en el día seleccionado",
    kind: "status",
    statusFilter: "resueltas_hoy",
  },
  {
    key: "generar_ot",
    label: "OT por Generar",
    icon: ClipboardPlus,
    tone: "gray",
    hint: "Consultas listas para generar OT.",
    kind: "category",
    category: "generar_ot",
  },
]

const INDICATOR_KPI_KEYS = ["nuevas", "resueltas_hoy", "generar_ot"] as const

const WORK_TRAY_ICONS: Record<
  Extract<
    SharedInboxWorkTray,
    | "espera_cliente"
    | "retenciones"
    | "tecnica"
    | "administracion"
    | "morosos"
    | "ventas"
  >,
  LucideIcon
> = {
  espera_cliente: Clock3,
  retenciones: PhoneCall,
  tecnica: Wrench,
  administracion: BriefcaseBusiness,
  morosos: Wallet,
  ventas: TrendingUp,
}

const WORK_TRAY_TONES: Record<keyof typeof WORK_TRAY_ICONS, VisualTone> = {
  espera_cliente: "violet",
  retenciones: "amber",
  tecnica: "violet",
  administracion: "amber",
  morosos: "amber",
  ventas: "blue",
}

/**
 * RC 3.0.9 — KPI hierarchy: icon + name, then dominant value.
 * Card height stays at the RC 3.0.8 intermediate size.
 */
const COMPACT_CARD_CLASS = cn(
  "min-h-[5.25rem]",
  "[&_[data-slot=card-content]]:flex-row-reverse [&_[data-slot=card-content]]:items-start [&_[data-slot=card-content]]:gap-2.5 [&_[data-slot=card-content]]:px-3.5 [&_[data-slot=card-content]]:py-3",
  "[&_[data-slot=card-content]_p:first-child]:text-[13px] [&_[data-slot=card-content]_p:first-child]:font-medium [&_[data-slot=card-content]_p:first-child]:leading-snug [&_[data-slot=card-content]_p:first-child]:text-foreground/80",
  "[&_[data-slot=card-content]_p:nth-child(2)]:mt-1 [&_[data-slot=card-content]_p:nth-child(2)]:text-2xl [&_[data-slot=card-content]_p:nth-child(2)]:font-semibold [&_[data-slot=card-content]_p:nth-child(2)]:leading-none [&_[data-slot=card-content]_p:nth-child(2)]:tracking-tight",
  "[&_[data-slot=card-content]>div:last-child]:mt-0.5 [&_[data-slot=card-content]>div:last-child]:size-6 [&_[data-slot=card-content]>div:last-child]:shrink-0",
  "[&_[data-slot=card-content]>div:last-child_svg]:size-3"
)

/** RC 3.0.7 — responsive tray grid (1 / 2 / 3 / 6). */
function workTrayGridClass(columnCount: number) {
  const desktopCols = Math.min(Math.max(columnCount, 1), 6)

  return cn(
    "grid gap-1.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    desktopCols === 1 && "xl:grid-cols-1",
    desktopCols === 2 && "xl:grid-cols-2",
    desktopCols === 3 && "xl:grid-cols-3",
    desktopCols === 4 && "xl:grid-cols-4",
    desktopCols === 5 && "xl:grid-cols-5",
    desktopCols === 6 && "xl:grid-cols-6"
  )
}

const SECTION_TITLE_CLASS =
  "text-[15px] font-semibold tracking-tight text-foreground sm:text-base"

type WorkTrayChipProps = {
  label: string
  value: string
  icon: LucideIcon
  tone: VisualTone
  isActive: boolean
  onClick: () => void
  ariaLabel: string
}

function WorkTrayChip({
  label,
  value,
  icon: Icon,
  tone,
  isActive,
  onClick,
  ariaLabel,
}: WorkTrayChipProps) {
  const styles = KPI_TONE_STYLES[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border px-2 text-left transition-colors",
        styles.card,
        "hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isActive && "ring-2 ring-primary/25"
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded",
          styles.icon
        )}
        aria-hidden
      >
        <Icon className={cn("size-3", styles.iconColor)} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-foreground/80">
        {label}
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums leading-none text-foreground">
        {value}
      </span>
    </button>
  )
}

function WorkTrayChipSkeleton() {
  return (
    <div className="flex h-8 w-full items-center gap-1.5 rounded-md border bg-card px-2">
      <Skeleton className="size-5 shrink-0 rounded" />
      <Skeleton className="h-2.5 min-w-0 flex-1" />
      <Skeleton className="h-3.5 w-5 shrink-0" />
    </div>
  )
}

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
    sharedInboxWorkTrayCounts,
    isSharedInboxDashboardLoading,
    isSharedInboxLoading,
  } = useAtencionCliente()

  const visibleTrays = useMemo(
    () => getVisibleOperationalWorkTrays(sharedInboxWorkTrayCounts),
    [sharedInboxWorkTrayCounts]
  )

  const traysLoading = isSharedInboxDashboardLoading || isSharedInboxLoading

  // Drop filters for trays removed from the UI (RC 3.0.6).
  useEffect(() => {
    if (query.workTray && !isSharedInboxUiWorkTray(query.workTray)) {
      onQueryChange({
        ...query,
        workTray: null,
        statusFilter: "all",
        operationalCategory: null,
      })
    }
  }, [onQueryChange, query])

  function resolveIndicatorValue(card: KpiStripCard): number {
    if (card.kind === "category") {
      return sharedInboxOperationalCounts[card.category]
    }

    if (card.key === "nuevas") {
      return sharedInboxKpis.nuevas
    }

    if (card.key === "resueltas_hoy") {
      return sharedInboxKpis.resueltas_hoy
    }

    return 0
  }

  function resolveIndicatorIsActive(card: KpiStripCard): boolean {
    if (query.workTray) {
      return false
    }

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

  function handleIndicatorClick(card: KpiStripCard) {
    if (card.kind === "status") {
      onQueryChange({
        ...query,
        statusFilter: card.statusFilter,
        operationalCategory: null,
        workTray: null,
      })
      return
    }

    if (card.kind === "category") {
      onQueryChange({
        ...query,
        statusFilter: "all",
        operationalCategory: card.category,
        workTray: null,
      })
    }
  }

  function selectWorkTray(tray: SharedInboxWorkTray) {
    if (!isSharedInboxUiWorkTray(tray)) {
      return
    }

    onQueryChange({
      ...query,
      statusFilter: "all",
      operationalCategory: null,
      workTray: tray,
    })
  }

  function selectAllTrays() {
    onQueryChange({
      ...query,
      statusFilter: "all",
      operationalCategory: null,
      workTray: null,
    })
  }

  function getKpiCard(key: string): KpiStripCard {
    const card = KPI_STRIP_CARDS.find((item) => item.key === key)

    if (!card) {
      throw new Error(`KPI card not found: ${key}`)
    }

    return card
  }

  function renderIndicatorCard(card: KpiStripCard) {
    return (
      <FilterableKpiCard
        key={card.key}
        compact
        label={card.label}
        value={
          isSharedInboxDashboardLoading
            ? "…"
            : resolveIndicatorValue(card).toLocaleString("es-AR")
        }
        icon={card.icon}
        tone={card.tone}
        isActive={resolveIndicatorIsActive(card)}
        isLoading={isSharedInboxDashboardLoading}
        onClick={
          card.kind === "informational"
            ? undefined
            : () => handleIndicatorClick(card)
        }
        ariaLabel={card.hint ? `${card.label}: ${card.hint}` : card.label}
        cardClassName={COMPACT_CARD_CLASS}
      />
    )
  }

  return (
    <section className="space-y-2.5">
      <div className="space-y-2 rounded-lg border bg-card/40 px-3 py-2.5">
        <h2 className={SECTION_TITLE_CLASS}>Indicadores</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {INDICATOR_KPI_KEYS.map((key) =>
            renderIndicatorCard(getKpiCard(key))
          )}
        </div>
      </div>

      <div className="space-y-1.5 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={SECTION_TITLE_CLASS}>Bandejas de Trabajo</h2>
          <Button
            type="button"
            size="sm"
            variant={
              query.workTray == null || !isSharedInboxUiWorkTray(query.workTray)
                ? "default"
                : "outline"
            }
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={selectAllTrays}
          >
            <LayoutList className="size-3" aria-hidden />
            Todas
          </Button>
        </div>

        {traysLoading ? (
          <div className={workTrayGridClass(6)}>
            {Array.from({ length: 6 }).map((_, index) => (
              <WorkTrayChipSkeleton key={`tray-skeleton-${index}`} />
            ))}
          </div>
        ) : visibleTrays.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay consultas pendientes en bandejas de área.
          </p>
        ) : (
          <div className={workTrayGridClass(visibleTrays.length)}>
            {visibleTrays.map((tray) => {
              const Icon = WORK_TRAY_ICONS[tray as keyof typeof WORK_TRAY_ICONS]
              const label = SHARED_INBOX_WORK_TRAY_LABELS[tray]
              const value = sharedInboxWorkTrayCounts[tray]

              return (
                <WorkTrayChip
                  key={tray}
                  label={label}
                  value={value.toLocaleString("es-AR")}
                  icon={Icon}
                  tone={WORK_TRAY_TONES[tray as keyof typeof WORK_TRAY_TONES]}
                  isActive={query.workTray === tray}
                  onClick={() => selectWorkTray(tray)}
                  ariaLabel={`${label}: ${value} consultas`}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
