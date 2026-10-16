import type { MikrotikHttpFetch } from "@/lib/integrations/mikrotik/types"

export const MOCK_MIKROTIK_USER = "bespoke-reader"
export const MOCK_MIKROTIK_PASSWORD = "lab-secret-not-for-browser"
export const MOCK_MIKROTIK_IDENTITY = "CORE-ABNET"
export const MOCK_MIKROTIK_VERSION = "7.16.2 (stable)"

function expectedAuth() {
  return (
    "Basic " +
    Buffer.from(MOCK_MIKROTIK_USER + ":" + MOCK_MIKROTIK_PASSWORD, "utf8").toString("base64")
  )
}

export function createMockMikrotikRestFetch(options?: {
  delayMs?: number
  unauthorized?: boolean
}): MikrotikHttpFetch {
  const delayMs = options?.delayMs ?? 0
  return async (input, init) => {
    if (delayMs > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs)
        const signal = init?.signal
        if (!signal) return
        const onAbort = () => {
          clearTimeout(timer)
          const error = new Error("The operation was aborted")
          error.name = "AbortError"
          reject(error)
        }
        if (signal.aborted) {
          onAbort()
          return
        }
        signal.addEventListener("abort", onAbort, { once: true })
      })
    }

    const headers = init?.headers
    const authorization =
      headers instanceof Headers
        ? headers.get("Authorization")
        : Array.isArray(headers)
          ? null
          : String((headers as Record<string, string> | undefined)?.Authorization ?? "")

    if (options?.unauthorized || authorization !== expectedAuth()) {
      return new Response("cannot log in", { status: 401 })
    }

    const url = String(input)
    if (url.includes("/rest/system/identity")) {
      return Response.json({ name: MOCK_MIKROTIK_IDENTITY })
    }
    if (url.includes("/rest/system/resource")) {
      return Response.json({
        version: MOCK_MIKROTIK_VERSION,
        uptime: "1w2d3h4m5s",
        "cpu-load": "3",
        "free-memory": 256 * 1024 * 1024,
        "total-memory": 512 * 1024 * 1024,
        "board-name": "RB5009UG+S+",
        "architecture-name": "arm64",
      })
    }
    if (url.includes("/rest/interface")) {
      return Response.json([
        { name: "ether1", running: "true", disabled: "false" },
        { name: "ether2", running: "false", disabled: "true" },
      ])
    }
    return new Response("not found", { status: 404 })
  }
}
