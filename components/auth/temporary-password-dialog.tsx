"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { buildTemporaryPasswordDeliveryMessage } from "@/lib/auth/initial-credentials-policy"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type TemporaryPasswordReveal = {
  password: string
  displayName?: string
  nationalId?: string | null
}

export function TemporaryPasswordDialog({
  reveal,
  onOpenChange,
}: {
  reveal: TemporaryPasswordReveal | null
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!reveal) return
    await navigator.clipboard.writeText(reveal.password)
    setCopied(true)
  }

  return (
    <Dialog
      open={Boolean(reveal)}
      onOpenChange={(open) => {
        if (!open) setCopied(false)
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contraseña temporal</DialogTitle>
          <DialogDescription>
            {buildTemporaryPasswordDeliveryMessage(reveal?.displayName)}
          </DialogDescription>
        </DialogHeader>
        {reveal ? (
          <div className="space-y-3">
            {reveal.nationalId?.trim() ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Usuario (DNI): </span>
                <span className="font-medium">{reveal.nationalId.trim()}</span>
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {reveal.password}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleCopy()}
                aria-label="Copiar contraseña temporal"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
