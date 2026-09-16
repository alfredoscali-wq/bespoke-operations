"use client"

import { formatGainMeters, formatPlannedLengthMeters } from "@/lib/gps/distance"
import { resolveElementColor, resolveSegmentColor } from "@/lib/projects/design/colors"
import { formatProjectDesignGainListLabel } from "@/lib/projects/design/gains"
import {
  projectDesignElementShapeSvg,
  resolveElementIcon,
} from "@/lib/projects/design/icons"
import { formatProjectDesignKindLabel } from "@/lib/projects/design/labels"
import {
  buildProjectDesignSummary,
  formatProjectDesignSegmentSidebarMeta,
  resolveProjectDesignSegmentLabel,
} from "@/lib/projects/design/summary"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSelection,
} from "@/lib/types/project-design"
import { cn } from "@/lib/utils"

type ProjectDesignSidebarProps = {
  elements: ProjectDesignElement[]
  segments: ProjectDesignSegment[]
  gains: ProjectDesignGain[]
  selected: ProjectDesignSelection
  onSelect: (selection: ProjectDesignSelection) => void
}

export function ProjectDesignSidebar({
  elements,
  segments,
  gains,
  selected,
  onSelect,
}: ProjectDesignSidebarProps) {
  const summary = buildProjectDesignSummary(elements, segments, gains)
  const nodes = elements.filter((element) => element.kind === "node")
  const naps = elements.filter((element) => element.kind === "nap")

  return (
    <aside className="flex w-full flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Diseño de Obra</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Planificado. No modifica OT ni Field Agent.
        </p>
      </div>

      <section className="rounded-lg border bg-muted/30 p-3 text-xs">
        <p className="font-medium text-foreground">Resumen</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>
            {summary.nodeCount} {formatProjectDesignKindLabel("node")}
            {summary.nodeCount === 1 ? "" : "s"} · {summary.napCount} NAP
          </li>
          <li className="flex justify-between gap-2">
            <span>Metros de tendido</span>
            <span className="tabular-nums text-foreground">
              {formatPlannedLengthMeters(summary.plannedLengthM)}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Ganancias de trazas</span>
            <span className="tabular-nums text-foreground">
              {formatGainMeters(summary.traceGainM)}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Ganancias de NAP/Nodo</span>
            <span className="tabular-nums text-foreground">
              {formatGainMeters(summary.elementGainM)}
            </span>
          </li>
          <li className="flex justify-between gap-2 border-t pt-1 font-medium text-foreground">
            <span>Total cable planificado</span>
            <span className="tabular-nums">
              {formatGainMeters(summary.totalCableM)}
            </span>
          </li>
        </ul>
      </section>

      <ElementGroup
        title="Nodo"
        empty="Sin nodos"
        items={nodes}
        selectedId={selected?.type === "element" ? selected.id : null}
        onSelect={(id) => onSelect({ type: "element", id })}
      />
      <ElementGroup
        title="NAPs"
        empty="Sin NAP"
        items={naps}
        selectedId={selected?.type === "element" ? selected.id : null}
        onSelect={(id) => onSelect({ type: "element", id })}
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trazas
        </p>
        {segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin trazas</p>
        ) : (
          <ul className="space-y-1">
            {segments.map((segment) => {
              const isSelected =
                selected?.type === "segment" && selected.id === segment.id
              const color = resolveSegmentColor(segment.color)
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ type: "segment", id: segment.id })}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {resolveProjectDesignSegmentLabel(segment, elements)}
                      </span>
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {formatProjectDesignSegmentSidebarMeta(segment)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ganancias
        </p>
        {gains.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin ganancias de traza</p>
        ) : (
          <ul className="space-y-1">
            {gains.map((gain) => {
              const isSelected = selected?.type === "gain" && selected.id === gain.id
              const segment = segments.find((item) => item.id === gain.segmentId)
              const color = resolveSegmentColor(segment?.color)
              return (
                <li key={gain.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ type: "gain", id: gain.id })}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span
                      className="mt-1 size-2 shrink-0 rotate-45 border border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 truncate">
                      {formatProjectDesignGainListLabel(gain, segments, elements)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

function ElementGroup({
  title,
  empty,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  empty: string
  items: ProjectDesignElement[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const isSelected = selectedId === item.id
            const color = resolveElementColor(item.kind, item.color)
            const icon = resolveElementIcon(item.kind, item.icon)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span
                    className="inline-flex size-3 shrink-0 items-center justify-center"
                    dangerouslySetInnerHTML={{
                      __html: projectDesignElementShapeSvg({
                        icon,
                        color,
                        size: 12,
                      }),
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{item.name}</span>
                    {item.gainM > 0 ? (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        Ganancia: {formatGainMeters(item.gainM)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
