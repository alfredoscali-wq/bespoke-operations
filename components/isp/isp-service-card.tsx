"use client"

import {
  AlertTriangle,
  Calendar,
  Network,
  Pencil,
  Receipt,
  Wifi,
  Zap,
} from "lucide-react"

import {
  IspCommercialStatusBadge,
  IspTechnicalStatusBadge,
} from "@/components/isp/isp-status-badges"
import { Button } from "@/components/ui/button"
import {
  ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE,
} from "@/lib/isp/constants"
import {
  ISP_COMMERCIAL_STATUS_TONES,
  ISP_CONNECTION_TYPE_LABELS,
} from "@/lib/isp/labels"
import {
  formatIspDate,
  formatIspMoneyMonthly,
  formatIspSpeedPair,
} from "@/lib/isp/detail-presentation"
import type { SubscriberServiceSheetMode } from "@/components/isp/isp-subscriber-service-sheet"
import type { IspServiceWithConnection } from "@/lib/isp/types"
import { STATUS_ACCENT_BORDER_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function IspServiceCard({
  service,
  onOpen,
}: {
  service: IspServiceWithConnection
  onOpen: (
    mode: SubscriberServiceSheetMode,
    service: IspServiceWithConnection
  ) => void
}) {
  const speed = formatIspSpeedPair(service)
  const isCancelled = service.commercialStatus === "cancelled"
  const isPending = service.commercialStatus === "pending_activation"
  const connection = service.connection
  const tone = ISP_COMMERCIAL_STATUS_TONES[service.commercialStatus]

  return (
    <article
      id={`servicio-${service.id}`}
      className={cn(
        "rounded-xl border border-border/70 border-l-4 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        STATUS_ACCENT_BORDER_STYLES[tone]
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            <Wifi className="mt-0.5 size-4 shrink-0 text-blue-700 dark:text-blue-300" />
            <div className="min-w-0">
              <p className="font-medium leading-tight">{service.planName}</p>
              {service.catalogCode ? (
                <p className="text-xs text-muted-foreground">
                  {service.catalogCode}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <IspCommercialStatusBadge status={service.commercialStatus} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {speed ? (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="size-3.5 text-blue-700 dark:text-blue-300" />
            <span className="font-medium text-foreground">{speed}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-1.5 font-medium">
          <Receipt className="size-3.5 text-muted-foreground" />
          {formatIspMoneyMonthly(service.monthlyFee)}
        </p>
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          {isCancelled ? "Baja:" : "Alta:"} {formatIspDate(service.activationDate)}
        </p>
        {isPending && service.activationDate ? (
          <p className="pl-5 text-[11px] text-muted-foreground">
            Se activa el {formatIspDate(service.activationDate)}
          </p>
        ) : null}
      </div>

      {connection ? (
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Network className="size-3.5 text-blue-700 dark:text-blue-300" />
              {ISP_CONNECTION_TYPE_LABELS[connection.connectionType]}
            </p>
            <IspTechnicalStatusBadge status={connection.technicalStatus} />
          </div>
          <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {connection.connectionType === "pppoe" && connection.pppoeUsername ? (
              <div>
                Usuario:{" "}
                <span className="font-medium text-foreground">
                  {connection.pppoeUsername}
                </span>
              </div>
            ) : null}
            {connection.ipAddress ? (
              <div>
                IP:{" "}
                <span className="font-medium text-foreground">
                  {connection.ipAddress}
                </span>
              </div>
            ) : null}
            {connection.technicalProfile ? (
              <div>
                Perfil:{" "}
                <span className="font-medium text-foreground">
                  {connection.technicalProfile}
                </span>
              </div>
            ) : null}
            {connection.coreName ? (
              <div>
                Core:{" "}
                <span className="font-medium text-foreground">
                  {connection.coreName}
                </span>
              </div>
            ) : null}
          </dl>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/40">
          <p className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-3.5 shrink-0" />
            {ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE}
          </p>
          {!isCancelled ? (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => onOpen("create-connection", service)}
            >
              Crear conexión
            </Button>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => onOpen("edit-service", service)}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
        {!isCancelled ? (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => onOpen("change-plan", service)}
          >
            Cambiar servicio
          </Button>
        ) : null}
        {connection ? (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => onOpen("view-connection", service)}
          >
            Ver conexión
          </Button>
        ) : null}
      </div>
    </article>
  )
}
