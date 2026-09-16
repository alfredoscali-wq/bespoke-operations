import type { CSSProperties } from "react"

import { normalizeCompanyBrandingHex } from "@/lib/company-branding/validate"

function hexLuminance(hex: string): number {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16) / 255
  const g = Number.parseInt(value.slice(2, 4), 16) / 255
  const b = Number.parseInt(value.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function foregroundForHex(hex: string): string {
  return hexLuminance(hex) > 0.55 ? "#111827" : "#FFFFFF"
}

export function tenantChromeStyle(input: {
  primaryColor?: string | null
  secondaryColor?: string | null
}): CSSProperties | undefined {
  const primary = normalizeCompanyBrandingHex(input.primaryColor)
  const secondary = normalizeCompanyBrandingHex(input.secondaryColor)
  if (!primary && !secondary) {
    return undefined
  }

  const style: Record<string, string> = {}
  if (primary) {
    const foreground = foregroundForHex(primary)
    style["--primary"] = primary
    style["--primary-foreground"] = foreground
    style["--ring"] = primary
    style["--sidebar-primary"] = primary
    style["--sidebar-primary-foreground"] = foreground
    style["--sidebar-ring"] = primary
  }
  if (secondary) {
    style["--tenant-accent"] = secondary
  }

  return style as CSSProperties
}
