import type { OperationalStep } from "@/lib/types/tasks"

export const DEFAULT_OPERATIONAL_STEP_LABELS = [
  "Paso Operativo 1",
  "Paso Operativo 2",
  "Paso Operativo 3",
] as const

export function createDefaultOperationalSteps(): OperationalStep[] {
  return DEFAULT_OPERATIONAL_STEP_LABELS.map((label) => ({
    id: crypto.randomUUID(),
    label,
    observation: "",
    completedAt: null,
  }))
}
