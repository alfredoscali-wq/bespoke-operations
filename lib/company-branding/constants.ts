export const COMPANY_BRANDING_LOGO_BUCKET = "company-branding-logos"
export const COMPANY_BRANDING_LOGO_MAX_BYTES = 2 * 1024 * 1024
export const COMPANY_BRANDING_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const

export const COMPANY_BRANDING_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/
