"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConsultationDecisionAction = {
  id: string
  label: string
  onClick: () => void
  disabled?: boolean
  /** Soft highlight when a related form is open */
  active?: boolean
}

type ConsultationDecisionCenterProps = {
  /** Optional status / blocked-state copy above the actions. */
  statusMessage?: ReactNode
  primary?: ConsultationDecisionAction | null
  /** Content revealed under the primary action (forms, OT block, etc.). */
  primaryDetail?: ReactNode
  secondary?: ConsultationDecisionAction[]
  /** Forms or contextual blocks revealed by a secondary action. */
  detail?: ReactNode
  administrative?: ConsultationDecisionAction[]
  className?: string
}

/**
 * UX 3.0 — shared Decision Center shell for the expediente.
 * Areas only change which actions are passed; the visual structure stays fixed.
 */
export function ConsultationDecisionCenter({
  statusMessage,
  primary,
  primaryDetail,
  secondary = [],
  detail,
  administrative = [],
  className,
}: ConsultationDecisionCenterProps) {
  const hasOperationalActions = Boolean(primary) || secondary.length > 0
  const hasAnything =
    Boolean(statusMessage) || hasOperationalActions || administrative.length > 0

  if (!hasAnything) {
    return null
  }

  return (
    <section
      className={cn(
        "max-w-2xl border-t border-slate-200/80 pt-8",
        className
      )}
    >
      <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-slate-900">
        ¿Qué desea hacer ahora?
      </h2>

      {statusMessage ? (
        <div className="mt-4 text-[13px] leading-relaxed text-slate-600">
          {statusMessage}
        </div>
      ) : null}

      {primary ? (
        <div className="mt-5">
          <Button
            size="lg"
            className="h-11 w-full text-[14px] font-semibold"
            onClick={primary.onClick}
            disabled={primary.disabled}
          >
            {primary.label}
          </Button>
          {primaryDetail ? <div className="mt-3">{primaryDetail}</div> : null}
        </div>
      ) : null}

      {secondary.length > 0 ? (
        <div className={cn("space-y-2", primary ? "mt-4" : "mt-5")}>
          {secondary.map((action) => (
            <Button
              key={action.id}
              size="lg"
              variant={action.active ? "secondary" : "outline"}
              className="h-10 w-full justify-center text-[13px] font-medium"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {detail ? <div className="mt-3">{detail}</div> : null}

      {administrative.length > 0 ? (
        <div className="mt-8 border-t border-slate-200/80 pt-6">
          <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Acciones administrativas
          </p>
          <div className="mt-3 space-y-2">
            {administrative.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 w-full justify-start gap-2 text-[13px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
