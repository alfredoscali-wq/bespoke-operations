export function createMobileRequestId(): string {
  return crypto.randomUUID()
}
