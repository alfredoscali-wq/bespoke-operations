/**
 * In-memory activity providers for Indicator Engine 2.0 E2E (Sprint 7).
 */

export type { ActivityProvider } from "@/lib/indicator-engine/providers/types"

export {
  DEMO_ACTIVITY_DATASET,
  DEMO_BUSINESS_DATE,
  DEMO_EMPLOYEE_A_ID,
  DEMO_EMPLOYEE_B_ID,
} from "@/lib/indicator-engine/providers/mock-dataset"

export {
  createInMemoryActivityProvider,
  emptyInMemoryActivityProvider,
  inMemoryActivityProvider,
} from "@/lib/indicator-engine/providers/in-memory-activity-provider"

export { stubResolveIndicators } from "@/lib/indicator-engine/providers/stub-indicator-resolution"
