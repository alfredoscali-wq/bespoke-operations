"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  ClipboardList,
  Clock,
  Gauge,
  Hash,
  Headphones,
  History,
  IdCard,
  Mail,
  MapPin,
  MessageCircle,
  Network,
  Package,
  Pencil,
  Phone,
  Wifi,
  Zap,
} from "lucide-react"

import { IspActivityTimeline } from "@/components/isp/isp-activity-timeline"
import { IspCustomerEditSheet } from "@/components/isp/isp-customer-edit-sheet"
import {
  IspCustomerSummaryCards,
  IspDetailSkeleton,
  IspEmptyState,
  IspInfoRow,
  IspSectionHeader,
} from "@/components/isp/isp-detail-ui"
import { IspServiceCard } from "@/components/isp/isp-service-card"
import {
  IspTechnicalStatusBadge,
  IspTonedStatusBadge,
} from "@/components/isp/isp-status-badges"
import { IspSubscriberHistorySheet } from "@/components/isp/isp-subscriber-history-sheet"
import {
  IspSubscriberServiceSheet,
  type SubscriberServiceSheetMode,
} from "@/components/isp/isp-subscriber-service-sheet"
import { IspWorkOrderSheet } from "@/components/isp/isp-work-order-sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TelLink } from "@/components/ui/tel-link"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import {
  ISP_CORE_NOT_CONNECTED_MESSAGE,
  ISP_EMPTY_SERVICES_MESSAGE,
  ISP_MONITORING_PLACEHOLDER,
} from "@/lib/isp/constants"
import {
  contractedAbonoTotal,
  customerInitials,
  deriveIspGeneralVisualStatus,
  formatIspDate,
  formatIspDocumentLine,
  formatIspMoney,
  friendlyIspDetailError,
  liveServices,
  workOrderVisualTone,
} from "@/lib/isp/detail-presentation"
import { ISP_CONNECTION_TYPE_LABELS } from "@/lib/isp/labels"
import { ISP_ACTIVITY_SUMMARY_LIMIT } from "@/lib/isp/subscriber-service-integrity"
import type { IspCustomerDetail, IspServiceWithConnection } from "@/lib/isp/types"

export function IspCustomerDetailScreen({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [detail, setDetail] = useState<IspCustomerDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workOrderId, setWorkOrderId] = useState<string | null>(null)
  const [sheetMode, setSheetMode] = useState<SubscriberServiceSheetMode | null>(
    null
  )
  const [sheetService, setSheetService] =
    useState<IspServiceWithConnection | null>(null)
  const [editCustomerOpen, setEditCustomerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [tab, setTab] = useState("resumen")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showAllAtenciones, setShowAllAtenciones] = useState(false)

  const loadDetail = useCallback(() => {
    fetch(`/api/isp/customers/${customerId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          detail?: IspCustomerDetail
          message?: string
        }
        if (!body.success || !body.detail) {
          throw new Error(body.message ?? "Abonado no encontrado.")
        }
        setDetail(body.detail)
        setError(null)
      })
      .catch((cause: unknown) => {
        setError(friendlyIspDetailError(cause))
      })
  }, [customerId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  function openSheet(
    mode: SubscriberServiceSheetMode,
    service?: IspServiceWithConnection
  ) {
    setSheetService(service ?? null)
    setSheetMode(mode)
  }

  function handleSaved() {
    setFeedback("Cambios guardados.")
    loadDetail()
    window.setTimeout(() => setFeedback(null), 2500)
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-6 dark:border-amber-800/60 dark:bg-amber-950/40">
        <p className="text-sm font-medium">No pudimos cargar la información.</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadDetail}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!detail) {
    return <IspDetailSkeleton />
  }

  const { customer, services } = detail
  const connections = services
    .map((service) => service.connection)
    .filter((connection): connection is NonNullable<typeof connection> =>
      Boolean(connection)
    )
  const general = deriveIspGeneralVisualStatus(services)
  const abono = contractedAbonoTotal(services)
  const visibleAtenciones = showAllAtenciones
    ? detail.atenciones
    : detail.atenciones.slice(0, 3)
  const recentActivity = detail.activity.slice(0, ISP_ACTIVITY_SUMMARY_LIMIT)
  const currentServices = liveServices(services)
  const documentLine = [
    formatIspDocumentLine(customer.dni),
    customer.externalCustomerCode
      ? `Abonado #${customer.externalCustomerCode}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="text-sm text-muted-foreground hover:underline"
        onClick={() => router.push("/clientes-360")}
      >
        ← Clientes 360°
      </button>

      <header className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar size="lg" className="size-12">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {customerInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {customer.name}
                </h1>
                <IspTonedStatusBadge tone={general.tone}>
                  {general.label}
                </IspTonedStatusBadge>
              </div>
              {documentLine ? (
                <p className="text-sm text-muted-foreground">{documentLine}</p>
              ) : null}
              {customer.locality ? (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {customer.locality}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditCustomerOpen(true)}
            >
              <Pencil className="size-3.5" />
              Editar cliente
            </Button>
            <Button asChild variant="outline">
              <Link href="/atencion-cliente">
                <Headphones className="size-3.5" />
                Nueva Atención
              </Link>
            </Button>
            <Button type="button" onClick={() => openSheet("add-service")}>
              + Agregar servicio
            </Button>
          </div>
        </div>
      </header>

      <IspCustomerSummaryCards
        serviceCount={detail.kpis.serviceCount}
        connectionCount={detail.kpis.connectionCount}
        abonoLabel={abono == null ? "—" : formatIspMoney(abono)}
      />

      <EntityActionFeedback message={feedback} />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="conexiones">Conexiones</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Datos del abonado</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerIdentity customer={customer} />
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Actividad</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                >
                  Ver historial completo
                </Button>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay actividad registrada para este abonado.
                  </p>
                ) : (
                  <IspActivityTimeline events={recentActivity} compact />
                )}
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <IspSectionHeader
              icon={Package}
              title="Servicios"
              action={
                currentServices.length > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setTab("servicios")}
                  >
                    Ver todos
                  </Button>
                ) : null
              }
            />
            {currentServices.length === 0 ? (
              <IspEmptyState
                icon={Wifi}
                title={ISP_EMPTY_SERVICES_MESSAGE}
                action={
                  <Button type="button" onClick={() => openSheet("add-service")}>
                    + Agregar servicio
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3">
                {currentServices.slice(0, 3).map((service) => (
                  <IspServiceCard
                    key={service.id}
                    service={service}
                    onOpen={openSheet}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Historial de OT</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkOrderList
                  orders={detail.workOrders}
                  onOpen={setWorkOrderId}
                />
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Atenciones</CardTitle>
                {detail.atenciones.length > 3 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setShowAllAtenciones((open) => !open)}
                  >
                    {showAllAtenciones ? "Ver menos" : "Ver todas"}
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent>
                {visibleAtenciones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay atenciones registradas para este abonado.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {visibleAtenciones.map((item) => (
                      <li key={item.id} className="flex gap-2 text-sm">
                        <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{item.motivo || "Atención"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatIspDate(item.date)}
                            {item.resultado || item.status
                              ? ` · ${item.resultado || item.status}`
                              : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="servicios" className="space-y-3">
          {services.length === 0 ? (
            <IspEmptyState
              icon={Wifi}
              title={ISP_EMPTY_SERVICES_MESSAGE}
              action={
                <Button type="button" onClick={() => openSheet("add-service")}>
                  + Agregar servicio
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {services.map((service) => (
                <IspServiceCard
                  key={service.id}
                  service={service}
                  onOpen={openSheet}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conexiones" className="space-y-3">
          {connections.length === 0 ? (
            <IspEmptyState
              icon={Network}
              title="Todavía no hay conexiones técnicas."
            />
          ) : (
            <div className="grid gap-3">
              {services.map((service) => {
                const connection = service.connection
                if (!connection) return null
                return (
                  <div
                    key={connection.id}
                    className="rounded-xl border border-border/70 border-l-4 border-l-blue-500 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 font-medium">
                          <Network className="size-4 text-blue-700 dark:text-blue-300" />
                          {ISP_CONNECTION_TYPE_LABELS[connection.connectionType]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {service.planName}
                        </p>
                      </div>
                      <IspTechnicalStatusBadge status={connection.technicalStatus} />
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {connection.connectionType === "pppoe" &&
                      connection.pppoeUsername ? (
                        <p>
                          Usuario:{" "}
                          <span className="font-medium text-foreground">
                            {connection.pppoeUsername}
                          </span>
                        </p>
                      ) : null}
                      {connection.ipAddress ? (
                        <p>
                          IP:{" "}
                          <span className="font-medium text-foreground">
                            {connection.ipAddress}
                          </span>
                        </p>
                      ) : null}
                      {connection.vlan ? (
                        <p>
                          VLAN:{" "}
                          <span className="font-medium text-foreground">
                            {connection.vlan}
                          </span>
                        </p>
                      ) : null}
                      {connection.technicalProfile ? (
                        <p>
                          Perfil:{" "}
                          <span className="font-medium text-foreground">
                            {connection.technicalProfile}
                          </span>
                        </p>
                      ) : null}
                      {connection.coreName ? (
                        <p>
                          Core:{" "}
                          <span className="font-medium text-foreground">
                            {connection.coreName}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => openSheet("view-connection", service)}
                      >
                        Ver conexión
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => openSheet("edit-connection", service)}
                      >
                        Editar conexión
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="diagnostico">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="size-4 text-muted-foreground" />
                Diagnóstico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-3 dark:border-amber-800/60 dark:bg-amber-950/40">
                <IspTonedStatusBadge tone="yellow">
                  Diagnóstico técnico no disponible
                </IspTonedStatusBadge>
                <p className="mt-2 text-sm text-muted-foreground">
                  La conexión todavía no está provisionada.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ISP_CORE_NOT_CONNECTED_MESSAGE}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Estado de conexión", icon: Wifi },
                  { label: "Latencia", icon: Zap },
                  { label: "Pérdida de paquetes", icon: Activity },
                  { label: "Velocidad de bajada", icon: Gauge },
                  { label: "Velocidad de subida", icon: Gauge },
                  { label: "Uptime", icon: Clock },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-dashed border-border/70 px-3 py-2"
                  >
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <item.icon className="size-3.5" />
                      {item.label}
                    </p>
                    <p className="text-sm text-muted-foreground">—</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-dashed border-border/70 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">
                  Historial de desconexiones
                </p>
                <p className="mt-1 text-sm text-muted-foreground">—</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {ISP_MONITORING_PLACEHOLDER}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="size-4 text-muted-foreground" />
                Historial del abonado
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setHistoryOpen(true)}
              >
                Ver historial completo
              </Button>
            </CardHeader>
            <CardContent>
              <IspActivityTimeline
                events={detail.activity}
                emptyTitle="Todavía no hay actividad registrada para este abonado."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IspWorkOrderSheet
        taskId={workOrderId}
        onClose={() => setWorkOrderId(null)}
      />
      <IspSubscriberServiceSheet
        open={Boolean(sheetMode)}
        mode={sheetMode ?? "add-service"}
        customerId={customer.id}
        service={sheetService}
        onClose={() => {
          setSheetMode(null)
          setSheetService(null)
        }}
        onSaved={handleSaved}
      />
      <IspCustomerEditSheet
        open={editCustomerOpen}
        customer={customer}
        onClose={() => setEditCustomerOpen(false)}
        onSaved={handleSaved}
      />
      <IspSubscriberHistorySheet
        open={historyOpen}
        events={detail.activity}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}

function CustomerIdentity({
  customer,
}: {
  customer: IspCustomerDetail["customer"]
}) {
  const contact = [
    customer.phone ? (
      <IspInfoRow
        key="phone"
        icon={Phone}
        label="Teléfono"
        value={<TelLink phone={customer.phone} />}
        toneClassName="bg-primary/10 text-primary"
      />
    ) : null,
    customer.whatsapp ? (
      <IspInfoRow
        key="whatsapp"
        icon={MessageCircle}
        label="WhatsApp"
        value={<WhatsAppLink phone={customer.whatsapp} />}
        toneClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      />
    ) : null,
    customer.email ? (
      <IspInfoRow
        key="email"
        icon={Mail}
        label="Email"
        value={customer.email}
        toneClassName="bg-blue-500/10 text-blue-700 dark:text-blue-300"
      />
    ) : null,
  ].filter(Boolean)

  const address = [
    customer.address ? (
      <IspInfoRow
        key="address"
        icon={MapPin}
        label="Domicilio"
        value={customer.address}
      />
    ) : null,
    customer.locality ? (
      <IspInfoRow
        key="locality"
        icon={MapPin}
        label="Localidad"
        value={customer.locality}
      />
    ) : null,
  ].filter(Boolean)

  const identity = [
    customer.dni ? (
      <IspInfoRow
        key="dni"
        icon={IdCard}
        label="DNI / CUIT"
        value={customer.dni}
        toneClassName="bg-muted text-muted-foreground"
      />
    ) : null,
    customer.externalCustomerCode ? (
      <IspInfoRow
        key="code"
        icon={Hash}
        label="Número de cliente"
        value={customer.externalCustomerCode}
        toneClassName="bg-muted text-muted-foreground"
      />
    ) : null,
  ].filter(Boolean)

  if (contact.length === 0 && address.length === 0 && identity.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos de contacto cargados.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {contact.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Contacto
          </p>
          <div className="grid gap-3 sm:grid-cols-2">{contact}</div>
        </div>
      ) : null}
      {address.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Domicilio
          </p>
          <div className="grid gap-3 sm:grid-cols-2">{address}</div>
        </div>
      ) : null}
      {identity.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Identificación
          </p>
          <div className="grid gap-3 sm:grid-cols-2">{identity}</div>
        </div>
      ) : null}
    </div>
  )
}

function WorkOrderList({
  orders,
  onOpen,
}: {
  orders: IspCustomerDetail["workOrders"]
  onOpen: (id: string) => void
}) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este abonado no tiene OT asociadas.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ClipboardList className="size-3.5 text-muted-foreground" />
              {order.code}
            </p>
            <p className="text-xs text-muted-foreground">
              {[order.type, formatIspDate(order.date)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <IspTonedStatusBadge tone={workOrderVisualTone(order.status)}>
              {order.status}
            </IspTonedStatusBadge>
            <Button size="sm" variant="outline" onClick={() => onOpen(order.id)}>
              Ver OT
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
