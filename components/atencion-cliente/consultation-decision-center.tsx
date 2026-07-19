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

export type ConsultationAssistantOption = {
  id: string
  label: string
  selected?: boolean
  onSelect: () => void
  disabled?: boolean
}

type ConsultationDecisionCenterProps = {
  /** Compact "Estado actual" block (RC 3.1). */
  currentState?: ReactNode
  /** Banner when another area returned the consultation. */
  flowContext?: ReactNode
  /** Optional status / blocked-state copy above the actions. */
  statusMessage?: ReactNode
  /** Guided selectable outcomes (RC 3.1). */
  options?: ConsultationAssistantOption[]
  /** Dynamic "Próximo paso" copy for the selected option. */
  nextStepMessage?: string | null
  /** Forms revealed for the selected option (resolution, OT, etc.). */
  detail?: ReactNode
  /** Primary confirm — typically "Registrar gestión". */
  confirm?: ConsultationDecisionAction | null
  /**
   * Legacy immediate primary (e.g. Iniciar gestión / open area dialog).
   * Used when the operator is not yet choosing a guided outcome.
   */
  primary?: ConsultationDecisionAction | null
  primaryDetail?: ReactNode
  /** @deprecated Prefer `options` + `confirm` for general management. */
  secondary?: ConsultationDecisionAction[]
  administrative?: ConsultationDecisionAction[]
  className?: string
  /** Section title for the guided choice block. */
  title?: string
}

/**
 * RC 3.1 — Guided management assistant shell for the expediente panel.
 * Areas only change which options are passed; the visual structure stays fixed.
 */
export function ConsultationDecisionCenter({
  currentState,
  flowContext,
  statusMessage,
  options = [],
  nextStepMessage,
  detail,
  confirm,
  primary,
  primaryDetail,
  secondary = [],
  administrative = [],
  className,
  title = "¿Cómo continúa esta atención?",
}: ConsultationDecisionCenterProps) {
  const hasGuidedOptions = options.length > 0
  const hasLegacySecondary = secondary.length > 0
  const hasOperationalActions =
    Boolean(primary) || Boolean(confirm) || hasGuidedOptions || hasLegacySecondary
  const hasAssistantBody =
    Boolean(flowContext) ||
    Boolean(statusMessage) ||
    hasOperationalActions ||
    Boolean(detail) ||
    Boolean(primaryDetail) ||
    administrative.length > 0
  const hasAnything = Boolean(currentState) || hasAssistantBody

  if (!hasAnything) {
    return null
  }

  return (
    <div className={cn(className)}>
      {currentState ? (
        <div className="mb-4 w-full border-t border-slate-200/80 pt-5">
          {currentState}
        </div>
      ) : null}

      {hasAssistantBody ? (
      <section
        className={cn(
          "max-w-2xl",
          !currentState && "border-t border-slate-200/80 pt-5"
        )}
      >
      {flowContext ? <div className="mb-4">{flowContext}</div> : null}

      {statusMessage ? (
        <div className="mb-4 text-[13px] leading-relaxed text-slate-600">
          {statusMessage}
        </div>
      ) : null}

      {hasGuidedOptions ||
      hasLegacySecondary ||
      primary ||
      confirm ||
      detail ? (
        <h2 className="text-[15px] leading-snug font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
      ) : null}

      {primary ? (
        <div className="mt-3">
          <Button
            size="lg"
            className="h-10 w-full text-[13px] font-semibold"
            onClick={primary.onClick}
            disabled={primary.disabled}
          >
            {primary.label}
          </Button>
          {primaryDetail ? <div className="mt-3">{primaryDetail}</div> : null}
        </div>
      ) : null}

      {hasGuidedOptions ? (
        <div className={cn("space-y-1.5", primary ? "mt-3" : "mt-3")}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              aria-pressed={option.selected}
              onClick={option.onSelect}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                option.selected
                  ? "border-sky-300 bg-sky-50/90 ring-1 ring-sky-200/80"
                  : "border-slate-200/90 bg-white hover:bg-slate-50/80",
                option.disabled && "pointer-events-none opacity-60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                  option.selected
                    ? "border-sky-600 bg-sky-600"
                    : "border-slate-300 bg-white"
                )}
                aria-hidden
              >
                {option.selected ? (
                  <span className="size-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              <span className="min-w-0 text-[13px] leading-snug font-medium text-slate-800">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {hasLegacySecondary ? (
        <div className={cn("space-y-2", primary || hasGuidedOptions ? "mt-3" : "mt-3")}>
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

      {nextStepMessage ? (
        <div className="mt-3 rounded-md border border-sky-200/80 bg-sky-50/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wide text-sky-800 uppercase">
            Próximo paso
          </p>
          <p className="mt-1 text-[13px] leading-snug text-slate-700">
            {nextStepMessage}
          </p>
        </div>
      ) : null}

      {detail ? <div className="mt-3">{detail}</div> : null}

      {confirm ? (
        <div className="mt-3">
          <Button
            size="lg"
            className="h-10 w-full text-[13px] font-semibold"
            onClick={confirm.onClick}
            disabled={confirm.disabled}
          >
            {confirm.label}
          </Button>
        </div>
      ) : null}

      {administrative.length > 0 ? (
        <div className="mt-6 border-t border-slate-200/80 pt-4">
          <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Acciones administrativas
          </p>
          <div className="mt-2 space-y-2">
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
      ) : null}
    </div>
  )
}
