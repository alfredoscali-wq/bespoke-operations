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
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NETWORK_DISCOVERY_JOB_POLL_MS } from "@/lib/network/discovery/job-poll"
import {
  NETWORK_DISCOVERY_TRANSPORT_OPTIONS,
  formatNetworkTimestamp,
  isNetworkDiscoveryTransport,
  networkDiscoveryTransportFromPayload,
  networkDiscoveryTransportLabel,
  networkDiscoveryTransportPayload,
  type NetworkDiscoveryTransport,
} from "@/lib/network/labels"
import {
  NETWORK_TARGET_CONNECTION_OK_MESSAGE,
  NETWORK_TARGET_CONNECTION_STATUS_LABELS,
} from "@/lib/network/targets/connection"
import type {
  NetworkAgent,
  NetworkDiscoveryTarget,
  NetworkSite,
} from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type TargetDialog = "view" | "edit" | "delete" | null

const TEST_POLL_ATTEMPTS = 20

export function NetworkDiscoveryTargetsPanel({
  targets,
  agents,
  sites,
  selectedTargetId,
  busy,
  onSelectTarget,
  onTargetsChanged,
}: {
  targets: NetworkDiscoveryTarget[]
  agents: NetworkAgent[]
  sites: NetworkSite[]
  selectedTargetId: string
  busy?: boolean
  onSelectTarget: (targetId: string) => void
  onTargetsChanged: (options?: { selectId?: string }) => void
}) {
  const [dialog, setDialog] = useState<TargetDialog>(null)
  const [active, setActive] = useState<NetworkDiscoveryTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [transport, setTransport] = useState<NetworkDiscoveryTransport>("api")
  const [agentId, setAgentId] = useState("")
  const [siteId, setSiteId] = useState("none")

  useEffect(() => {
    if (!active) return
    const next = targets.find((target) => target.id === active.id) ?? null
    if (next) setActive(next)
  }, [targets, active])

  function openDialog(next: TargetDialog, target: NetworkDiscoveryTarget) {
    onSelectTarget(target.id)
    setActive(target)
    setError(null)
    if (next === "edit") {
      setName(target.name)
      setHost(target.host)
      setUsername(target.username)
      setPassword("")
      setTransport(
        networkDiscoveryTransportFromPayload(target.protocol, target.port)
      )
      setAgentId(target.agentId)
      setSiteId(target.siteId ?? "none")
    }
    setDialog(next)
  }

  async function handleSave() {
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      const { protocol, port } = networkDiscoveryTransportPayload(transport)
      const response = await fetch(`/api/network/targets/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          host,
          username,
          password,
          protocol,
          port,
          vendor: "mikrotik",
          agentId,
          siteId: siteId === "none" ? null : siteId,
        }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      setPassword("")
      setDialog(null)
      setNotice(body.message ?? "Destino actualizado.")
      onTargetsChanged({ selectId: active.id })
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el destino."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/network/targets/${active.id}`, {
        method: "DELETE",
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      setDialog(null)
      setNotice(body.message ?? "Destino eliminado de Discovery.")
      onTargetsChanged()
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo eliminar el destino."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(target: NetworkDiscoveryTarget) {
    onSelectTarget(target.id)
    setTestingId(target.id)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/network/targets/${target.id}/test`, {
        method: "POST",
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      onTargetsChanged({ selectId: target.id })

      for (let attempt = 0; attempt < TEST_POLL_ATTEMPTS; attempt += 1) {
        await wait(NETWORK_DISCOVERY_JOB_POLL_MS)
        const statusResponse = await fetch(`/api/network/targets/${target.id}`)
        const statusBody = (await statusResponse.json()) as {
          success: boolean
          message?: string
          target?: NetworkDiscoveryTarget
        }
        if (!statusBody.success) throw new Error(statusBody.message)
        const next = statusBody.target
        if (!next || next.connectionStatus === "pending") continue
        onTargetsChanged({ selectId: target.id })
        if (next.connectionStatus === "ok") {
          setNotice(NETWORK_TARGET_CONNECTION_OK_MESSAGE)
        } else {
          setError(
            next.connectionMessage ??
              NETWORK_TARGET_CONNECTION_STATUS_LABELS[next.connectionStatus]
          )
        }
        return
      }
      setNotice(
        "La prueba sigue en curso. El resultado se actualizará cuando el Agent responda."
      )
      onTargetsChanged({ selectId: target.id })
    } catch (testError: unknown) {
      setError(
        testError instanceof Error
          ? testError.message
          : "No se pudo probar la conexión."
      )
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Destinos MikroTik autorizados</h2>
        <p className="text-sm text-muted-foreground">
          Destinos configurados para Discovery. La contraseña nunca se muestra.
        </p>
      </div>
      {notice ? <EntityActionFeedback message={notice} /> : null}
      {error && dialog == null ? (
        <EntityActionFeedback message={error} variant="error" />
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Host/IP</TableHead>
            <TableHead>Puerto</TableHead>
            <TableHead>Protocolo</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Sitio</TableHead>
            <TableHead>Conexión</TableHead>
            <TableHead>Último error</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">
                Todavía no hay destinos MikroTik autorizados.
              </TableCell>
            </TableRow>
          ) : (
            targets.map((target) => {
              const selected = target.id === selectedTargetId
              const connectionTone =
                target.connectionStatus === "ok"
                  ? "green"
                  : target.connectionStatus === "pending"
                    ? "blue"
                    : target.connectionStatus === "auth_error" ||
                        target.connectionStatus === "error"
                      ? "red"
                      : "gray"
              const lastError =
                target.connectionStatus === "auth_error" ||
                target.connectionStatus === "error"
                  ? target.connectionMessage
                  : null
              return (
                <TableRow
                  key={target.id}
                  className={selected ? "bg-muted/40" : undefined}
                >
                  <TableCell className="font-medium">{target.name}</TableCell>
                  <TableCell>{target.host}</TableCell>
                  <TableCell>{target.port}</TableCell>
                  <TableCell>
                    {networkDiscoveryTransportLabel(
                      target.protocol,
                      target.port
                    )}
                  </TableCell>
                  <TableCell>{dash(target.agentName)}</TableCell>
                  <TableCell>{dash(target.siteName)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      className={cn(STATUS_TONE_STYLES[connectionTone])}
                    >
                      {
                        NETWORK_TARGET_CONNECTION_STATUS_LABELS[
                          target.connectionStatus
                        ]
                      }
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {dash(lastError)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="xs"
                        variant={selected ? "secondary" : "outline"}
                        onClick={() => openDialog("view", target)}
                      >
                        Ver
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => openDialog("edit", target)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || testingId === target.id}
                        onClick={() => void handleTest(target)}
                      >
                        Probar conexión
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => openDialog("delete", target)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <Dialog
        open={dialog === "view"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Destino MikroTik</DialogTitle>
            <DialogDescription>
              Datos del destino autorizado. La contraseña no se muestra.
            </DialogDescription>
          </DialogHeader>
          {active ? <TargetReadOnlyDetails target={active} /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "edit"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar destino MikroTik</DialogTitle>
            <DialogDescription>
              Dejá la contraseña vacía para conservar la actual. Nunca se
              vuelve a mostrar.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <EntityActionFeedback message={error} variant="error" />
          ) : null}
          <div className="space-y-3">
            <Input
              placeholder="Nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="IP o hostname de gestión"
              value={host}
              onChange={(event) => setHost(event.target.value)}
            />
            <Input
              placeholder="Usuario"
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              placeholder="Nueva contraseña (opcional)"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Network Agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Sitio opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin sitio</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={transport}
              onValueChange={(value) => {
                if (isNetworkDiscoveryTransport(value)) setTransport(value)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NETWORK_DISCOVERY_TRANSPORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={
                saving ||
                !name.trim() ||
                !host.trim() ||
                !username.trim() ||
                !agentId
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este destino de Discovery?</DialogTitle>
            <DialogDescription>
              Se elimina el destino autorizado de Discovery. No se borran
              dispositivos descubiertos, historial, observaciones, topología,
              monitoreo ni alarmas.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <EntityActionFeedback message={error} variant="error" />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TargetReadOnlyDetails({ target }: { target: NetworkDiscoveryTarget }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
      <Detail label="Nombre" value={target.name} />
      <Detail label="Host/IP" value={target.host} />
      <Detail label="Puerto" value={String(target.port)} />
      <Detail
        label="Protocolo"
        value={networkDiscoveryTransportLabel(target.protocol, target.port)}
      />
      <Detail label="Usuario" value={target.username} />
      <Detail label="Agent" value={target.agentName} />
      <Detail label="Sitio" value={target.siteName} />
      <Detail
        label="Estado"
        value={NETWORK_TARGET_CONNECTION_STATUS_LABELS[target.connectionStatus]}
      />
      <Detail
        label="Actualizado"
        value={formatNetworkTimestamp(target.updatedAt)}
      />
      <Detail
        label="Último discovery"
        value={formatNetworkTimestamp(target.lastDiscoveryAt)}
      />
      <Detail
        label="Último error"
        value={
          target.connectionStatus === "auth_error" ||
          target.connectionStatus === "error"
            ? target.connectionMessage
            : null
        }
      />
    </dl>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{dash(value)}</dd>
    </>
  )
}

function dash(value: string | null | undefined): string {
  return value?.trim() || "—"
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
