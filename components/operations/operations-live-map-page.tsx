"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { canViewOperationsLiveMap } from "@/lib/gps-live/access"
import { GPS_LIVE_MAP_POLL_MS } from "@/lib/gps-live/constants"
import type { GpsLiveCrewMarker } from "@/lib/gps-live/types"
import { cn } from "@/lib/utils"

const LiveMapCanvas = dynamic(
  () =>
    import("@/components/operations/live-map-canvas").then(
      (module) => module.LiveMapCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(70vh,40rem)] items-center justify-center rounded-xl border bg-muted/20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

type LiveMapResponse = {
  success?: boolean
  message?: string
  pollIntervalMs?: number
  heartbeatIntervalSeconds?: number
  crews?: GpsLiveCrewMarker[]
}

function freshnessLabel(crew: GpsLiveCrewMarker): string {
  if (crew.freshness === "recent") return "Reciente"
  if (crew.freshness === "stale") return "Desactualizada"
  return "Sin posición"
}

export function OperationsLiveMapPage() {
  const { sessionUser, isAuthReady } = useAuth()
  const canView = canViewOperationsLiveMap(sessionUser)
  const [crews, setCrews] = useState<GpsLiveCrewMarker[]>([])
  const [selectedWorkTeamId, setSelectedWorkTeamId] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadMap = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const response = await fetch("/api/operations/live-map")
      const body = (await response.json()) as LiveMapResponse
      if (!response.ok || !body.success || !body.crews) {
        throw new Error(body.message ?? "No se pudo cargar el mapa operativo.")
      }
      setCrews(body.crews)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el mapa operativo."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthReady || !canView) {
      return
    }
    void loadMap()
    const timer = window.setInterval(() => {
      void loadMap(true)
    }, GPS_LIVE_MAP_POLL_MS)
    return () => window.clearInterval(timer)
  }, [canView, isAuthReady, loadMap])

  if (!isAuthReady) {
    return <p className="text-sm text-muted-foreground">Verificando permisos…</p>
  }

  if (!canView) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          El mapa operativo está disponible para administrador y supervisor.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/operations/planificacion">Volver a Planificación</Link>
        </Button>
      </div>
    )
  }

  const selected = crews.find((crew) => crew.workTeamId === selectedWorkTeamId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mapa Operativo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Última posición de cuadrillas con jornada activa. Se actualiza cada
            30 segundos.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadMap()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-600" /> Reciente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-600" /> Desactualizada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-slate-400" /> Sin posición
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 bg-blue-600" /> Destino OT
        </span>
      </div>

      <LiveMapCanvas
        crews={crews}
        selectedWorkTeamId={selectedWorkTeamId}
        onSelectCrew={setSelectedWorkTeamId}
      />

      <div className="grid gap-2 md:grid-cols-2">
        {crews.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">
            No hay cuadrillas con jornada activa.
          </p>
        ) : null}
        {crews.map((crew) => (
          <button
            key={crew.workTeamId}
            type="button"
            onClick={() => setSelectedWorkTeamId(crew.workTeamId)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm",
              selectedWorkTeamId === crew.workTeamId
                ? "border-primary bg-muted/40"
                : "bg-card"
            )}
          >
            <p className="font-medium">{crew.workTeamName}</p>
            <p className="text-xs text-muted-foreground">
              {freshnessLabel(crew)}
              {crew.currentTask
                ? ` · OT ${crew.currentTask.code ?? crew.currentTask.title}`
                : ""}
            </p>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">{selected.workTeamName}</p>
          <p className="text-muted-foreground">
            Jornada {selected.shiftStatus}. Posición {freshnessLabel(selected)}.
          </p>
          {selected.currentTask ? (
            <p className="text-muted-foreground">
              OT en curso: {selected.currentTask.code ?? selected.currentTask.id}{" "}
              · {selected.currentTask.title} ({selected.currentTask.status})
            </p>
          ) : (
            <p className="text-muted-foreground">Sin OT en curso.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
