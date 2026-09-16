"use client"

import { useMemo, useState } from "react"

import { ProjectDesignMapView } from "@/components/obras/design/project-design-map-view"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseProjectDesignMapHighlightKey } from "@/lib/projects/design/map-view"
import { formatProjectDesignKindLabel } from "@/lib/projects/design/labels"
import { resolveProjectDesignSegmentLabel } from "@/lib/projects/design/summary"
import { buildProjectDesignTraceDetail } from "@/lib/projects/design/trace-detail"
import { ProjectDesignTraceDetailCard } from "@/components/obras/design/project-design-trace-detail"
import type {
  ProjectDesignMapHighlight,
  ProjectDesignSelection,
  ProjectDesignSnapshot,
} from "@/lib/types/project-design"

type ProjectDesignMapPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: ProjectDesignSnapshot
  projectLatitude?: number | null
  projectLongitude?: number | null
}

export function ProjectDesignMapPreviewDialog({
  open,
  onOpenChange,
  snapshot,
  projectLatitude,
  projectLongitude,
}: ProjectDesignMapPreviewDialogProps) {
  const [highlightKey, setHighlightKey] = useState("")
  const [inspected, setInspected] = useState<ProjectDesignSelection>(null)

  const highlight = useMemo((): ProjectDesignMapHighlight | null => {
    if (highlightKey === "segments:demo") {
      const ids = snapshot.segments.slice(0, 2).map((segment) => segment.id)
      if (ids.length === 0) {
        return null
      }
      return { kind: "segment", ids }
    }
    return parseProjectDesignMapHighlightKey(highlightKey)
  }, [highlightKey, snapshot.segments])

  const inspectedSegment = useMemo(() => {
    if (inspected?.type !== "segment") {
      return null
    }
    return snapshot.segments.find((item) => item.id === inspected.id) ?? null
  }, [inspected, snapshot.segments])

  const inspectedTraceDetail = useMemo(() => {
    if (!inspectedSegment) {
      return null
    }
    return buildProjectDesignTraceDetail(inspectedSegment, snapshot)
  }, [inspectedSegment, snapshot])

  const inspectedLabel = useMemo(() => {
    if (!inspected) {
      return "Clic en un Node, NAP, traza o ganancia para inspeccionar."
    }
    if (inspected.type === "element") {
      const element = snapshot.elements.find((item) => item.id === inspected.id)
      if (!element) {
        return "Elemento"
      }
      return `${formatProjectDesignKindLabel(element.kind)} · ${element.name}`
    }
    if (inspected.type === "segment") {
      return inspectedTraceDetail?.identifier ?? "Traza"
    }
    const gain = snapshot.gains.find((item) => item.id === inspected.id)
    return gain ? `Ganancia ${gain.gainM} m` : "Ganancia"
  }, [inspected, inspectedTraceDetail, snapshot])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setHighlightKey("")
          setInspected(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex h-[min(92vh,52rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Mapa de Obra</DialogTitle>
          <DialogDescription>
            Vista de solo lectura del diseño. No permite dibujar ni editar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="project-design-map-highlight"
            className="text-xs font-medium text-muted-foreground"
          >
            Highlight de prueba
          </label>
          <select
            id="project-design-map-highlight"
            className="h-8 min-w-[12rem] rounded-lg border border-input bg-background px-2 text-sm"
            value={highlightKey}
            onChange={(event) => {
              setHighlightKey(event.target.value)
              setInspected(null)
            }}
          >
            <option value="">Sin highlight</option>
            {snapshot.elements.map((element) => (
              <option key={element.id} value={`element:${element.id}`}>
                {formatProjectDesignKindLabel(element.kind)} · {element.name}
              </option>
            ))}
            {snapshot.segments.map((segment) => (
              <option key={segment.id} value={`segment:${segment.id}`}>
                Traza · {resolveProjectDesignSegmentLabel(segment, snapshot.elements)}
              </option>
            ))}
            {snapshot.segments.length >= 2 ? (
              <option value="segments:demo">Varias trazas (prueba)</option>
            ) : null}
          </select>
        </div>

        <div className="min-h-0 flex-1">
          {open ? (
            <ProjectDesignMapView
              snapshot={snapshot}
              projectLatitude={projectLatitude}
              projectLongitude={projectLongitude}
              highlight={highlight}
              onInspect={(selection) => {
                setInspected(selection)
                if (selection?.type === "segment") {
                  setHighlightKey(`segment:${selection.id}`)
                }
              }}
            />
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{inspectedLabel}</p>
        {inspectedTraceDetail ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <ProjectDesignTraceDetailCard detail={inspectedTraceDetail} />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
