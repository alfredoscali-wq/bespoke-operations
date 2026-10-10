"use client"

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"

import { PackFutbolAction } from "@/components/subscriptions/pack-futbol-action"
import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
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
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { commercialTvTierLabel } from "@/lib/subscriptions/pack-futbol"
import {
  formatTvMoney,
  type TvConditionFilter,
  type TvPackFilter,
  type TvTierFilter,
} from "@/lib/subscriptions/tv-plans"
import {
  FILTER_CLEAR_BUTTON_CLASS,
  FILTER_SELECT_TRIGGER_CLASS,
  STATUS_TONE_STYLES,
} from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"
import type { TvSubscriberRow } from "@/lib/types/subscriptions"

const HEAD_CLASS = "h-10 px-2 text-xs font-medium"
const CELL_CLASS = "max-w-0 px-2 py-2.5 text-sm leading-5"
const CHIP_CLASS =
  "inline-flex items-center rounded border px-1.5 py-0.5 text-xs leading-4 font-medium"

function formatDeskFee(amount: number | null): string {
  if (amount == null) return "—"
  return formatTvMoney(amount)
}

function packLabel(active: boolean): string {
  return active ? "Activo" : "Sin pack"
}

export function TvCommercialDeskSection() {
  const {
    deskList,
    deskSummary,
    deskTvTier,
    deskPack,
    deskCondition,
    deskSearch,
    isDeskReady,
    deskError,
    setDeskTvTier,
    setDeskPack,
    setDeskCondition,
    setDeskSearch,
    setDeskPage,
    clearDeskFilters,
  } = useSubscriptions()

  const hasFilters =
    deskTvTier !== "all" ||
    deskPack !== "all" ||
    deskCondition !== "all" ||
    deskSearch.trim() !== ""
  const total = deskList?.total ?? 0
  const pageSize = deskList?.pageSize ?? 50
  const currentPage = deskList?.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const emptyMessage = hasFilters
    ? "Ningún abono coincide con los filtros."
    : "No hay servicios con TV Básica o TV Full."

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">Abonos con TV</h2>
        <p className="text-xs text-muted-foreground">
          Cada fila es un servicio contratado. El abono mensual sale de ese
          servicio, sus componentes y su condición comercial.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isDeskReady && deskSummary
            ? `${deskSummary.basicaCustomers.toLocaleString("es-AR")} TV Básica · ${deskSummary.fullCustomers.toLocaleString("es-AR")} TV Full · ${deskSummary.packFutbolCustomers.toLocaleString("es-AR")} Pack Fútbol · ${formatDeskFee(deskSummary.monthlyRevenue)} en abonos activos`
            : "—"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={deskSearch}
            onChange={(event) => setDeskSearch(event.target.value)}
            placeholder="Buscar por N° Cliente, nombre, plan o documento"
            className="pl-8"
          />
        </div>
        <QuickFilterBar>
          <QuickFilterField label="Nivel de TV">
            <Select
              value={deskTvTier}
              onValueChange={(value) => setDeskTvTier(value as TvTierFilter)}
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="basica">TV Básica</SelectItem>
                <SelectItem value="full">TV Full</SelectItem>
              </SelectContent>
            </Select>
          </QuickFilterField>
          <QuickFilterField label="Pack Fútbol">
            <Select
              value={deskPack}
              onValueChange={(value) => setDeskPack(value as TvPackFilter)}
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with_pack">Con Pack Fútbol</SelectItem>
                <SelectItem value="without_pack">Sin Pack Fútbol</SelectItem>
              </SelectContent>
            </Select>
          </QuickFilterField>
          <QuickFilterField label="Condición comercial">
            <Select
              value={deskCondition}
              onValueChange={(value) =>
                setDeskCondition(value as TvConditionFilter)
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="jubilado">Jubilado</SelectItem>
              </SelectContent>
            </Select>
          </QuickFilterField>
          {hasFilters ? (
            <div className="flex items-end pb-1">
              <button
                type="button"
                className={FILTER_CLEAR_BUTTON_CLASS}
                onClick={clearDeskFilters}
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </QuickFilterBar>
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">Filtro activo:</p>
            {deskTvTier === "basica" ? (
              <FilterChip label="TV Básica" onRemove={() => setDeskTvTier("all")} />
            ) : null}
            {deskTvTier === "full" ? (
              <FilterChip label="TV Full" onRemove={() => setDeskTvTier("all")} />
            ) : null}
            {deskPack === "with_pack" ? (
              <FilterChip
                label="Con Pack Fútbol"
                onRemove={() => setDeskPack("all")}
              />
            ) : null}
            {deskPack === "without_pack" ? (
              <FilterChip
                label="Sin Pack Fútbol"
                onRemove={() => setDeskPack("all")}
              />
            ) : null}
            {deskCondition === "jubilado" ? (
              <FilterChip
                label="Jubilado"
                onRemove={() => setDeskCondition("all")}
              />
            ) : null}
            {deskSearch.trim() ? (
              <FilterChip
                label={deskSearch.trim()}
                onRemove={() => setDeskSearch("")}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {deskError ? <p className="text-sm text-destructive">{deskError}</p> : null}

      {!isDeskReady ? (
        <TableRowsSkeleton rows={8} columns={8} />
      ) : deskError ? null : !deskList || deskList.items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta lista no usa el padrón de Conex.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("es-AR")} servicios ·{" "}
            {(deskList.uniqueCustomers ?? 0).toLocaleString("es-AR")} clientes
          </p>
          <div className="w-full overflow-x-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-slate-100/70 hover:bg-slate-100/70">
                  <TableHead className={HEAD_CLASS}>N° Cliente</TableHead>
                  <TableHead className={HEAD_CLASS}>Cliente</TableHead>
                  <TableHead className={HEAD_CLASS}>Plan</TableHead>
                  <TableHead className={HEAD_CLASS}>Nivel</TableHead>
                  <TableHead className={HEAD_CLASS}>Pack Fútbol</TableHead>
                  <TableHead className={HEAD_CLASS}>Condición</TableHead>
                  <TableHead className={HEAD_CLASS}>Abono</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deskList.items.map((row) => (
                  <TableRow key={row.serviceId}>
                    <TableCell className={`${CELL_CLASS} tabular-nums`}>
                      {row.externalCustomerNumber || row.customerNumber || "—"}
                    </TableCell>
                    <TableCell className={`${CELL_CLASS} truncate font-medium`}>
                      {row.customerName}
                    </TableCell>
                    <TableCell className={`${CELL_CLASS} truncate text-muted-foreground`}>
                      {row.commercialPlanName}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <TierMark row={row} />
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={cn(
                            CHIP_CLASS,
                            row.packFutbolActive
                              ? STATUS_TONE_STYLES.green
                              : STATUS_TONE_STYLES.gray
                          )}
                        >
                          {packLabel(row.packFutbolActive)}
                        </span>
                        <PackFutbolAction row={row} />
                      </div>
                    </TableCell>
                    <TableCell className={`${CELL_CLASS} truncate`}>
                      {row.conditionName ? (
                        <span
                          className={cn(
                            CHIP_CLASS,
                            row.jubilado
                              ? STATUS_TONE_STYLES.orange
                              : STATUS_TONE_STYLES.gray
                          )}
                        >
                          {row.conditionName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={`${CELL_CLASS} tabular-nums`}>
                      {formatDeskFee(row.commercialMonthlyFee)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages} · {total} servicios
            </p>
            {total > pageSize ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={currentPage <= 1}
                  onClick={() => setDeskPage(currentPage - 1)}
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={currentPage >= totalPages}
                  onClick={() => setDeskPage(currentPage + 1)}
                >
                  Siguiente
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

function TierMark({ row }: { row: TvSubscriberRow }) {
  const label = commercialTvTierLabel(row.tvTier)
  if (!label) return "—"
  const tone =
    row.tvTier === "full" ? STATUS_TONE_STYLES.violet : STATUS_TONE_STYLES.blue
  return <span className={cn(CHIP_CLASS, tone)}>{label}</span>
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-4 rounded-full"
        onClick={onRemove}
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" />
      </Button>
    </Badge>
  )
}
