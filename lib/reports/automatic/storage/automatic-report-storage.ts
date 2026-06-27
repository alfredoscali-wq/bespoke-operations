export const AUTOMATIC_REPORTS_STORAGE_BUCKET = "automatic-reports"

export function buildWeeklyReportStoragePath(input: {
  generatedAt: string
  weekNumber: number
}): string {
  const date = new Date(input.generatedAt)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const week = String(input.weekNumber).padStart(2, "0")

  return `${year}/${month}/weekly-report-S${week}.pdf`
}

export function buildWeeklyReportDownloadFileName(weekNumber: number): string {
  const week = String(weekNumber).padStart(2, "0")
  return `Bespoke-Weekly-Report-Semana-${week}.pdf`
}
