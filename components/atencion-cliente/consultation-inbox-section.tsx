"use client"

import { useRouter } from "next/navigation"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { ConsultationHistoricalDaySummaryCard } from "@/components/atencion-cliente/consultation-historical-day-summary-card"
import { ConsultationStatusBadge } from "@/components/atencion-cliente/consultation-status-badge"
import {
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
} from "@/lib/customer-atenciones/format"
import {
  CUSTOMER_ATENCION_CHANNEL_OPTIONS,
  CUSTOMER_ATENCION_MOTIVO_OPTIONS,
} from "@/lib/customer-atenciones/format"
import {
  normalizeSharedInboxCreatedDate,
  normalizeSharedInboxSearch,
} from "@/lib/customer-atenciones/shared-inbox"
import type { CustomerAtencionInboxRow } from "@/lib/types/customer-atenciones"
import type {
  SharedInboxQuery,
  SharedInboxStatusFilter,
} from "@/lib/customer-atenciones/shared-inbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { FILTER_CLEAR_BUTTON_CLASS } from "@/lib/ui/visual-tokens"

/** Visible daily-operation filters; other statuses remain supported internally. */
const STATUS_FILTER_OPTIONS: { value: SharedInboxStatusFilter; label: string }[] =
  [
    { value: "all", label: "Todas" },
    { value: "pendiente", label: "Pendientes" },
    { value: "para_resolver", label: "Para resolver" },
    { value: "resueltas_hoy", label: "Resueltas hoy" },
  ]

function createDefaultInboxQuery(): SharedInboxQuery {
  return {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: null,
    createdDate: null,
    search: "",
  }
}

function formatRowDate(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  })
  const time = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return `${day} · ${time}`
}

/** Contextual side panel is available on desktop/notebook; mobile keeps page navigation. */
const CONTEXTUAL_DETAIL_MEDIA_QUERY = "(min-width: 1024px)"

function ConsultationInboxTableRow({
  item,
  rowNumber,
  isSelected,
  onSelect,
}: {
  item: CustomerAtencionInboxRow
  rowNumber: number
  isSelected: boolean
  onSelect?: (atencionId: string) => void
}) {
  const router = useRouter()
  const assignedName =
    item.status === "en_gestion" && item.activeManagementEmployeeName
      ? item.activeManagementEmployeeName
      : null

  function openConsultation() {
    if (
      onSelect &&
      typeof window !== "undefined" &&
      window.matchMedia(CONTEXTUAL_DETAIL_MEDIA_QUERY).matches
    ) {
      onSelect(item.id)
      return
    }

    router.push(`/atencion-cliente/${item.id}`)
  }

  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`Abrir consulta de ${item.customerName}`}
      data-state={isSelected ? "selected" : undefined}
      onClick={openConsultation}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openConsultation()
        }
      }}
    >
      <TableCell className="w-10 text-xs text-muted-foreground">
        {rowNumber}
      </TableCell>
      <TableCell className="min-w-[180px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {item.customerName}
          </span>
          <ConsultationStatusBadge status={item.status} />
        </div>
      </TableCell>
      <TableCell className="min-w-[140px]">
        <span className="block truncate text-sm text-muted-foreground">
          {formatCustomerAtencionMotivoLabel(item.motivo)}
        </span>
      </TableCell>
      <TableCell className="min-w-[180px]">
        {item.nextStep ? (
          <span className="block truncate text-sm text-foreground">
            {formatCustomerAtencionNextStepLabel(item.nextStep)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-[140px]">
        {assignedName ? (
          <span className="block truncate text-sm text-foreground">
            {assignedName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Sin asignar</span>
        )}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
        {formatRowDate(item.createdAt)}
      </TableCell>
    </TableRow>
  )
}

type ConsultationInboxSectionProps = {
  query: SharedInboxQuery
  onQueryChange: (query: SharedInboxQuery) => void
  /** Open the consultation in the side work panel (desktop only). */
  onSelectConsultation?: (atencionId: string) => void
  selectedConsultationId?: string | null
}

export function ConsultationInboxSection({
  query,
  onQueryChange,
  onSelectConsultation,
  selectedConsultationId,
}: ConsultationInboxSectionProps) {
  const { sharedInboxRows, isSharedInboxLoading, sharedInboxHistoricalDaySummary } =
    useAtencionCliente()

  const createdDate = normalizeSharedInboxCreatedDate(query.createdDate)
  const activeSearch = normalizeSharedInboxSearch(query.search)
  const hasDiscoveryFilters =
    Boolean(activeSearch) || Boolean(createdDate)
  const hasOperationalFilters =
    query.statusFilter !== "all" ||
    Boolean(query.operationalCategory) ||
    (query.motivo && query.motivo !== "all") ||
    (query.channel && query.channel !== "all") ||
    hasDiscoveryFilters

  const showDiscoveryChips = Boolean(activeSearch) || Boolean(createdDate)

  function clearFilters() {
    onQueryChange(createDefaultInboxQuery())
  }

  return (
    <Card>
      <CardHeader className="space-y-5 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle>Bandeja de Consultas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Consultas según los filtros seleccionados
          </p>
        </div>

        {showDiscoveryChips ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {createdDate ? (
              <Badge variant="secondary" className="font-normal">
                Fecha:{" "}
                {new Date(`${createdDate}T12:00:00`).toLocaleDateString("es-AR")}
              </Badge>
            ) : null}
            {activeSearch ? (
              <Badge variant="secondary" className="font-normal">
                Búsqueda global: {activeSearch}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {sharedInboxHistoricalDaySummary ? (
          <ConsultationHistoricalDaySummaryCard
            summary={sharedInboxHistoricalDaySummary}
          />
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={
                  query.statusFilter === option.value ? "default" : "outline"
                }
                onClick={() =>
                  onQueryChange({
                    ...query,
                    statusFilter: option.value,
                    operationalCategory: null,
                  })
                }
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="consultation-inbox-date"
                className="text-xs text-muted-foreground"
              >
                Fecha
              </Label>
              <Input
                id="consultation-inbox-date"
                type="date"
                value={createdDate ?? ""}
                placeholder="Seleccionar fecha..."
                onChange={(event) =>
                  onQueryChange({
                    ...query,
                    createdDate: event.target.value || null,
                  })
                }
                className="h-9 w-[160px] bg-background"
              />
              {createdDate ? (
                <button
                  type="button"
                  className={FILTER_CLEAR_BUTTON_CLASS}
                  onClick={() =>
                    onQueryChange({
                      ...query,
                      createdDate: null,
                    })
                  }
                >
                  Limpiar fecha
                </button>
              ) : null}
            </div>

            <Select
              value={query.motivo ?? "all"}
              onValueChange={(value) =>
                onQueryChange({
                  ...query,
                  motivo: value as SharedInboxQuery["motivo"],
                })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los motivos</SelectItem>
                {CUSTOMER_ATENCION_MOTIVO_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={query.channel ?? "all"}
              onValueChange={(value) =>
                onQueryChange({
                  ...query,
                  channel: value as SharedInboxQuery["channel"],
                })
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los canales</SelectItem>
                {CUSTOMER_ATENCION_CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasOperationalFilters ? (
              <button
                type="button"
                className={cn(FILTER_CLEAR_BUTTON_CLASS, "sm:ml-auto")}
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isSharedInboxLoading ? (
          <p className="text-sm text-muted-foreground">Cargando consultas…</p>
        ) : sharedInboxRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay consultas para los filtros seleccionados.
          </p>
        ) : (
          <div className="max-h-[34rem] overflow-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-xs text-muted-foreground">
                    Nº
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    Cliente
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    Motivo
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    Próxima Acción
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    Asignado
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground">
                    Fecha
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedInboxRows.map((item, index) => (
                  <ConsultationInboxTableRow
                    key={item.id}
                    item={item}
                    rowNumber={index + 1}
                    isSelected={item.id === selectedConsultationId}
                    onSelect={onSelectConsultation}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
