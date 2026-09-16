"use client"

import { PROJECT_DESIGN_COLOR_PRESETS } from "@/lib/projects/design/colors"
import { cn } from "@/lib/utils"

type ProjectDesignColorPickerProps = {
  value: string
  recentColors?: string[]
  disabled?: boolean
  onChange: (color: string) => void
}

function Swatch({
  color,
  selected,
  disabled,
  onSelect,
}: {
  color: string
  selected: boolean
  disabled?: boolean
  onSelect: (color: string) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={color}
      title={color}
      onClick={() => onSelect(color)}
      className={cn(
        "size-5 rounded-full border border-white shadow-sm disabled:opacity-50",
        selected ? "ring-2 ring-ring ring-offset-1" : ""
      )}
      style={{ backgroundColor: color }}
    />
  )
}

export function ProjectDesignColorPicker({
  value,
  recentColors = [],
  disabled = false,
  onChange,
}: ProjectDesignColorPickerProps) {
  const current = value.toLowerCase()
  const recents = recentColors.filter(
    (color) =>
      !PROJECT_DESIGN_COLOR_PRESETS.some(
        (preset) => preset.toLowerCase() === color.toLowerCase()
      )
  )

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Colores rápidos
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {PROJECT_DESIGN_COLOR_PRESETS.map((preset) => (
          <Swatch
            key={preset}
            color={preset}
            selected={current === preset.toLowerCase()}
            disabled={disabled}
            onSelect={onChange}
          />
        ))}
        <input
          type="color"
          value={value || "#2563eb"}
          disabled={disabled}
          aria-label="Color personalizado"
          onChange={(event) => onChange(event.target.value)}
          className="h-5 w-6 cursor-pointer rounded-sm border bg-transparent p-0"
        />
      </div>
      {recents.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recientes
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {recents.map((color) => (
              <Swatch
                key={color}
                color={color}
                selected={current === color.toLowerCase()}
                disabled={disabled}
                onSelect={onChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
