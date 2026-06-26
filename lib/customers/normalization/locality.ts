import {
  normalizeComparisonKey,
  repairLegacyEncoding,
  trimString,
} from "@/lib/customers/normalization/text"

/** Variante normalizada → nombre canónico para Bespoke. */
export const LOCALITY_CANONICAL_BY_KEY: Record<string, string> = {
  cordoba: "Córdoba",
  "la granja": "La Granja",
  "colonia tirolesa": "Colonia Tirolesa",
  tirolesa: "Colonia Tirolesa",
  "col tirolesa": "Colonia Tirolesa",
  "rio segundo": "Río Segundo",
  "villa animi": "Villa Animi",
  "agua de oro": "Agua de Oro",
  pilar: "Pilar",
  malagueno: "Malagueño",
  "las vertientes": "Las Vertientes",
  "jesus maria": "Jesús María",
  esquiu: "Esquiu",
  "colonia caroya": "Colonia Caroya",
  "la pampa": "La Pampa",
  "santa catalina": "Santa Catalina",
  ascochinga: "Ascochinga",
  "el mirador": "El Mirador",
  "vicente aguero": "Vicente Aguero",
  "villa retiro": "Villa Retiro",
  "los molles": "Los Molles",
  "cerro azul": "Cerro Azul",
  "el manzano": "El Manzano",
  "colonia vicente aguero": "Colonia Vicente Aguero",
  "bajo olmos": "Bajo Olmos",
  "las vertientes la granja": "Las Vertientes",
  "agua de las piedras": "Agua de las Piedras",
  "rio pinto": "Río Pinto",
  "villa esquiu": "Villa Esquiu",
  "los surgentes": "Los Surgentes",
  "santa rosa de rio primero": "Santa Rosa de Río Primero",
  "salsipuedes": "Salsipuedes",
  "mendiolaza": "Mendiolaza",
  "unquillo": "Unquillo",
  "sinsacate": "Sinsacate",
  "toledo": "Toledo",
  "monte crist": "Monte Cristo",
  "monte cristo": "Monte Cristo",
}

function toTitleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase()
      if (lower.length <= 2 && ["de", "la", "el", "y", "del"].includes(lower)) {
        return lower
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

export type NormalizedLocality = {
  raw: string
  normalized: string
  canonicalKey: string
  wasMapped: boolean
}

export function normalizeLocalityName(value: unknown): NormalizedLocality {
  const raw = trimString(value)
  if (!raw) {
    return { raw: "", normalized: "", canonicalKey: "", wasMapped: false }
  }

  const repaired = repairLegacyEncoding(raw)
  const key = normalizeComparisonKey(repaired)
  const mapped = LOCALITY_CANONICAL_BY_KEY[key]

  if (mapped) {
    return {
      raw,
      normalized: mapped,
      canonicalKey: key,
      wasMapped: true,
    }
  }

  const fallback = toTitleCaseWords(repaired)
  return {
    raw,
    normalized: fallback,
    canonicalKey: key,
    wasMapped: false,
  }
}

export function registerLocalityAlias(
  alias: string,
  canonical: string
): void {
  LOCALITY_CANONICAL_BY_KEY[normalizeComparisonKey(alias)] = canonical
}
