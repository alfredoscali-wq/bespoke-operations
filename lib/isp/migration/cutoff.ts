export type IspOnboardingWorkOrderCandidate = {
  id: string
  closedAt?: string | null
  completedAt?: string | null
  dueDate?: string | null
  createdAt?: string | null
}

export function workOrderEffectiveAt(
  task: IspOnboardingWorkOrderCandidate
): string | null {
  return (
    task.closedAt ||
    task.completedAt ||
    task.dueDate ||
    task.createdAt ||
    null
  )
}

export function isWorkOrderEligibleForIspOnboarding(input: {
  task: IspOnboardingWorkOrderCandidate
  cutoffAt: string | null | undefined
  linkedSourceTaskIds: Iterable<string>
}): boolean {
  const linked = new Set(
    [...input.linkedSourceTaskIds].filter((id) => Boolean(id?.trim()))
  )
  if (linked.has(input.task.id)) return false

  const cutoff = input.cutoffAt?.trim() ?? ""
  if (!cutoff) return true

  const effective = workOrderEffectiveAt(input.task)
  if (!effective) return false

  const effectiveTime = Date.parse(effective)
  const cutoffTime = Date.parse(cutoff)
  if (Number.isNaN(effectiveTime) || Number.isNaN(cutoffTime)) return false
  return effectiveTime >= cutoffTime
}
