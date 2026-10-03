import fs from "node:fs"
import net from "node:net"
import tls from "node:tls"

import { ConnectorError } from "../types"
import {
  decodeSentences,
  encodeSentence,
  type RouterOsSentence,
} from "./protocol"

export type RouterOsClient = {
  talk(words: string[]): Promise<RouterOsSentence[]>
  close(): void
}

export type RouterOsDecodeFn = typeof decodeSentences

export type RouterOsSocketLike = {
  on(event: string, listener: (...args: unknown[]) => void): unknown
  once(event: string, listener: (...args: unknown[]) => void): unknown
  off(event: string, listener: (...args: unknown[]) => void): unknown
  write(data: Uint8Array): unknown
  destroy(): void
  setTimeout(timeout: number): unknown
}

type PendingTalk = {
  resolve: (sentences: RouterOsSentence[]) => void
  reject: (error: Error) => void
  collected: RouterOsSentence[]
  settled: boolean
}

const activeRouterOsSockets = new Set<RouterOsSocketLike>()

export function destroyActiveRouterOsSockets() {
  for (const socket of [...activeRouterOsSockets]) {
    try {
      socket.destroy()
    } catch {
      // The socket may already be gone; keep tearing down the rest.
    }
  }
  activeRouterOsSockets.clear()
}

function toConnectorError(error: unknown, fallback: string): ConnectorError {
  if (error instanceof ConnectorError) return error
  const message = error instanceof Error && error.message.trim() ? error.message : fallback
  return new ConnectorError(message)
}

export function isRouterOsApiTlsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env.NETWORK_ROUTEROS_TLS?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

/**
 * RouterOS API transport is selected by protocol+port, not by the process-wide
 * NETWORK_ROUTEROS_TLS flag.
 *
 * - protocol=api + 8728 → plaintext (`net.connect`)
 * - protocol=api + 8729 → API-SSL (`tls.connect` + NETWORK_ROUTEROS_CA_FILE)
 * - protocol=rest → never this API client
 * - any other API port → NETWORK_ROUTEROS_TLS fallback (kept for tests / odd ports)
 */
export function resolveRouterOsApiTls(input: {
  protocol?: string | null
  port: number
  env?: NodeJS.ProcessEnv
}): boolean {
  const protocol = (input.protocol ?? "api").trim().toLowerCase() || "api"
  const port = Number(input.port)
  if (protocol === "rest") return false
  if (protocol === "api" && port === 8728) return false
  if (protocol === "api" && port === 8729) return true
  return isRouterOsApiTlsEnabled(input.env)
}

export function readRouterOsApiCaFile(
  env: NodeJS.ProcessEnv = process.env
): Buffer {
  const file = env.NETWORK_ROUTEROS_CA_FILE?.trim()
  if (!file) {
    throw new ConnectorError(
      "NETWORK_ROUTEROS_CA_FILE es obligatorio cuando la conexión API usa TLS."
    )
  }

  try {
    return fs.readFileSync(file)
  } catch {
    throw new ConnectorError(
      "No se pudo leer NETWORK_ROUTEROS_CA_FILE para validar TLS de RouterOS API."
    )
  }
}

export type RouterOsApiConnectFns = {
  connectPlain?: typeof net.connect
  connectTls?: typeof tls.connect
}

export function bindRouterOsApiSocket(
  socket: RouterOsSocketLike,
  options?: {
    timeoutMs?: number
    decode?: RouterOsDecodeFn
    readyEvent?: "connect" | "secureConnect"
  }
): {
  waitUntilConnected(): Promise<void>
  talk(words: string[]): Promise<RouterOsSentence[]>
  close(): void
} {
  const timeoutMs = options?.timeoutMs ?? 12_000
  const decode = options?.decode ?? decodeSentences
  const readyEvent = options?.readyEvent ?? "connect"
  socket.setTimeout(timeoutMs)

  let buffer: Buffer = Buffer.from([])
  const pending: PendingTalk[] = []
  let sessionFailed: Error | null = null
  let connected = false
  let connectResolve: (() => void) | null = null
  let connectReject: ((error: Error) => void) | null = null
  let connectSettled = false

  activeRouterOsSockets.add(socket)

  function settleConnectReject(error: Error) {
    if (connectSettled) return
    connectSettled = true
    connectReject?.(error)
    connectResolve = null
    connectReject = null
  }

  function settleConnectResolve() {
    if (connectSettled) return
    connectSettled = true
    connected = true
    connectResolve?.()
    connectResolve = null
    connectReject = null
  }

  function settleTalk(item: PendingTalk, action: () => void) {
    if (item.settled) return
    item.settled = true
    action()
  }

  function fail(error: Error) {
    if (sessionFailed) return
    sessionFailed = toConnectorError(error, "La conexión API con MikroTik falló.")
    settleConnectReject(sessionFailed)
    while (pending.length > 0) {
      const item = pending.shift()
      if (!item) continue
      settleTalk(item, () => item.reject(sessionFailed as Error))
    }
    try {
      socket.destroy()
    } catch {
      // Destroy must never throw out of an EventEmitter handler.
    }
  }

  function safeHandle(handler: (...args: unknown[]) => void) {
    return (...args: unknown[]) => {
      try {
        handler(...args)
      } catch (error) {
        fail(toConnectorError(error, "Error interno en la sesión API MikroTik."))
      }
    }
  }

  socket.on(
    "data",
    safeHandle((chunk) => {
      if (sessionFailed) return
      const data = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk instanceof Uint8Array ? chunk : [])
      buffer = Buffer.concat([buffer, data]) as Buffer
      const decoded = decode(buffer)
      buffer = decoded.rest
      const current = pending[0]
      if (!current) return
      current.collected.push(...decoded.sentences)
      const done = current.collected.some(
        (item) => item.type === "!done" || item.type === "!trap" || item.type === "!fatal"
      )
      if (!done) return
      pending.shift()
      settleTalk(current, () => current.resolve(current.collected))
    })
  )

  socket.on(
    "timeout",
    safeHandle(() => {
      fail(new ConnectorError("Timeout al hablar con MikroTik (API)."))
    })
  )

  socket.on(
    "error",
    safeHandle((error) => {
      const message = error instanceof Error ? error.message : "error de socket"
      fail(new ConnectorError(`No se pudo conectar al MikroTik por API: ${message}`))
    })
  )

  socket.on(
    "close",
    safeHandle(() => {
      activeRouterOsSockets.delete(socket)
      fail(new ConnectorError("La conexión API con MikroTik se cerró."))
    })
  )

  socket.once(
    readyEvent,
    safeHandle(() => {
      if (sessionFailed) return
      settleConnectResolve()
    })
  )

  async function waitUntilConnected(): Promise<void> {
    if (sessionFailed) throw sessionFailed
    if (connected) return
    await new Promise<void>((resolve, reject) => {
      if (sessionFailed) {
        reject(sessionFailed)
        return
      }
      if (connected) {
        resolve()
        return
      }
      connectResolve = resolve
      connectReject = reject
    })
  }

  async function talk(words: string[]): Promise<RouterOsSentence[]> {
    if (sessionFailed) throw sessionFailed
    const sentences = await new Promise<RouterOsSentence[]>((resolve, reject) => {
      if (sessionFailed) {
        reject(sessionFailed)
        return
      }
      const item: PendingTalk = {
        resolve,
        reject,
        collected: [],
        settled: false,
      }
      pending.push(item)
      try {
        socket.write(encodeSentence(words))
      } catch (error) {
        fail(toConnectorError(error, "No se pudo enviar el comando API a MikroTik."))
      }
    })
    const trap = sentences.find((item) => item.type === "!trap" || item.type === "!fatal")
    if (trap) {
      throw new ConnectorError(
        trap.attributes.message || "MikroTik devolvió un error de API."
      )
    }
    return sentences
  }

  function close() {
    fail(new ConnectorError("La conexión API con MikroTik se cerró."))
  }

  return { waitUntilConnected, talk, close }
}

export async function connectRouterOsApi(
  input: {
    host: string
    port: number
    protocol?: string | null
    username: string
    password: string
    timeoutMs?: number
  },
  connectFns: RouterOsApiConnectFns = {}
): Promise<RouterOsClient> {
  const tlsEnabled = resolveRouterOsApiTls({
    protocol: input.protocol,
    port: input.port,
    env: process.env,
  })
  console.info("[network-agent] RouterOS API connecting", {
    host: input.host,
    port: input.port,
    protocol: input.protocol ?? "api",
    tls: tlsEnabled,
  })

  let socket: RouterOsSocketLike
  let readyEvent: "connect" | "secureConnect" = "connect"

  if (tlsEnabled) {
    const ca = readRouterOsApiCaFile()
    const connectTls = connectFns.connectTls ?? tls.connect.bind(tls)
    const tlsOptions: tls.ConnectionOptions = {
      host: input.host,
      port: input.port,
      ca,
      rejectUnauthorized: true,
    }
    // SNI must be a DNS name. IP identity is verified via `host` + SAN IP.
    if (net.isIP(input.host) === 0) {
      tlsOptions.servername = input.host
    }
    socket = connectTls(tlsOptions) as unknown as RouterOsSocketLike
    readyEvent = "secureConnect"
  } else {
    const connectPlain = connectFns.connectPlain ?? net.connect.bind(net)
    socket = connectPlain({
      host: input.host,
      port: input.port,
    }) as unknown as RouterOsSocketLike
  }

  const session = bindRouterOsApiSocket(socket, {
    timeoutMs: input.timeoutMs,
    readyEvent,
  })
  try {
    await session.waitUntilConnected()
    await session.talk(["/login", `=name=${input.username}`, `=password=${input.password}`])
    return {
      talk: session.talk,
      close: session.close,
    }
  } catch (error) {
    session.close()
    throw toConnectorError(error, "No se pudo conectar al MikroTik por API.")
  }
}

export async function printRecords(
  client: RouterOsClient,
  command: string
): Promise<Record<string, string>[]> {
  const sentences = await client.talk([command])
  return sentences
    .filter((item) => item.type === "!re")
    .map((item) => item.attributes)
}
