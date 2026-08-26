"use client"

import { useMemo } from "react"

import { getLocationInputFeedback } from "@/lib/location"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const LOCATION_INPUT_DEFAULT_LABEL = "Ubicación"
export const LOCATION_INPUT_DEFAULT_PLACEHOLDER =
  "Pegue un enlace de Google Maps o coordenadas GPS."

export type LocationInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  /** Native HTML required. Defaults to false so JS validation owns the message. */
  htmlRequired?: boolean
  readOnly?: boolean
  disabled?: boolean
  className?: string
  /** Optional helper under the field. Defaults to a short paste hint. */
  hint?: string | null
  /** When false, hides the live validation feedback. Default true. */
  showFeedback?: boolean
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

/**
 * Canonical Bespoke location capture field.
 * Accepts Google Maps links (maps.app.goo.gl, google.com/maps) and GPS coordinates.
 * Resolution at save time is owned by callers via lib/location helpers.
 */
export function LocationInput({
  id,
  value,
  onChange,
  label = LOCATION_INPUT_DEFAULT_LABEL,
  placeholder = LOCATION_INPUT_DEFAULT_PLACEHOLDER,
  required = false,
  htmlRequired = false,
  readOnly = false,
  disabled = false,
  className,
  hint = "Pegá el enlace compartido desde Google Maps o las coordenadas GPS.",
  showFeedback = true,
  onKeyDown,
}: LocationInputProps) {
  const feedback = useMemo(
    () => (showFeedback ? getLocationInputFeedback(value) : null),
    [showFeedback, value]
  )

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={htmlRequired}
        readOnly={readOnly}
        disabled={disabled}
        autoComplete="off"
        className={readOnly ? "bg-muted/40" : undefined}
      />
      {feedback ? (
        <p
          className={cn(
            "text-xs",
            feedback.startsWith("✓")
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          )}
        >
          {feedback}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
