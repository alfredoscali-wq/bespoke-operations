"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

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
  formatNetworkLastSeen,
  formatNetworkMemory,
  formatNetworkTemperature,
  formatNetworkTimestamp,
} from "@/lib/network/labels"
import type { NetworkDeviceDetail, NetworkInterfaceMonitoring } from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function NetworkDeviceDetailScreen({ deviceId }: { deviceId: string }) {
  const [device, setDevice] = useState<NetworkDeviceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pollMessage, setPollMessage] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  const loadDevice = useCallback(() => {
    return fetch(`/api/network/devices/${deviceId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          device?: NetworkDeviceDetail
          message?: string
        }
        if (!body.success) throw new Error(body.message)
        setDevice(body.device ?? null)
        setError(null)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el dispositivo."
        )
      })
  }, [deviceId])

  useEffect(() => {
    void loadDevice()
  }, [loadDevice])

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
      window.setTimeout(() => {
        void loadDevice()
      }, 8000)
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
