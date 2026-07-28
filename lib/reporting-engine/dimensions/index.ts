import {
  REPORTING_DIMENSION_KEYS,
  type ReportingDimensionKey,
  type ReportingDimensions,
} from "@/lib/reporting-engine/types"

export {
  REPORTING_DIMENSION_KEYS,
  type ReportingDimensionKey,
  type ReportingDimensions,
}

export const REPORTING_DIMENSIONS = {
  employee: "employee",
  crew: "crew",
  project: "project",
  customer: "customer",
  serviceType: "serviceType",
  locality: "locality",
  technology: "technology",
  status: "status",
  date: "date",
} as const satisfies Record<ReportingDimensionKey, ReportingDimensionKey>

export function isReportingDimensionKey(
  value: string
): value is ReportingDimensionKey {
  return (REPORTING_DIMENSION_KEYS as readonly string[]).includes(value)
}

export function listReportingDimensions(): ReportingDimensionKey[] {
  return [...REPORTING_DIMENSION_KEYS]
}

/** Keep only known dimension keys with non-empty values. */
export function pickReportingDimensions(
  input: ReportingDimensions | undefined
): ReportingDimensions {
  if (!input) {
    return {}
  }

  const result: ReportingDimensions = {}
  for (const key of REPORTING_DIMENSION_KEYS) {
    const value = input[key]
    if (value != null && String(value).trim() !== "") {
      result[key] = String(value).trim()
    }
  }
  return result
}
