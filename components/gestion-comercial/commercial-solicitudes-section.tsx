"use client"

import { useState } from "react"
import {
  Ban,
  CheckCircle2,
  Eye,
  FilePlus2,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react"

import { EntityActivityTimeline } from "@/components/activity/entity-activity-timeline"
import { REQUEST_TIMELINE_FILTERS } from "@/lib/activity/activity-timeline-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  COMMERCIAL_SOLICITUD_PRIORITY_LABELS,
  COMMERCIAL_SOLICITUD_RESOLUTION_LABELS,
  COMMERCIAL_SOLICITUD_STATUS_LABELS,
  commercialSolicitudAllowsOtGeneration,
} from "@/lib/commercial/solicitud-catalogs"
import type { CommercialSolicitud } from "@/lib/types/commercial-solicitudes"
import { cn } from "@/lib/utils"

type CommercialSolicitudesSectionProps = {
  solicitudes: CommercialSolicitud[]
  isLoading?: boolean
  onNew: () => void
  onEdit: (solicitud: CommercialSolicitud) => void
  onResolve: (solicitud: CommercialSolicitud) => void
  onGenerateOt: (solicitud: CommercialSolicitud) => void
  onCancel: (solicitud: CommercialSolicitud) => void
  className?: string
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return "—"
  }
}

function statusVariant(
  status: CommercialSolicitud["status"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "finalizada":
      return "default"
    case "cancelada":
      return "destructive"
    case "ot_generada":
      return "secondary"
    case "en_gestion":
      return "secondary"
    default:
      return "outline"
  }
}

export function CommercialSolicitudesSection({
  solicitudes,
  isLoading = false,
  onNew,
  onEdit,
  onResolve,
  onGenerateOt,
  onCancel,
  className,
}: CommercialSolicitudesSectionProps) {
  const [viewing, setViewing] = useState<CommercialSolicitud | null>(null)
  const [cancelling, setCancelling] = useState<CommercialSolicitud | null>(null)

  return (
    <>
      <Card className={cn("overflow-hidden rounded-xl border shadow-sm", className)}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Solicitudes</CardTitle>
            <CardDescription>
              Proceso comercial del cliente hasta su resolución.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-2"
            onClick={onNew}
          >
            <Plus className="size-4" />
            Nueva Solicitud
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando solicitudes…</p>
          ) : solicitudes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
              <FilePlus2
                className="size-8 text-muted-foreground/70"
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">
                Todavía no hay solicitudes
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Registrá el primer pedido del cliente para gestionar el proceso
                comercial hasta su resolución.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {solicitudes.map((solicitud) => {
                const isClosed =
                  solicitud.status === "cancelada" ||
                  solicitud.status === "finalizada" ||
                  solicitud.status === "ot_generada"
                const canResolve = !isClosed || commercialSolicitudAllowsOtGeneration(
                  solicitud.resolutionCode,
                  solicitud.workOrderId
                )
                const canGenerateOt = commercialSolicitudAllowsOtGeneration(
                  solicitud.resolutionCode,
                  solicitud.workOrderId
                )
                const canCancel =
                  solicitud.status !== "cancelada" &&
                  solicitud.status !== "finalizada" &&
                  solicitud.status !== "ot_generada"

                return (
                  <li
                    key={solicitud.id}
                    className="rounded-lg border bg-card px-3 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold tracking-wide">
                            {solicitud.code}
                          </span>
                          <Badge variant="secondary">
                            {solicitud.requestTypeName ?? "—"}
                          </Badge>
                          <Badge variant={statusVariant(solicitud.status)}>
                            {
                              COMMERCIAL_SOLICITUD_STATUS_LABELS[
                                solicitud.status
                              ]
                            }
                          </Badge>
                          <Badge variant="outline">
                            {
                              COMMERCIAL_SOLICITUD_PRIORITY_LABELS[
                                solicitud.priority
                              ]
                            }
                          </Badge>
                          {solicitud.resolutionCode ? (
                            <Badge variant="outline">
                              {
                                COMMERCIAL_SOLICITUD_RESOLUTION_LABELS[
                                  solicitud.resolutionCode
                                ]
                              }
                            </Badge>
                          ) : null}
                        </div>
                        <dl className="grid gap-1 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              Producto
                            </dt>
                            <dd>{solicitud.productPlan.trim() || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              Fecha
                            </dt>
                            <dd>{formatDate(solicitud.createdAt)}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-xs text-muted-foreground">
                              Responsable
                            </dt>
                            <dd>
                              {solicitud.responsibleEmployeeName?.trim() ||
                                "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => setViewing(solicitud)}
                        >
                          <Eye className="size-3.5" />
                          Ver
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => onEdit(solicitud)}
                          disabled={isClosed && !canGenerateOt}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => onResolve(solicitud)}
                          disabled={!canResolve && !canGenerateOt}
                        >
                          <CheckCircle2 className="size-3.5" />
                          Resolver
                        </Button>
                        {canGenerateOt ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => onGenerateOt(solicitud)}
                          >
                            <Wrench className="size-3.5" />
                            Generar OT
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={!canCancel}
                          onClick={() => setCancelling(solicitud)}
                        >
                          <Ban className="size-3.5" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={viewing != null}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Solicitud {viewing?.code ?? ""}</DialogTitle>
            <DialogDescription>
              Detalle del proceso comercial de la solicitud.
            </DialogDescription>
          </DialogHeader>
          {viewing ? (
            <Tabs defaultValue="datos" className="min-h-0 flex-1 space-y-4 overflow-hidden">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="datos">Datos</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent
                value="datos"
                className="max-h-[55vh] overflow-y-auto"
              >
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Tipo</dt>
                    <dd>{viewing.requestTypeName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Estado</dt>
                    <dd>
                      {COMMERCIAL_SOLICITUD_STATUS_LABELS[viewing.status]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Prioridad</dt>
                    <dd>
                      {COMMERCIAL_SOLICITUD_PRIORITY_LABELS[viewing.priority]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Resolución</dt>
                    <dd>
                      {viewing.resolutionCode
                        ? COMMERCIAL_SOLICITUD_RESOLUTION_LABELS[
                            viewing.resolutionCode
                          ]
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Fecha</dt>
                    <dd>{formatDate(viewing.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">OT vinculada</dt>
                    <dd className="font-mono text-xs">
                      {viewing.workOrderId ?? "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      Producto / Servicio
                    </dt>
                    <dd>{viewing.productPlan.trim() || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Responsable</dt>
                    <dd>{viewing.responsibleEmployeeName?.trim() || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Observaciones</dt>
                    <dd className="whitespace-pre-wrap">
                      {viewing.observations.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              </TabsContent>
              <TabsContent
                value="activity"
                className="max-h-[55vh] overflow-y-auto"
              >
                <EntityActivityTimeline
                  scope={{
                    kind: "entity",
                    entityType: "request",
                    entityId: viewing.id,
                  }}
                  visibleFilters={REQUEST_TIMELINE_FILTERS}
                  layout="embedded"
                  showStats
                />
              </TabsContent>
            </Tabs>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewing(null)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelling != null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar solicitud</DialogTitle>
            <DialogDescription>
              {cancelling
                ? `¿Confirmás cancelar la solicitud ${cancelling.code}?`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelling(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!cancelling) return
                const target = cancelling
                setCancelling(null)
                onCancel(target)
              }}
            >
              Cancelar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
