import type { MonitoringSnapshot } from "@/lib/network/monitoring/contract"
import { NETWORK_VENDORS, type NetworkVendor } from "@/lib/network/constants"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isVendor(value: unknown): value is NetworkVendor {
  return typeof value === "string" && (NETWORK_VENDORS as readonly string[]).includes(value)
}

function parseInterfaces(value: unknown): MonitoringSnapshot["interfaces"] {
  if (!Array.isArray(value)) return []
  const interfaces: MonitoringSnapshot["interfaces"] = []
  for (const item of value) {
    const record = asRecord(item)
    const name = trimToNull(record?.name)
    if (!name) continue
    interfaces.push({
      name,
      status: trimToNull(record?.status),
      speedMbps: asFiniteNumber(record?.speedMbps),
      rxBytes: asFiniteNumber(record?.rxBytes),
      txBytes: asFiniteNumber(record?.txBytes),
      rxPackets: asFiniteNumber(record?.rxPackets),
      txPackets: asFiniteNumber(record?.txPackets),
      rxErrors: asFiniteNumber(record?.rxErrors),
      txErrors: asFiniteNumber(record?.txErrors),
      rxDrops: asFiniteNumber(record?.rxDrops),
      txDrops: asFiniteNumber(record?.txDrops),
    })
  }
  return interfaces
}

export function parseMonitoringSnapshot(
  body: unknown
): { ok: true; snapshot: MonitoringSnapshot } | { ok: false; message: string } {
  const record = asRecord(body)
  if (!record) {
    return { ok: false, message: "Resultado de monitoring inválido." }
  }
  if (!isVendor(record.vendor)) {
    return { ok: false, message: "El vendor de monitoring no es válido." }
  }
  const deviceId = trimToNull(record.deviceId)
  const targetId = trimToNull(record.targetId)
  const host = trimToNull(record.host)
  if (!deviceId || !targetId || !host) {
    return { ok: false, message: "El resultado debe incluir deviceId, targetId y host." }
  }

  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((item): item is string => typeof item === "string")
    : []

  return {
    ok: true,
    snapshot: {
      vendor: record.vendor,
      deviceId,
      targetId,
      host,
      hostname: trimToNull(record.hostname),
      routerosVersion: trimToNull(record.routerosVersion),
      uptime: trimToNull(record.uptime),
      cpuLoad: asFiniteNumber(record.cpuLoad),
      memoryTotal: asFiniteNumber(record.memoryTotal),
      memoryAvailable: asFiniteNumber(record.memoryAvailable),
      temperature: asFiniteNumber(record.temperature),
      interfaces: parseInterfaces(record.interfaces),
      warnings,
    },
  }
}
