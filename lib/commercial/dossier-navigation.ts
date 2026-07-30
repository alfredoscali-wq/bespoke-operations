import { COMMERCIAL_PIPELINE_UI_ENABLED } from "@/lib/commercial/mvp-ui"

export const COMMERCIAL_DOSSIER_FROM_VALUES = [
  "inicio",
  "oportunidades",
  "pipeline",
  "territorio",
  "actividad",
] as const

export type CommercialDossierFrom =
  (typeof COMMERCIAL_DOSSIER_FROM_VALUES)[number]

export function isCommercialDossierFrom(
  value: string | null | undefined
): value is CommercialDossierFrom {
  return (
    typeof value === "string" &&
    (COMMERCIAL_DOSSIER_FROM_VALUES as readonly string[]).includes(value)
  )
}

export function resolveCommercialDossierBackHref(
  from: string | null | undefined
): string | null {
  if (!isCommercialDossierFrom(from)) {
    return null
  }

  switch (from) {
    case "inicio":
      return "/gestion-comercial/oportunidades"
    case "oportunidades":
      return "/gestion-comercial/oportunidades"
    case "pipeline":
      // MVP: Pipeline UI hidden — never send “Volver” to the gated Kanban route.
      return COMMERCIAL_PIPELINE_UI_ENABLED
        ? "/gestion-comercial/pipeline"
        : "/gestion-comercial/oportunidades"
    case "territorio":
      return "/gestion-comercial/mapa"
    case "actividad":
      return "/gestion-comercial/actividad-comercial"
    default: {
      const _exhaustive: never = from
      return _exhaustive
    }
  }
}

/** Build expediente URL with navigation origin (and optional extra query params). */
export function buildCommercialDossierHref(
  opportunityId: string,
  from: CommercialDossierFrom,
  extraParams?: Record<string, string | undefined | null>
): string {
  const params = new URLSearchParams()
  params.set("from", from)

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      const trimmed = value?.trim()
      if (trimmed) {
        params.set(key, trimmed)
      }
    }
  }

  return `/gestion-comercial/${opportunityId}?${params.toString()}`
}
