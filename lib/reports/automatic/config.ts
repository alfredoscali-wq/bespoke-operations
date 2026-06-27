/**
 * Automatic Reports — configuración central (constantes e infraestructura).
 * Los parámetros funcionales viven en automatic_report_settings (DB).
 */

export const WEEKLY_REPORT_ID = "bespoke-weekly-executive" as const

export const WEEKLY_REPORT_TITLE = "Bespoke Weekly Report"
export const WEEKLY_REPORT_SUBTITLE = "Reporte Semanal Operativo"

export const WEEKLY_REPORT_SITE_URL = "https://bespoke-app.com.ar"
export const WEEKLY_REPORT_BRAND_COLOR = "#1e4d8c"

/** Lunes 07:30 America/Argentina/Buenos_Aires → 10:30 UTC (ver vercel.json). */
export const WEEKLY_REPORT_CRON_UTC = "30 10 * * 1"

export const WEEKLY_REPORT_TIMEZONE = "America/Argentina/Buenos_Aires"

export const WEEKLY_REPORT_FROM_EMAIL =
  "Bespoke Operations <reportes@bespoke-app.com.ar>"

export function getWeeklyReportFromEmail(): string {
  return WEEKLY_REPORT_FROM_EMAIL
}

export function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim()
  return key || null
}

export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  return secret || null
}

export const AUTOMATIC_REPORTS_FUTURE = {
  multipleRecipients: false,
  dailyReport: false,
  monthlyReport: false,
  perCrewEmail: false,
  excelExport: false,
} as const

export const WEEKLY_REPORT_SEND_DAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
] as const
