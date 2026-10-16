import { calculateCommercialPrice } from "@/lib/isp/commercial-pricing"
import { resolveCommercialListPrice } from "@/lib/isp/commercial-assignment"
import { latamPlanNameKey } from "@/lib/integrations/latam-tv/plans"
import {
  commercialTvTier,
  commercialTvTierLabel,
  PACK_FUTBOL_CODE,
  TV_FULL_UPGRADE_CODE,
} from "@/lib/subscriptions/pack-futbol"
import { ABNET_TV_PLAN_OPTIONS } from "@/lib/subscriptions/abnet-tv-plan-choice"

export type TvPlanKind = "basica" | "pack" | "full"

export type TvPlanCustomerLink = "one" | "none" | "many"

export type TvPlanCustomerIdentity = {
  source: string | null
  sourceRow: number | null
  abnetCustomerNumber: string | null
  bespokeLink: TvPlanCustomerLink | null
  bespokeCustomerId: string | null
}

export type TvPlanComponentFact = {
  code: string
  unitPrice: number
  isRecurring: boolean
}

export type TvPlanServiceFact = {
  serviceId: string
  includedTvCode: string | null
  listPrice: number | null
  catalogMonthlyPrice: number | null
  conditionCode: string | null
  discountPercent: number | null
  activeComponents: readonly TvPlanComponentFact[]
  catalogComponents: readonly TvPlanComponentFact[]
}

export type TvPlanIdentityResult =
  | { ok: true; customerId: string }
  | { ok: false; code: "missing_identity" | "ambiguous_customer" | "missing_customer" }

export type TvPlanServiceResult =
  | { ok: true; service: TvPlanServiceFact }
  | {
      ok: false
      code: "missing_service" | "ambiguous_service" | "incompatible_service"
    }

export type TvPlanComponentAction =
  | { type: "keep"; code: string }
  | { type: "assign"; code: string; unitPrice: number; isRecurring: boolean }
  | { type: "cancel"; code: string }

export type TvPlanDestination = {
  selectable: boolean
  blockReason: string | null
  note: string
  fullUpgrade: boolean
  pack: boolean
  actions: TvPlanComponentAction[]
  currentMonthlyFee: number | null
  nextMonthlyFee: number | null
  tierLabel: string | null
  nextTierLabel: string | null
  componentLabels: string[]
  nextComponentLabels: string[]
  conditionCode: string | null
  discountPercent: number | null
  padronAmount: number | null
}

export type TvPlanAttemptStatus =
  | "pending"
  | "latam_unconfirmed"
  | "latam_confirmed_bespoke_pending"
  | "completed"
  | "manual_review"

export type TvPlanAttempt = {
  id: string
  companyId: string
  customerId: string
  serviceId: string
  source: string
  sourceRow: number
  toKind: TvPlanKind
  toPlanId: string | null
  toPlanName: string | null
  latamStatus: string
  bespokeStatus: string
  status: TvPlanAttemptStatus
  error: string | null
  updatedAt: string
}

const FULL_WITH_PACK_BLOCK =
  "LATAM no tiene un plan Full con Pack Fútbol. La opción queda bloqueada para no quitar ni duplicar el Pack."

const MANAGED_CODES = [TV_FULL_UPGRADE_CODE, PACK_FUTBOL_CODE] as const

export function resolveTvPlanCustomer(
  identity: TvPlanCustomerIdentity
): TvPlanIdentityResult {
  if (!identity.source?.trim() || identity.sourceRow == null || identity.sourceRow <= 0) {
    return { ok: false, code: "missing_identity" }
  }
  if (!identity.abnetCustomerNumber?.trim()) {
    return { ok: false, code: "missing_identity" }
  }
  if (identity.bespokeLink === "many") return { ok: false, code: "ambiguous_customer" }
  if (identity.bespokeLink !== "one" || !identity.bespokeCustomerId?.trim()) {
    return { ok: false, code: "missing_customer" }
  }
  return { ok: true, customerId: identity.bespokeCustomerId }
}

export function resolveTvPlanService(
  services: readonly TvPlanServiceFact[]
): TvPlanServiceResult {
  const compatible = services.filter((service) => serviceHasCommercialTv(service))
  if (compatible.length === 1) return { ok: true, service: compatible[0] }
  if (compatible.length > 1) return { ok: false, code: "ambiguous_service" }
  if (services.length > 0) return { ok: false, code: "incompatible_service" }
  return { ok: false, code: "missing_service" }
}

export type TvPlanPreviewOption = {
  kind: TvPlanKind
  label: string
  latamName: string
  available: boolean
  selectable: boolean
  blockReason: string | null
  nextMonthlyFee: number | null
  changeNote: string | null
}

export type TvPlanCommercialPreview = {
  status: "ready" | "missing_service" | "ambiguous_service" | "incompatible_service" | "unavailable"
  message: string | null
  currentMonthlyFee: number | null
  tierLabel: string | null
  componentLabels: string[]
  conditionCode: string | null
  discountPercent: number | null
  options: TvPlanPreviewOption[]
}

const COMMERCIAL_STATUS_MESSAGE: Record<
  Exclude<TvPlanCommercialPreview["status"], "ready" | "unavailable">,
  string
> = {
  missing_service: "No hay un servicio contratado con TV comercial para este cliente.",
  ambiguous_service: "Hay más de un servicio contratado con TV. No se puede elegir uno solo.",
  incompatible_service: "El servicio contratado no usa TV Básica ni TV Full comercial.",
}

export function presentTvPlanPreview(input: {
  options: readonly { kind: TvPlanKind; label: string; latamName: string; available: boolean }[]
  services: readonly TvPlanServiceFact[] | null
}): TvPlanCommercialPreview {
  if (!input.services) {
    return emptyPreview(input.options, "unavailable", "No se pudo leer el servicio comercial.")
  }
  const resolved = resolveTvPlanService(input.services)
  if (!resolved.ok) {
    return emptyPreview(input.options, resolved.code, COMMERCIAL_STATUS_MESSAGE[resolved.code])
  }
  const quoted = input.options.map((option) => {
    const quote = quoteTvPlanDestination({
      service: resolved.service,
      kind: option.kind,
      latamAvailable: option.available,
    })
    return {
      kind: option.kind,
      label: option.label,
      latamName: option.latamName,
      available: option.available,
      selectable: option.available && quote.selectable,
      blockReason: option.available ? quote.blockReason : null,
      nextMonthlyFee: option.available ? quote.nextMonthlyFee : null,
      changeNote: quote.note,
    }
  })
  const sample = quoteTvPlanDestination({
    service: resolved.service,
    kind: "basica",
    latamAvailable: true,
  })
  return {
    status: "ready",
    message: null,
    currentMonthlyFee: sample.currentMonthlyFee,
    tierLabel: sample.tierLabel,
    componentLabels: sample.componentLabels,
    conditionCode: sample.conditionCode,
    discountPercent: sample.discountPercent,
    options: quoted,
  }
}

function emptyPreview(
  options: readonly { kind: TvPlanKind; label: string; latamName: string; available: boolean }[],
  status: TvPlanCommercialPreview["status"],
  message: string
): TvPlanCommercialPreview {
  return {
    status,
    message,
    currentMonthlyFee: null,
    tierLabel: null,
    componentLabels: [],
    conditionCode: null,
    discountPercent: null,
    options: options.map((option) => ({
      ...option,
      selectable: option.available,
      blockReason: null,
      nextMonthlyFee: null,
      changeNote: message,
    })),
  }
}

export function quoteTvPlanDestination(input: {
  service: TvPlanServiceFact
  kind: TvPlanKind
  latamAvailable: boolean
}): TvPlanDestination {
  const currentPack = hasCode(input.service.activeComponents, PACK_FUTBOL_CODE)
  const currentFull = hasCode(input.service.activeComponents, TV_FULL_UPGRADE_CODE)
  const tier = commercialTvTier({
    includedTvCode: input.service.includedTvCode,
    activeComponentCodes: input.service.activeComponents.map((item) => item.code),
  })
  const listPrice = resolveCommercialListPrice(
    input.service.listPrice,
    input.service.catalogMonthlyPrice
  )
  const currentMonthlyFee = priceOf(listPrice, input.service.activeComponents, input.service.discountPercent)
  const blocked = destinationBlock({
    kind: input.kind,
    latamAvailable: input.latamAvailable,
    currentPack,
  })
  const fullUpgrade = input.kind === "full"
  const pack = input.kind === "pack"
  const actions = blocked.selectable
    ? componentSyncPlan(input.service, { fullUpgrade, pack })
    : []
  const missingCatalog = blocked.selectable && requiredAssignMissing(input.service, { fullUpgrade, pack }, actions)
  const selectable = blocked.selectable && !missingCatalog
  const nextComponents = selectable
    ? componentsAfter(input.service, actions)
    : input.service.activeComponents
  const nextMonthlyFee = selectable
    ? priceOf(listPrice, nextComponents, input.service.discountPercent)
    : null
  const nextTier = commercialTvTier({
    includedTvCode: input.service.includedTvCode,
    activeComponentCodes: nextComponents.map((item) => item.code),
  })

  return {
    selectable,
    blockReason: missingCatalog
      ? "El catálogo comercial no tiene el precio del componente necesario."
      : blocked.blockReason,
    note: destinationNote({ kind: input.kind, currentPack, currentFull, pack, fullUpgrade }),
    fullUpgrade,
    pack,
    actions,
    currentMonthlyFee,
    nextMonthlyFee,
    tierLabel: commercialTvTierLabel(tier),
    nextTierLabel: commercialTvTierLabel(nextTier),
    componentLabels: labelsOf(input.service.activeComponents),
    nextComponentLabels: labelsOf(nextComponents),
    conditionCode: input.service.conditionCode,
    discountPercent: input.service.discountPercent,
    padronAmount: selectable ? padronAmountFor(input.kind) : null,
  }
}

export function componentSyncPlan(
  service: TvPlanServiceFact,
  target: { fullUpgrade: boolean; pack: boolean }
): TvPlanComponentAction[] {
  const desired = new Map<string, boolean>([
    [TV_FULL_UPGRADE_CODE, target.fullUpgrade],
    [PACK_FUTBOL_CODE, target.pack],
  ])
  const actions: TvPlanComponentAction[] = []
  for (const code of MANAGED_CODES) {
    const active = service.activeComponents.find((item) => sameCode(item.code, code))
    const want = desired.get(code) === true
    if (want && active) actions.push({ type: "keep", code })
    if (want && !active) {
      const catalog = service.catalogComponents.find((item) => sameCode(item.code, code))
      if (!catalog) continue
      actions.push({
        type: "assign",
        code,
        unitPrice: catalog.unitPrice,
        isRecurring: catalog.isRecurring,
      })
    }
    if (!want && active) actions.push({ type: "cancel", code })
  }
  return actions
}

export type TvPlanAttemptStore = {
  get(id: string): Promise<TvPlanAttempt | null>
  save(attempt: TvPlanAttempt): Promise<void>
  lock(key: string): Promise<boolean>
  unlock(key: string): Promise<void>
}

export function createMemoryTvPlanAttempts(): TvPlanAttemptStore & {
  rows(): TvPlanAttempt[]
} {
  const rows = new Map<string, TvPlanAttempt>()
  const locks = new Set<string>()
  return {
    async get(id) {
      const row = rows.get(id)
      return row ? { ...row } : null
    },
    async save(attempt) {
      rows.set(attempt.id, { ...attempt })
    },
    async lock(key) {
      if (locks.has(key)) return false
      locks.add(key)
      return true
    },
    async unlock(key) {
      locks.delete(key)
    },
    rows() {
      return [...rows.values()]
    },
  }
}

export type TvPlanLatamView = {
  found: boolean
  planId: string | null
  planName: string | null
}

export type TvPlanLatamChange =
  | { outcome: "updated"; planId: string | null; planName: string | null }
  | { outcome: "same_plan"; planId: string | null; planName: string | null }
  | { outcome: "unverified"; planId: string | null; planName: string | null }
  | { outcome: "rejected" | "not_found" | "plan_missing" | "unavailable" | "busy" }

export async function coordinateTvPlanChange(input: {
  attemptId: string
  companyId: string
  identity: TvPlanCustomerIdentity
  services: readonly TvPlanServiceFact[]
  kind: TvPlanKind
  latamAvailable: boolean
  targetPlanId: string
  targetPlanName: string
  now: string
  store: TvPlanAttemptStore
  readLatam: () => Promise<TvPlanLatamView>
  changeLatam: () => Promise<TvPlanLatamChange>
  applyAction: (action: TvPlanComponentAction) => Promise<void>
  readPersistedPrice: () => Promise<{
    priceSubtotal: number
    discountAmount: number
    monthlyFee: number
  } | null>
  updatePadron: (amount: number) => Promise<void>
}): Promise<{
  status: TvPlanAttemptStatus
  latamCalled: boolean
  bespokeWritten: boolean
  error: string | null
}> {
  const customer = resolveTvPlanCustomer(input.identity)
  if (!customer.ok) {
    return { status: "manual_review", latamCalled: false, bespokeWritten: false, error: customer.code }
  }
  const service = resolveTvPlanService(input.services)
  if (!service.ok) {
    return { status: "manual_review", latamCalled: false, bespokeWritten: false, error: service.code }
  }
  const quote = quoteTvPlanDestination({
    service: service.service,
    kind: input.kind,
    latamAvailable: input.latamAvailable,
  })
  if (!quote.selectable || quote.currentMonthlyFee == null) {
    return {
      status: "manual_review",
      latamCalled: false,
      bespokeWritten: false,
      error: quote.blockReason ?? "missing_price",
    }
  }

  const lockKey = `${input.companyId}:${service.service.serviceId}`
  const locked = await input.store.lock(lockKey)
  if (!locked) {
    return { status: "pending", latamCalled: false, bespokeWritten: false, error: "busy" }
  }

  try {
    const existing = await input.store.get(input.attemptId)
    const resume = existing?.status === "latam_confirmed_bespoke_pending"
    let latamCalled = false
    let latam = await input.readLatam()
    const alreadyThere = latamMatches(latam, input.targetPlanId, input.targetPlanName)

    if (!resume && !alreadyThere) {
      latamCalled = true
      const changed = await input.changeLatam()
      if (changed.outcome === "unverified") {
        await input.store.save(attemptOf(input, service.service.serviceId, {
          status: "manual_review",
          latamStatus: "unverified",
          bespokeStatus: "not_started",
          error: "unverified",
          toPlanId: changed.planId,
          toPlanName: input.targetPlanName,
        }))
        return { status: "manual_review", latamCalled, bespokeWritten: false, error: "unverified" }
      }
      if (changed.outcome !== "updated" && changed.outcome !== "same_plan") {
        await input.store.save(attemptOf(input, service.service.serviceId, {
          status: "latam_unconfirmed",
          latamStatus: changed.outcome,
          bespokeStatus: "not_started",
          error: changed.outcome,
          toPlanId: null,
          toPlanName: input.targetPlanName,
        }))
        return { status: "latam_unconfirmed", latamCalled, bespokeWritten: false, error: changed.outcome }
      }
      latam = await input.readLatam()
    }

    if (!latamMatches(latam, input.targetPlanId, input.targetPlanName)) {
      await input.store.save(attemptOf(input, service.service.serviceId, {
        status: "manual_review",
        latamStatus: "mismatch",
        bespokeStatus: resume ? "pending" : "not_started",
        error: "latam_mismatch",
        toPlanId: input.targetPlanId,
        toPlanName: input.targetPlanName,
      }))
      return { status: "manual_review", latamCalled, bespokeWritten: false, error: "latam_mismatch" }
    }

    await input.store.save(attemptOf(input, service.service.serviceId, {
      status: "latam_confirmed_bespoke_pending",
      latamStatus: "confirmed",
      bespokeStatus: "pending",
      error: null,
      toPlanId: input.targetPlanId,
      toPlanName: input.targetPlanName,
    }))

    try {
      for (const action of quote.actions) {
        if (action.type !== "keep") await input.applyAction(action)
      }
      const price = await input.readPersistedPrice()
      if (!price || price.monthlyFee !== quote.nextMonthlyFee) {
        await input.store.save(attemptOf(input, service.service.serviceId, {
          status: "manual_review",
          latamStatus: "confirmed",
          bespokeStatus: "price_unverified",
          error: "price_unverified",
          toPlanId: input.targetPlanId,
          toPlanName: input.targetPlanName,
        }))
        return { status: "manual_review", latamCalled, bespokeWritten: true, error: "price_unverified" }
      }
      if (quote.padronAmount != null) await input.updatePadron(quote.padronAmount)
    } catch (error) {
      const message = error instanceof Error ? error.message : "bespoke_failed"
      await input.store.save(attemptOf(input, service.service.serviceId, {
        status: "latam_confirmed_bespoke_pending",
        latamStatus: "confirmed",
        bespokeStatus: "failed",
        error: message,
        toPlanId: input.targetPlanId,
        toPlanName: input.targetPlanName,
      }))
      return {
        status: "latam_confirmed_bespoke_pending",
        latamCalled,
        bespokeWritten: false,
        error: message,
      }
    }

    await input.store.save(attemptOf(input, service.service.serviceId, {
      status: "completed",
      latamStatus: "confirmed",
      bespokeStatus: "completed",
      error: null,
      toPlanId: input.targetPlanId,
      toPlanName: input.targetPlanName,
    }))
    return { status: "completed", latamCalled, bespokeWritten: true, error: null }
  } finally {
    await input.store.unlock(lockKey)
  }
}

function serviceHasCommercialTv(service: TvPlanServiceFact): boolean {
  return (
    commercialTvTier({
      includedTvCode: service.includedTvCode,
      activeComponentCodes: service.activeComponents.map((item) => item.code),
    }) !== "none"
  )
}

function destinationBlock(input: {
  kind: TvPlanKind
  latamAvailable: boolean
  currentPack: boolean
}): { selectable: boolean; blockReason: string | null } {
  if (!input.latamAvailable) {
    return { selectable: false, blockReason: "El plan no está disponible en el catálogo de LATAM." }
  }
  if (input.kind === "full" && input.currentPack) {
    return { selectable: false, blockReason: FULL_WITH_PACK_BLOCK }
  }
  return { selectable: true, blockReason: null }
}

function destinationNote(input: {
  kind: TvPlanKind
  currentPack: boolean
  currentFull: boolean
  pack: boolean
  fullUpgrade: boolean
}): string {
  if (input.kind === "full" && input.currentPack) return FULL_WITH_PACK_BLOCK
  const parts = [
    "La condición comercial vigente se conserva. El estado Jubilado del padrón no se convierte en la condición JUBILADO.",
  ]
  if (input.pack && input.currentPack) {
    parts.push("El Pack Fútbol ya asignado se conserva una sola vez.")
  } else if (input.pack) {
    parts.push("Pack Fútbol se agrega una sola vez como componente PACK-FUTBOL.")
  } else if (input.currentPack) {
    parts.push("El plan de LATAM no incluye Pack Fútbol, así que ese componente se quita.")
  }
  if (input.fullUpgrade && !input.currentFull) {
    parts.push("TV Full se representa con el componente TV-FULL-UPGRADE.")
  } else if (!input.fullUpgrade && input.currentFull) {
    parts.push("TV Full se quita al cancelar TV-FULL-UPGRADE.")
  }
  return parts.join(" ")
}

function requiredAssignMissing(
  service: TvPlanServiceFact,
  target: { fullUpgrade: boolean; pack: boolean },
  actions: readonly TvPlanComponentAction[]
): boolean {
  const required = [
    target.fullUpgrade ? TV_FULL_UPGRADE_CODE : null,
    target.pack ? PACK_FUTBOL_CODE : null,
  ].filter((code): code is string => code != null)
  return required.some((code) => {
    const active = hasCode(service.activeComponents, code)
    const assigned = actions.some((action) => action.type === "assign" && sameCode(action.code, code))
    const kept = actions.some((action) => action.type === "keep" && sameCode(action.code, code))
    return !active && !assigned && !kept
  })
}

function componentsAfter(
  service: TvPlanServiceFact,
  actions: readonly TvPlanComponentAction[]
): TvPlanComponentFact[] {
  const next = service.activeComponents.filter(
    (item) => !actions.some((action) => action.type === "cancel" && sameCode(action.code, item.code))
  )
  for (const action of actions) {
    if (action.type !== "assign") continue
    if (next.some((item) => sameCode(item.code, action.code))) continue
    next.push({
      code: action.code,
      unitPrice: action.unitPrice,
      isRecurring: action.isRecurring,
    })
  }
  return next
}

function priceOf(
  listPrice: number | null,
  components: readonly TvPlanComponentFact[],
  discountPercent: number | null
): number | null {
  if (listPrice == null || listPrice < 0) return null
  return calculateCommercialPrice({
    listPrice,
    discountPercent,
    components: components.map((item) => ({
      unitPrice: item.unitPrice,
      isRecurring: item.isRecurring,
      status: "active" as const,
    })),
  }).monthlyFee
}

function labelsOf(components: readonly TvPlanComponentFact[]): string[] {
  return components.map((item) => item.code)
}

function padronAmountFor(kind: TvPlanKind): number | null {
  return ABNET_TV_PLAN_OPTIONS.find((option) => option.id === kind)?.amount ?? null
}

function hasCode(components: readonly TvPlanComponentFact[], code: string): boolean {
  return components.some((item) => sameCode(item.code, code))
}

function sameCode(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase()
}

function latamMatches(latam: TvPlanLatamView, planId: string, planName: string): boolean {
  if (!latam.found) return false
  if (latam.planId && latam.planId === planId) return true
  if (latam.planName && latamPlanNameKey(latam.planName) === latamPlanNameKey(planName)) return true
  return false
}

function attemptOf(
  input: {
    attemptId: string
    companyId: string
    identity: TvPlanCustomerIdentity
    kind: TvPlanKind
    now: string
  },
  serviceId: string,
  patch: {
    status: TvPlanAttemptStatus
    latamStatus: string
    bespokeStatus: string
    error: string | null
    toPlanId: string | null
    toPlanName: string | null
  }
): TvPlanAttempt {
  return {
    id: input.attemptId,
    companyId: input.companyId,
    customerId: input.identity.bespokeCustomerId ?? "",
    serviceId,
    source: input.identity.source ?? "",
    sourceRow: input.identity.sourceRow ?? 0,
    toKind: input.kind,
    toPlanId: patch.toPlanId,
    toPlanName: patch.toPlanName,
    latamStatus: patch.latamStatus,
    bespokeStatus: patch.bespokeStatus,
    status: patch.status,
    error: patch.error,
    updatedAt: input.now,
  }
}
