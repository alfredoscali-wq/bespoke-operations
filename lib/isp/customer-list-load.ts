export const ISP_CUSTOMER_LIST_EMPTY_MESSAGE =
  "No hay abonados para mostrar."

export const ISP_CUSTOMER_LIST_LOAD_ERROR =
  "No pudimos cargar los abonados. Intentá nuevamente."

export const ISP_CUSTOMER_LIST_SEARCH_DEBOUNCE_MS = 300

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    return String(error.name)
  }
  return ""
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message)
  }
  return ""
}

function errorCause(error: unknown): unknown {
  if (error && typeof error === "object" && "cause" in error) {
    return error.cause
  }
  return undefined
}

export function isIgnorableListLoadAbort(error: unknown): boolean {
  if (errorName(error) === "AbortError") return true
  if (/aborted/i.test(errorMessage(error))) return true
  const cause = errorCause(error)
  return Boolean(cause) && isIgnorableListLoadAbort(cause)
}

function isTechnicalFetchMessage(message: string): boolean {
  return /fetch failed|failed to fetch|networkerror|load failed/i.test(message)
}

export function isTechnicalFetchError(error: unknown): boolean {
  if (typeof error === "string") return isTechnicalFetchMessage(error)
  const message = errorMessage(error)
  if (isTechnicalFetchMessage(message)) return true
  if (errorName(error) === "TypeError" && /fetch/i.test(message)) {
    return true
  }
  const cause = errorCause(error)
  return Boolean(cause) && isTechnicalFetchError(cause)
}

export function customerListErrorMessage(error: unknown): string {
  if (isIgnorableListLoadAbort(error)) {
    return ISP_CUSTOMER_LIST_LOAD_ERROR
  }
  const message = errorMessage(error).trim()
  if (!message || isTechnicalFetchError(error) || isTechnicalFetchMessage(message)) {
    return ISP_CUSTOMER_LIST_LOAD_ERROR
  }
  return message
}

export function isTransientCustomerListError(error: unknown): boolean {
  return isTechnicalFetchError(error)
}
