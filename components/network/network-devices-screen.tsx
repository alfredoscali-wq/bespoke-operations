"use client"

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
  formatNetworkTimestamp,
} from "@/lib/network/labels"
import { useNetworkDevicesQuery } from "@/lib/network/react-query/use-network-devices-query"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function NetworkDevicesScreen() {
  const { data: devices = [], error, isPending } = useNetworkDevicesQuery()
  const loadError =
    error instanceof Error
      ? error.message
      : error
        ? "No se pudieron cargar los devices."
        : null

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">
          Inventario de infraestructura y estado operativo del último polling.
        </p>
        <NetworkSubnav current="devices" />
      </div>

      {loadError && devices.length === 0 ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

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
                {isPending
                  ? "Cargando devices…"
                  : "Todavía no hay devices. Ejecutá un discovery desde un Agent."}
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
                <TableCell>{formatNetworkTimestamp(device.lastPollAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
