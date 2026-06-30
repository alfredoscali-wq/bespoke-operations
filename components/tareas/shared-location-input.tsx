"use client"

import { useMemo } from "react"

import { getLocationInputFeedback } from "@/lib/location"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type SharedLocationInputProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  readOnly?: boolean
  className?: string
}

export function SharedLocationInput({
  id,
  label,
  value,
  onChange,
  placeholder = "https://maps.app.goo.gl/...",
  required = false,
  readOnly = false,
  className,
}: SharedLocationInputProps) {
  const feedback = useMemo(() => getLocationInputFeedback(value), [value])

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
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
      ) : null}
    </div>
  )
}
