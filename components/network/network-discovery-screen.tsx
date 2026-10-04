"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"

import { NetworkSubnav } from "@/components/network/network-subnav"
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
import {
  NETWORK_DISCOVERY_JOB_POLL_MS,
  hasNetworkDiscoveryJobInflight,
  targetHasNetworkDiscoveryJobInflight,
} from "@/lib/network/discovery/job-poll"
import {
  formatObservedInterfaceLabel,
  networkObservationGroupLabel,
} from "@/lib/network/discovery/observations"
import {
  nextDiscoveryObservationState,
  type NetworkDiscoveryLatestObservationView,
} from "@/lib/network/discovery/latest-run"
import {
  NETWORK_DISCOVERY_TRANSPORT_OPTIONS,
  NETWORK_JOB_STATUS_LABELS,
  NETWORK_JOB_STATUS_TONES,
  formatNetworkLastSeen,
  isNetworkDiscoveryTransport,
  networkDiscoveryTransportPayload,
  type NetworkDiscoveryTransport,
} from "@/lib/network/labels"
import type {
  NetworkAgent,
  NetworkDiscoveryJobView,
  NetworkDiscoveryObservationItem,
  NetworkDiscoveryObservationView,
  NetworkDiscoveryTarget,
  NetworkSite,
} from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function NetworkDiscoveryScreen() {
  const [targets, setTargets] = useState<NetworkDiscoveryTarget[]>([])
  const [jobs, setJobs] = useState<NetworkDiscoveryJobView[]>([])
  const [latestObservations, setLatestObservations] =
    useState<NetworkDiscoveryLatestObservationView | null>(null)
  const [historicalObservations, setHistoricalObservations] =
    useState<NetworkDiscoveryObservationView | null>(null)
  const [agents, setAgents] = useState<NetworkAgent[]>([])
  const [sites, setSites] = useState<NetworkSite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [transport, setTransport] = useState<NetworkDiscoveryTransport>("api")
  const [agentId, setAgentId] = useState("")
  const [siteId, setSiteId] = useState("none")
  const [historicalOpen, setHistoricalOpen] = useState(false)

  const jobsRequestInFlight = useRef(false)
  const observationStateRef = useRef({
    latest: null as NetworkDiscoveryLatestObservationView | null,
    historical: null as NetworkDiscoveryObservationView | null,
  })

  const applyJobsBody = useCallback((jobsBody: {
    jobs?: NetworkDiscoveryJobView[]
    latestObservations?: NetworkDiscoveryLatestObservationView | null
    historicalObservations?: NetworkDiscoveryObservationView | null
  }) => {
    setJobs(jobsBody.jobs ?? [])
    const next = nextDiscoveryObservationState(observationStateRef.current, {
      latestObservations: jobsBody.latestObservations,
      historicalObservations: jobsBody.historicalObservations,
    })
    observationStateRef.current = next
    setLatestObservations(next.latest)
    setHistoricalObservations(next.historical)
  }, [])

  const refreshJobs = useCallback(async () => {
    if (jobsRequestInFlight.current) return
    jobsRequestInFlight.current = true
    try {
      const response = await fetch("/api/network/jobs")
      const jobsBody = (await response.json()) as {
        success: boolean
        message?: string
        jobs?: NetworkDiscoveryJobView[]
        latestObservations?: NetworkDiscoveryLatestObservationView | null
        historicalObservations?: NetworkDiscoveryObservationView | null
        observations?: NetworkDiscoveryObservationView | null
      }
      if (!jobsBody.success) throw new Error(jobsBody.message)
      applyJobsBody(jobsBody)
      setError(null)
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron actualizar los jobs."
      )
    } finally {
      jobsRequestInFlight.current = false
    }
  }, [applyJobsBody])

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/network/targets").then((response) => response.json()),
      fetch("/api/network/jobs").then((response) => response.json()),
      fetch("/api/network/agents").then((response) => response.json()),
      fetch("/api/network/sites").then((response) => response.json()),
    ])
      .then(([targetsBody, jobsBody, agentsBody, sitesBody]) => {
        if (!targetsBody.success) throw new Error(targetsBody.message)
        if (!jobsBody.success) throw new Error(jobsBody.message)
        setTargets(targetsBody.targets ?? [])
        applyJobsBody(jobsBody)
        setAgents(agentsBody.agents ?? [])
        setSites(sitesBody.sites ?? [])
        setError(null)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar Discovery."
        )
      })
  }, [applyJobsBody])

  useEffect(() => {
    load()
  }, [load])

  const shouldPollJobs = hasNetworkDiscoveryJobInflight(jobs)

  useEffect(() => {
    if (!shouldPollJobs) return undefined
    const timer = window.setInterval(() => {
      void refreshJobs()
    }, NETWORK_DISCOVERY_JOB_POLL_MS)
    return () => window.clearInterval(timer)
  }, [shouldPollJobs, refreshJobs])

  async function handleCreateTarget() {
    setSaving(true)
    try {
      const { protocol, port } = networkDiscoveryTransportPayload(transport)
      const response = await fetch("/api/network/targets", {
        method: "POST",
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
      const body = (await response.json()) as { success: boolean; message?: string }
      if (!body.success) throw new Error(body.message)
      setCreateOpen(false)
      setName("")
      setHost("")
      setUsername("")
      setPassword("")
      setTransport("api")
      load()
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el destino."
      )
    } finally {
      setSaving(false)
    }
  }

  async function runDiscovery(targetId: string) {
    setSaving(true)
    try {
      const response = await fetch("/api/network/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      })
      const body = (await response.json()) as { success: boolean; message?: string }
      if (!body.success) throw new Error(body.message)
      await refreshJobs()
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo crear el job de discovery."
      )
    } finally {
      setSaving(false)
    }
  }

  const latestDiscoveryLabel =
    latestObservations?.targetName?.trim() ||
    latestObservations?.targetHost?.trim() ||
    null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Discovery</h1>
          <p className="text-sm text-muted-foreground">
            Destinos MikroTik autorizados. Discovery observa lo que el Core
            ve; no convierte vecinos en infraestructura administrada.
            La contraseña no se vuelve a mostrar.
          </p>
          <NetworkSubnav current="discovery" />
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={agents.length === 0}>
          Configurar MikroTik
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Destino</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Sitio</TableHead>
            <TableHead>Protocolo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Configurá un MikroTik alcanzable desde un Agent.
              </TableCell>
            </TableRow>
          ) : (
            targets.map((target) => (
              <TableRow key={target.id}>
                <TableCell className="font-medium">{target.name}</TableCell>
                <TableCell>{target.host}:{target.port}</TableCell>
                <TableCell>{target.agentName || "—"}</TableCell>
                <TableCell>{target.siteName || "Sin sitio"}</TableCell>
                <TableCell>{target.protocol}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      saving ||
                      targetHasNetworkDiscoveryJobInflight(jobs, target.id)
                    }
                    onClick={() => void runDiscovery(target.id)}
                  >
                    Ejecutar discovery
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Jobs</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Todavía no hay jobs de discovery.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                  <TableCell>{job.agentName || "—"}</TableCell>
                  <TableCell>
                    {job.targetName || "—"}
                    {job.targetHost ? ` (${job.targetHost})` : ""}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      className={cn(
                        STATUS_TONE_STYLES[NETWORK_JOB_STATUS_TONES[job.status]]
                      )}
                    >
                      {NETWORK_JOB_STATUS_LABELS[job.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{formatNetworkLastSeen(job.createdAt)}</TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {job.errorMessage
                      ? job.errorMessage
                      : job.result
                        ? `${String(job.result.deviceCount ?? 0)} devices`
                        : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {latestObservations ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">
              Último discovery
              {latestDiscoveryLabel ? ` · ${latestDiscoveryLabel}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              Observaciones de la última corrida completada. No se convierten
              en Devices administrados.
            </p>
          </div>
          <p className="text-sm">
            <span className="font-medium">{latestObservations.total}</span>
            {" "}observados en esta corrida
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ObservationStat label="Core" value={latestObservations.core} />
            <ObservationStat label="WAN" value={latestObservations.wan} />
            <ObservationStat label="LAN/VLAN" value={latestObservations.lanVlan} />
            <ObservationStat label="Unknown" value={latestObservations.unknown} />
          </div>
          <ObservationTable
            items={latestObservations.items}
            emptyLabel="Todavía no hay observaciones de una corrida completada."
          />
        </div>
      ) : null}

      {historicalObservations ? (
        <div className="space-y-3 border-t pt-6">
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 text-left"
            onClick={() => setHistoricalOpen((open) => !open)}
            aria-expanded={historicalOpen}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Historial de observaciones</h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {historicalObservations.total}
                </span>
                {" "}observaciones acumuladas
              </p>
            </div>
            <ChevronRight
              className={cn(
                "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                historicalOpen && "rotate-90"
              )}
              aria-hidden
            />
          </button>
          {historicalOpen ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Inventario acumulado. No se borra si un neighbor deja de
                aparecer en el último discovery.
              </p>
              <ObservationTable
                items={historicalObservations.items}
                emptyLabel="Todavía no hay observaciones persistidas."
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>MikroTik alcanzable desde un Agent</DialogTitle>
            <DialogDescription>
              La contraseña se cifra en el servidor. Nunca se muestra de nuevo
              ni viaja en el payload persistido del job.
            </DialogDescription>
          </DialogHeader>
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
              placeholder="Contraseña"
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreateTarget()}
              disabled={
                saving || !name.trim() || !host.trim() || !username.trim() || !password || !agentId
              }
            >
              Guardar destino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ObservationTable({
  items,
  emptyLabel,
}: {
  items: NetworkDiscoveryObservationItem[]
  emptyLabel: string
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre / Identity</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>MAC</TableHead>
            <TableHead>Interfaz donde fue observado</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Board</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Discovered by</TableHead>
            <TableHead>Origin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => <ObservationRow key={item.id} item={item} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ObservationStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  )
}

function ObservationRow({ item }: { item: NetworkDiscoveryObservationItem }) {
  const group = networkObservationGroupLabel(item.scope)
  return (
    <TableRow>
      <TableCell className="font-medium">
        {dash(item.hostname)}
      </TableCell>
      <TableCell>{dash(item.managementIp)}</TableCell>
      <TableCell className="font-mono text-xs">{dash(item.macAddress)}</TableCell>
      <TableCell>
        {dash(
          formatObservedInterfaceLabel(
            item.observedInterfaceName,
            item.observedInterfaceDescription
          )
        )}
      </TableCell>
      <TableCell>
        <StatusBadge className={cn(STATUS_TONE_STYLES[observationTone(item.scope)])}>
          {group}
        </StatusBadge>
      </TableCell>
      <TableCell>{dash(item.platform)}</TableCell>
      <TableCell>{dash(item.board)}</TableCell>
      <TableCell>{dash(item.version)}</TableCell>
      <TableCell>{dash(item.discoveredBy)}</TableCell>
      <TableCell>{dash(item.origin)}</TableCell>
    </TableRow>
  )
}

function dash(value: string | null | undefined): string {
  return value?.trim() || "—"
}

function observationTone(
  scope: NetworkDiscoveryObservationItem["scope"]
): "blue" | "amber" | "green" | "gray" {
  if (scope === "core") return "blue"
  if (scope === "wan") return "amber"
  if (scope === "lan" || scope === "vlan") return "green"
  return "gray"
}
