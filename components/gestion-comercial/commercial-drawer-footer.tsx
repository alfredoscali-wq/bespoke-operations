"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SheetFooter } from "@/components/ui/sheet"

type CommercialDrawerFooterProps = {
  formId: string
  isSubmitting: boolean
  onCancel: () => void
}

export function CommercialDrawerFooter({
  formId,
  isSubmitting,
  onCancel,
}: CommercialDrawerFooterProps) {
  return (
    <SheetFooter className="gap-2 border-t sm:flex-row">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button type="submit" form={formId} disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Guardando…
          </>
        ) : (
          "Guardar Oportunidad"
        )}
      </Button>
    </SheetFooter>
  )
}
