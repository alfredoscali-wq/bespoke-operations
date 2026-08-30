"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { NetworkSubnav } from "@/components/network/network-subnav"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NETWORK_AGENT_STATUS_LABELS } from "@/lib/network/labels"
import { NETWORK_AGENT_STATUSES } from "@/lib/network/constants"
import type { NetworkHomeSummary, NetworkSite } from "@/lib/network/types"

export function NetworkHomeScreen() {
  const [summary, setSummary] = useState<NetworkHomeSummary | null>(null)
  const [sites, setSites] = useState<NetworkSite[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/network/summary")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          summary?: NetworkHomeSummary
          sites?: NetworkSite[]
          message?: string
        }
        if (!body.success) throw new Error(body.message)
        setSummary(body.summary ?? null)
        setSites(body.sites ?? [])
        setError(null)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar Network."
        )
      })
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Network</h1>
        <p className="text-sm text-muted-foreground">
          Sitios de infraestructura, Network Agents, inventario y estado operativo.
        </p>
        <NetworkSubnav current="home" />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Agents" value={summary?.agentCount ?? "—"} />
        <SummaryCard title="Devices" value={summary?.deviceCount ?? "—"} />
        <SummaryCard title="Sitios" value={summary?.siteCount ?? "—"} />
        <SummaryCard
          title="Jobs pendientes"
          value={summary?.pendingJobCount ?? "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado operativo</CardTitle>
          <CardDescription>Último polling de monitoring, no inventario de discovery</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Devices</p>
            <p className="text-lg font-medium">{summary?.deviceCount ?? 0}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Online</p>
            <p className="text-lg font-medium">{summary?.devicesOnline ?? 0}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Offline</p>
            <p className="text-lg font-medium">{summary?.devicesOffline ?? 0}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Unknown</p>
            <p className="text-lg font-medium">{summary?.devicesUnknown ?? 0}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Interfaces up / down</p>
            <p className="text-lg font-medium">
              {summary ? `${summary.interfacesUp} / ${summary.interfacesDown}` : "0 / 0"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de Agents</CardTitle>
          <CardDescription>Conteo por estado actual</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {NETWORK_AGENT_STATUSES.map((status) => (
            <div key={status} className="rounded-lg border px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {NETWORK_AGENT_STATUS_LABELS[status]}
              </p>
              <p className="text-lg font-medium">
                {summary?.agentsByStatus[status] ?? 0}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sitios</CardTitle>
          <CardDescription>Agent asociado a cada sitio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay sitios. Creá el primero en{" "}
              <Link className="underline" href="/network/sites">
                Sitios
              </Link>
              .
            </p>
          ) : (
            sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  <p className="text-xs text-muted-foreground">{site.kind}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {site.agentCount} agent{site.agentCount === 1 ? "" : "s"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
