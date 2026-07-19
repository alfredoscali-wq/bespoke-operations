"use client"

import { useRouter } from "next/navigation"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { ConsultationHistoricalDaySummaryCard } from "@/components/atencion-cliente/consultation-historical-day-summary-card"
import { ConsultationStatusBadge } from "@/components/atencion-cliente/consultation-status-badge"
import {
  formatCustomerAtencionMotivoLabel,
} from "@/lib/customer-atenciones/format"
import { formatConsultationInboxSituationLabel } from "@/lib/customer-atenciones/consultation-expediente"
import { formatInboxManagingCell } from "@/lib/customer-atenciones/consultation-management-lock"
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
    workTray: null,
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

function TruncatedCellText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <span className={cn("block truncate", className)} title={text}>
      {text}
    </span>
  )
}

/** Open the expediente modal on all breakpoints when a parent handler is provided. */
function ConsultationInboxTableRow({
  item,
  rowNumber,
  isSelected,
  isMyActiveManagement,
  currentEmployeeId,
  onSelect,
}: {
  item: CustomerAtencionInboxRow
  rowNumber: number
  isSelected: boolean
  isMyActiveManagement?: boolean
  currentEmployeeId?: string | null
  onSelect?: (atencionId: string) => void
}) {
  const router = useRouter()
  const motivoLabel = formatCustomerAtencionMotivoLabel(item.motivo)
  const situationLabel = formatConsultationInboxSituationLabel(item)
  const dateLabel = formatRowDate(item.createdAt)
  const managingLabel = formatInboxManagingCell({
    status: item.status,
    activeManagementEmployeeId: item.activeManagementEmployeeId,
    activeManagementEmployeeName: item.activeManagementEmployeeName,
    currentEmployeeId,
  })

  function openConsultation() {
    if (onSelect) {
      onSelect(item.id)
      return
    }

    router.push(`/atencion-cliente/${item.id}`)
  }

  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        isMyActiveManagement &&
          "border-l-4 border-l-sky-500 bg-sky-50/70 hover:bg-sky-50"
      )}
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
      <TableCell className="w-8 px-1.5 text-center text-xs tabular-nums text-muted-foreground">
        {rowNumber}
      </TableCell>
      <TableCell className="w-[18%] max-w-[14rem] px-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <TruncatedCellText
            text={item.customerName}
            className="text-sm font-medium text-foreground"
          />
          {isMyActiveManagement ? (
            <Badge
              variant="secondary"
              className="shrink-0 bg-sky-100 text-[10px] font-semibold text-sky-900"
            >
              En gestión
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="w-[7.5rem] px-1.5">
        <ConsultationStatusBadge status={item.status} />
      </TableCell>
      <TableCell className="w-[6.5rem] px-1.5">
        <TruncatedCellText
          text={motivoLabel}
          className="text-sm text-muted-foreground"
        />
      </TableCell>
      <TableCell className="w-[32%] px-1.5">
        <TruncatedCellText
          text={situationLabel}
          className="text-sm text-foreground"
        />
      </TableCell>
      <TableCell className="w-[9rem] px-1.5">
        {managingLabel ? (
          <TruncatedCellText
            text={managingLabel}
            className={cn(
              "text-sm font-medium",
              isMyActiveManagement ? "text-sky-800" : "text-foreground"
            )}
          />
        ) : null}
      </TableCell>
      <TableCell
        className="w-[5.75rem] px-1.5 text-xs whitespace-nowrap text-muted-foreground"
        title={dateLabel}
      >
        {dateLabel}
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
  const {
    sharedInboxRows,
    isSharedInboxLoading,
    sharedInboxHistoricalDaySummary,
    currentEmployeeId,
  } = useAtencionCliente()

  const createdDate = normalizeSharedInboxCreatedDate(query.createdDate)
  const activeSearch = normalizeSharedInboxSearch(query.search)
  const hasDiscoveryFilters =
    Boolean(activeSearch) || Boolean(createdDate)
  const hasOperationalFilters =
    query.statusFilter !== "all" ||
    Boolean(query.operationalCategory) ||
    Boolean(query.workTray) ||
    (query.motivo && query.motivo !== "all") ||
    (query.channel && query.channel !== "all") ||
    hasDiscoveryFilters

  const showDiscoveryChips = Boolean(activeSearch) || Boolean(createdDate)

  function clearFilters() {
    onQueryChange(createDefaultInboxQuery())
  }

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2 pt-4">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
            Bandeja de Consultas
          </CardTitle>
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
            {STATUS_FILTER_OPTIONS.map((option) => {
              const isActive =
                !query.workTray &&
                !query.operationalCategory &&
                query.statusFilter === option.value

              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() =>
                    onQueryChange({
                      ...query,
                      statusFilter: option.value,
                      operationalCategory: null,
                      workTray: null,
                    })
                  }
                >
                  {option.label}
                </Button>
              )
            })}
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

      <CardContent className="px-3 pt-3 sm:px-4">
        {isSharedInboxLoading ? (
          <p className="text-sm text-muted-foreground">Cargando consultas…</p>
        ) : sharedInboxRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay consultas para los filtros seleccionados.
          </p>
        ) : (
          <div className="max-h-[34rem] overflow-y-auto overflow-x-auto rounded-lg border border-border/50 xl:overflow-x-hidden">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8 px-1.5 text-center text-xs text-muted-foreground">
                    Nº
                  </TableHead>
                  <TableHead className="w-[18%] max-w-[14rem] px-1.5 text-xs text-muted-foreground">
                    Cliente
                  </TableHead>
                  <TableHead className="w-[7.5rem] px-1.5 text-xs text-muted-foreground">
                    Estado
                  </TableHead>
                  <TableHead className="w-[6.5rem] px-1.5 text-xs text-muted-foreground">
                    Motivo
                  </TableHead>
                  <TableHead className="w-[32%] px-1.5 text-xs text-muted-foreground">
                    Situación Actual
                  </TableHead>
                  <TableHead className="w-[9rem] px-1.5 text-xs text-muted-foreground">
                    Gestionando
                  </TableHead>
                  <TableHead className="w-[5.75rem] px-1.5 text-xs text-muted-foreground">
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
                    isMyActiveManagement={
                      item.status === "en_gestion" &&
                      Boolean(currentEmployeeId) &&
                      item.activeManagementEmployeeId === currentEmployeeId
                    }
                    currentEmployeeId={currentEmployeeId}
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
