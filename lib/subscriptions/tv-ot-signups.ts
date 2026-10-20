import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import {
  abnetPadronTvRowLabel,
  classifyAbnetPadronTv,
  foldAbnetPadronText,
  isAbnetJubiladoPlan,
  ABNET_TV_BASICA_AMOUNT,
  ABNET_TV_BASICA_PACK_AMOUNT,
  ABNET_TV_FULL_AMOUNT,
} from "@/lib/subscriptions/abnet-tv-padron"

export const TV_OT_SIGNUP_SERVICE = "instalacion-nueva"
export const TV_OT_NOT_FINAL_MESSAGE = "La OT todavía no está finalizada."
export const TV_OT_SIGNUP_NOT_FOUND = "Esa OT no está entre las instalaciones nuevas."
export const BESPOKE_OT_TV_PADRON_SOURCE = "bespoke-ot-tv"
export const TV_OT_LATAM_STATUS = "Estado en Latam no verificable desde Bespoke"

export const TV_OT_PLAN_KINDS = ["basica", "pack", "full"] as const
export type TvOtPlanKind = (typeof TV_OT_PLAN_KINDS)[number]

export const TV_OT_QUEUE_STATUSES = [
  "pending_review",
  "pending_required_data",
  "incorporated",
  "excluded",
  "needs_review",
] as const
export type TvOtQueueStatus = (typeof TV_OT_QUEUE_STATUSES)[number]

export const TV_OT_CATEGORIES = [
  "approved_with_tv",
  "approved_without_tv",
  "active_unverified",
  "pending_activation",
  "cancelled",
  "incorporated",
] as const
export type TvOtSignupCategory = (typeof TV_OT_CATEGORIES)[number]

export const TV_OT_PLAN_OPTIONS: readonly {
  kind: TvOtPlanKind
  label: string
  structure: string
  padronAmount: number
}[] = [
  {
    kind: "basica",
    label: "TV Básica",
    structure: "Abono base de TV.",
    padronAmount: ABNET_TV_BASICA_AMOUNT,
  },
  {
    kind: "pack",
    label: "TV Básica + Pack Fútbol",
    structure: "Abono base de TV más el componente PACK-FUTBOL.",
    padronAmount: ABNET_TV_BASICA_PACK_AMOUNT,
  },
  {
    kind: "full",
    label: "TV Full",
    structure: "Abono base de TV más el componente TV-FULL-UPGRADE.",
    padronAmount: ABNET_TV_FULL_AMOUNT,
  },
]

const CATEGORY_LABEL: Record<TvOtSignupCategory, string> = {
  approved_with_tv: "Alta aprobada con TV contratada",
  approved_without_tv: "Alta aprobada sin TV contratada",
  active_unverified: "Activo sin aprobación verificable",
  pending_activation: "Pendiente de activación",
  cancelled: "OT cancelada",
  incorporated: "Ya incorporado al padrón",
}

const QUEUE_LABEL: Record<TvOtQueueStatus, string> = {
  pending_review: "Pendiente de revisión",
  pending_required_data: "Pendiente de datos obligatorios",
  incorporated: "Incorporado a TV",
  excluded: "Excluido de la lista",
  needs_review: "Requiere revisión",
}

const TASK_STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  programada: "Programada",
  asignada: "Asignada",
  vencida: "Vencida",
  "en-curso": "En curso",
  incidencia: "Incidencia",
  "pendiente-cierre": "Pendiente de cierre",
  finalizada: "Finalizada",
  "en-aprobacion": "En aprobación",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
}

const APPROVAL_PREVIOUS_STATUS = "pendiente-activacion"
const ACTIVE_CUSTOMER_STATUS = "activo"

export type TvOtPadronMatchRow = {
  number: string
  name: string
  planName: string
  tvAmount: number | null
  source: string
  sourceRow: number
}

export type TvOtProposalFact = {
  status: TvOtQueueStatus
  tvKind: TvOtPlanKind | null
  excludedAt: string | null
  excludedBy: string | null
  incorporatedAt: string | null
  incorporatedBy: string | null
  padronSource: string | null
  padronSourceRow: number | null
}

export type TvOtSignupFact = {
  taskId: string
  taskCode: string
  taskCreatedAt: string
  taskStatus: string
  contractedPlan: string | null
  customerId: string
  customerNumber: string
  customerName: string
  customerStatus: string | null
  abnetNumber: string | null
  activationPreviousStatus: string | null
  padronExact: { source: string; sourceRow: number; planLabel: string } | null
  possibleMatchNumbers: string[]
  proposal: TvOtProposalFact | null
}

export type TvOtSignupItem = {
  taskId: string
  customerId: string
  customerNumber: string
  customerName: string
  taskCode: string
  taskDate: string
  taskStatus: string
  taskStatusLabel: string
  taskOpen: boolean
  activationLabel: string
  category: TvOtSignupCategory
  categoryLabel: string
  contractedPlan: string | null
  suggestedTvKind: TvOtPlanKind | null
  selectedTvKind: TvOtPlanKind | null
  proposedPlanLabel: string
  proposedPlanStructure: string | null
  abnetNumber: string | null
  padronPresence: "exact" | "none"
  padronPlanLabel: string | null
  possibleMatch: boolean
  possibleMatchCount: number
  possibleMatchSample: string[]
  queueStatus: Exclude<TvOtQueueStatus, "excluded">
  queueStatusLabel: string
  canEditPlan: boolean
  canIncorporate: boolean
  canExclude: boolean
  incorporateBlock: string | null
  latamStatus: typeof TV_OT_LATAM_STATUS
}

export function isTvOtPlanKind(value: unknown): value is TvOtPlanKind {
  return TV_OT_PLAN_KINDS.includes(value as TvOtPlanKind)
}

export function tvOtPlanOption(kind: TvOtPlanKind) {
  const option = TV_OT_PLAN_OPTIONS.find((item) => item.kind === kind)
  if (!option) throw new Error("Plan de TV desconocido.")
  return option
}

/** Any recorded installation date qualifies. The queue is not limited to one month. */
export function isTvOtSignupWindow(createdAt: string | null | undefined): boolean {
  return Boolean(createdAt?.trim())
}

export function contractedPlanIncludesTv(plan: string | null | undefined): boolean {
  const folded = foldAbnetPadronText(plan)
  if (!folded) return false
  return /(?:^|[^a-z])tv(?:[^a-z]|$)/.test(folded)
}

/** Reference only. An Internet-only contract does not select a TV plan. */
export function suggestedTvKind(plan: string | null | undefined): TvOtPlanKind | null {
  if (!contractedPlanIncludesTv(plan)) return null
  const folded = foldAbnetPadronText(plan)
  if (folded.includes("full")) return "full"
  if (folded.includes("futbol") || folded.includes("pack")) return "pack"
  return "basica"
}

export function verifiedAbnetNumber(code: string | null | undefined): string | null {
  return abnetNumberFromExternalCode(code)
}

/** Bespoke customer code created with the client, for example CLI-005788. */
export function bespokeCliCustomerNumber(value: string | null | undefined): string | null {
  const match = /^CLI-(\d+)$/i.exec(value?.trim() ?? "")
  if (!match || /^0+$/.test(match[1])) return null
  return `CLI-${match[1]}`
}

export function formatTvOtSignupDate(value: string | null | undefined): string {
  if (!value) return "No disponible"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No disponible"
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function taskStatusLabel(status: string | null | undefined): string {
  const key = status?.trim() ?? ""
  return TASK_STATUS_LABEL[key] ?? (key || "No disponible")
}

export function padronPlanLabel(row: {
  planName: string
  tvAmount: number | null
}): string {
  const tv = classifyAbnetPadronTv(row.tvAmount)
  return abnetPadronTvRowLabel({
    tvKind: tv.kind,
    tvAmount: row.tvAmount,
    jubilado: isAbnetJubiladoPlan(row.planName),
  })
}

export function matchPadronIdentity(input: {
  abnetNumber: string | null
  customerNumber?: string | null
  customerName: string | null
  rows: readonly TvOtPadronMatchRow[]
}): {
  exact: { source: string; sourceRow: number; planLabel: string } | null
  possibleMatchNumbers: string[]
} {
  const identity = [input.abnetNumber, bespokeCliCustomerNumber(input.customerNumber)].filter(
    (value): value is string => Boolean(value)
  )
  const exactRows = identity.length
    ? input.rows.filter((row) => identity.includes(row.number))
    : []
  const exact = exactRows[0]
    ? {
        source: exactRows[0].source,
        sourceRow: exactRows[0].sourceRow,
        planLabel: [...new Set(exactRows.map((row) => padronPlanLabel(row)))].join(", "),
      }
    : null
  if (exact) return { exact, possibleMatchNumbers: [] }
  const folded = foldAbnetPadronText(input.customerName)
  if (!folded) return { exact: null, possibleMatchNumbers: [] }
  const numbers = new Set<string>()
  for (const row of input.rows) {
    if (foldAbnetPadronText(row.name) === folded) numbers.add(row.number)
  }
  return { exact: null, possibleMatchNumbers: [...numbers].sort() }
}

export function approvedFromPendingActivation(input: {
  taskStatus: string
  customerStatus: string | null
  activationPreviousStatus: string | null
}): boolean {
  return (
    input.taskStatus !== "cancelada" &&
    input.customerStatus === ACTIVE_CUSTOMER_STATUS &&
    input.activationPreviousStatus === APPROVAL_PREVIOUS_STATUS
  )
}

export function classifyTvOtSignup(input: {
  taskStatus: string
  customerStatus: string | null
  contractedPlan: string | null
  activationPreviousStatus: string | null
  padronExact: boolean
  proposalStatus: TvOtQueueStatus | null
}): { category: TvOtSignupCategory; activationLabel: string } {
  const approved = approvedFromPendingActivation(input)
  let activationLabel = "No disponible"
  if (input.taskStatus === "cancelada") activationLabel = "OT cancelada"
  else if (input.customerStatus === APPROVAL_PREVIOUS_STATUS) {
    activationLabel = "Pendiente de activación"
  } else if (approved) activationLabel = "Aprobada desde pendiente de activación"
  else if (input.customerStatus === ACTIVE_CUSTOMER_STATUS) {
    activationLabel = "Activo sin OK registrado"
  } else if (input.customerStatus) activationLabel = input.customerStatus

  if (input.proposalStatus === "incorporated") {
    return { category: "incorporated", activationLabel }
  }
  if (input.taskStatus === "cancelada") {
    return { category: "cancelled", activationLabel }
  }
  if (input.padronExact) {
    return { category: "incorporated", activationLabel }
  }
  if (input.customerStatus === APPROVAL_PREVIOUS_STATUS) {
    return { category: "pending_activation", activationLabel }
  }
  if (approved && contractedPlanIncludesTv(input.contractedPlan)) {
    return { category: "approved_with_tv", activationLabel }
  }
  if (approved) return { category: "approved_without_tv", activationLabel }
  return { category: "active_unverified", activationLabel }
}

function queueStatusOf(fact: TvOtSignupFact, possibleMatch: boolean): Exclude<TvOtQueueStatus, "excluded"> {
  const stored = fact.proposal?.status
  if (stored === "incorporated" || stored === "pending_required_data" || stored === "needs_review") {
    return stored
  }
  if (possibleMatch) return "needs_review"
  return "pending_review"
}

export function presentTvOtSignup(fact: TvOtSignupFact): TvOtSignupItem | null {
  if (fact.proposal?.status === "excluded") return null
  const possibleMatch = fact.possibleMatchNumbers.length > 0 && !fact.padronExact
  const classified = classifyTvOtSignup({
    taskStatus: fact.taskStatus,
    customerStatus: fact.customerStatus,
    contractedPlan: fact.contractedPlan,
    activationPreviousStatus: fact.activationPreviousStatus,
    padronExact: fact.padronExact != null,
    proposalStatus: fact.proposal?.status ?? null,
  })
  const selected = fact.proposal?.tvKind ?? null
  const suggested = suggestedTvKind(fact.contractedPlan)
  const selectedOption = selected ? tvOtPlanOption(selected) : null
  const suggestedOption = suggested ? tvOtPlanOption(suggested) : null
  const queueStatus = queueStatusOf(fact, possibleMatch)
  const incorporated = classified.category === "incorporated"
  const blockedCategory =
    classified.category === "cancelled" ||
    classified.category === "pending_activation" ||
    classified.category === "active_unverified"
  let incorporateBlock: string | null = null
  if (incorporated) {
    incorporateBlock = "Este cliente ya está en el padrón de TV."
  } else if (classified.category === "cancelled") {
    incorporateBlock = "La OT está cancelada. Queda en revisión manual."
  } else if (classified.category === "pending_activation") {
    incorporateBlock = "La activación comercial sigue pendiente."
  } else if (classified.category === "active_unverified") {
    incorporateBlock = "No hay un OK de activación verificable para esta OT."
  } else if (fact.taskStatus !== "finalizada") {
    incorporateBlock = TV_OT_NOT_FINAL_MESSAGE
  } else if (!selected) {
    incorporateBlock = "Seleccione y guarde un plan de TV antes de incorporar."
  } else if (!fact.abnetNumber && !bespokeCliCustomerNumber(fact.customerNumber)) {
    incorporateBlock = "Este cliente no tiene un N° CLI. No se inserta una fila en el padrón."
  }
  const taskOpen = fact.taskStatus !== "finalizada" && fact.taskStatus !== "cancelada"
  return {
    taskId: fact.taskId,
    customerId: fact.customerId,
    customerNumber: fact.customerNumber || "No disponible",
    customerName: fact.customerName.trim() || "No disponible",
    taskCode: fact.taskCode || "No disponible",
    taskDate: formatTvOtSignupDate(fact.taskCreatedAt),
    taskStatus: fact.taskStatus,
    taskStatusLabel: taskStatusLabel(fact.taskStatus),
    taskOpen,
    activationLabel: classified.activationLabel,
    category: classified.category,
    categoryLabel: CATEGORY_LABEL[classified.category],
    contractedPlan: fact.contractedPlan?.trim() || null,
    suggestedTvKind: suggested,
    selectedTvKind: selected,
    proposedPlanLabel: selectedOption
      ? selectedOption.label
      : suggestedOption
        ? `Referencia de la OT: ${suggestedOption.label}`
        : "Sin propuesta",
    proposedPlanStructure: selectedOption?.structure ?? suggestedOption?.structure ?? null,
    abnetNumber: fact.abnetNumber,
    padronPresence: fact.padronExact ? "exact" : "none",
    padronPlanLabel: fact.padronExact?.planLabel ?? null,
    possibleMatch,
    possibleMatchCount: fact.possibleMatchNumbers.length,
    possibleMatchSample: fact.possibleMatchNumbers.slice(0, 3),
    queueStatus,
    queueStatusLabel: QUEUE_LABEL[queueStatus],
    canEditPlan: !incorporated,
    canIncorporate:
      !incorporated && !blockedCategory && fact.taskStatus === "finalizada",
    canExclude: !incorporated,
    incorporateBlock,
    latamStatus: TV_OT_LATAM_STATUS,
  }
}

export type TvOtPlanEditDecision =
  | { outcome: "save"; tvKind: TvOtPlanKind }
  | { outcome: "rejected"; message: string }

export function planTvOtSignupPlanEdit(input: {
  item: TvOtSignupItem
  tvKind: unknown
}): TvOtPlanEditDecision {
  if (!input.item.canEditPlan) {
    return { outcome: "rejected", message: "Esta alta ya no admite un cambio de plan." }
  }
  if (!isTvOtPlanKind(input.tvKind)) {
    return { outcome: "rejected", message: "El plan de TV no pertenece al catálogo." }
  }
  return { outcome: "save", tvKind: input.tvKind }
}

export type TvOtExclusionDecision =
  | { outcome: "exclude" }
  | { outcome: "already_excluded" }
  | { outcome: "rejected"; message: string }

export function planTvOtSignupExclusion(input: {
  proposalStatus: TvOtQueueStatus | null
  incorporated: boolean
}): TvOtExclusionDecision {
  if (input.proposalStatus === "excluded") return { outcome: "already_excluded" }
  if (input.incorporated || input.proposalStatus === "incorporated") {
    return {
      outcome: "rejected",
      message: "Esta alta ya fue incorporada al padrón y no se quita desde esta lista.",
    }
  }
  return { outcome: "exclude" }
}

export type TvOtIncorporationDecision =
  | { outcome: "rejected"; message: string }
  | { outcome: "needs_review"; message: string }
  | {
      outcome: "missing_abnet"
      message: string
      tvKind: TvOtPlanKind
    }
  | {
      outcome: "insert"
      tvKind: TvOtPlanKind
      abnetNumber: string
      customerName: string
      planName: string
      tvAmount: number
      serviceType: string | null
    }

export function serviceTypeFromContract(plan: string | null): string | null {
  const folded = foldAbnetPadronText(plan)
  if (folded.includes("ftth") || folded.includes("fibra")) return "Fibra"
  if (folded.includes("wireless") || folded.includes("radio")) return "Wireless"
  return null
}

export function planTvOtSignupIncorporation(input: {
  item: TvOtSignupItem
  customerName: string
  acknowledgePossibleMatch: boolean
}): TvOtIncorporationDecision {
  if (input.item.category === "incorporated" || input.item.padronPresence === "exact") {
    return { outcome: "rejected", message: "Este cliente ya está en el padrón de TV." }
  }
  if (!input.item.canIncorporate) {
    return {
      outcome: "rejected",
      message: input.item.incorporateBlock ?? "Esta alta no está confirmada para incorporar.",
    }
  }
  if (!input.item.selectedTvKind) {
    return {
      outcome: "rejected",
      message: "Seleccione y guarde un plan de TV antes de incorporar.",
    }
  }
  if (input.item.possibleMatch && !input.acknowledgePossibleMatch) {
    return {
      outcome: "needs_review",
      message:
        "Hay una coincidencia de nombre con el padrón. Revísela antes de incorporar. El nombre no demuestra que sea la misma persona.",
    }
  }
  const option = tvOtPlanOption(input.item.selectedTvKind)
  const padronNumber = input.item.abnetNumber ?? bespokeCliCustomerNumber(input.item.customerNumber)
  if (!padronNumber) {
    return {
      outcome: "missing_abnet",
      tvKind: input.item.selectedTvKind,
      message: "Este cliente no tiene un N° CLI. No se insertó una fila en el padrón.",
    }
  }
  const name = input.customerName.trim()
  if (!name) {
    return { outcome: "rejected", message: "El cliente no tiene nombre. No se insertó una fila incompleta." }
  }
  return {
    outcome: "insert",
    tvKind: input.item.selectedTvKind,
    abnetNumber: padronNumber,
    customerName: name,
    planName: option.label,
    tvAmount: option.padronAmount,
    serviceType: serviceTypeFromContract(input.item.contractedPlan),
  }
}

/** Visible altas that still need a decision. An incorporated row stays in the list and leaves this count. */
export function countPendingTvOtSignups(
  items: readonly Pick<TvOtSignupItem, "category">[]
): number {
  return items.filter((item) => item.category !== "incorporated").length
}

export function countTvOtSignups(items: readonly TvOtSignupItem[]): Record<TvOtSignupCategory | "possible_match" | "total", number> {
  const counts: Record<TvOtSignupCategory | "possible_match" | "total", number> = {
    total: items.length,
    possible_match: 0,
    approved_with_tv: 0,
    approved_without_tv: 0,
    active_unverified: 0,
    pending_activation: 0,
    cancelled: 0,
    incorporated: 0,
  }
  for (const item of items) {
    counts[item.category] += 1
    if (item.possibleMatch) counts.possible_match += 1
  }
  return counts
}
