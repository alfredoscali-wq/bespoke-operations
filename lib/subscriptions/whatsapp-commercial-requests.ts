import type { TvPlanKind } from "@/lib/subscriptions/tv-plan-coordination"
import type {
  TvPlanComponentAction,
  TvPlanDestination,
  TvPlanServiceFact,
} from "@/lib/subscriptions/tv-plan-coordination"
import { canWriteSubscriptions } from "@/lib/subscriptions/permissions"
import type { SystemRole } from "@/lib/types/employees"

export const WHATSAPP_REQUEST_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "completed",
  "rejected",
] as const

export type WhatsappRequestStatus = (typeof WHATSAPP_REQUEST_STATUSES)[number]

export type WhatsappIdentityStatus = "unverified" | "verified"

export type WhatsappQuotedComponent = {
  code: string
  unitPrice: number | null
  action: TvPlanComponentAction["type"]
}

export type WhatsappCommercialRequest = {
  id: string
  companyId: string
  customerId: string | null
  identityStatus: WhatsappIdentityStatus
  originPhone: string
  offer: TvPlanKind
  currentPlanLabel: string | null
  destinationPlanLabel: string | null
  quotedMonthlyFee: number | null
  quotedComponents: WhatsappQuotedComponent[]
  customerAccepted: boolean | null
  customerAcceptedAt: string | null
  status: WhatsappRequestStatus
  operatorResult: string | null
  operatorNotes: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

const TRANSITIONS: Record<WhatsappRequestStatus, readonly WhatsappRequestStatus[]> = {
  pending: ["in_review", "rejected"],
  in_review: ["approved", "rejected"],
  approved: ["completed", "rejected"],
  completed: [],
  rejected: [],
}

export function whatsappRequestStatusLabel(status: WhatsappRequestStatus): string {
  if (status === "pending") return "Pendiente"
  if (status === "in_review") return "En revisión"
  if (status === "approved") return "Aprobada"
  if (status === "completed") return "Completada"
  return "Rechazada"
}

export function allowedWhatsappRequestTransitions(
  status: WhatsappRequestStatus
): readonly WhatsappRequestStatus[] {
  return TRANSITIONS[status]
}

export function canReviewWhatsappRequests(
  role: SystemRole | null | undefined
): boolean {
  return canWriteSubscriptions(role)
}

/** Digits only. A 10-digit local mobile becomes the Argentina WhatsApp form. */
export function normalizeWhatsappOriginPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  digits = digits.replace(/^0+/, "")
  if (digits.length === 10) digits = `549${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

/**
 * A phone match is not enough. The request is linked only when the phone was
 * verified and it belongs to exactly one customer.
 */
export function resolveWhatsappRequestIdentity(input: {
  matches: readonly { customerId: string }[]
  phoneVerified: boolean
}): { customerId: string | null; identityStatus: WhatsappIdentityStatus } {
  const ids = [
    ...new Set(input.matches.map((match) => match.customerId.trim()).filter(Boolean)),
  ]
  if (!input.phoneVerified || ids.length !== 1) {
    return { customerId: null, identityStatus: "unverified" }
  }
  return { customerId: ids[0], identityStatus: "verified" }
}

export function snapshotWhatsappCommercialQuote(input: {
  quote: TvPlanDestination
  service: TvPlanServiceFact
}): {
  quotedMonthlyFee: number
  quotedComponents: WhatsappQuotedComponent[]
  currentPlanLabel: string | null
  destinationPlanLabel: string | null
} | null {
  if (!input.quote.selectable || input.quote.nextMonthlyFee == null) return null
  return {
    quotedMonthlyFee: input.quote.nextMonthlyFee,
    quotedComponents: input.quote.actions.map((action) => ({
      code: action.code,
      action: action.type,
      unitPrice: componentUnitPrice(action, input.service),
    })),
    currentPlanLabel: input.quote.tierLabel,
    destinationPlanLabel: input.quote.nextTierLabel,
  }
}

function componentUnitPrice(
  action: TvPlanComponentAction,
  service: TvPlanServiceFact
): number | null {
  if (action.type === "assign") return action.unitPrice
  const active = service.activeComponents.find(
    (item) => item.code.trim().toUpperCase() === action.code.trim().toUpperCase()
  )
  return active?.unitPrice ?? null
}

export function buildWhatsappCommercialRequest(input: {
  id: string
  companyId: string
  originPhone: string
  offer: TvPlanKind
  matches: readonly { customerId: string }[]
  phoneVerified: boolean
  quote: TvPlanDestination | null
  service: TvPlanServiceFact | null
  customerAccepted: boolean | null
  customerAcceptedAt: string | null
  now: string
}): { ok: true; request: WhatsappCommercialRequest } | { ok: false; message: string } {
  const companyId = input.companyId.trim()
  if (!companyId) return { ok: false, message: "Empresa no resuelta." }
  const originPhone = normalizeWhatsappOriginPhone(input.originPhone)
  if (!originPhone) return { ok: false, message: "Teléfono de origen inválido." }
  const identity = resolveWhatsappRequestIdentity({
    matches: input.matches,
    phoneVerified: input.phoneVerified,
  })
  const snapshot =
    identity.identityStatus === "verified" && input.quote && input.service
      ? snapshotWhatsappCommercialQuote({ quote: input.quote, service: input.service })
      : null
  return {
    ok: true,
    request: {
      id: input.id,
      companyId,
      customerId: identity.customerId,
      identityStatus: identity.identityStatus,
      originPhone,
      offer: input.offer,
      currentPlanLabel: snapshot?.currentPlanLabel ?? null,
      destinationPlanLabel: snapshot?.destinationPlanLabel ?? null,
      quotedMonthlyFee: snapshot?.quotedMonthlyFee ?? null,
      quotedComponents: snapshot?.quotedComponents ?? [],
      customerAccepted:
        identity.identityStatus === "verified" ? input.customerAccepted : null,
      customerAcceptedAt:
        identity.identityStatus === "verified" ? input.customerAcceptedAt : null,
      status: "pending",
      operatorResult: null,
      operatorNotes: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    },
  }
}

export function resolveWhatsappRequestUpdate(input: {
  current: WhatsappCommercialRequest
  status: WhatsappRequestStatus
  operatorNotes: string
  actorId: string
  now: string
}):
  | { ok: true; request: WhatsappCommercialRequest }
  | { ok: false; message: string } {
  if (!allowedWhatsappRequestTransitions(input.current.status).includes(input.status)) {
    return { ok: false, message: "Ese cambio de estado no está permitido." }
  }
  const notes = input.operatorNotes.trim()
  if (
    (input.status === "approved" ||
      input.status === "completed" ||
      input.status === "rejected") &&
    notes.length === 0
  ) {
    return { ok: false, message: "La resolución necesita una observación." }
  }
  const terminal = input.status === "completed" || input.status === "rejected"
  return {
    ok: true,
    request: {
      ...input.current,
      status: input.status,
      operatorNotes: notes.length > 0 ? notes : input.current.operatorNotes,
      operatorResult: whatsappRequestStatusLabel(input.status),
      resolvedBy: terminal ? input.actorId : input.current.resolvedBy,
      resolvedAt: terminal ? input.now : input.current.resolvedAt,
      updatedAt: input.now,
    },
  }
}

export type WhatsappRequestStore = {
  insert(request: WhatsappCommercialRequest): Promise<void>
  list(companyId: string, status: WhatsappRequestStatus | "all"): Promise<WhatsappCommercialRequest[]>
  get(companyId: string, id: string): Promise<WhatsappCommercialRequest | null>
  save(request: WhatsappCommercialRequest): Promise<void>
}

export const WHATSAPP_OPEN_REQUEST_STATUSES = ["pending", "in_review", "approved"] as const

export function resolveRepeatedWhatsappAcceptance(input: {
  companyId: string
  originPhone: string
  offer: string
  existing: {
    companyId: string
    originPhone: string
    offer: string
    status: string
    customerId: string | null
  } | null
}): "create" | "reuse" {
  const existing = input.existing
  if (!existing) return "create"
  if (existing.companyId !== input.companyId) return "create"
  if (existing.originPhone !== input.originPhone) return "create"
  if (existing.offer !== input.offer) return "create"
  if (!(WHATSAPP_OPEN_REQUEST_STATUSES as readonly string[]).includes(existing.status)) {
    return "create"
  }
  return "reuse"
}

export function createMemoryWhatsappRequests(): WhatsappRequestStore {
  const rows = new Map<string, WhatsappCommercialRequest>()
  return {
    async insert(request) {
      rows.set(request.id, request)
    },
    async list(companyId, status) {
      return [...rows.values()].filter(
        (row) => row.companyId === companyId && (status === "all" || row.status === status)
      )
    },
    async get(companyId, id) {
      const row = rows.get(id)
      if (!row || row.companyId !== companyId) return null
      return row
    },
    async save(request) {
      const current = rows.get(request.id)
      if (!current || current.companyId !== request.companyId) {
        throw new Error("whatsapp_request_not_found")
      }
      if (
        current.quotedMonthlyFee !== request.quotedMonthlyFee ||
        JSON.stringify(current.quotedComponents) !== JSON.stringify(request.quotedComponents)
      ) {
        throw new Error("whatsapp_request_snapshot_locked")
      }
      rows.set(request.id, request)
    },
  }
}
