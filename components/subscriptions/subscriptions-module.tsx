"use client"

import { ArrowLeftRight, ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"

import { AbnetTvOffer } from "@/components/subscriptions/abnet-tv-offer"
import { SubscriptionsProvider, useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { SubscriptionsSummaryCards } from "@/components/subscriptions/subscriptions-summary-cards"
import { SubscriptionsTvOverview } from "@/components/subscriptions/subscriptions-tv-overview"
import { TvPlansCatalogSection } from "@/components/subscriptions/tv-plans-catalog-section"
import { TvSubscribersFilters } from "@/components/subscriptions/tv-subscribers-filters"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  abnetPadronTvRowLabel,
  formatAbnetPadronMoney,
  type AbnetTvKind,
  type AbnetTvPadronRow,
} from "@/lib/subscriptions/abnet-tv-padron"
import {
  ABNET_TV_PLAN_OPTIONS,
  abnetTvJubiladoHalf,
  abnetTvPlanSelectionNotice,
  currentAbnetTvPlanOption,
  type AbnetTvPlanOptionId,
} from "@/lib/subscriptions/abnet-tv-plan-choice"
import { formatTvMoney } from "@/lib/subscriptions/tv-plans"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const PADRON_HEAD_CLASS = "h-6 px-1.5 py-0 text-[11px] font-medium"
const PADRON_CELL_CLASS = "h-6 max-w-0 px-1.5 py-0 text-xs leading-4"
const PADRON_CHIP_CLASS =
  "inline-flex items-center rounded border px-1 py-0 text-[10px] leading-4 font-medium"

const TV_KIND_CLASS: Record<AbnetTvKind, string> = {
  basica: STATUS_TONE_STYLES.blue,
  full: STATUS_TONE_STYLES.violet,
  pack: STATUS_TONE_STYLES.green,
  other: STATUS_TONE_STYLES.gray,
}

const STATUS_CLASS: Record<string, string> = {
  Activa: STATUS_TONE_STYLES.green,
  Pendiente: STATUS_TONE_STYLES.yellow,
  Morosa: STATUS_TONE_STYLES.red,
  Inactiva: STATUS_TONE_STYLES.gray,
}

function SubscriptionsModuleContent() {
  const {
    plans,
    tvKind,
    jubiladoOnly,
    statusFilter,
    duplicatesOnly,
    search,
    list,
    isListLoading,
    isSummaryReady,
    canWrite,
    error,
    setPage,
    createPlan,
    updatePlan,
    togglePlanActive,
    removePadronRow,
  } = useSubscriptions()

  const listTitle =
    tvKind === "basica"
      ? "Filas con TV Básica"
      :     tvKind === "full"
        ? "Filas con TV Full"
        : tvKind === "pack"
          ? "Filas con TV Básica + Pack Fútbol"
          : tvKind === "other"
          ? "Filas con otro valor de TV"
          : jubiladoOnly
            ? "Filas de jubilados"
            : "Padrón de TV"
  const serviceTotal = list?.total ?? 0
  const pageSize = list?.pageSize ?? 50
  const currentPage = list?.page ?? 1
  const totalPages = Math.max(1, Math.ceil(serviceTotal / pageSize))
  const hasFilters =
    tvKind !== "all" ||
    jubiladoOnly ||
    statusFilter !== "all" ||
    duplicatesOnly ||
    search.trim() !== ""
  const emptyMessage = hasFilters
    ? "Ninguna fila del padrón coincide con los filtros."
    : "El padrón de TV no tiene filas."
  const [selectedRow, setSelectedRow] = useState<AbnetTvPadronRow | null>(null)
  const [rowToChange, setRowToChange] = useState<AbnetTvPadronRow | null>(null)
  const [rowToRemove, setRowToRemove] = useState<AbnetTvPadronRow | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          TV & Suscripciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Padrón de TV de ABNet, tal como está en Conex. Internet + TV.
        </p>
      </div>

      <TvPlansCatalogSection
        plans={plans}
        canWrite={canWrite}
        onCreate={createPlan}
        onUpdate={updatePlan}
        onToggleActive={togglePlanActive}
      />

      <SubscriptionsTvOverview />

      <SubscriptionsSummaryCards />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">{listTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {serviceTotal.toLocaleString("es-AR")} filas ·{" "}
            {(list?.uniqueCustomers ?? 0).toLocaleString("es-AR")} N° Cliente
          </p>
        </div>

        <TvSubscribersFilters />

        {!isSummaryReady || isListLoading ? (
          <TableRowsSkeleton rows={8} columns={9} />
        ) : !list || list.items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
            <p className="text-sm font-medium text-foreground">
              {emptyMessage}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Las filas salen del padrón ABNet, aunque no tengan servicio en
              Bespoke.
            </p>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-hidden">
              <table className="w-full table-fixed text-xs">
                <TableHeader>
                  <TableRow className="bg-slate-100/70 hover:bg-slate-100/70">
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[8%]`}>
                      N° Cliente
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[20%]`}>
                      Cliente
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[12%]`}>
                      Tipo
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[8%]`}>
                      Nodo
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[9%]`}>
                      Estado
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[17%]`}>
                      TV
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[8%]`}>
                      2% IMP. TV
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[8%]`}>
                      FINAL
                    </TableHead>
                    <TableHead className={`${PADRON_HEAD_CLASS} w-[10%]`}>
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((row) => (
                    <TableRow
                      key={`${row.source}-${row.sourceRow}`}
                      data-padron-row=""
                      className="cursor-default"
                    >
                      <TableCell className={`${PADRON_CELL_CLASS} tabular-nums`}>
                        {row.abnetCustomerNumber}
                      </TableCell>
                      <TableCell className={`${PADRON_CELL_CLASS} truncate font-medium`}>
                        {row.customerName}
                      </TableCell>
                      <TableCell className={`${PADRON_CELL_CLASS} truncate`}>
                        {row.serviceType || "—"}
                      </TableCell>
                      <TableCell className={`${PADRON_CELL_CLASS} truncate`}>
                        {row.node || "—"}
                      </TableCell>
                      <TableCell className={PADRON_CELL_CLASS}>
                        <StatusBadge
                          className={cn(
                            "px-1.5 py-0 text-[10px]",
                            STATUS_CLASS[row.status] ?? STATUS_TONE_STYLES.gray
                          )}
                        >
                          {row.status || "—"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className={`${PADRON_CELL_CLASS} whitespace-nowrap`}>
                        <PadronTvMark row={row} />
                      </TableCell>
                      <TableCell className={`${PADRON_CELL_CLASS} whitespace-nowrap tabular-nums`}>
                        {row.tvTaxAmount == null
                          ? "—"
                          : formatTvMoney(row.tvTaxAmount)}
                      </TableCell>
                      <TableCell className={`${PADRON_CELL_CLASS} whitespace-nowrap tabular-nums`}>
                        {row.finalAmount == null
                          ? "—"
                          : formatTvMoney(row.finalAmount)}
                      </TableCell>
                      <TableCell className="h-6 px-0.5 py-0 text-right">
                        <PadronRowActions
                          canWrite={canWrite}
                          onDetail={() => setSelectedRow(row)}
                          onChangePlan={() => setRowToChange(row)}
                          onRemove={() => setRowToRemove(row)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · {serviceTotal} filas
              </p>
              {serviceTotal > pageSize ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
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
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Siguiente
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
        <AbnetPadronContact
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
        <ChangePadronDialog
          row={rowToChange}
          onClose={() => setRowToChange(null)}
        />
        <RemovePadronDialog
          row={rowToRemove}
          onClose={() => setRowToRemove(null)}
          onConfirm={removePadronRow}
        />
      </div>
    </div>
  )
}

function PadronTvMark({ row }: { row: AbnetTvPadronRow }) {
  const label = abnetPadronTvRowLabel(row)
  const tvClass = TV_KIND_CLASS[row.tvKind]
  if (!row.jubilado) {
    return <span className={cn(PADRON_CHIP_CLASS, tvClass)}>{label}</span>
  }
  const splitAt = label.indexOf(" + ")
  const tvLabel = splitAt >= 0 ? label.slice(0, splitAt) : null
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {tvLabel ? (
        <span className={cn(PADRON_CHIP_CLASS, tvClass)}>{tvLabel}</span>
      ) : null}
      <span className={cn(PADRON_CHIP_CLASS, STATUS_TONE_STYLES.orange)}>
        Jubilado 50%
      </span>
    </span>
  )
}

function PadronRowActions({
  canWrite,
  onDetail,
  onChangePlan,
  onRemove,
}: {
  canWrite: boolean
  onDetail: () => void
  onChangePlan: () => void
  onRemove: () => void
}) {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-end gap-0.5">
        <PadronIconButton
          label="Ver detalle"
          className="text-muted-foreground"
          onClick={onDetail}
        >
          <Eye className="size-3.5" />
        </PadronIconButton>
        <PadronIconButton
          label="Cambiar plan de TV"
          className="text-violet-700 hover:text-violet-800 dark:text-violet-300"
          onClick={onChangePlan}
        >
          <ArrowLeftRight className="size-3.5" />
        </PadronIconButton>
        {canWrite ? (
          <PadronIconButton
            label="Eliminar de TV"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </PadronIconButton>
        ) : null}
      </div>
    </TooltipProvider>
  )
}

function PadronIconButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-6 cursor-pointer", className)}
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function AbnetPadronContact({
  row,
  onClose,
}: {
  row: AbnetTvPadronRow | null
  onClose: () => void
}) {
  const tvLabel = row ? abnetPadronTvRowLabel(row) : ""

  return (
    <Dialog open={row != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {row?.customerName} · N° {row?.abnetCustomerNumber}
          </DialogTitle>
        </DialogHeader>
        {row ? (
          <div className="space-y-3 text-sm">
            <p>N° Cliente: {row.abnetCustomerNumber}</p>
            <p>Cliente: {row.customerName}</p>
            <p>Tipo: {row.serviceType || "—"}</p>
            <p>Nodo: {row.node || "—"}</p>
            <p>Estado: {row.status || "—"}</p>
            <p>TV: {tvLabel}</p>
            <p>
              2% IMP. TV:{" "}
              {row.tvTaxAmount == null ? "—" : formatTvMoney(row.tvTaxAmount)}
            </p>
            <p>
              FINAL:{" "}
              {row.finalAmount == null ? "—" : formatTvMoney(row.finalAmount)}
            </p>
            <p>
              CLI: {row.bespokeCustomerNumber || "Sin ficha en Bespoke"}
            </p>
            <p>Ficha: {row.bespokeCustomerName || "—"}</p>
            <p>
              Pack Fútbol: {row.packFutbolActive ? "Activo" : "Sin Pack Fútbol"}
            </p>
            <div className="flex flex-wrap gap-2">
              {row.tvKind === "basica" ? (
                <AbnetTvOffer
                  title="Ofrecer TV Full"
                  detail={`${row.customerName} · N° ${row.abnetCustomerNumber} · TV actual ${tvLabel}. Esta acción no cambia el plan de ABNet.`}
                />
              ) : null}
              {row.packFutbolActive ? null : (
                <AbnetTvOffer
                  title="Ofrecer Pack Fútbol"
                  detail={`${row.customerName} · N° ${row.abnetCustomerNumber}. Esta acción no contrata Pack Fútbol ni modifica el padrón.`}
                />
              )}
              {row.bespokeCustomerId ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/clientes-360/${row.bespokeCustomerId}`}>
                    Ver Cliente 360
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ChangePadronDialog({
  row,
  onClose,
}: {
  row: AbnetTvPadronRow | null
  onClose: () => void
}) {
  const [choice, setChoice] = useState<AbnetTvPlanOptionId | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const current = row ? currentAbnetTvPlanOption(row) : null
  const tvLabel = row ? abnetPadronTvRowLabel(row) : ""

  useEffect(() => {
    setChoice(row ? currentAbnetTvPlanOption(row) : null)
    setNotice(null)
  }, [row])

  return (
    <Dialog
      open={row != null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar plan de TV</DialogTitle>
          <DialogDescription>
            La selección queda en pantalla. No modifica el padrón ni ABNet.
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-3 text-sm">
            <p>N° Cliente: {row.abnetCustomerNumber}</p>
            <p>Cliente: {row.customerName}</p>
            <p>TV actual: {tvLabel}</p>
            {notice ? (
              <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                <p className="font-medium">{notice}</p>
                <p className="text-muted-foreground">
                  Este cambio todavía no se aplica en ABNet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-medium">Seleccionar nuevo plan</p>
                {ABNET_TV_PLAN_OPTIONS.map((option) => {
                  const selected = choice === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "flex w-full cursor-pointer flex-col rounded-lg border px-3 py-2 text-left",
                        selected
                          ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40"
                          : "border-border"
                      )}
                      onClick={() => setChoice(option.id)}
                    >
                      <span className="font-medium">
                        {option.label}
                        {current === option.id ? " · Vigente" : ""}
                      </span>
                      <span>{formatAbnetPadronMoney(option.amount)}</span>
                      {row.jubilado ? (
                        <span className="text-muted-foreground">
                          Jubilado 50% →{" "}
                          {formatAbnetPadronMoney(abnetTvJubiladoHalf(option.amount))}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {notice ? "Cerrar" : "Cancelar"}
          </Button>
          {notice ? null : (
            <Button
              type="button"
              disabled={choice == null}
              onClick={() => {
                if (!choice) return
                setNotice(abnetTvPlanSelectionNotice(choice).headline)
              }}
            >
              Seleccionar plan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemovePadronDialog({
  row,
  onClose,
  onConfirm,
}: {
  row: AbnetTvPadronRow | null
  onClose: () => void
  onConfirm: (row: AbnetTvPadronRow) => Promise<string | null>
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const tvLabel = row ? abnetPadronTvRowLabel(row) : ""

  return (
    <Dialog
      open={row != null}
      onOpenChange={(open) => {
        if (pending) return
        if (!open) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este registro del padrón de TV?</DialogTitle>
          <DialogDescription>
            El registro dejará de aparecer en el padrón de TV y en sus totales.
            El cliente continuará existiendo en Clientes 360 y sus servicios de
            Internet no serán modificados.
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-1 text-sm">
            <p>N° Cliente: {row.abnetCustomerNumber}</p>
            <p>Cliente: {row.customerName}</p>
            <p>TV actual: {tvLabel}</p>
            {error ? <p className="text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null)
              onClose()
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || row == null}
            onClick={() => {
              if (!row) return
              setPending(true)
              setError(null)
              void onConfirm(row).then((message) => {
                setPending(false)
                if (message) {
                  setError(message)
                  return
                }
                setError(null)
                onClose()
              })
            }}
          >
            Eliminar de TV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SubscriptionsModule() {
  return (
    <SubscriptionsProvider>
      <SubscriptionsModuleContent />
    </SubscriptionsProvider>
  )
}
