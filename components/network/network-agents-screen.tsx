"use client"

import { useEffect, useState } from "react"

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
import { NETWORK_JOB_TYPES } from "@/lib/network/constants"
import {
  NETWORK_AGENT_STATUS_LABELS,
  NETWORK_AGENT_STATUS_TONES,
  NETWORK_JOB_TYPE_LABELS,
  formatNetworkLastSeen,
} from "@/lib/network/labels"
import type { NetworkAgent, NetworkAgentJob, NetworkSite } from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function NetworkAgentsScreen() {
  const [agents, setAgents] = useState<NetworkAgent[]>([])
  const [sites, setSites] = useState<NetworkSite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [siteId, setSiteId] = useState("")
  const [saving, setSaving] = useState(false)
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null)
  const [jobAgent, setJobAgent] = useState<NetworkAgent | null>(null)
  const [jobType, setJobType] = useState<(typeof NETWORK_JOB_TYPES)[number]>("monitoring")
  const [jobs, setJobs] = useState<NetworkAgentJob[]>([])

  function loadAgents() {
    fetch("/api/network/agents")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          agents?: NetworkAgent[]
          message?: string
        }
        if (!body.success) throw new Error(body.message)
        setAgents(body.agents ?? [])
        setError(null)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los agents."
        )
      })
  }

  useEffect(() => {
    loadAgents()
    fetch("/api/network/sites")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          sites?: NetworkSite[]
        }
        if (body.success) setSites(body.sites ?? [])
      })
      .catch(() => undefined)
  }, [])

  async function handleCreate() {
    setSaving(true)
    try {
      const response = await fetch("/api/network/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          siteId: siteId && siteId !== "none" ? siteId : null,
        }),
      })
      const body = (await response.json()) as {
        success: boolean
        enrollmentToken?: string
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      setEnrollmentToken(body.enrollmentToken ?? null)
      setName("")
      loadAgents()
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el agent."
      )
    } finally {
      setSaving(false)
    }
  }

  async function openJobs(agent: NetworkAgent) {
    setJobAgent(agent)
    const response = await fetch(`/api/network/agents/${agent.id}/jobs`)
    const body = (await response.json()) as {
      success: boolean
      jobs?: NetworkAgentJob[]
    }
    setJobs(body.jobs ?? [])
  }

  async function createJob() {
    if (!jobAgent) return
    setSaving(true)
    try {
      const response = await fetch(`/api/network/agents/${jobAgent.id}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      await openJobs(jobAgent)
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo crear el job."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Network Agents</h1>
          <p className="text-sm text-muted-foreground">
            Identidad de máquina. El tenant sale del credential, no del payload.
          </p>
          <NetworkSubnav current="agents" />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          Registrar agent
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Sitio</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Último heartbeat</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No hay agents registrados.
              </TableCell>
            </TableRow>
          ) : (
            agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell>{agent.siteName || "Sin sitio"}</TableCell>
                <TableCell>
                  <StatusBadge
                    className={cn(
                      STATUS_TONE_STYLES[NETWORK_AGENT_STATUS_TONES[agent.status]]
                    )}
                  >
                    {NETWORK_AGENT_STATUS_LABELS[agent.status]}
                  </StatusBadge>
                </TableCell>
                <TableCell>{formatNetworkLastSeen(agent.lastSeenAt)}</TableCell>
                <TableCell>{agent.version || "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void openJobs(agent)}
                  >
                    Jobs
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next)
          if (!next) setEnrollmentToken(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Network Agent</DialogTitle>
            <DialogDescription>
              Se genera un token de enrollment de un solo uso, atado a tu empresa.
              El sitio es opcional: el Agent es un punto de acceso, no un POP.
            </DialogDescription>
          </DialogHeader>
          {enrollmentToken ? (
            <div className="space-y-2">
              <p className="text-sm">
                Guardá este token. No se vuelve a mostrar.
              </p>
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
                {enrollmentToken}
              </pre>
              <p className="text-xs text-muted-foreground">
                El agent lo envía a POST /api/network/v1/enroll
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="Nombre del agent"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Select value={siteId || "none"} onValueChange={setSiteId}>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cerrar
            </Button>
            {enrollmentToken ? null : (
              <Button
                onClick={() => void handleCreate()}
                disabled={saving || !name.trim()}
              >
                Generar enrollment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(jobAgent)} onOpenChange={(next) => !next && setJobAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jobs de {jobAgent?.name}</DialogTitle>
            <DialogDescription>
              Contrato Cloud → Agent. Discovery se dispara desde /network/discovery.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Select
              value={jobType}
              onValueChange={(value) =>
                setJobType(value as (typeof NETWORK_JOB_TYPES)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NETWORK_JOB_TYPES.filter((item) => item !== "discovery").map((item) => (
                  <SelectItem key={item} value={item}>
                    {NETWORK_JOB_TYPE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void createJob()} disabled={saving}>
              Crear pendiente
            </Button>
          </div>
          <ul className="space-y-2 text-sm">
            {jobs.length === 0 ? (
              <li className="text-muted-foreground">Sin jobs.</li>
            ) : (
              jobs.map((job) => (
                <li key={job.id} className="rounded-md border px-3 py-2">
                  {NETWORK_JOB_TYPE_LABELS[job.jobType]} · {job.status}
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}
