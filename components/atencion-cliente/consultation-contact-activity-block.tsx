"use client"

import { useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  MOROSO_CONTACT_RESULT_OPTIONS,
  type MorosoContactResult,
  type NextActionPreset,
  resolveNextActionAt,
} from "@/lib/customer-atenciones/consultation-interaction"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ConsultationContactActivityBlockProps = {
  atencionId: string
  onRegistered?: () => void | Promise<void>
}

export function ConsultationContactActivityBlock({
  atencionId,
  onRegistered,
}: ConsultationContactActivityBlockProps) {
  const { registerConsultationInteraction } = useAtencionCliente()
  const [result, setResult] = useState<MorosoContactResult | "">("")
  const [detail, setDetail] = useState("")
  const [nextPreset, setNextPreset] = useState<NextActionPreset>("none")
  const [customNext, setCustomNext] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setError(null)

    if (!result) {
      setError("Seleccioná el resultado del contacto.")
      return
    }

    if (!detail.trim()) {
      setError("Completá el detalle de la interacción.")
      return
    }

    if (nextPreset === "custom" && !customNext.trim()) {
      setError("Indicá la fecha y hora de la próxima acción.")
      return
    }

    const nextActionAt = resolveNextActionAt(
      nextPreset,
      nextPreset === "custom" ? customNext : null
    )

    if (nextPreset === "custom" && !nextActionAt) {
      setError("La fecha de próxima acción no es válida.")
      return
    }

    setIsSaving(true)
    try {
      const response = await registerConsultationInteraction(atencionId, {
        interactionKind: "contact",
        interactionResult: result,
        detail: detail.trim(),
        nextActionAt,
      })

      if (!response.success) {
        setError(response.message)
        return
      }

      setResult("")
      setDetail("")
      setNextPreset("none")
      setCustomNext("")
      await onRegistered?.()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">
          Registrar contacto
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
          Registra el resultado del intento. No cambia la bandeja: la consulta
          sigue en Morosos.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consultation-contact-result">Resultado</Label>
        <Select
          value={result || undefined}
          onValueChange={(value) => setResult(value as MorosoContactResult)}
        >
          <SelectTrigger id="consultation-contact-result" className="w-full">
            <SelectValue placeholder="Seleccioná el resultado" />
          </SelectTrigger>
          <SelectContent>
            {MOROSO_CONTACT_RESULT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consultation-contact-detail">Detalle</Label>
        <Textarea
          id="consultation-contact-detail"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={3}
          placeholder={
            result === "promesa_pago"
              ? "Describa la promesa (monto, fecha comprometida, condiciones)."
              : "Describa qué ocurrió en el intento de contacto."
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Próxima acción</Label>
        <div className="flex flex-wrap gap-3 text-[13px] text-slate-700">
          {(
            [
              ["none", "Ninguna"],
              ["today", "Hoy"],
              ["tomorrow", "Mañana"],
              ["custom", "Fecha personalizada"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="consultation-next-action"
                checked={nextPreset === value}
                onChange={() => setNextPreset(value)}
                className="size-3.5 accent-sky-600"
              />
              {label}
            </label>
          ))}
        </div>
        {nextPreset === "custom" ? (
          <input
            type="datetime-local"
            value={customNext}
            onChange={(event) => setCustomNext(event.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px]"
          />
        ) : null}
      </div>

      <Button
        type="button"
        onClick={() => {
          void handleSave()
        }}
        disabled={isSaving || !result || !detail.trim()}
        className="h-10 w-full text-[13px] font-semibold"
      >
        {isSaving ? "Registrando…" : "Registrar contacto"}
      </Button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
