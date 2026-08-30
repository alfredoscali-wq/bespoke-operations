function normalizeToken(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

export function normalizeMacAddress(value: string | null | undefined): string | null {
  const token = normalizeToken(value)
  if (!token) return null
  const hex = token.replace(/[^0-9a-f]/g, "")
  if (hex.length !== 12) return token
  return hex.match(/.{2}/g)?.join(":") ?? token
}

export function buildDeviceFingerprint(input: {
  serialNumber?: string | null
  macAddress?: string | null
  managementIp?: string | null
  manufacturer?: string | null
  neighborIdentity?: string | null
}): string {
  const serial = normalizeToken(input.serialNumber)
  if (serial) return `serial:${serial}`

  const mac = normalizeMacAddress(input.macAddress)
  if (mac) return `mac:${mac}`

  const ip = normalizeToken(input.managementIp)
  const manufacturer = normalizeToken(input.manufacturer)
  if (ip) return `ip:${ip}:${manufacturer ?? "unknown"}`

  const identity = normalizeToken(input.neighborIdentity)
  if (identity) return `identity:${identity}`

  throw new Error("No hay identidad suficiente para el dispositivo descubierto.")
}
