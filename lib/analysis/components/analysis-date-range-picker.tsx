"use client"

/**
 * Official Análisis period selector — Sprint 26.
 * One component for the whole Analysis module. No variants.
 *
 * Custom ranges only apply on "Aplicar". Cancel discards draft dates.
 */

import { useEffect, useState } from "react"
import { CalendarRange, Check, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ANALYSIS_DATE_RANGE_PRESET_OPTIONS,
  analysisDateRangeFocusDate,
  createDefaultAnalysisDateRange,
  formatAnalysisDateRangeTriggerLabel,
  resolveAnalysisDateRange,
  toAnalysisDateOnly,
  type AnalysisDateRangePreset,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export type AnalysisDateRangePickerProps = {
  value: AnalysisDateRangeValue
  onChange: (next: AnalysisDateRangeValue) => void
  className?: string
  triggerClassName?: string
  id?: string
  disabled?: boolean
}

export function AnalysisDateRangePicker({
  value,
  onChange,
  className,
  triggerClassName,
  id = "analysis-date-range",
  disabled = false,
}: AnalysisDateRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(value.dateFrom)
  const [draftTo, setDraftTo] = useState(value.dateTo)
  const today = toAnalysisDateOnly(new Date())

  useEffect(() => {
    if (!customOpen) return
    setDraftFrom(value.dateFrom)
    setDraftTo(value.dateTo)
  }, [customOpen, value.dateFrom, value.dateTo])

  const triggerLabel = formatAnalysisDateRangeTriggerLabel(value, today)

  function selectPreset(preset: AnalysisDateRangePreset) {
    if (preset === "custom") {
      setCustomOpen(true)
      return
    }
    onChange(resolveAnalysisDateRange({ preset }))
  }

  function cancelCustom() {
    setCustomOpen(false)
  }

  function applyCustom() {
    if (!draftFrom.trim() || !draftTo.trim()) return
    onChange(
      resolveAnalysisDateRange({
        preset: "custom",
        dateFrom: draftFrom,
        dateTo: draftTo,
      })
    )
    setCustomOpen(false)
  }

  const canApply = Boolean(draftFrom.trim() && draftTo.trim())

  return (
    <div className={cn("space-y-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              FILTER_SELECT_TRIGGER_CLASS,
              "h-8 min-w-[11.5rem] justify-between gap-1.5 px-2.5 font-normal",
              triggerClassName
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          {ANALYSIS_DATE_RANGE_PRESET_OPTIONS.map((option) => {
            const selected =
              option.value === "custom"
                ? value.preset === "custom"
                : value.preset === option.value
            return (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => selectPreset(option.value)}
              >
                <span className="flex-1">{option.label}</span>
                {selected ? (
                  <Check className="size-3.5 text-muted-foreground" />
                ) : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={customOpen}
        onOpenChange={(open) => {
          if (!open) cancelCustom()
          else setCustomOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="size-4" />
              Período personalizado
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-from`}>Desde</Label>
              <Input
                id={`${id}-from`}
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-to`}>Hasta</Label>
              <Input
                id={`${id}-to`}
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={cancelCustom}>
              Cancelar
            </Button>
            <Button type="button" onClick={applyCustom} disabled={!canApply}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export {
  analysisDateRangeFocusDate,
  createDefaultAnalysisDateRange,
  resolveAnalysisDateRange,
  type AnalysisDateRangeValue,
}
