"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AbnetTvPadronRow } from "@/lib/subscriptions/abnet-tv-padron"

type LatamPhase =
  | "idle"
  | "loading"
  | "no_bespoke"
  | "unavailable"
  | "unregistered"
  | "active"
  | "suspended"
  | "missing"
  | "confirm"
  | "created"
  | "exists"

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
  return null
}

function registeredPhase(status: unknown): "active" | "suspended" | "unavailable" {
  if (status === "disabled") return "suspended"
  if (status === "enabled") return "active"
  return "unavailable"
}

export function LatamTvRowDialog({
  row,
  canWrite,
  onClose,
  onStatus,
}: {
  row: AbnetTvPadronRow | null
  canWrite: boolean
  onClose: () => void
  onStatus: (customerId: string, label: string) => void
}) {
  const [phase, setPhase] = useState<LatamPhase>("idle")
  const [missing, setMissing] = useState<string[]>([])
  const [preview, setPreview] = useState<LatamPreview | null>(null)
  const [created, setCreated] = useState<LatamCreated | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    setMissing([])
    setPreview(null)
    setCreated(null)
    setActionError(null)
    setPending(false)
    busy.current = false
    if (!row) {
      setPhase("idle")
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
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean
          found?: boolean
          client?: { status?: string | null }
        } | null
        if (cancelled) return
        if (!response.ok || !payload?.success) {
          setPhase("unavailable")
          onStatus(customerId, "LATAM: No disponible")
          return
        }
        if (!payload.found) {
          setPhase("unregistered")
          onStatus(customerId, "LATAM: No registrado")
          return
        }
        const next = registeredPhase(payload.client?.status)
        setPhase(next)
        onStatus(
          customerId,
          next === "active"
            ? "LATAM: Activo"
            : next === "suspended"
              ? "LATAM: Suspendido"
              : "LATAM: No disponible"
        )
      })
      .catch(() => {
        if (cancelled) return
        setPhase("unavailable")
        onStatus(customerId, "LATAM: No disponible")
      })
    return () => {
      cancelled = true
    }
  }, [row, onStatus])

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
        setCreated({
          customerName: row.customerName,
          identifier: payload.identifier,
          username: payload.username,
          initialPassword: payload.initialPassword ?? "",
          planLabel: payload.planLabel ?? "",
        })
        setPhase("created")
        onStatus(row.bespokeCustomerId, "LATAM: Activo")
        return
      }
      if (payload?.outcome === "already_exists") {
        const next = registeredPhase(payload.status)
        setActionError(payload.message ?? "El cliente ya existe en LATAM TV.")
        if (next === "suspended") {
          setPhase("suspended")
          onStatus(row.bespokeCustomerId, "LATAM: Suspendido")
        } else if (next === "active") {
          setPhase("active")
          onStatus(row.bespokeCustomerId, "LATAM: Activo")
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

  const label = statusLabel(phase)
  const exists =
    phase === "active" || phase === "suspended" || phase === "created" || phase === "exists"
  const showAlta = phase === "unregistered" || phase === "missing"

  return (
    <Dialog open={row != null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {phase === "confirm" ? "Dar de alta en LATAM TV" : "LATAM TV"}
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
            {label ? <p className="font-medium">{label}</p> : null}
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
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {actionError ? <p className="text-destructive">{actionError}</p> : null}
            {phase === "confirm" || phase === "loading" || phase === "no_bespoke" ? null : (
              <div className="flex flex-wrap gap-2">
                {showAlta ? (
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
                ) : null}
                {exists || showAlta ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      title="Pendiente de implementación"
                      aria-label="Cambiar clave"
                    >
                      Cambiar clave
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      title="Pendiente de implementación"
                      aria-label={phase === "suspended" ? "Activar" : "Suspender"}
                    >
                      {phase === "suspended" ? "Activar" : "Suspender"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      title="Pendiente de implementación"
                      aria-label="Cambiar plan LATAM"
                    >
                      Cambiar plan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      title="Pendiente de implementación"
                      aria-label="Eliminar de LATAM"
                    >
                      Eliminar
                    </Button>
                  </>
                ) : null}
              </div>
            )}
            {showAlta && !canWrite ? (
              <p className="text-muted-foreground">
                No tiene permiso para dar de alta en LATAM TV.
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          {phase === "confirm" ? (
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
