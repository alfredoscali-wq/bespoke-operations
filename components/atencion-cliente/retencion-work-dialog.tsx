"use client"

import { useEffect, useMemo, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  CUSTOMER_RETENCION_RESOLVE_RESULTADO_OPTIONS,
  formatCustomerRetencionMotivoBajaLabel,
  formatCustomerRetencionResultadoLabel,
  formatCustomerRetencionStatusLabel,
  getCustomerRetencionStatusTone,
} from "@/lib/customer-retenciones/format"
import type { ResolveCustomerRetencionInput } from "@/lib/types/customer-retenciones"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { STATUS_BADGE_BASE, STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type RetencionWorkDialogProps = {
  retencionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RetencionWorkDialog({
  retencionId,
  open,
  onOpenChange,
}: RetencionWorkDialogProps) {
  const {
    fetchRetencionById,
    pendingRetenciones,
    resolveRetencion,
  } = useAtencionCliente()
  const [resultado, setResultado] =
    useState<ResolveCustomerRetencionInput["resultado"]>("retenido")
  const [resolution, setResolution] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedDetail, setLoadedDetail] = useState<string | null>(null)

  const listRow = useMemo(
    () => pendingRetenciones.find((item) => item.id === retencionId) ?? null,
    [pendingRetenciones, retencionId]
  )

  const isEnGestion = listRow?.status === "en_gestion"
  const isPendienteRetiro = listRow?.status === "pendiente_retiro"

  useEffect(() => {
    if (!open || !retencionId) {
      return
    }

    let cancelled = false
    const currentRetencionId = retencionId

    async function load() {
      setIsLoading(true)
      setError(null)
      setResultado("retenido")
      setResolution("")

      const retencion = await fetchRetencionById(currentRetencionId)
      if (!cancelled) {
        setLoadedDetail(retencion?.detail ?? listRow?.detail ?? null)
        setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [fetchRetencionById, listRow?.detail, open, retencionId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!retencionId || !isEnGestion || !resolution.trim()) {
      setError("Completá las observaciones de la gestión.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await resolveRetencion(retencionId, {
        resultado,
        resolution,
      })

      if (!result.success) {
        setError(result.message ?? "No se pudo registrar la gestión.")
        return
      }

      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[50rem]">
        <DialogHeader>
          <DialogTitle>Gestión de baja</DialogTitle>
          <DialogDescription>
            {isPendienteRetiro
              ? "Coordiná el retiro de equipo con el cliente."
              : "Revisá la solicitud y registrá el resultado del contacto."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !listRow ? (
          <p className="text-sm text-muted-foreground">Cargando gestión…</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  STATUS_BADGE_BASE,
                  STATUS_TONE_STYLES[getCustomerRetencionStatusTone(listRow.status)]
                )}
              >
                {formatCustomerRetencionStatusLabel(listRow.status)}
              </Badge>
              {listRow.resultado ? (
                <Badge variant="outline" className={STATUS_BADGE_BASE}>
                  {formatCustomerRetencionResultadoLabel(listRow.resultado)}
                </Badge>
              ) : null}
            </div>

            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <p className="font-medium">{listRow.customerName}</p>
              <p className="text-muted-foreground">
                {formatCustomerRetencionMotivoBajaLabel(listRow.motivoBaja)} ·{" "}
                {new Date(listRow.createdAt).toLocaleDateString("es-AR")}
              </p>
              <p className="mt-2">{loadedDetail ?? listRow.detail}</p>
              {listRow.resolution ? (
                <p className="mt-2 text-muted-foreground">
                  Gestión realizada: {listRow.resolution}
                </p>
              ) : null}
            </div>

            {isEnGestion ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="retencion-resultado">Resultado</Label>
                  <Select
                    value={resultado}
                    onValueChange={(value) =>
                      setResultado(value as ResolveCustomerRetencionInput["resultado"])
                    }
                  >
                    <SelectTrigger id="retencion-resultado" className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_RETENCION_RESOLVE_RESULTADO_OPTIONS.map(
                        (option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retencion-resolution">
                    Observaciones / Resolución
                  </Label>
                  <Textarea
                    id="retencion-resolution"
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    rows={3}
                    placeholder="Qué ocurrió en el contacto con el cliente"
                  />
                </div>
              </>
            ) : null}

            {isPendienteRetiro ? (
              <p className="text-sm text-muted-foreground">
                Administración marcó esta gestión como lista para retiro. La
                creación de la OT de Baja estará disponible próximamente.
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              {isEnGestion ? (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando…" : "Confirmar gestión"}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
