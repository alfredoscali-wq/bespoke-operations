import type { OperationalStep, Task } from "@/lib/types/tasks"

export function hasOperationalSteps(
  task: Pick<Task, "operationalSteps">
): boolean {
  return (task.operationalSteps?.length ?? 0) > 0
}

export function getOperationalStepsProgress(
  steps: OperationalStep[],
  stepPhotoCounts: Record<string, number>
): number {
  if (steps.length === 0) return 0

  const completed = steps.filter(
    (step) => (stepPhotoCounts[step.id] ?? 0) > 0
  ).length

  return Math.round((completed / steps.length) * 100)
}

export function buildStepPhotoCounts(
  photos: Array<{ operationalStepId?: string | null }>
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const photo of photos) {
    if (!photo.operationalStepId) continue
    counts[photo.operationalStepId] =
      (counts[photo.operationalStepId] ?? 0) + 1
  }

  return counts
}

export function syncOperationalStepsWithPhotoCounts(
  steps: OperationalStep[],
  stepPhotoCounts: Record<string, number>
): OperationalStep[] {
  const now = new Date().toISOString()

  return steps.map((step) => {
    const hasPhoto = (stepPhotoCounts[step.id] ?? 0) > 0

    return {
      ...step,
      completedAt: hasPhoto ? step.completedAt ?? now : null,
    }
  })
}

export function getLatestPhotoForStep<
  T extends { operationalStepId?: string | null; createdAt: string }
>(photos: T[], stepId: string): T | undefined {
  return photos
    .filter((photo) => photo.operationalStepId === stepId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
}
