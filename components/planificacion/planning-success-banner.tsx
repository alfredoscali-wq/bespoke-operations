"use client"

import { CheckCircle2, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { PlanningSuccessMessage } from "@/lib/planificacion/planning-success-message"
import { cn } from "@/lib/utils"

type PlanningSuccessBannerProps = {
  message: PlanningSuccessMessage | null
  onDismiss: () => void
  className?: string
}

export function PlanningSuccessBanner({
  message,
  onDismiss,
  className,
}: PlanningSuccessBannerProps) {
  if (!message) {
    return null
  }

  return (
    <Alert
      className={cn(
        "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50",
        className
      )}
    >
      <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>{message.description}</AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 text-emerald-800 hover:text-emerald-950 dark:text-emerald-200"
        onClick={onDismiss}
        aria-label="Cerrar mensaje"
      >
        <X className="size-4" />
      </Button>
    </Alert>
  )
}
