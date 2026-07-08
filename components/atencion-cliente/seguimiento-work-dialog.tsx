"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  formatScheduledDateLabel,
  formatScheduledTimeLabel,
} from "@/lib/customer-seguimientos/format"
import type { CustomerAtencion } from "@/lib/types/customer-atenciones"
import type { CustomerSeguimiento } from "@/lib/types/customer-seguimientos"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type SeguimientoWorkDialogProps = {
  seguimientoId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type WorkMode = "resuelto" | "nuevo_seguimiento"

export function SeguimientoWorkDialog({
  seguimientoId,
  open,
  onOpenChange,
}: SeguimientoWorkDialogProps) {
  const {
    fetchSeguimientoById,
    fetchAtencionById,
    pendingSeguimientos,
    completeSeguimiento,
    completeSeguimientoWithFollowUp,
  } = useAtencionCliente()
  const [seguimiento, setSeguimiento] = useState<CustomerSeguimiento | null>(null)
  const [atencion, setAtencion] = useState<CustomerAtencion | null>(null)
  const [mode, setMode] = useState<WorkMode>("resuelto")
  const [completionAction, setCompletionAction] = useState("")
  const [nextDate, setNextDate] = useState("")
  const [nextTime, setNextTime] = useState("")
  const [nextObservation, setNextObservation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customerName = useMemo(() => {
    if (!seguimientoId) {
      return "Cliente"
    }

    return (
      pendingSeguimientos.find((item) => item.id === seguimientoId)
        ?.customerName ?? "Cliente"
    )
  }, [pendingSeguimientos, seguimientoId])

  useEffect(() => {
    if (!open || !seguimientoId) {
      return
    }

    let cancelled = false
    const currentSeguimientoId = seguimientoId

    async function load() {
      setIsLoading(true)
      setError(null)
      setMode("resuelto")
      setCompletionAction("")
      setNextDate("")
      setNextTime("")
      setNextObservation("")

      try {
        const loadedSeguimiento = await fetchSeguimientoById(currentSeguimientoId)
        if (cancelled || !loadedSeguimiento) {
          if (!cancelled && !loadedSeguimiento) {
            setError("No se encontró el seguimiento.")
          }
          return
        }

        setSeguimiento(loadedSeguimiento)

        if (loadedSeguimiento.sourceAtencionId) {
          const loadedAtencion = await fetchAtencionById(
            loadedSeguimiento.sourceAtencionId
          )
          if (!cancelled) {
            setAtencion(loadedAtencion)
          }
        } else {
          setAtencion(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [fetchAtencionById, fetchSeguimientoById, open, seguimientoId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!seguimientoId || !completionAction.trim()) {
      setError("Completá la acción realizada.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (mode === "resuelto") {
        const result = await completeSeguimiento(seguimientoId, {
          completionAction,
        })

        if (!result.success) {
          setError(result.message ?? "No se pudo completar el seguimiento.")
          return
        }
      } else {
        if (!nextDate.trim() || !nextObservation.trim()) {
          setError("Completá la fecha y observación del próximo seguimiento.")
          return
        }

        const result = await completeSeguimientoWithFollowUp(seguimientoId, {
          completionAction,
          nextScheduledDate: nextDate,
          nextScheduledTime: nextTime.trim() || null,
          nextObservation,
        })

        if (!result.success) {
          setError(result.message ?? "No se pudo registrar el seguimiento.")
          return
        }
      }

      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trabajar seguimiento</DialogTitle>
          <DialogDescription>
            Registrá el contacto realizado y el resultado de la gestión.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !seguimiento ? (
          <p className="text-sm text-muted-foreground">
            {error ?? "Cargando seguimiento…"}
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <p className="font-medium">{customerName}</p>
              <p className="text-muted-foreground">
                {formatScheduledDateLabel(seguimiento.scheduledDate)} ·{" "}
                {formatScheduledTimeLabel(seguimiento.scheduledTime)}
              </p>
              <p className="mt-2">{seguimiento.observation}</p>
              {atencion ? (
                <p className="mt-2 text-muted-foreground">
                  Atención origen:{" "}
                  <Link
                    href={`/atencion-cliente/${atencion.id}`}
                    className="text-primary hover:underline"
                  >
                    ver detalle
                  </Link>
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="seguimiento-completion-action">Acción realizada</Label>
              <Textarea
                id="seguimiento-completion-action"
                value={completionAction}
                onChange={(event) => setCompletionAction(event.target.value)}
                rows={3}
                placeholder="Qué ocurrió en el contacto"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "resuelto" ? "default" : "outline"}
                onClick={() => setMode("resuelto")}
              >
                Finalizar resuelto
              </Button>
              <Button
                type="button"
                variant={mode === "nuevo_seguimiento" ? "default" : "outline"}
                onClick={() => setMode("nuevo_seguimiento")}
              >
                Nuevo seguimiento
              </Button>
            </div>

            {mode === "nuevo_seguimiento" ? (
              <div className="space-y-4 rounded-lg border px-3 py-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="next-seguimiento-date">Próxima fecha</Label>
                    <Input
                      id="next-seguimiento-date"
                      type="date"
                      value={nextDate}
                      onChange={(event) => setNextDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="next-seguimiento-time">Hora (opcional)</Label>
                    <Input
                      id="next-seguimiento-time"
                      type="time"
                      value={nextTime}
                      onChange={(event) => setNextTime(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next-seguimiento-observation">
                    Observación del próximo contacto
                  </Label>
                  <Textarea
                    id="next-seguimiento-observation"
                    value={nextObservation}
                    onChange={(event) => setNextObservation(event.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Registrar gestión"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
