"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NETWORK_DISCOVERY_JOB_POLL_MS } from "@/lib/network/discovery/job-poll"
import { isNetworkTargetDecryptError } from "@/lib/network/management/errors"
import {
  getNetworkManagementProfile,
  networkManagementVendorLabel,
  resolveNetworkManagementVendor,
} from "@/lib/network/management/vendor"
import type { NetworkAgent, NetworkAgentJob } from "@/lib/network/types"
import { postNetworkDeviceManage } from "@/lib/network/topology/manage-request"
import type { LocalTopologyObservedDevice } from "@/lib/network/topology/types"

async function waitForTopologyManagementJob(jobId: string) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch("/api/network/topology")
    const body = (await response.json()) as {
      success?: boolean
      discoveryJobs?: Array<{
        id: string
        jobType?: string
        status: string
        errorMessage: string | null
      }>
    }
    const job = body.discoveryJobs?.find((item) => item.id === jobId) ?? null
    if (job?.status === "completed") return job
    if (job?.status === "failed" || job?.status === "cancelled") {
      throw new Error(
        job.errorMessage?.trim() || "No fue posible conectar con el dispositivo."
      )
    }
    await new Promise((resolve) =>
      setTimeout(resolve, NETWORK_DISCOVERY_JOB_POLL_MS)
    )
  }
  throw new Error("El Agent no está disponible.")
}

export function NetworkTopologyManageDialog({
  open,
  device,
  agentId,
  mode,
  onOpenChange,
  onStarted,
  onReplaced,
}: {
  open: boolean
  device: LocalTopologyObservedDevice | null
  agentId: string | null
  mode: "administer" | "replace"
  onOpenChange: (open: boolean) => void
  onStarted: (job: NetworkAgentJob) => void
  onReplaced: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ManageDialogBody
          key={`${device?.id ?? "none"}-${mode}`}
          device={device}
          agentId={agentId}
          mode={mode}
          onOpenChange={onOpenChange}
          onStarted={onStarted}
          onReplaced={onReplaced}
        />
      ) : null}
    </Dialog>
  )
}

function ManageDialogBody({
  device,
  agentId,
  mode,
  onOpenChange,
  onStarted,
  onReplaced,
}: {
  device: LocalTopologyObservedDevice | null
  agentId: string | null
  mode: "administer" | "replace"
  onOpenChange: (open: boolean) => void
  onStarted: (job: NetworkAgentJob) => void
  onReplaced: () => void
}) {
  const vendor = resolveNetworkManagementVendor({
    manufacturer: device?.platform,
    platform: device?.platform,
    board: device?.board,
  })
  const profile = getNetworkManagementProfile(vendor)
  const options = profile?.accessOptions ?? []
  const lockAgent = Boolean(device?.managed || mode === "replace")
  const [accessId, setAccessId] = useState(options[0]?.id ?? "")
  const [port, setPort] = useState(String(options[0]?.port ?? 8728))
  const [selectedAgentId, setSelectedAgentId] = useState(agentId ?? "")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [agents, setAgents] = useState<NetworkAgent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connection, setConnection] = useState<"untested" | "verified" | "failed">(
    "untested"
  )
  const [credentialUnavailable, setCredentialUnavailable] = useState(false)
  const [busy, setBusy] = useState<"test" | "discover" | "replace" | null>(null)
  const access = options.find((option) => option.id === accessId) ?? options[0] ?? null

  useEffect(() => {
    let cancelled = false
    void fetch("/api/network/agents")
      .then((response) => response.json())
      .then((body: { success?: boolean; agents?: NetworkAgent[] }) => {
        if (!cancelled) setAgents(body.agents ?? [])
      })
      .catch(() => {
        if (!cancelled) setAgents([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function resetConnection() {
    setConnection("untested")
    setCredentialUnavailable(false)
    setError(null)
  }

  function changeAccess(nextId: string) {
    setAccessId(nextId)
    const next = options.find((option) => option.id === nextId)
    if (next) setPort(String(next.port))
    resetConnection()
  }

  const canSubmitCredentials =
    profile?.implemented === true &&
    access != null &&
    selectedAgentId.trim() !== "" &&
    username.trim() !== "" &&
    password.trim() !== "" &&
    busy == null

  const canTest = canSubmitCredentials
  const canReplace = mode === "replace" && canSubmitCredentials
  const canDiscover =
    mode === "administer" &&
    profile?.implemented === true &&
    access != null &&
    connection === "verified" &&
    busy == null

  async function submit(intent: "test" | "discover" | "replace") {
    if (!device || !access) return
    if (intent === "discover" && connection !== "verified") return
    setBusy(intent)
    setError(null)
    setCredentialUnavailable(false)
    try {
      const parsedPort = Number(port)
      const result = await postNetworkDeviceManage({
        deviceId: device.id,
        intent,
        agentId: selectedAgentId,
        protocol: access.protocol,
        port: Number.isInteger(parsedPort) ? parsedPort : access.port,
        username,
        password: intent === "discover" ? "" : password,
      })
      if (intent === "replace") {
        setPassword("")
        onReplaced()
        onOpenChange(false)
        return
      }
      if (!result.job) {
        throw new Error("No se pudo administrar el dispositivo.")
      }
      if (intent === "discover") {
        onStarted(result.job)
        onOpenChange(false)
        return
      }
      if (result.job.jobType === "discovery") {
        throw new Error("La prueba de conexión no debe lanzar discovery.")
      }
      await waitForTopologyManagementJob(result.job.id)
      setPassword("")
      setConnection("verified")
      onStarted(result.job)
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "No se pudo administrar el dispositivo."
      if (intent === "test" && isNetworkTargetDecryptError(message)) {
        setCredentialUnavailable(true)
        setConnection("untested")
      } else if (intent === "test") {
        setConnection("failed")
      }
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {mode === "replace" ? "Reemplazar credenciales" : "Administrar"}{" "}
          {device?.hostname || device?.managementIp || "dispositivo"}
        </DialogTitle>
        <DialogDescription>
          {mode === "replace"
            ? "Se actualiza el secret cifrado del destino existente. No se crea un target duplicado."
            : "Las credenciales se guardan cifradas. El Agent ejecuta la conexión."}
        </DialogDescription>
      </DialogHeader>

      {!profile?.implemented ? (
        <p className="text-sm text-muted-foreground">
          {vendor
            ? `El conector ${networkManagementVendorLabel(vendor)} todavía no está implementado.`
            : "No hay suficiente información de fabricante para administrar este dispositivo."}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Fabricante</p>
            <p className="font-medium">
              {device?.platform || networkManagementVendorLabel(vendor)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Modelo</p>
            <p className="font-medium">{device?.board || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Host</p>
            <p className="font-medium">{device?.managementIp || "—"}</p>
          </div>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Protocolo</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3"
              value={access?.id ?? ""}
              onChange={(event) => changeAccess(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Puerto</span>
            <Input
              value={port}
              onChange={(event) => {
                setPort(event.target.value)
                resetConnection()
              }}
              inputMode="numeric"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Agente</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 disabled:opacity-70"
              value={selectedAgentId}
              disabled={lockAgent}
              onChange={(event) => {
                setSelectedAgentId(event.target.value)
                resetConnection()
              }}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Usuario</span>
            <Input
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                resetConnection()
              }}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Contraseña</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (connection !== "untested" || credentialUnavailable) {
                  resetConnection()
                }
              }}
              autoComplete="new-password"
            />
          </label>
          {credentialUnavailable ? (
            <div className="space-y-1 text-destructive">
              <p className="font-medium">🔴 Credencial no disponible</p>
              {error ? <p>{error}</p> : null}
            </div>
          ) : null}
          {connection === "untested" && !credentialUnavailable ? (
            <p className="text-muted-foreground">⚪ Sin probar</p>
          ) : null}
          {connection === "verified" ? (
            <div className="space-y-1 rounded-md border bg-emerald-50 px-3 py-2 text-emerald-800">
              <p className="font-medium">🟢 Conexión verificada</p>
              <p>
                {device?.platform || networkManagementVendorLabel(vendor)}{" "}
                {device?.board ?? ""}
              </p>
              <p>
                {access?.label} · {port}
              </p>
            </div>
          ) : null}
          {connection === "failed" ? (
            <div className="space-y-1 text-destructive">
              <p className="font-medium">🔴 No se pudo conectar</p>
              {error ? <p>{error}</p> : null}
            </div>
          ) : error && !credentialUnavailable ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
        {mode === "replace" ? (
          <Button
            type="button"
            disabled={!canReplace}
            onClick={() => void submit("replace")}
          >
            {busy === "replace" ? "Guardando…" : "Reemplazar credenciales"}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!canTest}
              onClick={() => void submit("test")}
            >
              {busy === "test" ? "Probando…" : "Probar conexión"}
            </Button>
            <Button
              type="button"
              disabled={!canDiscover}
              onClick={() => void submit("discover")}
            >
              {busy === "discover" ? "Administrando…" : "Administrar y descubrir"}
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  )
}
