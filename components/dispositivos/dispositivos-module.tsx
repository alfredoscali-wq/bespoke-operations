"use client"

import { useCallback, useEffect, useState } from "react"
import { Smartphone } from "lucide-react"

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MobileDeviceRecord } from "@/lib/mobile-devices/types"

type DevicesResponse = {
  success: boolean
  devices?: MobileDeviceRecord[]
  message?: string
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function statusBadge(status: MobileDeviceRecord["status"]) {
  if (status === "ACTIVE") {
    return <Badge variant="default">Activo</Badge>
  }
  return <Badge variant="destructive">Bloqueado</Badge>
}

export function DispositivosModule() {
  const [devices, setDevices] = useState<MobileDeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<MobileDeviceRecord | null>(
    null
  )
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/mobile-devices")
      const payload = (await response.json()) as DevicesResponse

      if (!response.ok || !payload.success || !payload.devices) {
        throw new Error(payload.message ?? "No se pudieron cargar los dispositivos.")
      }

      setDevices(payload.devices)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los dispositivos."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  async function updateStatus(
    device: MobileDeviceRecord,
    status: MobileDeviceRecord["status"]
  ) {
    setUpdatingId(device.id)

    try {
      const response = await fetch("/api/admin/mobile-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: device.id, status }),
      })
      const payload = (await response.json()) as {
        success: boolean
        device?: MobileDeviceRecord
        message?: string
      }

      if (!response.ok || !payload.success || !payload.device) {
        throw new Error(payload.message ?? "No se pudo actualizar el dispositivo.")
      }

      setDevices((current) =>
        current.map((item) =>
          item.id === payload.device!.id ? payload.device! : item
        )
      )

      if (selectedDevice?.id === payload.device.id) {
        setSelectedDevice(payload.device)
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el dispositivo."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dispositivos
          </CardTitle>
          <CardDescription>
            Registro y autorización de dispositivos corporativos de Bespoke Field Agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando dispositivos...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay dispositivos registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fabricante / Modelo</TableHead>
                  <TableHead>Android</TableHead>
                  <TableHead>Versión App</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>{statusBadge(device.status)}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {device.manufacturer} {device.model}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {device.deviceId}
                      </div>
                    </TableCell>
                    <TableCell>{device.androidVersion}</TableCell>
                    <TableCell>{device.appVersion}</TableCell>
                    <TableCell>{formatDateTime(device.lastSeenAt)}</TableCell>
                    <TableCell>{formatDateTime(device.registeredAt)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDevice(device)}
                      >
                        Ver detalle
                      </Button>
                      {device.status === "BLOCKED" ? (
                        <Button
                          size="sm"
                          disabled={updatingId === device.id}
                          onClick={() => void updateStatus(device, "ACTIVE")}
                        >
                          Activar
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={updatingId === device.id}
                          onClick={() => void updateStatus(device, "BLOCKED")}
                        >
                          Bloquear
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedDevice != null}
        onOpenChange={(open) => {
          if (!open) setSelectedDevice(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del dispositivo</DialogTitle>
            <DialogDescription>
              Información registrada por Bespoke Field Agent.
            </DialogDescription>
          </DialogHeader>
          {selectedDevice ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Estado</dt>
                <dd>{statusBadge(selectedDevice.status)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ID del dispositivo</dt>
                <dd>{selectedDevice.deviceId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fabricante</dt>
                <dd>{selectedDevice.manufacturer}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Modelo</dt>
                <dd>{selectedDevice.model}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Android</dt>
                <dd>{selectedDevice.androidVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versión App</dt>
                <dd>{selectedDevice.appVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plataforma</dt>
                <dd>{selectedDevice.platform}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Último acceso</dt>
                <dd>{formatDateTime(selectedDevice.lastSeenAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha de registro</dt>
                <dd>{formatDateTime(selectedDevice.registeredAt)}</dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
