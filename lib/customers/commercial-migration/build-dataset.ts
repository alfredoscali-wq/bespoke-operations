import { normalizeComparisonKey } from "@/lib/customers/normalization/text"
import { loadLegacyTablesFromDump } from "@/lib/customers/commercial-migration/dump-parser"
import {
  attachDuplicateFlagsToRecords,
  detectLegacyDuplicateGroups,
} from "@/lib/customers/commercial-migration/duplicate-detection"
import { prepareLegacyCustomerRecord } from "@/lib/customers/commercial-migration/prepare-record"
import type {
  CommercialMigrationAuditReport,
  CommercialMigrationDataset,
  CommercialMigrationReport,
  DuplicateMatchKind,
  LegacyClientRow,
  LegacyConnectionRow,
} from "@/lib/customers/commercial-migration/types"

const AUTO_REVIEW_DUPLICATE_KINDS = new Set<DuplicateMatchKind>([
  "external_code",
  "dni",
])

const INFO_DUPLICATE_LABEL: Partial<Record<DuplicateMatchKind, string>> = {
  address: "advertencia: dirección duplicada",
  name: "advertencia: nombre duplicado",
}

const AUTO_REVIEW_DUPLICATE_LABEL: Partial<Record<DuplicateMatchKind, string>> =
  {
    external_code: "ncliente duplicado",
    dni: "DNI duplicado",
  }

function indexConnectionsByClient(
  conexiones: LegacyConnectionRow[]
): Map<number, LegacyConnectionRow[]> {
  const map = new Map<number, LegacyConnectionRow[]>()
  for (const conn of conexiones) {
    if (conn.idclientes == null) continue
    const list = map.get(conn.idclientes) ?? []
    list.push(conn)
    map.set(conn.idclientes, list)
  }
  return map
}

function applyDuplicateClassification<
  T extends {
    bucket: "listo" | "revisar" | "descartado"
    reviewReasons: string[]
    duplicateMatches: DuplicateMatchKind[]
  },
>(record: T): T {
  if (record.duplicateMatches.length === 0) return record

  const infoReasons = record.duplicateMatches
    .filter((kind) => !AUTO_REVIEW_DUPLICATE_KINDS.has(kind))
    .map((kind) => INFO_DUPLICATE_LABEL[kind] ?? `advertencia: duplicado por ${kind}`)

  const autoReviewReasons = record.duplicateMatches
    .filter((kind) => AUTO_REVIEW_DUPLICATE_KINDS.has(kind))
    .map(
      (kind) =>
        AUTO_REVIEW_DUPLICATE_LABEL[kind] ?? `duplicado por ${kind}`
    )

  const reviewReasons = [...new Set([...record.reviewReasons, ...infoReasons])]

  if (autoReviewReasons.length === 0 || record.bucket === "descartado") {
    return {
      ...record,
      reviewReasons,
    }
  }

  return {
    ...record,
    bucket: "revisar",
    validationStatus: "review",
    reviewReasons: [...new Set([...reviewReasons, ...autoReviewReasons])],
  }
}

export function buildCommercialMigrationAuditReport(input: {
  clientes: LegacyClientRow[]
  conexiones: LegacyConnectionRow[]
}): CommercialMigrationAuditReport {
  const clientStateCounts = { A: 0, B: 0, P: 0, other: 0 }
  for (const client of input.clientes) {
    const state = String(client.estado ?? "").trim().toUpperCase()
    if (state === "A") clientStateCounts.A++
    else if (state === "B") clientStateCounts.B++
    else if (state === "P") clientStateCounts.P++
    else clientStateCounts.other++
  }

  const connectionStateCounts = { A: 0, B: 0, C: 0, M: 0, I: 0, P: 0, other: 0 }
  for (const conn of input.conexiones) {
    const state = String(conn.estado ?? "").trim().toUpperCase()
    if (state in connectionStateCounts) {
      connectionStateCounts[state as keyof typeof connectionStateCounts]++
    } else {
      connectionStateCounts.other++
    }
  }

  const connectionsByClient = indexConnectionsByClient(input.conexiones)
  let clientsWithActiveConnection = 0
  let clientsWithoutConnections = 0
  let clientsWithConnectionsButNoneActive = 0
  const uniqueClientsByConnectionState = {
    A: 0,
    B: 0,
    C: 0,
    M: 0,
    I: 0,
    P: 0,
    otro: 0,
  }

  for (const client of input.clientes) {
    const connections = connectionsByClient.get(client.id) ?? []
    if (connections.length === 0) {
      clientsWithoutConnections++
      continue
    }

    const connectionStates = new Set<string>()
    for (const conn of connections) {
      const state = String(conn.estado ?? "").trim().toUpperCase()
      connectionStates.add(state || "otro")
    }

    for (const state of connectionStates) {
      if (state in uniqueClientsByConnectionState) {
        uniqueClientsByConnectionState[
          state as keyof typeof uniqueClientsByConnectionState
        ]++
      } else {
        uniqueClientsByConnectionState.otro++
      }
    }

    const hasActive = connectionStates.has("A")
    if (hasActive) {
      clientsWithActiveConnection++
    } else {
      clientsWithConnectionsButNoneActive++
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    clientes: {
      total: input.clientes.length,
      estadoA: clientStateCounts.A,
      estadoB: clientStateCounts.B,
      estadoP: clientStateCounts.P,
      estadoOtro: clientStateCounts.other,
    },
    conexiones: {
      total: input.conexiones.length,
      porEstado: {
        A: connectionStateCounts.A,
        B: connectionStateCounts.B,
        C: connectionStateCounts.C,
        M: connectionStateCounts.M,
        I: connectionStateCounts.I,
        P: connectionStateCounts.P,
        otro: connectionStateCounts.other,
      },
      clientesConConexionActiva: clientsWithActiveConnection,
      clientesSinConexiones: clientsWithoutConnections,
      clientesConConexionesSinActivas: clientsWithConnectionsButNoneActive,
      clientesUnicosPorEstadoConexion: uniqueClientsByConnectionState,
    },
  }
}

export function buildCommercialMigrationDataset(input: {
  sqlContent: string
  sourceDump: string
}): CommercialMigrationDataset {
  const { clientes, conexiones } = loadLegacyTablesFromDump(input.sqlContent)
  const connectionsByClient = indexConnectionsByClient(conexiones)

  let records = clientes.map((client) =>
    prepareLegacyCustomerRecord({
      client,
      connections: connectionsByClient.get(client.id) ?? [],
    })
  )

  const duplicateGroups = detectLegacyDuplicateGroups(records)
  records = attachDuplicateFlagsToRecords(records, duplicateGroups)
  records = records.map((record) => applyDuplicateClassification(record))

  const listos = records.filter((r) => r.bucket === "listo").length
  const revisar = records.filter((r) => r.bucket === "revisar").length
  const descartados = records.filter((r) => r.bucket === "descartado").length

  const localitiesMapped = records.filter(
    (r) =>
      r.locality &&
      normalizeComparisonKey(r.locality) !== normalizeComparisonKey(r.localityRaw)
  ).length

  return {
    generatedAt: new Date().toISOString(),
    sourceDump: input.sourceDump,
    summary: {
      totalLegacyClients: records.length,
      listos,
      revisar,
      descartados,
      duplicateGroups: {
        external_code: duplicateGroups.filter((g) => g.kind === "external_code")
          .length,
        dni: duplicateGroups.filter((g) => g.kind === "dni").length,
        name: duplicateGroups.filter((g) => g.kind === "name").length,
        address: duplicateGroups.filter((g) => g.kind === "address").length,
      },
      localitiesMapped,
      localitiesUnmapped: records.filter((r) => r.localityRaw && !r.locality)
        .length,
    },
    duplicateGroups,
    records,
  }
}

export function buildCommercialMigrationReport(
  dataset: CommercialMigrationDataset,
  durationMs: number
): CommercialMigrationReport {
  const motivoCounts = new Map<string, number>()

  for (const record of dataset.records) {
    if (record.bucket !== "revisar") continue
    for (const reason of record.reviewReasons) {
      motivoCounts.set(reason, (motivoCounts.get(reason) ?? 0) + 1)
    }
  }

  const porEstadoMigracion = {
    activo: 0,
    pendiente_activacion: 0,
    inactivo: 0,
    revisar: 0,
  }

  let descartadosSinConexiones = 0
  let revisarSinConexionActiva = 0

  for (const record of dataset.records) {
    porEstadoMigracion[record.migrationStatus]++

    if (
      record.bucket === "descartado" &&
      record.reviewReasons.includes("Sin conexiones asociadas")
    ) {
      descartadosSinConexiones++
    }

    if (
      record.bucket === "revisar" &&
      record.reviewReasons.includes("sin conexión activa")
    ) {
      revisarSinConexionActiva++
    }
  }

  return {
    generatedAt: dataset.generatedAt,
    clientesListos: dataset.summary.listos,
    clientesARevisar: dataset.summary.revisar,
    clientesDescartados: dataset.summary.descartados,
    descartadosSinConexiones,
    revisarSinConexionActiva,
    total: dataset.summary.totalLegacyClients,
    porEstadoMigracion,
    topMotivosRevision: [...motivoCounts.entries()]
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    rendimientoMs: Math.round(durationMs),
  }
}

export function buildCommercialMigrationFromDumpFile(input: {
  dumpPath: string
  sqlContent: string
}): {
  dataset: CommercialMigrationDataset
  report: CommercialMigrationReport
  auditReport: CommercialMigrationAuditReport
} {
  const started = performance.now()
  const { clientes, conexiones } = loadLegacyTablesFromDump(input.sqlContent)
  const auditReport = buildCommercialMigrationAuditReport({
    clientes,
    conexiones,
  })

  const dataset = buildCommercialMigrationDataset({
    sqlContent: input.sqlContent,
    sourceDump: input.dumpPath,
  })
  const durationMs = performance.now() - started

  const report = buildCommercialMigrationReport(dataset, durationMs)
  return { dataset, report, auditReport }
}
