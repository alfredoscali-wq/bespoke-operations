import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"

/**
 * Único punto de verdad de la equivalencia comercial.
 * Los nombres de LATAM no se traducen. Los `pl_id` no viven aquí:
 * salen de POST /api/get-plans y se asocian por nombre exacto.
 * TV Full se identifica, pero no es operativo para altas ni cambios.
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
    operational: false,
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

/** Trim and collapse whitespace. Case and wording stay exact. */
export function normalizeLatamPlanName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function wholeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

function categories(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()]
    if (typeof item === "number" && Number.isFinite(item)) return [String(item)]
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      const label = text(record.nombre) ?? text(record.name) ?? text(record.categoria)
      return label ? [label] : []
    }
    return []
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

function planList(payload: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(payload.plans)) return payload.plans
  if (Array.isArray(payload.plan)) return payload.plan
  const data = payload.data
  if (Array.isArray(data)) return data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.plans)) return record.plans
    if (Array.isArray(record.plan)) return record.plan
  }
  return null
}

/** Interpreta el JSON de get-plans. No copia el token ni otros campos. */
export function readLatamTvPlansPayload(payload: Record<string, unknown>): LatamTvCatalogPlan[] {
  if (wholeNumber(payload.code) !== 1) throw new LatamTvRequestError("unavailable")
  const listed = planList(payload)
  if (!listed) throw new LatamTvRequestError("unavailable")
  return listed.flatMap((item) => {
    const plan = toCatalogPlan(item)
    return plan ? [plan] : []
  })
}

export function matchLatamTvPlans(plans: readonly LatamTvCatalogPlan[]): LatamTvPlanDiagnosis {
  const groups = new Map<string, LatamTvCatalogPlan[]>()
  for (const plan of plans) {
    const key = normalizeLatamPlanName(plan.name)
    const current = groups.get(key) ?? []
    current.push(plan)
    groups.set(key, current)
  }

  const linkedNames = new Set(
    LATAM_TV_PLAN_LINKS.map((link) => normalizeLatamPlanName(link.latamName))
  )
  const correspondence = LATAM_TV_PLAN_LINKS.map((link) => {
    const matches = groups.get(normalizeLatamPlanName(link.latamName)) ?? []
    if (matches.length !== 1) {
      return {
        bespokeKind: link.bespokeKind,
        bespokeLabel: link.bespokeLabel,
        latamName: link.latamName,
        planId: null,
        categories: [],
        status: "unmapped" as const,
        reason: matches.length > 1 ? ("duplicate" as const) : ("missing" as const),
      }
    }
    const plan = matches[0]
    return {
      bespokeKind: link.bespokeKind,
      bespokeLabel: link.bespokeLabel,
      latamName: link.latamName,
      planId: plan.id,
      categories: plan.categories,
      status: link.operational ? ("ok" as const) : ("not_operational" as const),
      reason: null,
    }
  })

  return {
    plans: [...plans],
    correspondence,
    otherPlans: plans.filter(
      (plan) => !linkedNames.has(normalizeLatamPlanName(plan.name))
    ),
  }
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
