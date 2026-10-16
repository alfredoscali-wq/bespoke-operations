/**
 * Persistent guard for a new Latam TV signup.
 * The row is keyed by company and customers.id. Credentials stay out of this table.
 * A register-client call never releases the row by itself.
 * release closes pending_sync only when the stored code is not 1 or 3.
 * The caller must already have a complete catalog with no match.
 */

export type LatamSignupAttemptState =
  | "register_sent"
  | "pending_sync"
  | "confirmed"
  | "rejected"

export type LatamSignupReservation = {
  granted: boolean
  state: LatamSignupAttemptState
}

export type LatamSignupAttemptStore = {
  reserve: () => Promise<LatamSignupReservation>
  /** Estado persistido. Null cuando esta ficha no tiene reserva. */
  read: () => Promise<LatamSignupAttemptState | null>
  finish: (
    state: "pending_sync" | "confirmed",
    latamCode: number | null
  ) => Promise<"saved" | "unavailable">
  /** Cierra pending_sync salvo código 1 o 3. No inserta ni llama a register-client. */
  release: () => Promise<"released" | "blocked" | "unavailable">
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

function asState(value: unknown): LatamSignupAttemptState | null {
  return typeof value === "string" && STATES.has(value as LatamSignupAttemptState)
    ? (value as LatamSignupAttemptState)
    : null
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
      return { granted: record?.granted === true, state }
    },
    async read() {
      const { data, error } = await supabase.rpc("read_latam_tv_signup_attempt", {
        p_customer_id: customerId,
      })
      if (error) throw new Error("latam_signup_attempt_unavailable")
      return asState(asRecord(data)?.state)
    },
    async finish(state, latamCode) {
      try {
        const { data, error } = await supabase.rpc("finish_latam_tv_signup_attempt", {
          p_customer_id: customerId,
          p_state: state,
          p_latam_code: latamCode,
        })
        if (error) return "unavailable"
        const record = asRecord(data)
        return record?.saved === true ? "saved" : "unavailable"
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
  }
}
