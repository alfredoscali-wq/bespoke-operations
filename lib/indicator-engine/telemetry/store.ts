import type { PerformanceReport } from "@/lib/indicator-engine/telemetry/types"

const MAX_REPORTS = 100

const reports: PerformanceReport[] = []
let lastReport: PerformanceReport | null = null

export function recordPerformanceReport(report: PerformanceReport): void {
  lastReport = report
  reports.push(report)
  if (reports.length > MAX_REPORTS) {
    reports.splice(0, reports.length - MAX_REPORTS)
  }
}

export function getLastPerformanceReport(): PerformanceReport | null {
  return lastReport
}

export function listPerformanceReports(): readonly PerformanceReport[] {
  return [...reports]
}

export function clearPerformanceReports(): void {
  reports.length = 0
  lastReport = null
}

export function getPerformanceTelemetrySummary(): {
  readonly reportCount: number
  readonly last: PerformanceReport | null
  readonly totalDurationMs: number
  readonly totalEvents: number
} {
  let totalDurationMs = 0
  let totalEvents = 0
  for (const report of reports) {
    totalDurationMs += report.totalDurationMs
    totalEvents += report.eventCount
  }
  return {
    reportCount: reports.length,
    last: lastReport,
    totalDurationMs,
    totalEvents,
  }
}
