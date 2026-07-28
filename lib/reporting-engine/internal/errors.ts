import type {
  ReportingPeriod,
  ReportingQueryResult,
  ReportContext,
} from "@/lib/reporting-engine/types"

export class ReportingEngineError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "ReportingEngineError"
    this.code = code
  }
}

export function notImplementedQueryResult<T = unknown>(
  context: ReportContext,
  queryName: string
): ReportingQueryResult<T> {
  return {
    status: "not_implemented",
    data: null,
    message: `Reporting Engine: ${queryName} aún no está implementado (Foundation 1.0).`,
    context,
  }
}

export function assertValidPeriod(period: ReportingPeriod): void {
  if (!period?.range?.from || !period?.range?.to) {
    throw new ReportingEngineError(
      "INVALID_PERIOD",
      "period.range.from y period.range.to son obligatorios."
    )
  }
}
