import https from "node:https"
import http from "node:http"

import { ConnectorError } from "../types"

function requestJson(input: {
  protocol: "http" | "https"
  host: string
  port: number
  path: string
  username: string
  password: string
  timeoutMs: number
}): Promise<unknown> {
  const auth = Buffer.from(`${input.username}:${input.password}`).toString("base64")
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  }

  return new Promise((resolve, reject) => {
    const handleResponse = (res: http.IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8")
        if ((res.statusCode ?? 500) === 401) {
          reject(new ConnectorError("Credenciales MikroTik rechazadas (REST)."))
          return
        }
        if ((res.statusCode ?? 500) >= 400) {
          reject(
            new ConnectorError(
              `MikroTik REST ${res.statusCode}: ${body.slice(0, 180)}`
            )
          )
          return
        }
        if (!body.trim()) {
          resolve(null)
          return
        }
        try {
          resolve(JSON.parse(body) as unknown)
        } catch {
          reject(new ConnectorError("MikroTik REST devolvió JSON inválido."))
        }
      })
    }

    const req =
      input.protocol === "https"
        ? https.request(
            {
              host: input.host,
              port: input.port,
              path: input.path,
              method: "GET",
              rejectUnauthorized: false,
              timeout: input.timeoutMs,
              headers,
            },
            handleResponse
          )
        : http.request(
            {
              host: input.host,
              port: input.port,
              path: input.path,
              method: "GET",
              timeout: input.timeoutMs,
              headers,
            },
            handleResponse
          )

    req.on("timeout", () => {
      req.destroy()
      reject(new ConnectorError("Timeout al hablar con MikroTik (REST)."))
    })
    req.on("error", (error) => {
      reject(
        new ConnectorError(
          `No se pudo conectar al MikroTik por REST: ${error.message}`
        )
      )
    })
    req.end()
  })
}

function asRecords(value: unknown): Record<string, string>[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => {
        const record: Record<string, string> = {}
        for (const [key, nested] of Object.entries(item)) {
          if (nested == null) continue
          record[key] = String(nested)
        }
        return record
      })
  }
  if (value && typeof value === "object") {
    const record: Record<string, string> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested == null) continue
      record[key] = String(nested)
    }
    return [record]
  }
  return []
}

export async function fetchRouterOsRest(input: {
  host: string
  port: number
  username: string
  password: string
  timeoutMs?: number
}): Promise<{
  identity: Record<string, string>
  resource: Record<string, string>
  routerboard: Record<string, string>
  interfaces: Record<string, string>[]
  addresses: Record<string, string>[]
  neighbors: Record<string, string>[]
}> {
  const timeoutMs = input.timeoutMs ?? 12_000
  const protocol = input.port === 80 ? "http" : "https"
  const get = async (path: string) =>
    requestJson({
      protocol,
      host: input.host,
      port: input.port,
      path,
      username: input.username,
      password: input.password,
      timeoutMs,
    })

  const [identity, resource, routerboard, interfaces, addresses, neighbors] =
    await Promise.all([
      get("/rest/system/identity"),
      get("/rest/system/resource"),
      get("/rest/system/routerboard").catch(() => null),
      get("/rest/interface"),
      get("/rest/ip/address"),
      get("/rest/ip/neighbor").catch(() => []),
    ])

  return {
    identity: asRecords(identity)[0] ?? {},
    resource: asRecords(resource)[0] ?? {},
    routerboard: asRecords(routerboard)[0] ?? {},
    interfaces: asRecords(interfaces),
    addresses: asRecords(addresses),
    neighbors: asRecords(neighbors),
  }
}

export async function fetchRouterOsMonitoring(input: {
  host: string
  port: number
  username: string
  password: string
  timeoutMs?: number
}): Promise<{
  identity: Record<string, string>
  resource: Record<string, string>
  health: Record<string, string>[]
  interfaces: Record<string, string>[]
}> {
  const timeoutMs = input.timeoutMs ?? 12_000
  const protocol = input.port === 80 ? "http" : "https"
  const get = async (path: string) =>
    requestJson({
      protocol,
      host: input.host,
      port: input.port,
      path,
      username: input.username,
      password: input.password,
      timeoutMs,
    })

  const [identity, resource, health, interfaces] = await Promise.all([
    get("/rest/system/identity"),
    get("/rest/system/resource"),
    get("/rest/system/health").catch(() => []),
    get("/rest/interface"),
  ])

  return {
    identity: asRecords(identity)[0] ?? {},
    resource: asRecords(resource)[0] ?? {},
    health: asRecords(health),
    interfaces: asRecords(interfaces),
  }
}
