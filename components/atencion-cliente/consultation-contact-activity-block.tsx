"use client"

import { CustomerInteractionDialog } from "@/components/atencion-cliente/customer-interaction-dialog"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import type { CustomerAtencionNextStep } from "@/lib/types/customer-atenciones"

type ConsultationContactActivityBlockProps = {
  atencionId: string
  customerId: string
  currentNextStep?: CustomerAtencionNextStep | null
  /** Tray name shown in copy — e.g. Morosos, Retenciones. */
  workTrayLabel: string
  onRegistered?: () => void | Promise<void>
}

/**
 * Thin entry point for tray UIs — opens the unified 1.1C interaction dialog.
 * Prefer the Decision Center action "Registrar interacción" on the expediente.
 */
export function ConsultationContactActivityBlock({
  atencionId,
  customerId,
  currentNextStep = null,
  workTrayLabel,
  onRegistered,
}: ConsultationContactActivityBlockProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">
          Registrar interacción
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
          Registra el contacto con el cliente. No cambia la bandeja: la consulta
          sigue en {workTrayLabel}.
        </p>
      </div>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-full text-[13px] font-semibold"
      >
        Registrar interacción
      </Button>
      <CustomerInteractionDialog
        open={open}
        onOpenChange={setOpen}
        atencionId={atencionId}
        customerId={customerId}
        currentNextStep={currentNextStep}
        onRegistered={onRegistered}
      />
    </div>
  )
}
