/** Bloquea mutaciones en modo demostración y abre el diálogo amigable. */
export function blockDemoWrite(
  isReadOnly: boolean,
  openRestrictedDialog: () => void
): boolean {
  if (isReadOnly) {
    openRestrictedDialog()
    return true
  }

  return false
}

export const DEMO_WRITE_BLOCKED_TASK_RESULT = {
  success: false as const,
}

export const DEMO_WRITE_BLOCKED_MUTATION_RESULT = {
  success: false as const,
}

export class DemoWriteBlockedError extends Error {
  constructor() {
    super("DEMO_WRITE_BLOCKED")
    this.name = "DemoWriteBlockedError"
  }
}

export function throwIfDemoWriteBlocked(
  isReadOnly: boolean,
  openRestrictedDialog: () => void
): void {
  if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
    throw new DemoWriteBlockedError()
  }
}
