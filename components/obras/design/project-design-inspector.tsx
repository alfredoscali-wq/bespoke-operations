"use client"

import { useState } from "react"

import { ProjectDesignColorPicker } from "@/components/obras/design/project-design-color-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatPlannedLengthMeters } from "@/lib/gps/distance"
import {
  resolveElementColor,
  resolveSegmentColor,
} from "@/lib/projects/design/colors"
import {
  distanceFromStartForGain,
  parseProjectDesignGainMeters,
} from "@/lib/projects/design/gains"
import {
  iconOptionsForKind,
  projectDesignElementShapeSvg,
  resolveElementIcon,
} from "@/lib/projects/design/icons"
import {
  persistProjectDesignRecentColor,
  readProjectDesignRecentColors,
} from "@/lib/projects/design/recent-colors"
import {
  formatProjectDesignKindLabel,
  formatProjectDesignSegmentTypeLabel,
} from "@/lib/projects/design/labels"
import { resolveProjectDesignSegmentLabel } from "@/lib/projects/design/summary"
import { buildProjectDesignTraceDetail } from "@/lib/projects/design/trace-detail"
import { ProjectDesignTraceDetailCard } from "@/components/obras/design/project-design-trace-detail"
import type {
  ProjectDesignElement,
  ProjectDesignElementIcon,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSegmentType,
} from "@/lib/types/project-design"
import { PROJECT_DESIGN_SEGMENT_TYPES } from "@/lib/types/project-design"
import { cn } from "@/lib/utils"

type ProjectDesignInspectorProps = {
  element: ProjectDesignElement | null
  segment: ProjectDesignSegment | null
  gain: ProjectDesignGain | null
  elements: ProjectDesignElement[]
  segments: ProjectDesignSegment[]
  gains: ProjectDesignGain[]
  disabled?: boolean
  onSaveElement: (input: {
    name?: string
    notes?: string
    color?: string
    icon?: ProjectDesignElementIcon
    gainM?: number
  }) => Promise<boolean>
  onSaveSegment: (input: {
    name?: string
    notes?: string
    type?: ProjectDesignSegmentType
    cableReference?: string
    color?: string
    originElementId?: string | null
    destinationElementId?: string | null
  }) => Promise<boolean>
  onSaveGain: (input: { gainM: number; observations: string }) => Promise<boolean>
  onDelete: () => void
}

export function ProjectDesignInspector({
  element,
  segment,
  gain,
  elements,
  segments,
  gains,
  disabled = false,
  onSaveElement,
  onSaveSegment,
  onSaveGain,
  onDelete,
}: ProjectDesignInspectorProps) {
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [cableReference, setCableReference] = useState("")
  const [segmentType, setSegmentType] = useState<ProjectDesignSegmentType>("tendido")
  const [color, setColor] = useState("")
  const [icon, setIcon] = useState<ProjectDesignElementIcon>("circle")
  const [originElementId, setOriginElementId] = useState("")
  const [destinationElementId, setDestinationElementId] = useState("")
  const [gainInput, setGainInput] = useState("0")
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectionSync, setSelectionSync] = useState<{
    element: ProjectDesignElement | null
    segment: ProjectDesignSegment | null
    gain: ProjectDesignGain | null
  } | null>(null)

  const gainSegment = gain
    ? (segments.find((item) => item.id === gain.segmentId) ?? null)
    : null
  const distanceFromStart = gain
    ? distanceFromStartForGain(gain, gainSegment)
    : null

  if (
    selectionSync === null ||
    element !== selectionSync.element ||
    segment !== selectionSync.segment ||
    gain !== selectionSync.gain
  ) {
    setSelectionSync({ element, segment, gain })
    setRecentColors(readProjectDesignRecentColors())
    setLocalError(null)
    if (gain) {
      setGainInput(String(gain.gainM))
      setNotes(gain.observations)
      setName("")
      setCableReference("")
      setSegmentType("tendido")
      setOriginElementId("")
      setDestinationElementId("")
    } else if (element) {
      setName(element.name)
      setNotes(element.notes)
      setColor(resolveElementColor(element.kind, element.color))
      setIcon(resolveElementIcon(element.kind, element.icon))
      setGainInput(String(element.gainM ?? 0))
      setCableReference("")
      setSegmentType("tendido")
      setOriginElementId("")
      setDestinationElementId("")
    } else if (segment) {
      setName(segment.name)
      setNotes(segment.notes)
      setCableReference(segment.cableReference)
      setSegmentType(segment.type)
      setColor(resolveSegmentColor(segment.color))
      setOriginElementId(segment.originElementId ?? "")
      setDestinationElementId(segment.destinationElementId ?? "")
      setGainInput("0")
    }
  }

  if (!element && !segment && !gain) {
    return (
      <div className="rounded-lg border bg-background/95 p-3 text-xs text-muted-foreground shadow-sm">
        Seleccione un nodo, NAP, traza o ganancia para editarlo.
      </div>
    )
  }

  function handleColorPicked(nextColor: string) {
    setColor(nextColor)
    setRecentColors(persistProjectDesignRecentColor(nextColor))
  }

  function readGainValue(): number | null {
    const parsed = parseProjectDesignGainMeters(gainInput)
    if (parsed == null) {
      setLocalError("La ganancia debe ser un número mayor o igual a 0.")
      return null
    }
    return parsed
  }

  async function handleSave() {
    setSaving(true)
    setLocalError(null)
    try {
      if (gain) {
        const parsed = readGainValue()
        if (parsed == null) {
          return
        }
        await onSaveGain({ gainM: parsed, observations: notes })
        return
      }
      if (element) {
        const parsed = readGainValue()
        if (parsed == null) {
          return
        }
        await onSaveElement({ name, notes, color, icon, gainM: parsed })
        return
      }
      if (segment) {
        await onSaveSegment({
          name,
          notes,
          type: segmentType,
          cableReference,
          color,
          originElementId: originElementId || null,
          destinationElementId: destinationElementId || null,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const iconOptions = element ? iconOptionsForKind(element.kind) : []

  if (gain) {
    return (
      <div className="space-y-3 rounded-lg border bg-background/95 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Ganancia</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {gainSegment
                ? resolveProjectDesignSegmentLabel(gainSegment, elements)
                : "Traza"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:text-destructive"
            disabled={disabled || saving}
            onClick={onDelete}
          >
            Eliminar
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="design-gain-m" className="text-xs">
            Ganancia
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="design-gain-m"
              inputMode="decimal"
              value={gainInput}
              disabled={disabled || saving}
              onChange={(event) => setGainInput(event.target.value)}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">m</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium">Distancia desde inicio</p>
          <p className="text-sm tabular-nums text-foreground">
            {distanceFromStart == null
              ? "—"
              : formatPlannedLengthMeters(distanceFromStart)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Informativa. No modifica la geometría ni los metros de ganancia.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="design-gain-notes" className="text-xs">
            Observaciones
          </Label>
          <Textarea
            id="design-gain-notes"
            value={notes}
            disabled={disabled || saving}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="min-h-16 text-sm"
          />
        </div>

        {localError ? (
          <p className="text-xs text-destructive">{localError}</p>
        ) : null}

        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={disabled || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background/95 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {segment ? (
          <ProjectDesignTraceDetailCard
            detail={buildProjectDesignTraceDetail(segment, {
              elements,
              segments,
              gains,
            })}
          />
        ) : (
          <p className="text-xs font-semibold text-foreground">
            {formatProjectDesignKindLabel(element!.kind)}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 text-destructive hover:text-destructive"
          disabled={disabled || saving}
          onClick={onDelete}
        >
          Eliminar
        </Button>
      </div>

      {segment ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="design-segment-type" className="text-xs">
                Tipo
              </Label>
              <select
                id="design-segment-type"
                value={segmentType}
                disabled={disabled || saving}
                onChange={(event) =>
                  setSegmentType(event.target.value as ProjectDesignSegmentType)
                }
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {PROJECT_DESIGN_SEGMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatProjectDesignSegmentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="design-cable-reference" className="text-xs">
                Cable / referencia
              </Label>
              <Input
                id="design-cable-reference"
                value={cableReference}
                disabled={disabled || saving}
                onChange={(event) => setCableReference(event.target.value)}
                placeholder="Sin especificar"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="design-origin" className="text-xs">
                Origen
              </Label>
              <select
                id="design-origin"
                value={originElementId}
                disabled={disabled || saving}
                onChange={(event) => setOriginElementId(event.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Sin definir</option>
                {elements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="design-destination" className="text-xs">
                Destino
              </Label>
              <select
                id="design-destination"
                value={destinationElementId}
                disabled={disabled || saving}
                onChange={(event) => setDestinationElementId(event.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Sin definir</option>
                {elements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="design-item-name" className="text-xs">
          {segment ? "Nombre" : "Identificador"}
        </Label>
        <Input
          id="design-item-name"
          value={name}
          disabled={disabled || saving}
          onChange={(event) => setName(event.target.value)}
          placeholder={element ? "NAP 1" : "Tendido principal"}
          className="h-8 text-sm"
        />
      </div>

      {element ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Icono</Label>
          <div className="flex flex-wrap gap-1.5">
            {iconOptions.map((option) => {
              const selectedIcon = icon === option
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled || saving}
                  title={option}
                  aria-label={option}
                  aria-pressed={selectedIcon}
                  onClick={() => setIcon(option)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border bg-background disabled:opacity-50",
                    selectedIcon ? "border-primary ring-1 ring-primary" : "border-input"
                  )}
                  dangerouslySetInnerHTML={{
                    __html: projectDesignElementShapeSvg({
                      icon: option,
                      color,
                      size: 16,
                    }),
                  }}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <ProjectDesignColorPicker
          value={color}
          recentColors={recentColors}
          disabled={disabled || saving}
          onChange={handleColorPicked}
        />
      </div>

      {element ? (
        <div className="space-y-1.5">
          <Label htmlFor="design-element-gain" className="text-xs">
            Ganancia
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="design-element-gain"
              inputMode="decimal"
              value={gainInput}
              disabled={disabled || saving}
              onChange={(event) => setGainInput(event.target.value)}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">m</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="design-item-notes" className="text-xs">
          Observaciones
        </Label>
        <Textarea
          id="design-item-notes"
          value={notes}
          disabled={disabled || saving}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="min-h-16 text-sm"
        />
      </div>

      {localError ? (
        <p className="text-xs text-destructive">{localError}</p>
      ) : null}

      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={disabled || saving || (Boolean(element) && !name.trim())}
        onClick={() => void handleSave()}
      >
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  )
}
