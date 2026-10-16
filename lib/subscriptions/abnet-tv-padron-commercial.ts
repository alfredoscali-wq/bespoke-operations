import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { foldAbnetPadronText } from "@/lib/subscriptions/abnet-tv-padron"

export const TV_PADRON_ACTIVA = "Activa"
export const TV_PADRON_BASICA_AMOUNT = 4500

export type TvPadronCommercialRow = {
  sourceRow: number
  abnetCustomerNumber: string
  serviceType: string
  status: string
}

export type TvPadronCommercialService = {
  technology: "ftth" | "wireless"
}

export type TvPadronCommercialOmission = {
  sourceRow: number
  abnetCustomerNumber: string | null
  reason: string
}

export function padronServiceTechnology(
  serviceType: string | null | undefined
): "ftth" | "wireless" | null {
  const text = foldAbnetPadronText(serviceType)
  if (!text) return null
  if (text.includes("fibra") || text.includes("ftth")) return "ftth"
  if (text.includes("wireless") || text.includes("radio")) return "wireless"
  return null
}

/**
 * Corrige filas Pendiente cuando hay un único cliente y un único servicio
 * de Internet con TV Básica del mismo tipo. No usa solo el N° Cliente.
 */
export function planAbnetTvPadronCommercialCorrections(input: {
  rows: readonly TvPadronCommercialRow[]
  customerIdsByNumber: ReadonlyMap<string, readonly string[]>
  basicaServicesByCustomer: ReadonlyMap<string, readonly TvPadronCommercialService[]>
}): {
  sourceRows: number[]
  omitted: TvPadronCommercialOmission[]
} {
  const sourceRows: number[] = []
  const omitted: TvPadronCommercialOmission[] = []
  for (const row of input.rows) {
    if (row.status !== "Pendiente") continue
    const number = abnetNumberFromExternalCode(row.abnetCustomerNumber)
    const technology = padronServiceTechnology(row.serviceType)
    if (!number) {
      omitted.push({ sourceRow: row.sourceRow, abnetCustomerNumber: null, reason: "sin N° Cliente" })
      continue
    }
    const customerIds = input.customerIdsByNumber.get(number) ?? []
    if (customerIds.length === 0) {
      omitted.push({
        sourceRow: row.sourceRow,
        abnetCustomerNumber: number,
        reason: "sin cliente Bespoke",
      })
      continue
    }
    if (customerIds.length > 1) {
      omitted.push({
        sourceRow: row.sourceRow,
        abnetCustomerNumber: number,
        reason: "más de un cliente con el mismo N°",
      })
      continue
    }
    if (!technology) {
      omitted.push({
        sourceRow: row.sourceRow,
        abnetCustomerNumber: number,
        reason: "tipo de servicio no unívoco",
      })
      continue
    }
    const matches = (input.basicaServicesByCustomer.get(customerIds[0]) ?? []).filter(
      (service) => service.technology === technology
    )
    if (matches.length === 1) {
      sourceRows.push(row.sourceRow)
      continue
    }
    omitted.push({
      sourceRow: row.sourceRow,
      abnetCustomerNumber: number,
      reason:
        matches.length === 0
          ? "sin servicio de Internet con TV Básica para ese tipo"
          : "más de un servicio con TV Básica para ese tipo",
    })
  }
  return { sourceRows, omitted }
}
