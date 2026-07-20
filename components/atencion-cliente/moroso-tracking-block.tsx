"use client"

import { useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  MOROSO_TRACKING_STATUS_OPTIONS,
  resolveMorosoTrackingStatus,
} from "@/lib/customer-atenciones/moroso-flow"
import type { MorosoTrackingStatus } from "@/lib/types/customer-atenciones"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MorosoTrackingBlockProps = {
  atencionId: string
  trackingStatus?: MorosoTrackingStatus | null
}

export function MorosoTrackingBlock({
  atencionId,
  trackingStatus,
}: MorosoTrackingBlockProps) {
  const { updateMorosoTracking } = useAtencionCliente()
  const [selectedStatus, setSelectedStatus] = useState<MorosoTrackingStatus>(
    resolveMorosoTrackingStatus(trackingStatus)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setSelectedStatus(resolveMorosoTrackingStatus(trackingStatus))
  }, [trackingStatus])

  async function handleSave() {
    setError(null)
    setIsSaving(true)

    try {
      const result = await updateMorosoTracking(atencionId, selectedStatus)

      if (!result.success) {
        setError(result.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges =
    selectedStatus !== resolveMorosoTrackingStatus(trackingStatus)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado del proceso de cobranza</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Estado interno del proceso de cobranza (cupón, acreditación,
          rehabilitación). No cambia la bandeja: la consulta sigue en Morosos.
        </p>

        <div className="space-y-2">
          <Label htmlFor="moroso-tracking-status">Estado del proceso</Label>
          <Select
            value={selectedStatus}
            onValueChange={(value) =>
              setSelectedStatus(value as MorosoTrackingStatus)
            }
          >
            <SelectTrigger id="moroso-tracking-status" className="w-full">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {MOROSO_TRACKING_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? "Guardando…" : "Actualizar seguimiento"}
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
