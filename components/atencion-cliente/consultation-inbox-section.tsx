"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  formatCustomerAtencionChannelLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import {
  CUSTOMER_ATENCION_CHANNEL_OPTIONS,
  CUSTOMER_ATENCION_MOTIVO_OPTIONS,
} from "@/lib/customer-atenciones/format"
import { truncateConsultationDetail } from "@/lib/customer-atenciones/shared-inbox"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { FILTER_CLEAR_BUTTON_CLASS } from "@/lib/ui/visual-tokens"

const STATUS_FILTER_OPTIONS: { value: SharedInboxStatusFilter; label: string }[] =
  [
    { value: "all", label: "Todas" },
    { value: "nueva", label: "Nuevas" },
    { value: "para_resolver", label: "Para resolver" },
    { value: "en_gestion", label: "En gestión" },
    { value: "pendiente", label: "Pendientes" },
    { value: "resuelta", label: "Resueltas" },
    { value: "resueltas_hoy", label: "Resueltas hoy" },
  ]

function statusBadgeClassName(status: CustomerAtencionInboxRow["status"]): string {
  switch (status) {
    case "nueva":
      return "border-blue-200 bg-blue-500/10 text-blue-700"
    case "para_resolver":
      return "border-amber-200 bg-amber-500/10 text-amber-800"
    case "en_gestion":
      return "border-sky-200 bg-sky-500/10 text-sky-800"
    case "pendiente":
      return "border-violet-200 bg-violet-500/10 text-violet-700"
    case "resuelta":
      return "border-emerald-200 bg-emerald-500/10 text-emerald-700"
    default:
      return ""
  }
}

function ConsultationInboxCard({ item }: { item: CustomerAtencionInboxRow }) {
  const createdTime = new Date(item.createdAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <Link
      href={`/atencion-cliente/${item.id}`}
      className="block rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {item.customerName}
            </p>
            <Badge
              variant="outline"
              className={cn("text-xs", statusBadgeClassName(item.status))}
            >
              {formatCustomerAtencionStatusLabel(item.status)}
            </Badge>
          </div>

          <p className="text-sm text-foreground">
            {truncateConsultationDetail(item.detail)}
          </p>

          <p className="text-xs text-muted-foreground">
            {formatCustomerAtencionMotivoLabel(item.motivo)} ·{" "}
            {formatCustomerAtencionChannelLabel(item.channel)}
          </p>

          <p className="text-xs text-muted-foreground">
            Registrada por {item.attendedByEmployeeName} · {createdTime}
          </p>

          {item.nextStep ? (
            <p className="text-xs font-medium text-foreground">
              Próximo paso: {formatCustomerAtencionNextStepLabel(item.nextStep)}
            </p>
          ) : null}

          {item.status === "en_gestion" &&
          item.activeManagementEmployeeName &&
          item.activeManagementStartedAt ? (
            <p className="text-xs text-sky-800">
              En gestión por {item.activeManagementEmployeeName} desde{" "}
              {new Date(item.activeManagementStartedAt).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>

        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  )
}

type ConsultationInboxSectionProps = {
  query: SharedInboxQuery
  onQueryChange: (query: SharedInboxQuery) => void
}

export function ConsultationInboxSection({
  query,
  onQueryChange,
}: ConsultationInboxSectionProps) {
  const { sharedInboxRows, isSharedInboxLoading } = useAtencionCliente()
  const hasOperationalFilters =
    query.statusFilter !== "all" ||
    (query.motivo && query.motivo !== "all") ||
    (query.channel && query.channel !== "all")

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Bandeja de Consultas</CardTitle>
          {hasOperationalFilters ? (
            <button
              type="button"
              className={FILTER_CLEAR_BUTTON_CLASS}
              onClick={() =>
                onQueryChange({
                  statusFilter: "all",
                  motivo: "all",
                  channel: "all",
                })
              }
            >
              Ver todas
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
                  })
                }
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
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
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isSharedInboxLoading ? (
          <p className="text-sm text-muted-foreground">Cargando consultas…</p>
        ) : sharedInboxRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay consultas para los filtros seleccionados.
          </p>
        ) : (
          sharedInboxRows.map((item) => (
            <ConsultationInboxCard key={item.id} item={item} />
          ))
        )}
      </CardContent>
    </Card>
  )
}
