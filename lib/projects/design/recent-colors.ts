import {
  isProjectDesignHexColor,
  normalizeProjectDesignColor,
} from "@/lib/projects/design/colors"

export const PROJECT_DESIGN_RECENT_COLORS_KEY =
  "bespoke.project-design.recent-colors"
export const PROJECT_DESIGN_RECENT_COLORS_LIMIT = 8

export function rememberProjectDesignRecentColor(
  color: unknown,
  current: string[],
  limit: number = PROJECT_DESIGN_RECENT_COLORS_LIMIT
): string[] {
  const raw = String(color ?? "")
  if (!isProjectDesignHexColor(raw)) {
    return current.slice(0, limit)
  }
  const normalized = raw.toLowerCase()
  return [normalized, ...current.filter((item) => item !== normalized)].slice(
    0,
    Math.max(1, limit)
  )
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function sanitizeRecentColors(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  const colors: string[] = []
  for (const item of values) {
    if (!isProjectDesignHexColor(String(item ?? ""))) {
      continue
    }
    const normalized = normalizeProjectDesignColor(item, "")
    if (normalized && !colors.includes(normalized)) {
      colors.push(normalized)
    }
  }
  return colors.slice(0, PROJECT_DESIGN_RECENT_COLORS_LIMIT)
}

export function readProjectDesignRecentColors(
  storage: Pick<Storage, "getItem"> | null = getBrowserStorage()
): string[] {
  if (!storage) {
    return []
  }
  try {
    const raw = storage.getItem(PROJECT_DESIGN_RECENT_COLORS_KEY)
    if (!raw) {
      return []
    }
    return sanitizeRecentColors(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeProjectDesignRecentColors(
  colors: string[],
  storage: Pick<Storage, "setItem"> | null = getBrowserStorage()
): string[] {
  const sanitized = sanitizeRecentColors(colors)
  if (!storage) {
    return sanitized
  }
  try {
    storage.setItem(
      PROJECT_DESIGN_RECENT_COLORS_KEY,
      JSON.stringify(sanitized)
    )
  } catch {
    return sanitized
  }
  return sanitized
}

export function persistProjectDesignRecentColor(
  color: unknown,
  storage: Pick<Storage, "getItem" | "setItem"> | null = getBrowserStorage()
): string[] {
  const next = rememberProjectDesignRecentColor(
    color,
    readProjectDesignRecentColors(storage)
  )
  return writeProjectDesignRecentColors(next, storage)
}
