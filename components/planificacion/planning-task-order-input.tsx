"use client"

import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { parseOperationalOrderInput } from "@/lib/planificacion/planning-execution-order"
import { cn } from "@/lib/utils"

type PlanningTaskOrderInputProps = {
  taskId: string
  currentOrder: number | null
  maxOrder: number
  disabled?: boolean
  className?: string
  onMoveToPosition: (taskId: string, position: number) => void
}

export function PlanningTaskOrderInput({
  taskId,
  currentOrder,
  maxOrder,
  disabled = false,
  className,
  onMoveToPosition,
}: PlanningTaskOrderInputProps) {
  const [draft, setDraft] = useState(
    currentOrder != null ? String(currentOrder) : ""
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(currentOrder != null ? String(currentOrder) : "")
    setError(null)
  }, [taskId, currentOrder])

  function restoreCurrentOrder() {
    setDraft(currentOrder != null ? String(currentOrder) : "")
    setError(null)
  }

  function commitDraft() {
    if (disabled || maxOrder <= 0) {
      return
    }

    const trimmed = draft.trim()
    if (!trimmed) {
      setError("Indique el orden.")
      restoreCurrentOrder()
      return
    }

    const parsed = parseOperationalOrderInput(trimmed)
    if (!parsed.valid) {
      setError(parsed.message)
      restoreCurrentOrder()
      return
    }

    const clamped = Math.min(Math.max(parsed.order, 1), maxOrder)

    if (currentOrder === clamped) {
      setDraft(String(clamped))
      setError(null)
      return
    }

    setDraft(String(clamped))
    setError(null)
    onMoveToPosition(taskId, clamped)
  }

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <Input
        type="number"
        min={1}
        max={maxOrder}
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        aria-label="Orden operativo"
        aria-invalid={error != null}
        className="h-7 w-12 px-1 text-center text-sm tabular-nums"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === "Enter") {
            event.preventDefault()
            commitDraft()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            restoreCurrentOrder()
          }
        }}
        onBlur={() => {
          if (draft.trim() === (currentOrder != null ? String(currentOrder) : "")) {
            setError(null)
            return
          }
          commitDraft()
        }}
      />
      {error ? (
        <span className="max-w-[7rem] text-center text-[10px] leading-tight text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
