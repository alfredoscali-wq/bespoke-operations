/**
 * TEMP: diagnostic instrumentation for removeEmployee 401 investigation.
 * Remove after root cause is identified.
 */
import { createBrowserClient } from "@supabase/ssr"

import { assertSupabaseEnv } from "@/lib/supabase/env"
import type { SupabaseEmployeesClient } from "@/lib/supabase/employees.queries"

const DIAG_PREFIX = "[RRHH DIAG]"

function serializeUnknown(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return {
      name: record.name,
      message: record.message,
      code: record.code,
      details: record.details,
      hint: record.hint,
      status: record.status,
      statusCode: record.statusCode,
    }
  }

  return value
}

function headersToObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  return { ...headers }
}

function redactHeaders(headers: Record<string, string>) {
  const output: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const normalized = key.toLowerCase()

    if (normalized === "apikey" || normalized === "authorization") {
      output[key] = value
        ? `${value.slice(0, 24)}... (len=${value.length})`
        : "(empty)"
      continue
    }

    output[key] = value
  }

  return output
}

function tryParseJson(text: string) {
  if (!text) return text

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function diagnosticFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  const method = init?.method ?? "GET"
  const isEmployeePatch =
    method === "PATCH" && url.includes("/rest/v1/employees")

  if (!isEmployeePatch) {
    return fetch(input, init)
  }

  const requestHeaders = headersToObject(init?.headers)

  console.log(`${DIAG_PREFIX} HTTP request`, {
    url,
    method,
    headers: redactHeaders(requestHeaders),
    hasAuthorizationHeader: Boolean(
      requestHeaders.Authorization ?? requestHeaders.authorization
    ),
    hasApiKeyHeader: Boolean(requestHeaders.apikey ?? requestHeaders.Apikey),
    payload: tryParseJson(String(init?.body ?? "")),
  })

  const response = await fetch(input, init)
  const responseHeaders = headersToObject(response.headers)
  const bodyText = await response.clone().text()

  console.log(`${DIAG_PREFIX} HTTP response`, {
    url,
    method,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: tryParseJson(bodyText),
  })

  return response
}

export function buildEmployeeSoftDeleteRequestUrl(id: string) {
  const { url } = assertSupabaseEnv()
  const base = url.replace(/\/$/, "")
  return `${base}/rest/v1/employees?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`
}

export function createDiagnosticEmployeesClient(): SupabaseEmployeesClient {
  const { url, anonKey } = assertSupabaseEnv()
  const client = createBrowserClient(url, anonKey, {
    global: {
      fetch: diagnosticFetch,
    },
  })

  console.log(`${DIAG_PREFIX} createBrowserEmployeesClient()`, {
    supabaseUrl: url,
    anonKeyPrefix: anonKey.slice(0, 24),
    anonKeyLength: anonKey.length,
    usesDiagnosticFetch: true,
    client,
  })

  return client
}

export async function logEmployeeDeleteClientDiagnostics(
  client: SupabaseEmployeesClient,
  employeeId: string,
  label = "createBrowserEmployeesClient()"
) {
  const { url, anonKey } = assertSupabaseEnv()
  const { data, error } = await client.auth.getSession()
  const session = data.session
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = session?.expires_at ?? null

  console.log(`${DIAG_PREFIX} ${label}`, {
    employeeId,
    supabaseUrl: url,
    anonKeyPrefix: anonKey.slice(0, 24),
    anonKeyLength: anonKey.length,
    client,
    auth: {
      hasActiveSession: Boolean(session),
      getSessionError: error ? serializeUnknown(error) : null,
      userId: session?.user?.id ?? null,
      expiresAt,
      expiresAtIso: expiresAt
        ? new Date(expiresAt * 1000).toISOString()
        : null,
      isExpired: expiresAt ? expiresAt <= now : null,
      tokenType: session?.token_type ?? null,
      accessTokenLength: session?.access_token?.length ?? 0,
      accessTokenPrefix: session?.access_token
        ? `${session.access_token.slice(0, 24)}...`
        : null,
    },
  })
}

export function logEmployeeSoftDeleteAttempt(input: {
  employeeId: string
  payload: { deleted_at: string }
  requestUrl: string
}) {
  console.log(`${DIAG_PREFIX} softDeleteEmployee attempt`, input)
}

export function logEmployeeSoftDeleteResult(input: {
  employeeId: string
  data: unknown
  error: unknown
}) {
  if (input.error) {
    console.error(`${DIAG_PREFIX} softDeleteEmployee supabase error`, {
      employeeId: input.employeeId,
      error: serializeUnknown(input.error),
      errorRaw: input.error,
    })
    return
  }

  console.log(`${DIAG_PREFIX} softDeleteEmployee success`, {
    employeeId: input.employeeId,
    data: input.data,
  })
}

export function logRemoveEmployeeStart(employeeId: string) {
  console.group(`${DIAG_PREFIX} removeEmployee()`)
  console.log("employeeId", employeeId)
}

export function logRemoveEmployeeEnd(result: unknown) {
  console.log("removeEmployee result", result)
  console.groupEnd()
}

export function logDeleteEmployeeStart(employeeId: string) {
  console.group(`${DIAG_PREFIX} deleteEmployee()`)
  console.log("employeeId", employeeId)
}

export function logDeleteEmployeeEnd(result: unknown) {
  console.log("deleteEmployee result", result)
  console.groupEnd()
}
