import type {
  ProjectDesignElementIcon,
  ProjectDesignElementKind,
} from "@/lib/types/project-design"

export const NODE_ICON_OPTIONS = [
  "square",
  "circle",
  "marker",
  "diamond",
] as const satisfies readonly ProjectDesignElementIcon[]

export const NAP_ICON_OPTIONS = [
  "circle",
  "square",
  "hexagon",
  "marker",
] as const satisfies readonly ProjectDesignElementIcon[]

export const DEFAULT_NODE_ICON: ProjectDesignElementIcon = "square"
export const DEFAULT_NAP_ICON: ProjectDesignElementIcon = "circle"

export function isProjectDesignElementIcon(
  value: unknown
): value is ProjectDesignElementIcon {
  return (
    value === "square" ||
    value === "circle" ||
    value === "marker" ||
    value === "diamond" ||
    value === "hexagon"
  )
}

export function iconOptionsForKind(
  kind: ProjectDesignElementKind
): readonly ProjectDesignElementIcon[] {
  return kind === "nap" ? NAP_ICON_OPTIONS : NODE_ICON_OPTIONS
}

export function defaultIconForKind(
  kind: ProjectDesignElementKind
): ProjectDesignElementIcon {
  return kind === "nap" ? DEFAULT_NAP_ICON : DEFAULT_NODE_ICON
}

export function resolveElementIcon(
  kind: ProjectDesignElementKind,
  icon?: string | null
): ProjectDesignElementIcon {
  const allowed = iconOptionsForKind(kind)
  if (
    isProjectDesignElementIcon(icon) &&
    (allowed as readonly string[]).includes(icon)
  ) {
    return icon
  }
  return defaultIconForKind(kind)
}

export function projectDesignElementShapeSvg(input: {
  icon: ProjectDesignElementIcon
  color: string
  size?: number
}): string {
  const size = input.size ?? 12
  const fill = input.color
  const common = `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"`

  if (input.icon === "circle") {
    return `<svg ${common}><circle cx="8" cy="8" r="6.2" fill="${fill}" stroke="#fff" stroke-width="1.5"/></svg>`
  }
  if (input.icon === "diamond") {
    return `<svg ${common}><polygon points="8,1.4 14.6,8 8,14.6 1.4,8" fill="${fill}" stroke="#fff" stroke-width="1.5"/></svg>`
  }
  if (input.icon === "hexagon") {
    return `<svg ${common}><polygon points="8,1.3 14.2,4.6 14.2,11.4 8,14.7 1.8,11.4 1.8,4.6" fill="${fill}" stroke="#fff" stroke-width="1.5"/></svg>`
  }
  if (input.icon === "marker") {
    return `<svg ${common}><path d="M8 1.2C5.1 1.2 2.8 3.5 2.8 6.4c0 4.1 5.2 8.4 5.2 8.4s5.2-4.3 5.2-8.4C13.2 3.5 10.9 1.2 8 1.2z" fill="${fill}" stroke="#fff" stroke-width="1.2"/><circle cx="8" cy="6.2" r="1.7" fill="#fff"/></svg>`
  }
  return `<svg ${common}><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.4" fill="${fill}" stroke="#fff" stroke-width="1.5"/></svg>`
}

export function projectDesignElementMarkerHtml(input: {
  name: string
  color: string
  icon: ProjectDesignElementIcon
  selected?: boolean
  snapTarget?: boolean
}): string {
  const size = input.selected || input.snapTarget ? 14 : 12
  const ring = input.snapTarget
    ? "box-shadow:0 0 0 4px rgba(2,132,199,.45);"
    : input.selected
      ? `box-shadow:0 0 0 3px ${input.color}55;`
      : ""
  const label = escapeHtml(input.name)
  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <span style="display:flex;height:${size}px;width:${size}px;align-items:center;justify-content:center;${ring}">${projectDesignElementShapeSvg({ icon: input.icon, color: input.color, size })}</span>
      <span style="margin-top:2px;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:3px;background:${input.color};padding:0 4px;font-size:10px;font-weight:600;line-height:16px;color:#fff">${label}</span>
    </div>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
