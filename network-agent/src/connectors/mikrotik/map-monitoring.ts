import type {
  MonitoringInterfaceCounters,
  MonitoringSnapshot,
} from "@/lib/network/monitoring/contract"

export type RouterOsPollFacts = {
  host: string
  deviceId: string
  targetId: string
  identity: Record<string, string>
  resource: Record<string, string>
  health: Record<string, string>[]
  interfaces: Record<string, string>[]
}

function pick(record: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]?.trim()
    if (value) return value
  }
  return null
}

function parseNumber(value: string | null): number | null {
  if (!value) return null
  const normalized = value.replace("%", "").replace(/,/g, "").trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseSpeedMbps(value: string | null): number | null {
  if (!value) return null
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(gbps|mbps|kbps|g|m|k)?/)
  if (!match) return parseNumber(value)
  const amount = Number(match[1])
  const unit = match[2] ?? "mbps"
  if (unit.startsWith("g")) return Math.round(amount * 1000)
  if (unit.startsWith("k")) return Math.round(amount / 1000)
  return Math.round(amount)
}

function interfaceStatus(row: Record<string, string>): string {
  if (row.disabled === "true") return "down"
  if (row.running === "false") return "down"
  if (row.running === "true") return "up"
  return pick(row, "status") ?? "unknown"
}

function pickTemperature(health: Record<string, string>[]): number | null {
  for (const row of health) {
    const name = (pick(row, "name") ?? "").toLowerCase()
    if (name === "temperature" || name === "cpu-temperature" || name.includes("temp")) {
      const value = parseNumber(pick(row, "value", "temperature"))
      if (value != null) return value
    }
    const direct = parseNumber(pick(row, "temperature", "cpu-temperature"))
    if (direct != null) return direct
  }
  return null
}

function mapInterface(row: Record<string, string>): MonitoringInterfaceCounters | null {
  const name = pick(row, "name")
  if (!name) return null
  return {
    name,
    status: interfaceStatus(row),
    speedMbps: parseSpeedMbps(pick(row, "speed")),
    rxBytes: parseNumber(pick(row, "rx-byte", "rx_byte")),
    txBytes: parseNumber(pick(row, "tx-byte", "tx_byte")),
    rxPackets: parseNumber(pick(row, "rx-packet", "rx_packet")),
    txPackets: parseNumber(pick(row, "tx-packet", "tx_packet")),
    rxErrors: parseNumber(pick(row, "rx-error", "rx_error")),
    txErrors: parseNumber(pick(row, "tx-error", "tx_error")),
    rxDrops: parseNumber(pick(row, "rx-drop", "rx_drop")),
    txDrops: parseNumber(pick(row, "tx-drop", "tx_drop")),
  }
}

export function mapMikrotikFactsToMonitoring(facts: RouterOsPollFacts): MonitoringSnapshot {
  const warnings: string[] = []
  const temperature = pickTemperature(facts.health)
  if (temperature == null) {
    warnings.push("El MikroTik no expuso temperatura.")
  }

  const interfaces = facts.interfaces
    .map(mapInterface)
    .filter((item): item is MonitoringInterfaceCounters => Boolean(item))

  return {
    vendor: "mikrotik",
    deviceId: facts.deviceId,
    targetId: facts.targetId,
    host: facts.host,
    hostname: pick(facts.identity, "name"),
    routerosVersion: pick(facts.resource, "version"),
    uptime: pick(facts.resource, "uptime"),
    cpuLoad: parseNumber(pick(facts.resource, "cpu-load", "cpu_load")),
    memoryTotal: parseNumber(pick(facts.resource, "total-memory", "total_memory")),
    memoryAvailable: parseNumber(pick(facts.resource, "free-memory", "free_memory")),
    temperature,
    interfaces,
    warnings,
  }
}
