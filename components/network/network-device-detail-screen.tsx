"use client"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"

import { NetworkSubnav } from "@/components/network/network-subnav"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  NETWORK_DEVICE_STATUS_LABELS,
  NETWORK_DEVICE_STATUS_TONES,
  NETWORK_DEVICE_TYPE_LABELS,
  formatNetworkBytes,
  formatNetworkCpu,
  formatNetworkHistoryChangedAt,
  formatNetworkHistoryDuration,
  formatNetworkLastSeen,
  formatNetworkMemory,
  formatNetworkTemperature,
  formatNetworkTimestamp,
} from "@/lib/network/labels"
import { invalidateNetworkOperationalQueries } from "@/lib/network/react-query/invalidate"
import { useNetworkDeviceHistoryQuery } from "@/lib/network/react-query/use-network-device-history-query"
import { useNetworkDeviceQuery } from "@/lib/network/react-query/use-network-device-query"
import type {
  NetworkDeviceStatusHistory,
  NetworkDeviceStatusHistoryEvent,
  NetworkInterfaceMonitoring,
} from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function NetworkDeviceDetailScreen({ deviceId }: { deviceId: string }) {
  const queryClient = useQueryClient()
  const { data: device, error, isPending } = useNetworkDeviceQuery(deviceId)
  const historyQuery = useNetworkDeviceHistoryQuery(deviceId)
  const [pollMessage, setPollMessage] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  const loadError =
    error instanceof Error
      ? error.message
      : error
        ? "No se pudo cargar el dispositivo."
        : null

  async function requestPoll() {
    setPolling(true)
    setPollMessage(null)
    try {
      const response = await fetch("/api/network/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
        job?: {
          id?: string
          jobType?: string
          status?: string
        }
      }
      if (!body.success) throw new Error(body.message)
      setPollMessage(
        body.job?.id
          ? `Polling solicitado (${body.job.jobType ?? "job"} ${body.job.status ?? ""}). Job ${body.job.id}.`
          : "Polling solicitado. El estado se actualiza cuando el Agent complete el job."
      )
      await invalidateNetworkOperationalQueries(queryClient, deviceId)
    } catch (pollError: unknown) {
      setPollMessage(
        pollError instanceof Error ? pollError.message : "No se pudo solicitar el polling."
      )
    } finally {
      setPolling(false)
    }
  }

  const operational = device?.monitoring?.status ?? device?.operationalStatus ?? "unknown"
  const monitoringByName = new Map<string, NetworkInterfaceMonitoring>(
    (device?.monitoring?.interfaces ?? []).map((item) => [
      item.interfaceName.trim().toLowerCase(),
      item,
    ])
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {device?.hostname || "Device"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Inventario descubierto y estado operativo actual.
        </p>
        <NetworkSubnav current="devices" />
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-sm underline" href="/network/devices">
            Volver al inventario
          </Link>
          {device ? (
            <Button size="sm" disabled={polling} onClick={() => void requestPoll()}>
              {polling ? "Solicitando…" : "Polling ahora"}
            </Button>
          ) : null}
        </div>
        {pollMessage ? (
          <p className="text-sm text-muted-foreground">{pollMessage}</p>
        ) : null}
      </div>

      {loadError && !device ? <p className="text-sm text-destructive">{loadError}</p> : null}
      {isPending && !device ? (
        <p className="text-sm text-muted-foreground">Cargando dispositivo…</p>
      ) : null}

      {device ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              className={cn(STATUS_TONE_STYLES[NETWORK_DEVICE_STATUS_TONES[operational]])}
            >
              {NETWORK_DEVICE_STATUS_LABELS[operational]}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">
              Inventario: {NETWORK_DEVICE_STATUS_LABELS[device.status]}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              label="Último polling"
              value={formatNetworkTimestamp(device.monitoring?.lastPollAt)}
            />
            <InfoCard
              label="Último polling exitoso"
              value={formatNetworkTimestamp(device.monitoring?.lastSuccessAt)}
            />
            <InfoCard
              label="CPU"
              value={formatNetworkCpu(device.monitoring?.cpuLoad)}
            />
            <InfoCard
              label="Memoria disponible"
              value={formatNetworkMemory(device.monitoring?.memoryAvailable)}
            />
            <InfoCard
              label="Memoria total"
              value={formatNetworkMemory(device.monitoring?.memoryTotal)}
            />
            <InfoCard label="Uptime" value={device.monitoring?.uptime} />
            <InfoCard label="RouterOS" value={device.monitoring?.routerosVersion} />
            {device.monitoring?.temperature != null ? (
              <InfoCard
                label="Temperatura"
                value={formatNetworkTemperature(device.monitoring.temperature)}
              />
            ) : null}
            <InfoCard label="Fabricante" value={device.manufacturer} />
            <InfoCard label="Modelo" value={device.model} />
            <InfoCard
              label="Tipo"
              value={NETWORK_DEVICE_TYPE_LABELS[device.deviceType]}
            />
            <InfoCard label="IP de gestión" value={device.managementIp} />
            <InfoCard label="Serial" value={device.serialNumber} />
            <InfoCard label="MAC" value={device.macAddress} />
            <InfoCard label="Firmware" value={device.firmwareVersion} />
            <InfoCard label="Sitio" value={device.siteName ?? "Sin sitio"} />
            <InfoCard label="Agent" value={device.agentName} />
            <InfoCard
              label="Último visto"
              value={formatNetworkLastSeen(device.lastSeenAt)}
            />
          </div>

          {device.monitoring?.errorMessage ? (
            <p className="text-sm text-destructive">{device.monitoring.errorMessage}</p>
          ) : null}

          <DeviceStatusHistorySection
            isPending={historyQuery.isPending}
            error={historyQuery.error}
            history={historyQuery.data}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interfaces</CardTitle>
              <CardDescription>
                Inventario descubierto y contadores del último polling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>MAC</TableHead>
                    <TableHead>IPs</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Speed</TableHead>
                    <TableHead>RX</TableHead>
                    <TableHead>TX</TableHead>
                    <TableHead>Errores</TableHead>
                    <TableHead>Drops</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {device.interfaces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-muted-foreground">
                        Sin interfaces descubiertas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    device.interfaces.map((iface) => {
                      const counters = monitoringByName.get(iface.name.trim().toLowerCase())
                      const rxErrors = (counters?.rxErrors ?? 0) + (counters?.txErrors ?? 0)
                      const drops = (counters?.rxDrops ?? 0) + (counters?.txDrops ?? 0)
                      return (
                        <TableRow key={iface.id}>
                          <TableCell className="font-medium">{iface.name}</TableCell>
                          <TableCell>{iface.interfaceType || "—"}</TableCell>
                          <TableCell>{iface.macAddress || "—"}</TableCell>
                          <TableCell>
                            {iface.addresses.length > 0
                              ? iface.addresses
                                  .map((item) =>
                                    item.prefixLength
                                      ? `${item.address}/${item.prefixLength}`
                                      : item.address
                                  )
                                  .join(", ")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {counters?.status || iface.status || "—"}
                          </TableCell>
                          <TableCell>
                            {counters?.speedMbps
                              ? `${counters.speedMbps} Mbps`
                              : iface.speedMbps
                                ? `${iface.speedMbps} Mbps`
                                : "—"}
                          </TableCell>
                          <TableCell>{formatNetworkBytes(counters?.rxBytes)}</TableCell>
                          <TableCell>{formatNetworkBytes(counters?.txBytes)}</TableCell>
                          <TableCell>
                            {counters ? rxErrors : "—"}
                          </TableCell>
                          <TableCell>{counters ? drops : "—"}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relaciones descubiertas</CardTitle>
              <CardDescription>
                Adyacencias persistidas. El mapa visual llega después.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {device.links.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin vecinos identificados todavía.
                </p>
              ) : (
                device.links.map((link) => (
                  <div key={link.id} className="rounded-md border px-3 py-2 text-sm">
                    {link.fromDeviceHostname || "Device A"}
                    {link.fromInterfaceName ? ` / ${link.fromInterfaceName}` : ""}
                    {" → "}
                    {link.toDeviceHostname || "Device B"}
                    {link.toInterfaceName ? ` / ${link.toInterfaceName}` : ""}
                    {link.protocol ? ` · ${link.protocol}` : ""}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function DeviceStatusHistorySection({
  isPending,
  error,
  history,
}: {
  isPending: boolean
  error: unknown
  history: NetworkDeviceStatusHistory | undefined
}) {
  const historyError =
    error instanceof Error
      ? error.message
      : error
        ? "No se pudo cargar el histórico."
        : null
  const events = history?.events ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de estado</CardTitle>
        <CardDescription>
          Transiciones persistidas de Monitoring. No incluye cada poll.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && !history ? (
          <p className="text-sm text-muted-foreground">Cargando histórico…</p>
        ) : null}
        {historyError ? (
          <p className="text-sm text-destructive">{historyError}</p>
        ) : null}
        {!isPending && !historyError && events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cambios de estado registrados
          </p>
        ) : null}
        {events.map((event) => (
          <StatusHistoryEventItem key={event.id} event={event} />
        ))}
      </CardContent>
    </Card>
  )
}

function StatusHistoryEventItem({
  event,
}: {
  event: NetworkDeviceStatusHistoryEvent
}) {
  const previousLabel = NETWORK_DEVICE_STATUS_LABELS[event.previousStatus]
  const nextLabel = NETWORK_DEVICE_STATUS_LABELS[event.newStatus]

  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          className={cn(
            STATUS_TONE_STYLES[NETWORK_DEVICE_STATUS_TONES[event.previousStatus]]
          )}
        >
          {previousLabel}
        </StatusBadge>
        <span className="text-muted-foreground">→</span>
        <StatusBadge
          className={cn(
            STATUS_TONE_STYLES[NETWORK_DEVICE_STATUS_TONES[event.newStatus]]
          )}
        >
          {nextLabel}
        </StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatNetworkHistoryChangedAt(event.changedAt)}
      </p>
      <p className="text-xs text-muted-foreground">
        Duración: {formatNetworkHistoryDuration(event.durationSeconds)}
      </p>
      {event.message ? (
        <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
      ) : null}
    </div>
  )
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-base font-medium">{value || "—"}</CardTitle>
      </CardHeader>
    </Card>
  )
}
