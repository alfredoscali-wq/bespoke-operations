export function buildWeeklyReportEmailSubject(weekNumber: number): string {
  const week = String(weekNumber).padStart(2, "0")
  return `📊 Bespoke Weekly Report - Semana ${week}`
}

export function buildWeeklyReportEmailTextBody(): string {
  return [
    "Hola.",
    "",
    "Se adjunta el Reporte Semanal Operativo generado automáticamente por Bespoke Operations.",
    "",
    "Saludos.",
    "Bespoke Operations",
  ].join("\n")
}

export function buildWeeklyReportEmailHtmlBody(): string {
  return `
    <p>Hola.</p>
    <p>Se adjunta el Reporte Semanal Operativo generado automáticamente por Bespoke Operations.</p>
    <p>Saludos.<br/>Bespoke Operations</p>
  `.trim()
}
