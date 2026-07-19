"use client"

import {
  BriefcaseBusiness,
  CircleCheckBig,
  ClipboardPlus,
  Clock3,
  Inbox,
  LayoutList,
  MonitorPlay,
  PhoneCall,
  Store,
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
import type { CustomerAtencionMotivo } from "@/lib/types/customer-atenciones"
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
 * RC 3.2.1 — strategic indicators only (module health).
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

type UiWorkTray = Extract<
  SharedInboxWorkTray,
  | "espera_cliente"
  | "retenciones"
  | "tecnica"
  | "administracion"
  | "morosos"
  | "ventas"
>

const WORK_TRAY_ICONS: Record<UiWorkTray, LucideIcon> = {
  espera_cliente: Clock3,
  retenciones: PhoneCall,
  tecnica: Wrench,
  administracion: BriefcaseBusiness,
  morosos: Wallet,
  ventas: TrendingUp,
}

const WORK_TRAY_TONES: Record<UiWorkTray, VisualTone> = {
  espera_cliente: "violet",
  retenciones: "amber",
  tecnica: "violet",
  administracion: "amber",
  morosos: "amber",
  ventas: "blue",
}

type MotivoWorkCard = {
  key: "consulta_comercial" | "consulta_tv"
  label: string
  icon: LucideIcon
  tone: VisualTone
  motivo: CustomerAtencionMotivo
}

/** RC 3.2.1 — commercial motivo queues live with operational trays. */
const MOTIVO_WORK_CARDS: MotivoWorkCard[] = [
  {
    key: "consulta_comercial",
    label: "Consulta Comercial",
    icon: Store,
    tone: "blue",
    motivo: "consulta_comercial",
  },
  {
    key: "consulta_tv",
    label: "Consulta sobre TV",
    icon: MonitorPlay,
    tone: "violet",
    motivo: "consulta_tv",
  },
]

/**
 * RC 3.0.9 / 3.2.1 — main indicator card hierarchy.
 */
const COMPACT_CARD_CLASS = cn(
  "min-h-[5.25rem]",
  "[&_[data-slot=card-content]]:flex-row-reverse [&_[data-slot=card-content]]:items-start [&_[data-slot=card-content]]:gap-2.5 [&_[data-slot=card-content]]:px-3.5 [&_[data-slot=card-content]]:py-3",
  "[&_[data-slot=card-content]_p:first-child]:text-[13px] [&_[data-slot=card-content]_p:first-child]:font-medium [&_[data-slot=card-content]_p:first-child]:leading-snug [&_[data-slot=card-content]_p:first-child]:text-foreground/80",
  "[&_[data-slot=card-content]_p:nth-child(2)]:mt-1 [&_[data-slot=card-content]_p:nth-child(2)]:text-2xl [&_[data-slot=card-content]_p:nth-child(2)]:font-semibold [&_[data-slot=card-content]_p:nth-child(2)]:leading-none [&_[data-slot=card-content]_p:nth-child(2)]:tracking-tight",
  "[&_[data-slot=card-content]>div:last-child]:mt-0.5 [&_[data-slot=card-content]>div:last-child]:size-6 [&_[data-slot=card-content]>div:last-child]:shrink-0",
  "[&_[data-slot=card-content]>div:last-child_svg]:size-3"
)

/** RC 3.2.1 — responsive queue grid (fills without empty holes). */
function workQueueGridClass(columnCount: number) {
  const desktopCols = Math.min(Math.max(columnCount, 1), 6)

  return cn(
    "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
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

type WorkQueueCardProps = {
  label: string
  value: string
  icon: LucideIcon
  tone: VisualTone
  isActive: boolean
  onClick: () => void
  ariaLabel: string
}

/**
 * RC 3.2.1 — mini card (~60–70% of a main KPI): icon, name, dominant count.
 */
function WorkQueueCard({
  label,
  value,
  icon: Icon,
  tone,
  isActive,
  onClick,
  ariaLabel,
}: WorkQueueCardProps) {
  const styles = KPI_TONE_STYLES[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      className={cn(
        "flex min-h-[3.5rem] w-full min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors",
        styles.card,
        "hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isActive && "ring-2 ring-primary/25"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[12px] font-medium leading-snug text-foreground/80">
          {label}
        </span>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            styles.icon
          )}
          aria-hidden
        >
          <Icon className={cn("size-3.5", styles.iconColor)} />
        </span>
      </div>
      <span className="text-xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
        {value}
      </span>
    </button>
  )
}

function WorkQueueCardSkeleton() {
  return (
    <div className="flex min-h-[3.5rem] w-full flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-6 shrink-0 rounded-md" />
      </div>
      <Skeleton className="h-5 w-8" />
    </div>
  )
}

type WorkQueueItem =
  | {
      kind: "tray"
      key: UiWorkTray
      label: string
      value: number
      icon: LucideIcon
      tone: VisualTone
    }
  | {
      kind: "motivo"
      key: MotivoWorkCard["key"]
      label: string
      value: number
      icon: LucideIcon
      tone: VisualTone
      motivo: CustomerAtencionMotivo
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

  const workQueueItems = useMemo((): WorkQueueItem[] => {
    const trays: WorkQueueItem[] = visibleTrays
      .filter((tray): tray is UiWorkTray => tray in WORK_TRAY_ICONS)
      .map((tray) => ({
        kind: "tray",
        key: tray,
        label: SHARED_INBOX_WORK_TRAY_LABELS[tray],
        value: sharedInboxWorkTrayCounts[tray],
        icon: WORK_TRAY_ICONS[tray],
        tone: WORK_TRAY_TONES[tray],
      }))

    const motivos: WorkQueueItem[] = MOTIVO_WORK_CARDS.filter((card) => {
      const value =
        card.key === "consulta_comercial"
          ? sharedInboxKpis.consulta_comercial
          : sharedInboxKpis.consulta_tv
      return value > 0
    }).map((card) => ({
      kind: "motivo" as const,
      key: card.key,
      label: card.label,
      value:
        card.key === "consulta_comercial"
          ? sharedInboxKpis.consulta_comercial
          : sharedInboxKpis.consulta_tv,
      icon: card.icon,
      tone: card.tone,
      motivo: card.motivo,
    }))

    return [...trays, ...motivos]
  }, [sharedInboxKpis, sharedInboxWorkTrayCounts, visibleTrays])

  const traysLoading = isSharedInboxDashboardLoading || isSharedInboxLoading
  const hasMotivoFilter = Boolean(query.motivo && query.motivo !== "all")
  const isAllQueuesSelected =
    (query.workTray == null || !isSharedInboxUiWorkTray(query.workTray)) &&
    !hasMotivoFilter

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

  // Clear motivo filter when its queue card disappears (count → 0).
  useEffect(() => {
    if (!hasMotivoFilter || traysLoading) {
      return
    }

    const stillVisible = workQueueItems.some(
      (item) => item.kind === "motivo" && item.motivo === query.motivo
    )
    if (!stillVisible) {
      onQueryChange({
        ...query,
        motivo: "all",
      })
    }
  }, [hasMotivoFilter, onQueryChange, query, traysLoading, workQueueItems])

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
    if (query.workTray || hasMotivoFilter) {
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
        motivo: "all",
      })
      return
    }

    if (card.kind === "category") {
      onQueryChange({
        ...query,
        statusFilter: "all",
        operationalCategory: card.category,
        workTray: null,
        motivo: "all",
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
      motivo: "all",
    })
  }

  function selectMotivoQueue(motivo: CustomerAtencionMotivo) {
    onQueryChange({
      ...query,
      statusFilter: "all",
      operationalCategory: null,
      workTray: null,
      motivo,
    })
  }

  function selectAllTrays() {
    onQueryChange({
      ...query,
      statusFilter: "all",
      operationalCategory: null,
      workTray: null,
      motivo: "all",
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {INDICATOR_KPI_KEYS.map((key) =>
            renderIndicatorCard(getKpiCard(key))
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={SECTION_TITLE_CLASS}>Trabajo Pendiente por Área</h2>
          <Button
            type="button"
            size="sm"
            variant={isAllQueuesSelected ? "default" : "outline"}
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={selectAllTrays}
          >
            <LayoutList className="size-3" aria-hidden />
            Todas
          </Button>
        </div>

        {traysLoading ? (
          <div className={workQueueGridClass(6)}>
            {Array.from({ length: 6 }).map((_, index) => (
              <WorkQueueCardSkeleton key={`tray-skeleton-${index}`} />
            ))}
          </div>
        ) : workQueueItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay consultas pendientes en colas de trabajo.
          </p>
        ) : (
          <div className={workQueueGridClass(workQueueItems.length)}>
            {workQueueItems.map((item) => {
              const isActive =
                item.kind === "tray"
                  ? query.workTray === item.key
                  : query.motivo === item.motivo

              return (
                <WorkQueueCard
                  key={item.key}
                  label={item.label}
                  value={item.value.toLocaleString("es-AR")}
                  icon={item.icon}
                  tone={item.tone}
                  isActive={isActive}
                  onClick={() => {
                    if (item.kind === "tray") {
                      selectWorkTray(item.key)
                      return
                    }
                    selectMotivoQueue(item.motivo)
                  }}
                  ariaLabel={`${item.label}: ${item.value} consultas`}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
