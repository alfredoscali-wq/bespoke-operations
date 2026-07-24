export const TREASURY_RECEIPTS_BUCKET = "treasury-receipts"

export const TREASURY_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
] as const

export const TREASURY_RECEIPT_MAX_BYTES = 10 * 1024 * 1024

export function sanitizeTreasuryReceiptFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const normalized = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_")
  return normalized.slice(0, 180) || "comprobante.jpg"
}

export function buildTreasuryReceiptStoragePath(input: {
  companyId: string
  movementId: string
  fileName: string
}): string {
  return [
    input.companyId,
    input.movementId,
    sanitizeTreasuryReceiptFileName(input.fileName),
  ].join("/")
}
