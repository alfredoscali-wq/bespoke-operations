"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { NetworkSubnav } from "@/components/network/network-subnav"
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
  formatNetworkLastSeen,
} from "@/lib/network/labels"
import type { NetworkDevice } from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function NetworkDevicesScreen() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/network/devices")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          devices?: NetworkDevice[]
          message?: string
        }
        if (!body.success) throw new Error(body.message)
        setDevices(body.devices ?? [])
        setError(null)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los devices."
        )
      })
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">
          Inventario de infraestructura y estado operativo del último polling.
        </p>
        <NetworkSubnav current="devices" />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hostname</TableHead>
            <TableHead>Fabricante</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Sitio</TableHead>
            <TableHead>Último visto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                Todavía no hay devices. Ejecutá un discovery desde un Agent.
              </TableCell>
            </TableRow>
          ) : (
            devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-medium">
                  <Link
                    className="underline-offset-2 hover:underline"
                    href={`/network/devices/${device.id}`}
                  >
                    {device.hostname || device.managementIp || "Sin nombre"}
                  </Link>
                </TableCell>
                <TableCell>{device.manufacturer || "—"}</TableCell>
                <TableCell>{device.model || "—"}</TableCell>
                <TableCell>
                  {NETWORK_DEVICE_TYPE_LABELS[device.deviceType]}
                </TableCell>
                <TableCell>{device.managementIp || "—"}</TableCell>
                <TableCell>
                  <StatusBadge
                    className={cn(
                      STATUS_TONE_STYLES[
                        NETWORK_DEVICE_STATUS_TONES[device.operationalStatus]
                      ]
                    )}
                  >
                    {NETWORK_DEVICE_STATUS_LABELS[device.operationalStatus]}
                  </StatusBadge>
                </TableCell>
                <TableCell>{device.siteName || "Sin sitio"}</TableCell>
                <TableCell>{formatNetworkLastSeen(device.lastSeenAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
