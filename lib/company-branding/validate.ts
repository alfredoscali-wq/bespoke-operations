import {
  COMPANY_BRANDING_HEX_PATTERN,
  COMPANY_BRANDING_LOGO_MAX_BYTES,
  COMPANY_BRANDING_LOGO_MIME_TYPES,
} from "@/lib/company-branding/constants"

const BLOCKED_LOGO_SCHEME = /^\s*(javascript|data|vbscript):/i

export function normalizeCompanyBrandingHex(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === "") {
    return null
  }

  if (!COMPANY_BRANDING_HEX_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed.toUpperCase()
}

export function normalizeCompanyBrandingLogoUrl(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === "" || BLOCKED_LOGO_SCHEME.test(trimmed)) {
    return null
  }

  return trimmed
}

export function isAllowedCompanyBrandingLogoUrl(value: string): boolean {
  return normalizeCompanyBrandingLogoUrl(value) !== null
}

export function resolveCompanyBrandingLogoMimeType(input: {
  mimeType: string
  fileName?: string
}): string {
  const mime = input.mimeType.trim().toLowerCase()
  if (mime === "image/jpg") {
    return "image/jpeg"
  }
  if (
    (COMPANY_BRANDING_LOGO_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    return mime
  }

  const name = input.fileName?.trim().toLowerCase() ?? ""
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  return mime
}

export function isAllowedCompanyBrandingLogoFile(input: {
  mimeType: string
  size: number
  fileName?: string
}): boolean {
  const mimeType = resolveCompanyBrandingLogoMimeType(input)
  return (
    (COMPANY_BRANDING_LOGO_MIME_TYPES as readonly string[]).includes(mimeType) &&
    input.size > 0 &&
    input.size <= COMPANY_BRANDING_LOGO_MAX_BYTES
  )
}

export type CompanyBrandingPatch = {
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

function parseOptionalLogoUrl(
  value: unknown
): { ok: true; value?: string | null } | { ok: false; message: string } {
  if (value === undefined) {
    return { ok: true }
  }
  if (value === null) {
    return { ok: true, value: null }
  }
  if (typeof value !== "string") {
    return { ok: false, message: "La URL del logo no es válida." }
  }
  if (value.trim() === "") {
    return { ok: true, value: null }
  }
  const logoUrl = normalizeCompanyBrandingLogoUrl(value)
  if (!logoUrl) {
    return { ok: false, message: "La URL del logo no es válida." }
  }
  return { ok: true, value: logoUrl }
}

function parseOptionalHex(
  value: unknown,
  message: string
): { ok: true; value?: string | null } | { ok: false; message: string } {
  if (value === undefined) {
    return { ok: true }
  }
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return { ok: true, value: null }
  }
  if (typeof value !== "string") {
    return { ok: false, message }
  }
  const hex = normalizeCompanyBrandingHex(value)
  if (!hex) {
    return { ok: false, message }
  }
  return { ok: true, value: hex }
}

export function parseCompanyBrandingPatch(input: {
  logoUrl?: unknown
  primaryColor?: unknown
  secondaryColor?: unknown
} | Record<string, unknown>): { ok: true; patch: CompanyBrandingPatch } | { ok: false; message: string } {
  const logoUrl = parseOptionalLogoUrl(input.logoUrl)
  if (!logoUrl.ok) return logoUrl
  const primaryColor = parseOptionalHex(
    input.primaryColor,
    "El color primario debe ser #RRGGBB."
  )
  if (!primaryColor.ok) return primaryColor
  const secondaryColor = parseOptionalHex(
    input.secondaryColor,
    "El color secundario debe ser #RRGGBB."
  )
  if (!secondaryColor.ok) return secondaryColor

  const patch: CompanyBrandingPatch = {}
  if ("value" in logoUrl) patch.logoUrl = logoUrl.value ?? null
  if ("value" in primaryColor) patch.primaryColor = primaryColor.value ?? null
  if ("value" in secondaryColor) {
    patch.secondaryColor = secondaryColor.value ?? null
  }
  return { ok: true, patch }
}

export function resolveAuthenticatedLogoSrc(
  tenantLogoUrl: string | null | undefined,
  instanceLogoSrc: string
): string {
  const url = tenantLogoUrl?.trim()
  return url ? url : instanceLogoSrc
}
