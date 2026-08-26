export const ISP_BILLING_LOGO_POSITIONS = ["left", "center", "right"] as const
export type IspBillingLogoPosition = (typeof ISP_BILLING_LOGO_POSITIONS)[number]

export const ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH = 240
export const ISP_BILLING_LOGO_URL_MAX_LENGTH = 2048

export const ISP_BILLING_TEMPLATE_INVALID_MESSAGE =
  "La configuración de plantilla no es válida."
export const ISP_BILLING_TEMPLATE_UNKNOWN_KEY_MESSAGE =
  "La configuración de plantilla contiene propiedades no permitidas."
export const ISP_BILLING_TEMPLATE_LOGO_POSITION_MESSAGE =
  "La posición del logo no es válida."
export const ISP_BILLING_TEMPLATE_FOOTER_HTML_MESSAGE =
  "La leyenda inferior no puede incluir HTML."
export const ISP_BILLING_TEMPLATE_FOOTER_LENGTH_MESSAGE = `La leyenda inferior supera el máximo de ${ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH} caracteres.`
export const ISP_BILLING_LOGO_URL_INVALID_MESSAGE =
  "La URL del logo no es válida."

export type IspBillingTemplateSettings = {
  showLogo: boolean
  logoPosition: IspBillingLogoPosition
  showPhone: boolean
  showEmail: boolean
  showAddress: boolean
  showObservations: boolean
  footerLegend: string
}

export type IspBillingTemplateSettingsIssue = {
  field: string
  message: string
}

export const DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS: IspBillingTemplateSettings =
  {
    showLogo: true,
    logoPosition: "left",
    showPhone: true,
    showEmail: true,
    showAddress: true,
    showObservations: true,
    footerLegend: "",
  }

const API_KEYS = [
  "showLogo",
  "logoPosition",
  "showPhone",
  "showEmail",
  "showAddress",
  "showObservations",
  "footerLegend",
] as const

const DB_KEYS = [
  "show_logo",
  "logo_position",
  "show_phone",
  "show_email",
  "show_address",
  "show_observations",
  "footer_legend",
] as const

const API_KEY_SET = new Set<string>(API_KEYS)
const DB_KEY_SET = new Set<string>(DB_KEYS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function isIspBillingLogoPosition(
  value: unknown
): value is IspBillingLogoPosition {
  return (
    typeof value === "string" &&
    (ISP_BILLING_LOGO_POSITIONS as readonly string[]).includes(value)
  )
}

export function isAllowedBillingLogoUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.length > ISP_BILLING_LOGO_URL_MAX_LENGTH) return false
  if (/\s/.test(trimmed) || /[<>]/.test(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export function sanitizeBillingFooterLegend(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH)
}

function footerLooksLikeHtml(value: string): boolean {
  return /[<>]/.test(value) || /<\/?[a-z]/i.test(value)
}

function readBoolean(
  record: Record<string, unknown>,
  dbKey: string,
  apiKey: string,
  fallback: boolean
): boolean {
  const value = record[dbKey] ?? record[apiKey]
  return typeof value === "boolean" ? value : fallback
}

function readPosition(record: Record<string, unknown>): IspBillingLogoPosition {
  const value = record.logo_position ?? record.logoPosition
  return isIspBillingLogoPosition(value) ? value : "left"
}

function readLegend(record: Record<string, unknown>): string {
  const value = record.footer_legend ?? record.footerLegend
  return typeof value === "string" ? sanitizeBillingFooterLegend(value) : ""
}

export function parseIspBillingTemplateSettings(
  raw: unknown
): IspBillingTemplateSettings {
  if (raw == null || raw === "") {
    return { ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS }
  }
  if (!isRecord(raw)) {
    return { ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS }
  }

  return {
    showLogo: readBoolean(raw, "show_logo", "showLogo", true),
    logoPosition: readPosition(raw),
    showPhone: readBoolean(raw, "show_phone", "showPhone", true),
    showEmail: readBoolean(raw, "show_email", "showEmail", true),
    showAddress: readBoolean(raw, "show_address", "showAddress", true),
    showObservations: readBoolean(
      raw,
      "show_observations",
      "showObservations",
      true
    ),
    footerLegend: readLegend(raw),
  }
}

export function serializeIspBillingTemplateSettings(
  settings: IspBillingTemplateSettings
): {
  show_logo: boolean
  logo_position: IspBillingLogoPosition
  show_phone: boolean
  show_email: boolean
  show_address: boolean
  show_observations: boolean
  footer_legend: string
} {
  const parsed = parseIspBillingTemplateSettings(settings)
  return {
    show_logo: parsed.showLogo,
    logo_position: parsed.logoPosition,
    show_phone: parsed.showPhone,
    show_email: parsed.showEmail,
    show_address: parsed.showAddress,
    show_observations: parsed.showObservations,
    footer_legend: sanitizeBillingFooterLegend(parsed.footerLegend),
  }
}

export function validateIspBillingTemplateSettingsInput(
  raw: unknown
): IspBillingTemplateSettingsIssue[] {
  if (raw == null) return []
  if (!isRecord(raw)) {
    return [
      {
        field: "templateSettings",
        message: ISP_BILLING_TEMPLATE_INVALID_MESSAGE,
      },
    ]
  }

  const keys = Object.keys(raw)
  for (const key of keys) {
    if (!API_KEY_SET.has(key) && !DB_KEY_SET.has(key)) {
      return [
        {
          field: "templateSettings",
          message: ISP_BILLING_TEMPLATE_UNKNOWN_KEY_MESSAGE,
        },
      ]
    }
  }

  const usesApi = keys.some((key) => API_KEY_SET.has(key))
  const usesDb = keys.some((key) => DB_KEY_SET.has(key))
  if (usesApi && usesDb) {
    return [
      {
        field: "templateSettings",
        message: ISP_BILLING_TEMPLATE_INVALID_MESSAGE,
      },
    ]
  }

  const issues: IspBillingTemplateSettingsIssue[] = []
  const booleanFields: Array<[string, string]> = [
    ["showLogo", "show_logo"],
    ["showPhone", "show_phone"],
    ["showEmail", "show_email"],
    ["showAddress", "show_address"],
    ["showObservations", "show_observations"],
  ]

  for (const [apiKey, dbKey] of booleanFields) {
    const value = raw[apiKey] ?? raw[dbKey]
    if (value !== undefined && typeof value !== "boolean") {
      issues.push({
        field: `templateSettings.${apiKey}`,
        message: ISP_BILLING_TEMPLATE_INVALID_MESSAGE,
      })
    }
  }

  const position = raw.logoPosition ?? raw.logo_position
  if (position !== undefined && !isIspBillingLogoPosition(position)) {
    issues.push({
      field: "templateSettings.logoPosition",
      message: ISP_BILLING_TEMPLATE_LOGO_POSITION_MESSAGE,
    })
  }

  const legend = raw.footerLegend ?? raw.footer_legend
  if (legend !== undefined) {
    if (typeof legend !== "string") {
      issues.push({
        field: "templateSettings.footerLegend",
        message: ISP_BILLING_TEMPLATE_INVALID_MESSAGE,
      })
    } else if (footerLooksLikeHtml(legend)) {
      issues.push({
        field: "templateSettings.footerLegend",
        message: ISP_BILLING_TEMPLATE_FOOTER_HTML_MESSAGE,
      })
    } else if (legend.trim().length > ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH) {
      issues.push({
        field: "templateSettings.footerLegend",
        message: ISP_BILLING_TEMPLATE_FOOTER_LENGTH_MESSAGE,
      })
    }
  }

  return issues
}
