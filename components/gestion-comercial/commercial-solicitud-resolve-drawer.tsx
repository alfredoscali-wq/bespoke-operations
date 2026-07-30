"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  COMMERCIAL_SOLICITUD_RESOLUTION_CODES,
  COMMERCIAL_SOLICITUD_RESOLUTION_LABELS,
  commercialSolicitudAllowsOtGeneration,
  type CommercialSolicitudResolutionCode,
} from "@/lib/commercial/solicitud-catalogs"
import {
  buildSolicitudOtCreateHref,
  storeSolicitudOtCreatePrefill,
  type SolicitudOtCreatePrefill,
} from "@/lib/commercial/solicitud-ot-create"
import { resolveCommercialSolicitudBrowser } from "@/lib/supabase/commercial-solicitudes.browser"
import type { CommercialSolicitud } from "@/lib/types/commercial-solicitudes"

const FORM_ID = "commercial-solicitud-resolve-form"

type CommercialSolicitudResolveDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  actorEmployeeId: string | null
  solicitud: CommercialSolicitud | null
  otPrefill: SolicitudOtCreatePrefill | null
  onResolved: (solicitud: CommercialSolicitud) => void
}

export function CommercialSolicitudResolveDrawer({
  open,
  onOpenChange,
  companyId,
  actorEmployeeId,
  solicitud,
  otPrefill,
  onResolved,
}: CommercialSolicitudResolveDrawerProps) {
  const router = useRouter()
  const [resolution, setResolution] = useState<
    CommercialSolicitudResolutionCode | ""
  >("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = useMemo(() => {
    if (!solicitud) return null
    return {
      ...solicitud,
      resolutionCode: resolution || solicitud.resolutionCode,
    }
  }, [resolution, solicitud])

  const showGenerateOt =
    current != null &&
    commercialSolicitudAllowsOtGeneration(
      current.resolutionCode,
      current.workOrderId
    )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setResolution(solicitud?.resolutionCode ?? "")
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, solicitud])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!companyId || !solicitud) {
      setError("Solicitud no resuelta.")
      return
    }
    if (!resolution) {
      setError("Seleccioná una resolución.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await resolveCommercialSolicitudBrowser(
        companyId,
        solicitud.id,
        resolution,
        { employeeId: actorEmployeeId }
      )
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo resolver la solicitud.")
        return
      }
      onResolved(result.data)
      if (result.data.resolutionCode !== "venta_concretada") {
        onOpenChange(false)
      } else {
        setResolution("venta_concretada")
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo resolver la solicitud."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleGenerateOt() {
    if (!solicitud || !otPrefill) {
      setError("Faltan datos para generar la OT.")
      return
    }
    storeSolicitudOtCreatePrefill({
      ...otPrefill,
      solicitudId: solicitud.id,
    })
    onOpenChange(false)
    router.push(buildSolicitudOtCreateHref(solicitud.id))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Resolver Solicitud</SheetTitle>
          <SheetDescription>
            {solicitud
              ? `Definí el resultado comercial de ${solicitud.code}.`
              : "Definí el resultado comercial de la solicitud."}
          </SheetDescription>
        </SheetHeader>

        <form
          id={FORM_ID}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-2">
            <Label htmlFor="solicitud-resolution">Resolución *</Label>
            <Select
              value={resolution || undefined}
              onValueChange={(value) =>
                setResolution(value as CommercialSolicitudResolutionCode)
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="solicitud-resolution">
                <SelectValue placeholder="Seleccionar resolución" />
              </SelectTrigger>
              <SelectContent>
                {COMMERCIAL_SOLICITUD_RESOLUTION_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {COMMERCIAL_SOLICITUD_RESOLUTION_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showGenerateOt ? (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-sm text-foreground">
                La venta quedó concretada. Podés generar la Orden de Trabajo
                ahora o más adelante desde esta solicitud.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={handleGenerateOt}
                disabled={!otPrefill}
              >
                Generar Orden de Trabajo
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <CommercialDrawerFooter
          formId={FORM_ID}
          isSubmitting={isSubmitting}
          onCancel={() => onOpenChange(false)}
          submitLabel="Guardar resolución"
        />
      </SheetContent>
    </Sheet>
  )
}
