"use client"

import { useEffect, useState } from "react"
import { Truck } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type PlanningTravelSegmentRowProps = {
  fromLabel: string
  toLabel: string
  minutes: number
  colSpan: number
  readOnly?: boolean
  isSaving?: boolean
  onCommitMinutes: (minutes: number) => void | Promise<void>
  className?: string
}

export function PlanningTravelSegmentRow({
  fromLabel,
  toLabel,
  minutes,
  colSpan,
  readOnly = false,
  isSaving = false,
  onCommitMinutes,
  className,
}: PlanningTravelSegmentRowProps) {
  const [draft, setDraft] = useState(String(minutes))

  useEffect(() => {
    setDraft(String(minutes))
  }, [minutes])

  async function commit() {
    const parsed = Number.parseInt(draft.trim(), 10)
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    setDraft(String(next))
    if (next === minutes) {
      return
    }
    await onCommitMinutes(next)
  }

  return (
    <tr
      className={cn(
        "border-b border-slate-200/80 bg-slate-50/90 text-slate-600",
        className
      )}
      data-planning-travel-segment=""
    >
      <td colSpan={colSpan} className="px-3 py-1.5">
        <div className="flex min-h-8 items-center gap-2.5">
          <Truck
            className="size-3.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium tracking-tight">
            {fromLabel}
            <span className="mx-1.5 font-normal text-slate-400">→</span>
            {toLabel}
          </p>
          {readOnly ? (
            <span className="shrink-0 text-[12px] tabular-nums text-slate-600">
              {minutes} min
            </span>
          ) : (
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="sr-only">Minutos de traslado</span>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft}
                disabled={isSaving}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  void commit()
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                className="h-7 w-16 border-slate-200 bg-white px-2 text-center text-[12px] tabular-nums"
              />
              <span className="text-[11px] text-slate-500">min</span>
            </label>
          )}
        </div>
      </td>
    </tr>
  )
}
