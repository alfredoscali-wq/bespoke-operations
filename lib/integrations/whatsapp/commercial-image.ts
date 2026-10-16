/** Local asset to add when the commercial artwork is ready. Meta needs the public HTTPS link. */
export const WHATSAPP_COMMERCIAL_IMAGE_FILE =
  "public/images/tv/oferta-pack-futbol-tv-full.png"

export const WHATSAPP_COMMERCIAL_IMAGE_ENV = "WHATSAPP_COMMERCIAL_IMAGE_LINK"

/** Returns the configured public image link. An empty or non-HTTPS value stays unset. */
export function readWhatsappCommercialImageLink(
  value: string | undefined | null
): string | null {
  const link = value?.trim() ?? ""
  if (!link) return null
  try {
    const url = new URL(link)
    if (url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}
