import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

export const ABNET_RESIDENTIAL_AUDIT = {
  candidateRows: 4553,
  exactExtraRows: 113,
  servicesAfterCollapse: 4440,
  customersWithService: 4315,
  connectionCandidates: 4514,
} as const

/**
 * Date the Internet + TV extract was observed as Activa.
 * isp_services overwrites commercial_status from activation_date unless the
 * status is suspended or cancelled. Activa needs a non-future date to stay
 * active. This is not the historical alta date; the source file has none.
 */
export const ABNET_ACTIVA_OBSERVED_ON = "2026-10-06"

export const ABNET_RESIDENTIAL_CATALOG = {
  "WIRELESS-20-TV-BASICO": { technology: "wireless", download: 20 },
  "FTTH-50-TV-BASICO": { technology: "ftth", download: 50 },
  "FTTH-100-TV-BASICO": { technology: "ftth", download: 100 },
  "FTTH-300-TV-BASICO": { technology: "ftth", download: 300 },
} as const

export type AbnetResidentialCatalogCode = keyof typeof ABNET_RESIDENTIAL_CATALOG

export type AbnetInternetRow = {
  number: string
  name: string
  tipo: string
  nodo: string | null
  plan: string
  estado: string
  tv: number | null
  finalAmount: number | null
}

export type AbnetBillingIpRow = {
  number: string
  tipo: string
  nodo: string | null
  ip: string | null
}

/**
 * Two Internet + TV rows are exact copies when every commercial and technical
 * field used by the audit is the same: customer, type, node, plan, status,
 * TV amount and FINAL amount. A different plan, status, type or node is a
 * different service and is kept.
 */
export function abnetExactInternetKey(row: AbnetInternetRow): string {
  return [
    row.number,
    fold(row.tipo),
    fold(row.nodo),
    fold(row.plan),
    fold(row.estado),
    row.tv ?? "",
    row.finalAmount ?? "",
  ].join("|")
}

export function collapseExactInternetCopies(rows: readonly AbnetInternetRow[]): {
  kept: AbnetInternetRow[]
  extraCopies: number
} {
  const seen = new Set<string>()
  const kept: AbnetInternetRow[] = []
  let extraCopies = 0
  for (const row of rows) {
    const key = abnetExactInternetKey(row)
    if (seen.has(key)) {
      extraCopies += 1
      continue
    }
    seen.add(key)
    kept.push(row)
  }
  return { kept, extraCopies }
}

export function fold(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function compactPlan(value: string): string {
  return fold(value).replace(/[^a-z0-9+]/g, "")
}

export function mapAbnetResidentialCatalog(
  tipo: string,
  plan: string
): AbnetResidentialCatalogCode | null {
  const type = fold(tipo)
  const compact = compactPlan(plan)
  if (compact === "20mb+tvbasico" && type === "wireless") return "WIRELESS-20-TV-BASICO"
  if (compact === "50mb+tvbasico" && type === "fibra") return "FTTH-50-TV-BASICO"
  if (compact === "100mb+tvbasico" && type === "fibra") return "FTTH-100-TV-BASICO"
  if (compact === "300mb+tvbasico" && type === "fibra") return "FTTH-300-TV-BASICO"
  return null
}

export function isInternetAccessType(tipo: string): boolean {
  const type = fold(tipo)
  return type === "fibra" || type === "wireless"
}

export type ResidentialStatusDecision =
  | {
      load: true
      commercialStatus: "active" | "pending_activation"
      activationDate: string | null
      sourceStatus: "Activa" | "Pendiente"
    }
  | { load: false; sourceStatus: string; reason: string }

/**
 * Activa and Pendiente fit the existing commercial statuses.
 * Morosa is not suspended and Inactiva is not a baja, so those rows stop.
 */
export function decideResidentialStatus(estado: string): ResidentialStatusDecision {
  const status = fold(estado)
  if (status === "activa") {
    return {
      load: true,
      commercialStatus: "active",
      activationDate: ABNET_ACTIVA_OBSERVED_ON,
      sourceStatus: "Activa",
    }
  }
  if (status === "pendiente") {
    return {
      load: true,
      commercialStatus: "pending_activation",
      activationDate: null,
      sourceStatus: "Pendiente",
    }
  }
  if (status === "morosa" || status === "inactiva") {
    return {
      load: false,
      sourceStatus: estado.trim() || status,
      reason:
        "isp_services no tiene un estado equivalente. No se convierte en baja ni en suspendido.",
    }
  }
  return {
    load: false,
    sourceStatus: estado.trim() || "(vacío)",
    reason: "Estado de origen fuera de Activa, Morosa, Pendiente e Inactiva.",
  }
}

export function abnetServiceExternalCode(row: AbnetInternetRow): string {
  return `abnet-cx:${abnetExactInternetKey(row)}`
}

export function abnetConnectionExternalCode(row: AbnetInternetRow): string {
  return `abnet-cn:${abnetExactInternetKey(row)}`
}

export function connectionNodeNote(nodo: string): string {
  return `Nodo: ${nodo}`
}

export function sourceStatusNote(sourceStatus: string): string {
  return `Origen ABNet Internet+TV: ${sourceStatus}`
}

export function resolveUnambiguousIp(
  billingRows: readonly AbnetBillingIpRow[],
  tipo: string,
  nodo: string | null
): string | null {
  const ips = new Set<string>()
  for (const row of billingRows) {
    if (fold(row.tipo) !== fold(tipo)) continue
    if (fold(row.nodo) !== fold(nodo)) continue
    const ip = row.ip?.trim()
    if (ip) ips.add(ip)
  }
  if (ips.size !== 1) return null
  return [...ips][0]
}

export function customerIdForAbnetNumber(
  number: string,
  customersByNumber: ReadonlyMap<string, readonly string[]>
): { customerId: string } | { reason: string } {
  const matches = customersByNumber.get(number) ?? []
  if (matches.length === 1) return { customerId: matches[0] }
  if (matches.length === 0) return { reason: "Sin customer Bespoke vinculado por N° ABNet" }
  return { reason: "Más de un customer Bespoke con el mismo N° ABNet" }
}

export function abnetNumberFromCell(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return abnetNumberFromExternalCode(String(Math.trunc(value)))
  }
  return abnetNumberFromExternalCode(value == null ? null : String(value))
}

export type ResidentialLoadRow = {
  row: AbnetInternetRow
  catalogCode: AbnetResidentialCatalogCode
  customerId: string
  commercialStatus: "active" | "pending_activation"
  activationDate: string | null
  sourceStatus: "Activa" | "Pendiente"
  ip: string | null
  serviceExternalCode: string
  connectionExternalCode: string
}

export type ResidentialLoadPlan = {
  candidateRows: number
  exactExtraRows: number
  servicesAfterCollapse: number
  customersWithService: number
  connectionCandidates: number
  byCatalog: Record<AbnetResidentialCatalogCode, number>
  sourceStatus: Record<string, number>
  withIp: number
  withoutIp: number
  ambiguousIp: number
  multipleServiceCustomers: number
  residentialMultipleServiceCustomers: number
  excludedNoCustomer: number
  excludedAmbiguousCustomer: number
  excludedStatus: number
  excludedSpecialInternetRows: number
  loadRows: ResidentialLoadRow[]
}

export function planAbnetResidentialLoad(input: {
  internetRows: readonly AbnetInternetRow[]
  billingRows: readonly AbnetBillingIpRow[]
  customersByNumber: ReadonlyMap<string, readonly string[]>
}): ResidentialLoadPlan {
  const internet = input.internetRows.filter((row) => isInternetAccessType(row.tipo))
  const collapsedInternet = collapseExactInternetCopies(internet)
  const residential = collapsedInternet.kept.filter(
    (row) => mapAbnetResidentialCatalog(row.tipo, row.plan) != null
  )
  const residentialRaw = internet.filter(
    (row) => mapAbnetResidentialCatalog(row.tipo, row.plan) != null
  )
  const collapsedResidential = collapseExactInternetCopies(residentialRaw)

  const byCatalog: Record<AbnetResidentialCatalogCode, number> = {
    "WIRELESS-20-TV-BASICO": 0,
    "FTTH-50-TV-BASICO": 0,
    "FTTH-100-TV-BASICO": 0,
    "FTTH-300-TV-BASICO": 0,
  }
  const sourceStatus: Record<string, number> = {}
  const billingByNumber = new Map<string, AbnetBillingIpRow[]>()
  for (const row of input.billingRows) {
    const current = billingByNumber.get(row.number) ?? []
    current.push(row)
    billingByNumber.set(row.number, current)
  }

  let excludedNoCustomer = 0
  let excludedAmbiguousCustomer = 0
  let excludedStatus = 0
  let withIp = 0
  let withoutIp = 0
  let ambiguousIp = 0
  const loadRows: ResidentialLoadRow[] = []
  const residentialCustomers = new Map<string, number>()
  for (const row of collapsedResidential.kept) {
    residentialCustomers.set(row.number, (residentialCustomers.get(row.number) ?? 0) + 1)
  }

  for (const row of collapsedResidential.kept) {
    const catalogCode = mapAbnetResidentialCatalog(row.tipo, row.plan)
    if (!catalogCode) continue
    byCatalog[catalogCode] += 1
    const label = fold(row.estado) || "(vacío)"
    sourceStatus[label] = (sourceStatus[label] ?? 0) + 1

    const link = customerIdForAbnetNumber(row.number, input.customersByNumber)
    if (!("customerId" in link)) {
      if (link.reason.startsWith("Más de un")) excludedAmbiguousCustomer += 1
      else excludedNoCustomer += 1
      continue
    }
    const status = decideResidentialStatus(row.estado)
    if (!status.load) {
      excludedStatus += 1
      continue
    }
    const billing = billingByNumber.get(row.number) ?? []
    const matchingIps = new Set(
      billing
        .filter((item) => fold(item.tipo) === fold(row.tipo) && fold(item.nodo) === fold(row.nodo))
        .map((item) => item.ip?.trim() ?? "")
        .filter((ip) => ip.length > 0)
    )
    if (matchingIps.size > 1) ambiguousIp += 1
    const ip = resolveUnambiguousIp(billing, row.tipo, row.nodo)
    if (ip) withIp += 1
    else withoutIp += 1
    loadRows.push({
      row,
      catalogCode,
      customerId: link.customerId,
      commercialStatus: status.commercialStatus,
      activationDate: status.activationDate,
      sourceStatus: status.sourceStatus,
      ip,
      serviceExternalCode: abnetServiceExternalCode(row),
      connectionExternalCode: abnetConnectionExternalCode(row),
    })
  }

  const loadedCustomers = new Map<string, number>()
  for (const row of loadRows) {
    loadedCustomers.set(row.customerId, (loadedCustomers.get(row.customerId) ?? 0) + 1)
  }

  return {
    candidateRows: residentialRaw.length,
    exactExtraRows: collapsedResidential.extraCopies,
    servicesAfterCollapse: collapsedResidential.kept.length,
    customersWithService: residentialCustomers.size,
    connectionCandidates: collapsedInternet.kept.length,
    byCatalog,
    sourceStatus,
    withIp,
    withoutIp,
    ambiguousIp,
    multipleServiceCustomers: [...loadedCustomers.values()].filter((count) => count > 1).length,
    residentialMultipleServiceCustomers: [...residentialCustomers.values()].filter((count) => count > 1)
      .length,
    excludedNoCustomer,
    excludedAmbiguousCustomer,
    excludedStatus,
    excludedSpecialInternetRows: collapsedInternet.kept.length - collapsedResidential.kept.length,
    loadRows,
  }
}

export function residentialAuditMatches(plan: Pick<
  ResidentialLoadPlan,
  | "candidateRows"
  | "exactExtraRows"
  | "servicesAfterCollapse"
  | "customersWithService"
  | "connectionCandidates"
>): boolean {
  return (
    plan.candidateRows === ABNET_RESIDENTIAL_AUDIT.candidateRows &&
    plan.exactExtraRows === ABNET_RESIDENTIAL_AUDIT.exactExtraRows &&
    plan.servicesAfterCollapse === ABNET_RESIDENTIAL_AUDIT.servicesAfterCollapse &&
    plan.customersWithService === ABNET_RESIDENTIAL_AUDIT.customersWithService &&
    plan.connectionCandidates === ABNET_RESIDENTIAL_AUDIT.connectionCandidates
  )
}
