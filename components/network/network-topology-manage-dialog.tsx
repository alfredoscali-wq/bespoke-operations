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
import {
  getNetworkManagementProfile,
  networkManagementVendorLabel,
  resolveNetworkManagementVendor,
} from "@/lib/network/management/vendor"
import type { NetworkAgent, NetworkAgentJob } from "@/lib/network/types"
import type { LocalTopologyObservedDevice } from "@/lib/network/topology/types"

async function waitForTopologyManagementJob(jobId: string) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch("/api/network/topology")
    const body = (await response.json()) as {
      success?: boolean
      discoveryJobs?: Array<{
        id: string
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
  onOpenChange,
  onStarted,
}: {
  open: boolean
  device: LocalTopologyObservedDevice | null
  agentId: string | null
  onOpenChange: (open: boolean) => void
  onStarted: (job: NetworkAgentJob) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ManageDialogBody
          key={device?.id ?? "none"}
          device={device}
          agentId={agentId}
          onOpenChange={onOpenChange}
          onStarted={onStarted}
        />
      ) : null}
    </Dialog>
  )
}

function ManageDialogBody({
  device,
  agentId,
  onOpenChange,
  onStarted,
}: {
  device: LocalTopologyObservedDevice | null
  agentId: string | null
  onOpenChange: (open: boolean) => void
  onStarted: (job: NetworkAgentJob) => void
}) {
  const vendor = resolveNetworkManagementVendor({
    manufacturer: device?.platform,
    platform: device?.platform,
    board: device?.board,
  })
  const profile = getNetworkManagementProfile(vendor)
  const options = profile?.accessOptions ?? []
  const [accessId, setAccessId] = useState(options[0]?.id ?? "")
  const [port, setPort] = useState(String(options[0]?.port ?? 8728))
  const [selectedAgentId, setSelectedAgentId] = useState(agentId ?? "")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [agents, setAgents] = useState<NetworkAgent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState<"test" | "discover" | null>(null)
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

  function changeAccess(nextId: string) {
    setAccessId(nextId)
    const next = options.find((option) => option.id === nextId)
    if (next) setPort(String(next.port))
  }

  const canSubmit =
    profile?.implemented === true &&
    access != null &&
    selectedAgentId.trim() !== "" &&
    username.trim() !== "" &&
    password.trim() !== "" &&
    busy == null

  async function submit(intent: "test" | "discover") {
    if (!device || !access) return
    setBusy(intent)
    setError(null)
    setSuccess(null)
    try {
      const parsedPort = Number(port)
      const response = await fetch(`/api/network/devices/${device.id}/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          agentId: selectedAgentId,
          protocol: access.protocol,
          port: Number.isInteger(parsedPort) ? parsedPort : access.port,
          username,
          password,
        }),
      })
      const body = (await response.json()) as {
        success?: boolean
        message?: string
        job?: NetworkAgentJob
      }
      if (!body.success || !body.job) {
        throw new Error(body.message ?? "No se pudo administrar el dispositivo.")
      }
      setPassword("")
      onStarted(body.job)
      if (intent === "discover") {
        onOpenChange(false)
        return
      }
      await waitForTopologyManagementJob(body.job.id)
      setSuccess("Conexión correcta.")
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo administrar el dispositivo."
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          Administrar {device?.hostname || device?.managementIp || "dispositivo"}
        </DialogTitle>
        <DialogDescription>
          Las credenciales se guardan cifradas. El Agent ejecuta la conexión.
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
              onChange={(event) => setPort(event.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Agente</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3"
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
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
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Contraseña</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={!canSubmit}
          onClick={() => void submit("test")}
        >
          {busy === "test" ? "Probando…" : "Probar conexión"}
        </Button>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit("discover")}
        >
          {busy === "discover" ? "Administrando…" : "Administrar y descubrir"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
