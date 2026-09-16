export const DEFAULT_NAP_COLOR = "#2563eb"
export const DEFAULT_NODE_COLOR = "#0f172a"
export const DEFAULT_SEGMENT_COLOR = "#ea580c"

export const PROJECT_DESIGN_COLOR_PRESETS = [
  "#2563eb",
  "#ea580c",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#0f172a",
] as const

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export function isProjectDesignHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function normalizeProjectDesignColor(
  value: unknown,
  fallback: string
): string {
  if (typeof value === "string" && isProjectDesignHexColor(value)) {
    return value.toLowerCase()
  }
  return fallback.toLowerCase()
}

export function resolveNapColor(color?: string | null): string {
  return normalizeProjectDesignColor(color, DEFAULT_NAP_COLOR)
}

export function resolveNodeColor(color?: string | null): string {
  return normalizeProjectDesignColor(color, DEFAULT_NODE_COLOR)
}

export function resolveElementColor(
  kind: "node" | "nap",
  color?: string | null
): string {
  return kind === "nap" ? resolveNapColor(color) : resolveNodeColor(color)
}

export function resolveSegmentColor(color?: string | null): string {
  return normalizeProjectDesignColor(color, DEFAULT_SEGMENT_COLOR)
}

export function projectDesignColorToRgb(color: string): {
  r: number
  g: number
  b: number
} {
  const hex = normalizeProjectDesignColor(color, DEFAULT_SEGMENT_COLOR)
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}
