"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { SubscriptionsProvider, useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { SubscriptionsSummaryCards } from "@/components/subscriptions/subscriptions-summary-cards"
import { SubscriptionsTvOverview } from "@/components/subscriptions/subscriptions-tv-overview"
import { TvPlansCatalogSection } from "@/components/subscriptions/tv-plans-catalog-section"
import { TvSubscribersFilters } from "@/components/subscriptions/tv-subscribers-filters"
import { Button } from "@/components/ui/button"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ISP_COMMERCIAL_STATUS_LABELS } from "@/lib/isp/labels"
import {
  formatTvListCount,
  formatTvMoney,
  hasTvDeskListFilters,
  tvDeskEmptyListMessage,
} from "@/lib/subscriptions/tv-plans"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  pending_activation: STATUS_TONE_STYLES.yellow,
  active: STATUS_TONE_STYLES.green,
  suspended: STATUS_TONE_STYLES.orange,
  cancelled: STATUS_TONE_STYLES.red,
}

function SubscriptionsModuleContent() {
  const {
    plans,
    summary,
    selectedPlan,
    selectedCommercialId,
    statusFilter,
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
  } = useSubscriptions()

  const selectedName =
    selectedPlan === "all"
      ? null
      : plans.find((plan) => plan.id === selectedPlan)?.name ?? null
  const listTitle = selectedName
    ? `Clientes con ${selectedName}`
    : "Clientes con TV"
  const total = list?.total ?? 0
  const pageSize = list?.pageSize ?? 50
  const currentPage = list?.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = hasTvDeskListFilters({
    selectedPlan,
    selectedCommercialId,
    status: statusFilter,
    search,
  })
  const emptyMessage = tvDeskEmptyListMessage({
    selectedPlanName: selectedName,
    hasFilters,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          TV & Suscripciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Administración y seguimiento de los servicios de TV de la empresa.
        </p>
      </div>

      <TvPlansCatalogSection
        plans={plans}
        kpis={summary?.plans ?? []}
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
            {formatTvListCount(total)}
          </p>
        </div>

        <TvSubscribersFilters />

        {!isSummaryReady || isListLoading ? (
          <TableRowsSkeleton rows={8} columns={6} />
        ) : !list || list.items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
            <p className="text-sm font-medium text-foreground">
              {emptyMessage}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              El listado incluye únicamente clientes con componente TV en el
              servicio comercial.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio / Abono</TableHead>
                    <TableHead>Plan TV</TableHead>
                    <TableHead>Importe TV</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((row) => (
                    <TableRow key={row.serviceId}>
                      <TableCell className="font-medium">
                        {row.customerName}
                        {row.customerNumber ? (
                          <p className="text-xs text-muted-foreground">
                            {row.customerNumber}
                          </p>
                        ) : null}
                        {row.phone ? (
                          <p className="text-xs text-muted-foreground">
                            {row.phone}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.commercialPlanName}</TableCell>
                      <TableCell>{row.planName}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatTvMoney(row.monthlyPrice)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          className={cn(
                            STATUS_STYLES[row.commercialStatus] ??
                              STATUS_TONE_STYLES.gray
                          )}
                        >
                          {ISP_COMMERCIAL_STATUS_LABELS[row.commercialStatus]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/clientes-360/${row.customerId}`}>
                            Ver Cliente 360
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · {total}{" "}
                {total === 1 ? "cliente" : "clientes"}
              </p>
              {total > pageSize ? (
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
      </div>
    </div>
  )
}

export function SubscriptionsModule() {
  return (
    <SubscriptionsProvider>
      <SubscriptionsModuleContent />
    </SubscriptionsProvider>
  )
}
