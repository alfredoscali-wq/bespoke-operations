/**
 * Persistent guard for a new Latam TV signup.
 * The row is keyed by company and customers.id. Credentials stay out of this table.
 * A register-client call never releases the row by itself.
 * pending_sync with a null or unreported code stays pending and cannot be reserved again.
 * release is only for a stored code other than 1 or 3, after a complete catalog miss.
 */

export type LatamSignupAttemptState =
  | "register_sent"
  | "pending_sync"
  | "confirmed"
  | "rejected"

export type LatamSignupAttemptSnapshot = {
  state: LatamSignupAttemptState
  /** Ausente si la función instalada no informa el código guardado. */
  latamCode?: number | null
  /** id_iptv confirmado. Nunca es el code de register-client. */
  iptvId?: string | null
}

export type LatamSignupReservation = {
  granted: boolean
  state: LatamSignupAttemptState
  /** Ausente si la función instalada no informa el código guardado. */
  latamCode?: number | null
}

export type LatamSignupAttemptStore = {
  reserve: () => Promise<LatamSignupReservation>
  /** Estado persistido. Null cuando esta ficha no tiene reserva. */
  read: () => Promise<LatamSignupAttemptSnapshot | null>
  finish: (
    state: "pending_sync" | "confirmed",
    latamCode: number | null,
    iptvId?: string | null
  ) => Promise<"saved" | "saved_without_iptv" | "unavailable">
  /** Cierra pending_sync con un código distinto de 1 y 3. No inserta ni llama a register-client. */
  release: () => Promise<"released" | "blocked" | "unavailable">
  /** Guarda un id_iptv ya confirmado. No llama a register-client. */
  rememberIptv?: (iptvId: string) => Promise<"saved" | "conflict" | "unavailable">
}

/** Un id_iptv válido no es el code de la operación. */
export function latamIptvId(value: unknown, operationCode: number | null = null): string | null {
  const text =
    typeof value === "number" && Number.isInteger(value) && value > 0
      ? String(value)
      : typeof value === "string" && /^[1-9]\d*$/.test(value.trim())
        ? value.trim()
        : null
  if (!text) return null
  if (operationCode != null && text === String(operationCode)) return null
  return text
}

export function latamSignupPersistedView(
  attempt: { state: LatamSignupAttemptState; iptvId?: string | null } | null | undefined
): "signup" | "pending_sync" | "confirmed" {
  if (!attempt || attempt.state === "rejected") return "signup"
  if (attempt.state === "confirmed" && latamIptvId(attempt.iptvId)) return "confirmed"
  return "pending_sync"
}

export function latamSignupVisibleLabel(
  attempt: { state: LatamSignupAttemptState; iptvId?: string | null } | null | undefined
): string {
  const view = latamSignupPersistedView(attempt)
  if (view === "confirmed") return "Alta confirmada"
  if (view === "pending_sync") return "Alta enviada, pendiente de verificación"
  return "Alta en Latam pendiente de envío"
}

type SignupAttemptRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

const STATES = new Set<LatamSignupAttemptState>([
  "register_sent",
  "pending_sync",
  "confirmed",
  "rejected",
])

/** El alta no libera la reserva al interpretar un código. */
export function latamSignupRejectionReleasesAttempt(_code: number | null): boolean {
  return false
}

export type PendingLatamSignupAttempt = {
  customerId: string
  state: "pending_sync"
  latamCode: number | null
}

/** Fila del intento de esta empresa. No reescribe el intento. */
export function storedLatamSignupAttempt(row: Record<string, unknown>): {
  customerId: string
  state: LatamSignupAttemptState
  latamCode: number | null
  iptvId: string | null
} | null {
  const state = asState(row.state)
  const customerId = typeof row.customer_id === "string" ? row.customer_id.trim() : ""
  if (!state || !customerId) return null
  const latamCode = storedLatamCode(row.latam_code)
  return {
    customerId,
    state,
    latamCode,
    iptvId: latamIptvId(row.id_iptv, latamCode),
  }
}

/** Una fila pending_sync, incluso con latam_code null. No libera ni reescribe el intento. */
export function pendingLatamSignupAttempt(
  row: Record<string, unknown>
): PendingLatamSignupAttempt | null {
  if (row.state !== "pending_sync") return null
  const customerId = typeof row.customer_id === "string" ? row.customer_id.trim() : ""
  if (!customerId) return null
  return {
    customerId,
    state: "pending_sync",
    latamCode: storedLatamCode(row.latam_code),
  }
}

function storedLatamCode(value: unknown): number | null {
  if (value == null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

function asState(value: unknown): LatamSignupAttemptState | null {
  return typeof value === "string" && STATES.has(value as LatamSignupAttemptState)
    ? (value as LatamSignupAttemptState)
    : null
}

function asLatamCode(record: Record<string, unknown> | null): number | null | undefined {
  if (!record || !Object.prototype.hasOwnProperty.call(record, "latam_code")) return undefined
  const value = record.latam_code
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
  }
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** La firma de tres argumentos no acepta p_id_iptv. */
function legacyFinishSignature(message: string | undefined): boolean {
  const text = message?.toLowerCase() ?? ""
  return (
    text.includes("p_id_iptv") ||
    text.includes("schema cache") ||
    text.includes("could not find the function") ||
    text.includes("does not exist")
  )
}

export function createLatamSignupAttemptStore(
  supabase: SignupAttemptRpc,
  customerId: string
): LatamSignupAttemptStore {
  return {
    async reserve() {
      const { data, error } = await supabase.rpc("reserve_latam_tv_signup_attempt", {
        p_customer_id: customerId,
      })
      if (error) throw new Error("latam_signup_attempt_unavailable")
      const record = asRecord(data)
      const state = asState(record?.state)
      if (!state) throw new Error("latam_signup_attempt_unavailable")
      return { granted: record?.granted === true, state, latamCode: asLatamCode(record) }
    },
    async read() {
      const { data, error } = await supabase.rpc("read_latam_tv_signup_attempt", {
        p_customer_id: customerId,
      })
      if (error) throw new Error("latam_signup_attempt_unavailable")
      const record = asRecord(data)
      const state = asState(record?.state)
      if (!state) return null
      const latamCode = asLatamCode(record)
      return {
        state,
        latamCode,
        iptvId: latamIptvId(record?.id_iptv, latamCode ?? null),
      }
    },
    async finish(state, latamCode, iptvId = null) {
      const storedIptv = latamIptvId(iptvId, latamCode)
      try {
        const next = await supabase.rpc("finish_latam_tv_signup_attempt", {
          p_customer_id: customerId,
          p_state: state,
          p_latam_code: latamCode,
          p_id_iptv: storedIptv,
        })
        if (!next.error) {
          const record = asRecord(next.data)
          return record?.saved === true ? "saved" : "unavailable"
        }
        if (!legacyFinishSignature(next.error.message)) return "unavailable"
      } catch {
        return "unavailable"
      }
      // La función instalada todavía tiene tres argumentos. No confirma un id_iptv
      // que esa firma no puede guardar, y deja el intento pendiente para no repetir el alta.
      const fallbackState = storedIptv && state === "confirmed" ? "pending_sync" : state
      try {
        const legacy = await supabase.rpc("finish_latam_tv_signup_attempt", {
          p_customer_id: customerId,
          p_state: fallbackState,
          p_latam_code: latamCode,
        })
        if (legacy.error) return "unavailable"
        const record = asRecord(legacy.data)
        if (record?.saved !== true) return "unavailable"
        return storedIptv && state === "confirmed" ? "saved_without_iptv" : "saved"
      } catch {
        return "unavailable"
      }
    },
    async release() {
      try {
        const { data, error } = await supabase.rpc("release_latam_tv_signup_attempt", {
          p_customer_id: customerId,
        })
        if (error) return "unavailable"
        const record = asRecord(data)
        return record?.released === true ? "released" : "blocked"
      } catch {
        return "unavailable"
      }
    },
    async rememberIptv(iptvId) {
      const stored = latamIptvId(iptvId)
      if (!stored) return "unavailable"
      try {
        const { data, error } = await supabase.rpc("remember_latam_tv_signup_iptv", {
          p_customer_id: customerId,
          p_id_iptv: stored,
        })
        if (error) return "unavailable"
        const record = asRecord(data)
        if (record?.conflict === true) return "conflict"
        return record?.saved === true ? "saved" : "unavailable"
      } catch {
        return "unavailable"
      }
    },
  }
}
