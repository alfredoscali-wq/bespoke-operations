"use client"

import { cn } from "@/lib/utils"
import type { ProjectDesignTool } from "@/lib/types/project-design"

const TOOLS: Array<{
  id: ProjectDesignTool
  label: string
  hint: string
}> = [
  { id: "select", label: "Seleccionar", hint: "Mover y editar" },
  { id: "add-node", label: "Agregar Nodo", hint: "Sigue el cursor. Clic para colocar." },
  { id: "add-nap", label: "Agregar NAP", hint: "Sigue el cursor. Clic para colocar." },
  { id: "draw-segment", label: "Dibujar Tramo", hint: "Clics; clic en Nodo/NAP para terminar." },
  { id: "add-gain", label: "Ganancia", hint: "Clic sobre una traza para reservar cable." },
]

type ProjectDesignToolbarProps = {
  tool: ProjectDesignTool
  onToolChange: (tool: ProjectDesignTool) => void
  disabled?: boolean
  drawingPointCount: number
}

export function ProjectDesignToolbar({
  tool,
  onToolChange,
  disabled = false,
  drawingPointCount,
}: ProjectDesignToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Herramientas de diseño"
        className="inline-flex flex-wrap rounded-lg border bg-background/95 p-1 shadow-sm"
      >
        {TOOLS.map((item) => {
          const selected = tool === item.id
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              title={item.hint}
              onClick={() => onToolChange(item.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {tool === "draw-segment" ? (
        <p className="text-xs text-muted-foreground">
          {drawingPointCount === 0
            ? "Clic para empezar. Clic en Nodo/NAP para conectar. Esc cancela."
            : `${drawingPointCount} punto${drawingPointCount === 1 ? "" : "s"}. Clic en Nodo/NAP para terminar. Enter o doble clic también guarda.`}
        </p>
      ) : null}
      {tool === "add-node" || tool === "add-nap" ? (
        <p className="text-xs text-muted-foreground">
          El marcador sigue el cursor. Clic para colocar. Esc cancela.
        </p>
      ) : null}
      {tool === "add-gain" ? (
        <p className="text-xs text-muted-foreground">
          Clic sobre una traza. Esc cancela.
        </p>
      ) : null}
    </div>
  )
}
