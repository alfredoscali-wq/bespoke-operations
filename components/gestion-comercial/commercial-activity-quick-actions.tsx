"use client"

import { MessageCircle, Phone, PlusCircle, ClipboardList } from "lucide-react"

import { Button } from "@/components/ui/button"

type CommercialActivityQuickActionsProps = {
  phone?: string | null
  onRegisterActivity: () => void
  onNewSolicitud?: () => void
  disabled?: boolean
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function CommercialActivityQuickActions({
  phone = null,
  onRegisterActivity,
  onNewSolicitud,
  disabled = false,
}: CommercialActivityQuickActionsProps) {
  const digits = phone ? normalizePhoneDigits(phone) : ""
  const canCall = digits.length > 0

  function handleCall() {
    if (!canCall) return
    window.location.href = `tel:${digits}`
  }

  function handleWhatsApp() {
    if (!canCall) return
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !canCall}
        onClick={handleCall}
      >
        <Phone className="size-3.5" aria-hidden />
        Llamar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !canCall}
        onClick={handleWhatsApp}
      >
        <MessageCircle className="size-3.5" aria-hidden />
        WhatsApp
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onRegisterActivity}
      >
        <ClipboardList className="size-3.5" aria-hidden />
        Registrar Actividad
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !onNewSolicitud}
        onClick={onNewSolicitud}
        title={
          onNewSolicitud
            ? undefined
            : "Disponible en un próximo sprint"
        }
      >
        <PlusCircle className="size-3.5" aria-hidden />
        Nueva Solicitud
      </Button>
    </div>
  )
}
