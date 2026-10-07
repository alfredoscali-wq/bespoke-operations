import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"

/**
 * Único punto de verdad de la equivalencia comercial.
 * Los pl_id salen de get-plans y se asocian por nombre normalizado.
 * TV Full solo queda operativo si el catálogo trae "Plan Full".
 * El alta de un cliente Full sigue bloqueada en el flujo de registro.
 */
export const LATAM_TV_PLAN_LINKS = [
  {
    bespokeKind: "basica",
    bespokeLabel: "TV Básica",
    latamName: "Plan Basico",
    operational: true,
  },
  {
    bespokeKind: "pack",
    bespokeLabel: "TV Básica + Pack Fútbol",
    latamName: "Plan Basico + Pack Futbol",
    operational: true,
  },
  {
    bespokeKind: "full",
    bespokeLabel: "TV Full",
    latamName: "Plan Full",
    operational: true,
  },
] as const

export type LatamTvBespokePlanKind = (typeof LATAM_TV_PLAN_LINKS)[number]["bespokeKind"]

export type LatamTvCatalogPlan = {
  id: string
  name: string
  categories: string[]
}

export type LatamPlanMatchStatus = "ok" | "not_operational" | "unmapped"

export type LatamPlanCorrespondenceRow = {
  bespokeKind: LatamTvBespokePlanKind
  bespokeLabel: string
  latamName: string
  planId: string | null
  categories: string[]
  status: LatamPlanMatchStatus
  reason: "missing" | "duplicate" | null
}

export type LatamTvPlanDiagnosis = {
  plans: LatamTvCatalogPlan[]
  correspondence: LatamPlanCorrespondenceRow[]
  otherPlans: LatamTvCatalogPlan[]
}

/** Trim and collapse whitespace. The visible name keeps its original case. */
export function normalizeLatamPlanName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

/** Exact match: collapsed spaces, case-insensitive. Accents and wording stay. */
export function latamPlanNameKey(name: string): string {
  return normalizeLatamPlanName(name).toLowerCase()
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function categoryLabel(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const name = text(record.nombre) ?? text(record.name) ?? text(record.categoria)
  const id = text(record.id)
  if (name && id) return `${name} (${id})`
  return name
}

function categories(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = categoryLabel(value)
    return single ? [single] : []
  }
  return value.flatMap((item) => {
    const label = categoryLabel(item)
    return label ? [label] : []
  })
}

function toCatalogPlan(value: unknown): LatamTvCatalogPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = text(record.pl_id)
  const name = text(record.nombre)
  if (!id || !name) return null
  return { id, name, categories: categories(record.categorias) }
}

/**
 * get-plans responde `{ error: false, planes: [...] }`.
 * `error: true` es un fallo de LATAM. Sin `planes` la respuesta es inválida,
 * no un catálogo vacío. No se leen `code` ni `plans`.
 */
export function readLatamTvPlansPayload(payload: Record<string, unknown>): LatamTvCatalogPlan[] {
  if (payload.error === true) throw new LatamTvRequestError("unavailable")
  if (payload.error !== false) throw new LatamTvRequestError("unavailable")
  if (!Array.isArray(payload.planes)) throw new LatamTvRequestError("unavailable")
  return payload.planes.flatMap((item) => {
    const plan = toCatalogPlan(item)
    return plan ? [plan] : []
  })
}

export function matchLatamTvPlans(plans: readonly LatamTvCatalogPlan[]): LatamTvPlanDiagnosis {
  const groups = new Map<string, LatamTvCatalogPlan[]>()
  for (const plan of plans) {
    const key = latamPlanNameKey(plan.name)
    const current = groups.get(key) ?? []
    current.push(plan)
    groups.set(key, current)
  }

  const linkedNames = new Set(
    LATAM_TV_PLAN_LINKS.map((link) => latamPlanNameKey(link.latamName))
  )
  const correspondence = LATAM_TV_PLAN_LINKS.map((link) => {
    const matches = groups.get(latamPlanNameKey(link.latamName)) ?? []
    if (matches.length !== 1 || !matches[0]?.id) {
      return {
        bespokeKind: link.bespokeKind,
        bespokeLabel: link.bespokeLabel,
        latamName: link.latamName,
        planId: null,
        categories: [],
        status: "unmapped" as const,
        reason:
          matches.length > 1
            ? ("duplicate" as const)
            : matches.length === 0
              ? ("missing" as const)
              : null,
      }
    }
    const plan = matches[0]
    return {
      bespokeKind: link.bespokeKind,
      bespokeLabel: link.bespokeLabel,
      latamName: link.latamName,
      planId: plan.id,
      categories: plan.categories,
      status: "ok" as const,
      reason: null,
    }
  })

  return {
    plans: [...plans],
    correspondence,
    otherPlans: plans.filter(
      (plan) => !linkedNames.has(latamPlanNameKey(plan.name))
    ),
  }
}

export function formatLatamPlanCatalog(diagnosis: LatamTvPlanDiagnosis): string[] {
  const lines = diagnosis.plans.map((plan) => {
    const match = diagnosis.correspondence.find(
      (row) => row.status === "ok" && row.planId === plan.id
    )
    const label = match?.bespokeLabel ?? "Sin correspondencia"
    const listed = plan.categories.join(", ") || "—"
    return `${plan.id} | ${plan.name} | ${listed} | ${label}`
  })
  const full = diagnosis.correspondence.find((row) => row.bespokeKind === "full")
  if (!full || full.status !== "ok" || !full.planId) {
    lines.push("TV Full | no disponible")
  }
  return lines
}

export function formatLatamPlanDiagnosis(diagnosis: LatamTvPlanDiagnosis): string[] {
  return diagnosis.correspondence.map((row) => {
    const mark =
      row.status === "ok"
        ? "OK"
        : row.status === "not_operational"
          ? "NO OPERATIVO"
          : "UNMAPPED"
    const id = row.planId ?? "sin pl_id"
    return `${row.bespokeLabel} → ${row.latamName} → pl_id ${id} → ${mark}`
  })
}

/**
 * Ids operativos para un cambio futuro entre TV Básica y Pack Fútbol.
 * No llama a LATAM y no incluye TV Full.
 */
export function latamOperationalPlanIds(
  diagnosis: LatamTvPlanDiagnosis
): { basica: string; pack: string } | null {
  const basica = diagnosis.correspondence.find((row) => row.bespokeKind === "basica")
  const pack = diagnosis.correspondence.find((row) => row.bespokeKind === "pack")
  if (basica?.status !== "ok" || !basica.planId) return null
  if (pack?.status !== "ok" || !pack.planId) return null
  return { basica: basica.planId, pack: pack.planId }
}

export const LATAM_FULL_PLAN_UNAVAILABLE =
  "TV Full todavía no está disponible en LATAM TV."

export type LatamCommercialPlanOption = {
  kind: LatamTvBespokePlanKind
  label: string
  latamName: string
  available: boolean
  planId: string | null
}

/** Opciones comerciales. PlanTienda y el resto del catálogo no entran. */
export function latamCommercialPlanOptions(
  diagnosis: LatamTvPlanDiagnosis
): LatamCommercialPlanOption[] {
  return diagnosis.correspondence.map((row) => ({
    kind: row.bespokeKind,
    label: row.bespokeLabel,
    latamName: row.latamName,
    available: row.status === "ok" && Boolean(row.planId),
    planId: row.status === "ok" ? row.planId : null,
  }))
}

export function latamChangePlanTarget(
  kind: LatamTvBespokePlanKind,
  diagnosis: LatamTvPlanDiagnosis
): { planId: string; latamName: string } | null {
  const option = latamCommercialPlanOptions(diagnosis).find((item) => item.kind === kind)
  if (!option?.available || !option.planId) return null
  return { planId: option.planId, latamName: option.latamName }
}
