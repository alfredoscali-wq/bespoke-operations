"use client"

import { useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  formatCustomerRecuperacionChannelLabel,
  formatCustomerRecuperacionResultadoLabel,
  getCustomerRecuperacionDisplayName,
  getCustomerRecuperacionResultadoTone,
  getCustomerRecuperacionZoneLabel,
} from "@/lib/customer-recuperaciones/format"
import type { CustomerRecuperacionActivityRow } from "@/lib/types/customer-recuperaciones"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

type RecuperoViewDialogProps = {
  recuperacionId: string | null
  summary?: CustomerRecuperacionActivityRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value?.trim()) {
    return null
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

export function RecuperoViewDialog({
  recuperacionId,
  summary,
  open,
  onOpenChange,
}: RecuperoViewDialogProps) {
  const { fetchRecuperacionById } = useAtencionCliente()
  const [isLoading, setIsLoading] = useState(false)
  const [displayName, setDisplayName] = useState(summary?.displayName ?? "")
  const [zoneLabel, setZoneLabel] = useState(summary?.zoneLabel ?? null)
  const [phone, setPhone] = useState(summary?.manualPhone ?? null)
  const [channel, setChannel] = useState(summary?.channel ?? null)
  const [offer, setOffer] = useState(summary?.offer ?? "")
  const [observation, setObservation] = useState(summary?.observation ?? "")
  const [resultado, setResultado] = useState(summary?.resultado ?? null)
  const [createdAt, setCreatedAt] = useState(summary?.createdAt ?? "")

  useEffect(() => {
    if (!open || !recuperacionId) {
      return
    }

    const id = recuperacionId
    let cancelled = false

    async function loadDetail() {
      setIsLoading(true)
      const recuperacion = await fetchRecuperacionById(id)

      if (cancelled) {
        return
      }

      if (recuperacion) {
        setDisplayName(
          getCustomerRecuperacionDisplayName(recuperacion, summary?.displayName)
        )
        setZoneLabel(
          getCustomerRecuperacionZoneLabel(recuperacion, summary?.zoneLabel)
        )
        setPhone(recuperacion.manualPhone)
        setChannel(recuperacion.channel)
        setOffer(recuperacion.offer)
        setObservation(recuperacion.observation)
        setResultado(recuperacion.resultado)
        setCreatedAt(recuperacion.createdAt)
      }

      setIsLoading(false)
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [fetchRecuperacionById, open, recuperacionId, summary?.displayName, summary?.zoneLabel])

  const resultadoTone = resultado
    ? getCustomerRecuperacionResultadoTone(resultado)
    : "neutral"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[50rem]">
        <DialogHeader>
          <DialogTitle>Gestión de Recupero</DialogTitle>
          <DialogDescription>Detalle de solo lectura.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando detalle…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {createdAt ? (
                <span className="text-sm text-muted-foreground">
                  {new Date(createdAt).toLocaleDateString("es-AR")}{" "}
                  {new Date(createdAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {resultado ? (
                <Badge
                  variant="outline"
                  className={STATUS_TONE_STYLES[resultadoTone]}
                >
                  {formatCustomerRecuperacionResultadoLabel(resultado)}
                </Badge>
              ) : null}
            </div>

            <DetailField label="Cliente" value={displayName} />
            <DetailField label="Zona" value={zoneLabel} />
            <DetailField label="Teléfono" value={phone} />
            <DetailField
              label="Canal"
              value={channel ? formatCustomerRecuperacionChannelLabel(channel) : null}
            />
            <DetailField label="Oferta o promoción" value={offer} />
            <DetailField label="Observación" value={observation} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
