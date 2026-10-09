"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  latamLookupUiState,
  type LatamLookupUiPhase,
} from "@/lib/integrations/latam-tv/lookup-state"
import { latamPlanNameKey } from "@/lib/integrations/latam-tv/plans"
import { validateLatamTvPassword } from "@/lib/integrations/latam-tv/password"
import type { AbnetTvPadronRow } from "@/lib/subscriptions/abnet-tv-padron"

type LatamPhase =
  | "idle"
  | "loading"
  | "no_bespoke"
  | "unavailable"
  | "unregistered"
  | "partial"
  | "ambiguous"
  | "active"
  | "suspended"
  | "missing"
  | "confirm"
  | "created"
  | "exists"
  | "password"
  | "password_confirm"
  | "password_done"
  | "status_confirm"
  | "plan_loading"
  | "plan_select"
  | "plan_confirm"
  | "plan_done"

type LatamPlanOption = {
  kind: "basica" | "pack" | "full"
  label: string
  latamName: string
  available: boolean
}

type AccountPhase = "active" | "suspended"

type LatamPreview = {
  customerName: string
  identifier: string
  username: string
  initialPassword: string
  planLabel: string
}

type LatamCreated = LatamPreview

function statusLabel(phase: LatamPhase): string | null {
  if (phase === "active" || phase === "created") return "LATAM: Activo"
  if (phase === "suspended") return "LATAM: Suspendido"
  if (phase === "unregistered" || phase === "missing" || phase === "confirm") {
    return "LATAM: No registrado"
  }
  if (phase === "unavailable") return "LATAM: No disponible"
  if (phase === "partial") return "LATAM: Requiere revisión"
  if (phase === "ambiguous") return "LATAM: Coincidencia ambigua"
  return null
}

export function latamPresenceLabel(
  phase: "active" | "suspended" | "unavailable" | "created",
  planName: string | null
): string {
  const state =
    phase === "suspended"
      ? "LATAM: Suspendido"
      : phase === "unavailable"
        ? "LATAM: No disponible"
        : "LATAM: Activo"
  return planName ? `${state} · Plan: ${planName}` : state
}

function registeredPhase(status: unknown): "active" | "suspended" | "unavailable" {
  if (status === "disabled") return "suspended"
  if (status === "enabled") return "active"
  return "unavailable"
}

export type LatamDialogIntent =
  | "view"
  | "password"
  | "suspend"
  | "activate"
  | "plan"
  | "signup"

export type LatamRowPresence = {
  phase: LatamLookupUiPhase
  label: string
  planName: string | null
  identifier: string | null
  iptvId?: string | null
  username: string | null
}

export function latamRowIsOperational(presence: LatamRowPresence | undefined): boolean {
  return (
    (presence?.phase === "active" || presence?.phase === "suspended") &&
    Boolean(presence.identifier)
  )
}

export function LatamTvRowDialog({
  row,
  intent = "view",
  known,
  canWrite,
  onClose,
  onStatus,
  onPadronPlan,
}: {
  row: AbnetTvPadronRow | null
  intent?: LatamDialogIntent
  /** Resultado de la consulta agrupada. null: todavía no llegó. undefined: la fila no tiene N° Cliente. */
  known?: LatamRowPresence | null
  canWrite: boolean
  onClose: () => void
  onStatus: (customerId: string, presence: LatamRowPresence) => void
  onPadronPlan: (
    row: AbnetTvPadronRow,
    kind: "basica" | "pack" | "full"
  ) => Promise<string | null>
}) {
  const [phase, setPhase] = useState<LatamPhase>("idle")
  const [missing, setMissing] = useState<string[]>([])
  const [preview, setPreview] = useState<LatamPreview | null>(null)
  const [created, setCreated] = useState<LatamCreated | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [accountPhase, setAccountPhase] = useState<AccountPhase | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [statusAction, setStatusAction] = useState<"disable" | "enable" | null>(null)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [latamPlanName, setLatamPlanName] = useState<string | null>(null)
  const [latamIdentifier, setLatamIdentifier] = useState<string | null>(null)
  const [identityNote, setIdentityNote] = useState<string | null>(null)
  const [planOptions, setPlanOptions] = useState<LatamPlanOption[]>([])
  const [selectedPlan, setSelectedPlan] = useState<LatamPlanOption | null>(null)
  const [successPlanName, setSuccessPlanName] = useState<string | null>(null)
  const busy = useRef(false)
  const planDoneRef = useRef(false)
  const planChangeRef = useRef<() => void>(() => {})
  const signupRef = useRef<() => void>(() => {})
  const knownKey =
    known === undefined
      ? "none"
      : known === null
        ? "pending"
        : `${known.phase}|${known.identifier ?? ""}|${known.planName ?? ""}|${known.username ?? ""}`

  useEffect(() => {
    if (planDoneRef.current && row && intent === "plan") {
      setPhase("plan_done")
      return
    }
    if (!row) planDoneRef.current = false
    setMissing([])
    setPreview(null)
    setCreated(null)
    setActionError(null)
    setPending(false)
    setUsername(null)
    setAccountPhase(null)
    setPassword("")
    setConfirmPassword("")
    setStatusAction(null)
    setStatusNotice(null)
    setLatamPlanName(null)
    setLatamIdentifier(null)
    setIdentityNote(null)
    setPlanOptions([])
    setSelectedPlan(null)
    setSuccessPlanName(null)
    busy.current = false
    if (!row) {
      setPhase("idle")
      return
    }
    if (known === null) {
      setPhase("loading")
      return
    }
    if (known) {
      const presence = known
      setUsername(presence.username)
      setLatamPlanName(presence.planName)
      setLatamIdentifier(presence.identifier)
      if (presence.phase === "active" || presence.phase === "suspended") {
        setAccountPhase(presence.phase)
      }
      const linked = Boolean(presence.identifier)
      const operational =
        linked && (presence.phase === "active" || presence.phase === "suspended")
      if (row.bespokeCustomerId) onStatus(row.bespokeCustomerId, presence)
      if (intent === "password" && operational) {
        setPhase("password")
      } else if (intent === "suspend" && presence.phase === "active" && linked) {
        setStatusAction("disable")
        setPhase("status_confirm")
      } else if (intent === "activate" && presence.phase === "suspended" && linked) {
        setStatusAction("enable")
        setPhase("status_confirm")
      } else if (intent === "plan" && operational) {
        planChangeRef.current()
      } else if (intent === "signup" && presence.phase === "unregistered" && row.bespokeCustomerId) {
        signupRef.current()
      } else if (
        presence.phase === "active" ||
        presence.phase === "suspended" ||
        presence.phase === "unregistered" ||
        presence.phase === "unavailable" ||
        presence.phase === "partial" ||
        presence.phase === "ambiguous"
      ) {
        setPhase(presence.phase)
      } else {
        setPhase("unavailable")
      }
      return
    }
    if (!row.bespokeCustomerId) {
      setPhase("no_bespoke")
      return
    }

    const customerId = row.bespokeCustomerId
    let cancelled = false
    setPhase("loading")
    void fetch(`/api/integrations/latam-tv/customers/${customerId}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        const view = latamLookupUiState(response.ok, payload)
        setUsername(view.username)
        setLatamPlanName(view.planName)
        setLatamIdentifier(view.identifier)
        setIdentityNote(view.detail)
        if (view.phase === "active" || view.phase === "suspended") {
          setAccountPhase(view.phase)
        }
        const linked = Boolean(view.identifier)
        const operational =
          linked && (view.phase === "active" || view.phase === "suspended")
        onStatus(customerId, {
          phase: view.phase,
          label:
            view.phase === "active" || view.phase === "suspended"
              ? latamPresenceLabel(view.phase, view.planName)
              : view.label,
          planName: view.planName,
          identifier: view.identifier,
          username: view.username,
        })
        if (intent === "password" && operational) {
          setPhase("password")
        } else if (intent === "suspend" && view.phase === "active" && linked) {
          setStatusAction("disable")
          setPhase("status_confirm")
        } else if (intent === "activate" && view.phase === "suspended" && linked) {
          setStatusAction("enable")
          setPhase("status_confirm")
        } else if (intent === "plan" && operational) {
          planChangeRef.current()
        } else if (intent === "signup" && view.phase === "unregistered") {
          signupRef.current()
        } else {
          setPhase(view.phase)
        }
      })
      .catch(() => {
        if (cancelled) return
        setPhase("unavailable")
        onStatus(customerId, {
          phase: "unavailable",
          label: "LATAM: No disponible",
          planName: null,
          identifier: null,
          username: null,
        })
      })
    return () => {
      cancelled = true
    }
  }, [row, intent, onStatus, knownKey])

  async function postSignup(confirm: boolean) {
    if (!row?.bespokeCustomerId || busy.current) return
    busy.current = true
    setPending(true)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/integrations/latam-tv/customers/${row.bespokeCustomerId}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm, tvKind: row.tvKind }),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        outcome?: string
        missing?: string[]
        message?: string
        preview?: LatamPreview
        username?: string
        initialPassword?: string
        identifier?: string
        planLabel?: string
        status?: string | null
        iptvId?: string | null
      } | null
      if (payload?.outcome === "missing") {
        setMissing(payload.missing ?? [])
        setPhase("missing")
        return
      }
      if (payload?.outcome === "preview" && payload.preview) {
        setPreview(payload.preview)
        setPhase("confirm")
        return
      }
      if (payload?.outcome === "created" && payload.username && payload.identifier) {
        const next = registeredPhase(payload.status)
        if (next === "unavailable") {
          setActionError("LATAM no confirmó el alta. Las acciones siguen deshabilitadas.")
          setPhase("unregistered")
          return
        }
        setCreated({
          customerName: row.customerName,
          identifier: payload.identifier,
          username: payload.username,
          initialPassword: payload.initialPassword ?? "",
          planLabel: payload.planLabel ?? "",
        })
        setUsername(payload.username)
        setAccountPhase(next)
        setPhase("created")
        onStatus(row.bespokeCustomerId, {
          phase: next,
          label: latamPresenceLabel(next, payload.planLabel ?? null),
          planName: payload.planLabel ?? null,
          identifier: payload.identifier,
          iptvId: payload.iptvId ?? null,
          username: payload.username,
        })
        return
      }
      if (payload?.outcome === "unverified") {
        setActionError(payload.message ?? "LATAM no confirmó el alta. Las acciones siguen deshabilitadas.")
        setPhase("unregistered")
        return
      }
      if (payload?.outcome === "already_exists") {
        const next = registeredPhase(payload.status)
        setActionError(payload.message ?? "El cliente ya existe en LATAM TV.")
        if (next === "suspended") {
          setAccountPhase("suspended")
          setPhase("suspended")
          onStatus(row.bespokeCustomerId, {
            phase: "suspended",
            label: "LATAM: Suspendido",
            planName: latamPlanName,
            identifier: latamIdentifier,
            username,
          })
        } else if (next === "active") {
          setAccountPhase("active")
          setPhase("active")
          onStatus(row.bespokeCustomerId, {
            phase: "active",
            label: "LATAM: Activo",
            planName: latamPlanName,
            identifier: latamIdentifier,
            username,
          })
        } else {
          setPhase("exists")
        }
        return
      }
      setActionError(payload?.message ?? "LATAM: No disponible")
      if (!response.ok && phase === "loading") setPhase("unavailable")
    } catch {
      setActionError("LATAM: No disponible")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  function cancelPassword() {
    setPassword("")
    setConfirmPassword("")
    setActionError(null)
    setPhase(accountPhase ?? "active")
  }

  function reviewPassword() {
    if (busy.current) return
    if (password !== confirmPassword) {
      setActionError("Las contraseñas no coinciden.")
      return
    }
    const invalid = validateLatamTvPassword(password)
    if (invalid) {
      setActionError(invalid)
      return
    }
    setActionError(null)
    setPhase("password_confirm")
  }

  async function submitPassword() {
    if (!row?.bespokeCustomerId || busy.current) return
    if (password !== confirmPassword) {
      setActionError("Las contraseñas no coinciden.")
      setPhase("password")
      return
    }
    const invalid = validateLatamTvPassword(password)
    if (invalid) {
      setActionError(invalid)
      setPhase("password")
      return
    }
    busy.current = true
    setPending(true)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/integrations/latam-tv/customers/${row.bespokeCustomerId}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, confirmPassword }),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        outcome?: string
        message?: string
      } | null
      if (payload?.outcome === "changed") {
        setPassword("")
        setConfirmPassword("")
        setPhase("password_done")
        return
      }
      setActionError(
        payload?.message ??
          "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."
      )
      setPhase("password")
    } catch {
      setActionError(
        "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."
      )
      setPhase("password")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  function applyConfirmedStatus(status: "enabled" | "disabled", planName = latamPlanName) {
    if (!row?.bespokeCustomerId) return
    const next = status === "disabled" ? "suspended" : "active"
    setAccountPhase(next)
    setPhase(next)
    if (planName !== latamPlanName) setLatamPlanName(planName)
    onStatus(row.bespokeCustomerId, {
      phase: next,
      label: latamPresenceLabel(next, planName),
      planName,
      identifier: latamIdentifier,
      username,
    })
  }

  async function submitStatus() {
    if (!row?.bespokeCustomerId || !statusAction || busy.current) return
    busy.current = true
    setPending(true)
    setActionError(null)
    const action = statusAction
    try {
      const response = await fetch(
        `/api/integrations/latam-tv/customers/${row.bespokeCustomerId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        outcome?: string
        status?: string | null
        message?: string | null
      } | null
      const confirmed =
        payload?.status === "enabled" || payload?.status === "disabled" ? payload.status : null
      if (payload?.outcome === "updated" && payload.message && confirmed) {
        applyConfirmedStatus(confirmed)
        setStatusNotice(
          confirmed === "disabled"
            ? "✅ Cliente suspendido correctamente en LATAM TV."
            : "✅ Cliente activado correctamente en LATAM TV."
        )
        setStatusAction(null)
        return
      }
      if (confirmed && (payload?.outcome === "updated" || payload?.outcome === "mismatch")) {
        applyConfirmedStatus(confirmed)
        setStatusAction(null)
        setStatusNotice(null)
      }
      setActionError(
        payload?.message ??
          "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."
      )
    } catch {
      setActionError(
        "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."
      )
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  async function openPlanChange() {
    if (!row?.bespokeCustomerId || busy.current) return
    busy.current = true
    setPending(true)
    setActionError(null)
    setStatusNotice(null)
    setSelectedPlan(null)
    setPhase("plan_loading")
    try {
      const response = await fetch(
        `/api/integrations/latam-tv/customers/${row.bespokeCustomerId}/plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview: true }),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        outcome?: string
        message?: string
        status?: string | null
        currentPlanName?: string | null
        options?: LatamPlanOption[]
      } | null
      if (payload?.outcome !== "preview" || !payload.options) {
        setActionError(payload?.message ?? "No fue posible consultar LATAM TV.")
        setPhase(accountPhase ?? "active")
        return
      }
      setLatamPlanName(payload.currentPlanName ?? null)
      setPlanOptions(payload.options)
      if (payload.status === "disabled") setAccountPhase("suspended")
      if (payload.status === "enabled") setAccountPhase("active")
      setPhase("plan_select")
    } catch {
      setActionError("No fue posible consultar LATAM TV.")
      setPhase(accountPhase ?? "active")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  planChangeRef.current = () => {
    void openPlanChange()
  }
  signupRef.current = () => {
    void postSignup(false)
  }

  function choosePlan(option: LatamPlanOption) {
    if (!option.available || busy.current) return
    if (
      latamPlanName &&
      latamPlanNameKey(latamPlanName) === latamPlanNameKey(option.latamName)
    ) {
      setActionError("El cliente ya tiene este plan en LATAM TV.")
      return
    }
    setActionError(null)
    setSelectedPlan(option)
    setPhase("plan_confirm")
  }

  async function submitPlan() {
    if (!row?.bespokeCustomerId || !selectedPlan || busy.current) return
    busy.current = true
    setPending(true)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/integrations/latam-tv/customers/${row.bespokeCustomerId}/plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tvKind: selectedPlan.kind }),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        outcome?: string
        status?: string | null
        planName?: string | null
        message?: string | null
      } | null
      const confirmed = payload?.status === "enabled" || payload?.status === "disabled" ? payload.status : null
      if (payload?.outcome === "same_plan") {
        setActionError(payload.message ?? "El cliente ya tiene este plan en LATAM TV.")
        setPhase("plan_select")
        return
      }
      if (payload?.outcome === "updated" && confirmed && selectedPlan) {
        const completedPlanName = payload.planName ?? selectedPlan.latamName
        const padronError = await onPadronPlan(row, selectedPlan.kind)
        applyConfirmedStatus(confirmed, payload.planName ?? null)
        setSelectedPlan(null)
        if (padronError) {
          setActionError(padronError)
          return
        }
        planDoneRef.current = true
        setSuccessPlanName(completedPlanName)
        setPhase("plan_done")
        return
      }
      if (confirmed) {
        applyConfirmedStatus(confirmed, payload?.planName ?? null)
      } else {
        setPhase(accountPhase ?? "active")
      }
      setSelectedPlan(null)
      setActionError(
        payload?.message ??
          "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."
      )
    } catch {
      setActionError(
        "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."
      )
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const label = statusLabel(phase)
  const passwordStep =
    phase === "password" || phase === "password_confirm" || phase === "password_done"
  const planStep = phase === "plan_loading" || phase === "plan_select" || phase === "plan_confirm"
  const showAlta = phase === "unregistered" || phase === "missing"

  return (
    <Dialog open={row != null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {phase === "confirm" || phase === "missing" || intent === "signup"
              ? "Alta LATAM"
              : passwordStep
                ? "Cambiar clave LATAM"
                : phase === "status_confirm" && statusAction === "disable"
                  ? "Suspender cliente en LATAM TV"
                  : phase === "status_confirm" && statusAction === "enable"
                    ? "Activar cliente en LATAM TV"
                    : phase === "plan_confirm"
                      ? "Cambiar plan"
                      : phase === "plan_done"
                        ? "Plan cambiado con éxito"
                        : "LATAM TV"}
          </DialogTitle>
          <DialogDescription>
            {row ? `${row.customerName} · N° ${row.abnetCustomerNumber}` : "LATAM TV"}
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-3 text-sm">
            {phase === "loading" ? <p>Consultando LATAM TV…</p> : null}
            {phase === "no_bespoke" ? (
              <p>Este registro no tiene ficha en Bespoke.</p>
            ) : null}
            {label && !passwordStep && phase !== "status_confirm" ? (
              <p className="font-medium">{label}</p>
            ) : null}
            {phase === "unavailable" ? <p>No fue posible consultar LATAM TV.</p> : null}
            {phase === "unregistered" ? <p>El cliente no existe en LATAM TV.</p> : null}
            {identityNote ? <p>{identityNote}</p> : null}
            {latamIdentifier && (phase === "active" || phase === "suspended") ? (
              <p>Identificador LATAM: {latamIdentifier}</p>
            ) : null}
            {statusNotice ? <p>{statusNotice}</p> : null}
            {latamPlanName && !planStep && !passwordStep && phase !== "status_confirm" && phase !== "plan_done" ? (
              <p>Plan: {latamPlanName}</p>
            ) : null}
            {phase === "plan_loading" ? <p>Consultando el plan en LATAM TV…</p> : null}
            {phase === "plan_select" ? (
              <div className="space-y-2">
                <p>Plan actual: {latamPlanName ?? "—"}</p>
                <p>Planes disponibles</p>
                {planOptions.map((option) =>
                  option.available ? (
                    <Button
                      key={option.kind}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => choosePlan(option)}
                    >
                      {option.label}
                    </Button>
                  ) : (
                    <p key={option.kind}>
                      {option.kind === "full"
                        ? "TV Full — No disponible actualmente en LATAM"
                        : `${option.label} — No disponible`}
                    </p>
                  )
                )}
              </div>
            ) : null}
            {phase === "plan_done" ? (
              <div className="space-y-1">
                <p>El plan de TV se actualizó correctamente en LATAM y Bespoke.</p>
                {successPlanName ? <p>Nuevo plan: {successPlanName}</p> : null}
              </div>
            ) : null}
            {phase === "plan_confirm" && selectedPlan ? (
              <div className="space-y-1">
                <p>Cliente: {row.customerName}</p>
                <p>Plan actual: {latamPlanName ?? "—"}</p>
                <p>Nuevo plan: {selectedPlan.latamName}</p>
                <p>El cambio se aplicará en LATAM y luego se actualizará el padrón de Bespoke.</p>
                <p>El estado del cliente no se modificará.</p>
                {accountPhase === "suspended" ? (
                  <p>El cliente continuará suspendido después del cambio.</p>
                ) : null}
                {pending ? <p>Cambiando el plan…</p> : null}
              </div>
            ) : null}
            {phase === "status_confirm" && row ? (
              <div className="space-y-2">
                <p>Cliente: {row.customerName}</p>
                <p>Usuario: {username ?? "—"}</p>
                {statusAction === "disable" ? (
                  <>
                    <p>El usuario quedará deshabilitado en LATAM TV.</p>
                    <p>Esta acción no elimina al cliente ni modifica su plan.</p>
                  </>
                ) : (
                  <>
                    <p>El usuario volverá a quedar habilitado en LATAM TV.</p>
                    <p>Su plan actual no será modificado.</p>
                  </>
                )}
                {pending ? (
                  <p>{statusAction === "disable" ? "Suspendiendo…" : "Activando…"}</p>
                ) : null}
              </div>
            ) : null}
            {phase === "password" || phase === "password_confirm" ? (
              <div className="space-y-2">
                <p>Cliente: {row.customerName}</p>
                <p>Usuario: {username ?? "—"}</p>
                {phase === "password" ? (
                  <>
                    <label className="block space-y-1">
                      <span>Nueva contraseña</span>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        disabled={pending}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span>Repetir contraseña</span>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        disabled={pending}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </label>
                  </>
                ) : (
                  <p>
                    Se cambiará la contraseña del usuario de LATAM TV. Esta acción modifica únicamente la contraseña de LATAM TV.
                  </p>
                )}
                {pending ? <p>Cambiando la contraseña…</p> : null}
              </div>
            ) : null}
            {phase === "password_done" ? (
              <p>✅ Contraseña modificada correctamente en LATAM TV.</p>
            ) : null}
            {phase === "confirm" && preview ? (
              <div className="space-y-1">
                <p>Cliente: {preview.customerName}</p>
                <p>Identificador: {preview.identifier}</p>
                <p>Usuario: {preview.username}</p>
                <p>Contraseña inicial: {preview.initialPassword}</p>
                <p>Plan: {preview.planLabel}</p>
                <p>
                  Se creará este usuario en LATAM TV utilizando el email como usuario y el DNI como contraseña inicial.
                </p>
              </div>
            ) : null}
            {phase === "created" && created ? (
              <div className="space-y-1">
                <p>Cliente dado de alta correctamente en LATAM TV.</p>
                <p>Usuario: {created.username}</p>
                <p>Contraseña inicial: {created.initialPassword}</p>
                <p>Identificador: {created.identifier}</p>
                <p>Plan: {created.planLabel}</p>
              </div>
            ) : null}
            {phase === "missing" ? (
              <div className="space-y-1">
                <p>No se puede dar de alta en LATAM TV. Faltan datos:</p>
                <ul className="list-disc pl-5">
                  {missing.map((item) => (
                    <li key={item}>
                      {item === "DNI"
                        ? "Falta DNI para dar de alta"
                        : item === "Email"
                          ? "Falta email para dar de alta"
                          : item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {actionError ? <p className="text-destructive">{actionError}</p> : null}
            {showAlta ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canWrite || pending || phase === "missing"}
                  onClick={() => {
                    if (!canWrite) return
                    void postSignup(false)
                  }}
                >
                  Alta LATAM
                </Button>
              </div>
            ) : null}
            {showAlta && !canWrite ? (
              <p className="text-muted-foreground">
                No tiene permiso para dar de alta en LATAM TV.
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          {phase === "plan_select" ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setPhase(accountPhase ?? "active")}
            >
              Cancelar
            </Button>
          ) : phase === "plan_done" ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          ) : phase === "plan_confirm" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setSelectedPlan(null)
                  setActionError(null)
                  setPhase("plan_select")
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  void submitPlan()
                }}
              >
                {pending ? "Cambiando el plan…" : "Cambiar plan"}
              </Button>
            </>
          ) : phase === "status_confirm" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setStatusAction(null)
                  setActionError(null)
                  setPhase(accountPhase ?? "active")
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  void submitStatus()
                }}
              >
                {pending
                  ? statusAction === "disable"
                    ? "Suspendiendo…"
                    : "Activando…"
                  : statusAction === "disable"
                    ? "Suspender"
                    : "Activar"}
              </Button>
            </>
          ) : phase === "password" ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={cancelPassword}>
                Cancelar
              </Button>
              <Button type="button" disabled={pending} onClick={reviewPassword}>
                Cambiar clave
              </Button>
            </>
          ) : phase === "password_confirm" ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={cancelPassword}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  void submitPassword()
                }}
              >
                {pending ? "Cambiando la contraseña…" : "Confirmar cambio"}
              </Button>
            </>
          ) : phase === "password_done" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPassword("")
                setConfirmPassword("")
                onClose()
              }}
            >
              Cerrar
            </Button>
          ) : phase === "confirm" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setPreview(null)
                  setPhase("unregistered")
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  void postSignup(true)
                }}
              >
                Dar de alta en LATAM
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
