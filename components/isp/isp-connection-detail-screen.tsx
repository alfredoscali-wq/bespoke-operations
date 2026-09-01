"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { IspConnectionDeleteButton } from "@/components/isp/isp-connection-delete-dialog"
import { IspCommercialStatusBadge, IspTechnicalStatusBadge } from "@/components/isp/isp-status-badges"
import { IspSubscriberServiceSheet } from "@/components/isp/isp-subscriber-service-sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ISP_ACTION_NOT_IMPLEMENTED_MESSAGE,
  ISP_CORE_NOT_CONNECTED_MESSAGE,
  ISP_MONITORING_PLACEHOLDER,
} from "@/lib/isp/constants"
import {
  ISP_CONNECTION_TYPE_LABELS,
  ISP_MONTHLY_COLLECTION_LABELS,
  formatIspTechnologyLabel,
} from "@/lib/isp/labels"
import { connectionFieldsForType } from "@/lib/isp/integrity"
import type { IspConnectionDetail } from "@/lib/isp/types"

export function IspConnectionDetailScreen({ connectionId }: { connectionId: string }) {
  const router = useRouter()
  const [detail, setDetail] = useState<IspConnectionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    fetch(`/api/isp/connections/${connectionId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          detail?: IspConnectionDetail
          message?: string
        }
        if (!body.success || !body.detail) {
          throw new Error(body.message ?? "Conexión no encontrada.")
        }
        setDetail(body.detail)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Error inesperado.")
      })
  }, [connectionId, reloadKey])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!detail) return <p className="text-sm text-muted-foreground">Cargando conexión...</p>

  const { customer, service, connection } = detail
  const fields = connectionFieldsForType(connection.connectionType)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/conexiones" className="text-sm text-muted-foreground hover:underline">
          ← Conexiones
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {customer.name} · {formatIspTechnologyLabel(service.technology)} {service.planName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <IspCommercialStatusBadge status={service.commercialStatus} />
          <IspTechnicalStatusBadge status={connection.technicalStatus} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            Editar
          </Button>
          <IspConnectionDeleteButton
            target={{
              id: connection.id,
              customerName: customer.name,
              planName: service.planName,
              technology: service.technology,
            }}
            onDeleted={() => router.push("/conexiones")}
            onError={setError}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/clientes-360/${customer.id}`}>Ver en Clientes 360°</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{customer.name}</p>
            <p>{customer.dni || "Sin documento"}</p>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link href={`/clientes-360/${customer.id}`}>Ver cliente 360°</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Datos comerciales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Tecnología: {formatIspTechnologyLabel(service.technology)}</p>
            <p>Plan: {service.planName}</p>
            <p>Velocidad: {service.contractedSpeed || "—"}</p>
            <p>Precio: {service.monthlyFee ?? "—"}</p>
            <p>Alta: {service.activationDate || "—"}</p>
            <p>
              Cobranza mensual:{" "}
              {ISP_MONTHLY_COLLECTION_LABELS[service.monthlyCollectionMethod]}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conexión técnica</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>Tipo: {ISP_CONNECTION_TYPE_LABELS[connection.connectionType]}</p>
          {fields.showPppoe ? (
            <>
              <p>Usuario PPPoE: {connection.pppoeUsername || "—"}</p>
              <p>Contraseña: {connection.pppoePasswordSet || connection.pppoePassword ? "••••••" : "—"}</p>
            </>
          ) : null}
          {fields.showStaticIp ? (
            <>
              <p>IP: {connection.ipAddress || "—"}</p>
              <p>Prefijo: {connection.prefixLength ?? "—"}</p>
              <p>Gateway: {connection.gateway || "—"}</p>
            </>
          ) : null}
          <p>VLAN: {connection.vlan || "—"}</p>
          <p>Perfil: {connection.technicalProfile || "—"}</p>
          <p>Core/MikroTik: {connection.coreName || "—"}</p>
          <p>Perfil en Core: {connection.coreProfileId || "—"}</p>
          <p>Última sincronización: {connection.lastSyncAt || "—"}</p>
          <p>Error de provisioning: {connection.provisionError || "—"}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provisioning</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {ISP_CORE_NOT_CONNECTED_MESSAGE}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Salud de conexión</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {ISP_MONITORING_PLACEHOLDER}. Espacio reservado para
            disponibilidad, latencia, pérdida, sesiones y tráfico.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["Suspender", "Rehabilitar", "Reprovisionar", "Modificar"].map(
            (label) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                onClick={() => setActionMessage(ISP_ACTION_NOT_IMPLEMENTED_MESSAGE)}
              >
                {label}
              </Button>
            )
          )}
          {actionMessage ? (
            <p className="w-full text-sm text-muted-foreground">{actionMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <IspSubscriberServiceSheet
        open={editOpen}
        mode="edit-connection"
        customerId={customer.id}
        service={{
          ...service,
          catalogCategory: null,
          connection,
        }}
        onClose={() => setEditOpen(false)}
        onSaved={() => setReloadKey((value) => value + 1)}
      />
    </div>
  )
}
