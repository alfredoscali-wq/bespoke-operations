"use client"

import L from "leaflet"

import {
  projectDesignGainMarkerHtml,
} from "@/lib/projects/design/gains"
import {
  projectDesignElementMarkerHtml,
  resolveElementIcon,
} from "@/lib/projects/design/icons"
import { resolveElementColor } from "@/lib/projects/design/colors"
import type { ProjectDesignElement } from "@/lib/types/project-design"

export function createProjectDesignElementDivIcon(
  element: Pick<ProjectDesignElement, "name" | "kind" | "color" | "icon">,
  options: { selected?: boolean; snapTarget?: boolean } = {}
): L.DivIcon {
  const selected = Boolean(options.selected)
  const snapTarget = Boolean(options.snapTarget)
  const color = resolveElementColor(element.kind, element.color)
  const icon = resolveElementIcon(element.kind, element.icon)
  const size = selected || snapTarget ? 14 : 12
  return L.divIcon({
    className: "project-design-element !border-0 !bg-transparent",
    html: projectDesignElementMarkerHtml({
      name: element.name,
      color,
      icon,
      selected,
      snapTarget,
    }),
    iconSize: [88, size + 18],
    iconAnchor: [44, size / 2],
  })
}

export function createProjectDesignGainDivIcon(input: {
  gainM: number
  color: string
  selected?: boolean
  labeled?: boolean
}): L.DivIcon {
  const selected = Boolean(input.selected)
  const labeled = Boolean(input.labeled)
  const size = selected ? 10 : 8
  const extra = labeled || selected ? 18 : 0
  return L.divIcon({
    className: "project-design-gain !border-0 !bg-transparent",
    html: projectDesignGainMarkerHtml({
      gainM: input.gainM,
      color: input.color,
      selected,
      labeled,
    }),
    iconSize: [72, size + extra],
    iconAnchor: [36, size / 2],
  })
}
