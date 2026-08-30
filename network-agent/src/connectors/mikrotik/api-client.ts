import net from "node:net"

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

export function bindRouterOsApiSocket(
  socket: RouterOsSocketLike,
  options?: {
    timeoutMs?: number
    decode?: RouterOsDecodeFn
  }
): {
  waitUntilConnected(): Promise<void>
  talk(words: string[]): Promise<RouterOsSentence[]>
  close(): void
} {
  const timeoutMs = options?.timeoutMs ?? 12_000
  const decode = options?.decode ?? decodeSentences
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
    "connect",
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

export async function connectRouterOsApi(input: {
  host: string
  port: number
  username: string
  password: string
  timeoutMs?: number
}): Promise<RouterOsClient> {
  const socket = net.connect({ host: input.host, port: input.port })
  const session = bindRouterOsApiSocket(socket as unknown as RouterOsSocketLike, {
    timeoutMs: input.timeoutMs,
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
