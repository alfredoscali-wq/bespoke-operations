"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { List, Map as MapIcon, Plus } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { CommercialModuleHero } from "@/components/gestion-comercial/commercial-module-hero"
import {
  escapeCommercialMapHtml,
  type CommercialMapMarker,
} from "@/components/gestion-comercial/map/commercial-map-markers"
import { CommercialTerritorialActivityCreateDrawer } from "@/components/gestion-comercial/actividad-comercial/commercial-territorial-activity-create-drawer"
import { CommercialTerritorialActivityDetailDialog } from "@/components/gestion-comercial/actividad-comercial/commercial-territorial-activity-detail-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import { COMMERCIAL_ETIQUETA_FALLBACK_COLOR } from "@/lib/commercial/map-layers"
import {
  buildCommercialTerritorialActivitiesHref,
  commercialTerritorialActivityDayKey,
  isCommercialTerritorialActivityRange,
  type CommercialTerritorialActivityRange,
} from "@/lib/commercial/territorial-activity-ranges"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listCommercialTerritorialActivitiesBrowser } from "@/lib/supabase/commercial-territorial-activities.browser"
import { listCommercialTerritorialActivityTypesBrowser } from "@/lib/supabase/commercial-territorial-activity-types.browser"
import type {
  CommercialTerritorialActivity,
  CommercialTerritorialActivityType,
} from "@/lib/types/commercial-territorial-activity"
import type { CommercialMapBounds } from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

const MapCanvas = dynamic(
  () =>
    import("@/components/gestion-comercial/map/commercial-map-canvas").then(
      (mod) => mod.CommercialMapCanvas
    ),
  { ssr: false }
)

type ViewMode = "map" | "list"

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return "—"
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return "—"
  }
}

function buildActivityPopupHtml(activity: CommercialTerritorialActivity): string {
  const typeName = escapeCommercialMapHtml(
    activity.activityTypeName?.trim() || "Actividad"
  )
  const typeColor =
    activity.activityTypeColor?.trim() || COMMERCIAL_ETIQUETA_FALLBACK_COLOR
  const description = escapeCommercialMapHtml(activity.description)
  const user = escapeCommercialMapHtml(activity.employeeName?.trim() || "—")
  const date = escapeCommercialMapHtml(formatDate(activity.createdAt))
  const time = escapeCommercialMapHtml(formatTime(activity.createdAt))

  return `
    <div style="min-width:200px;font-family:system-ui,sans-serif">
      <p style="margin:0;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#0f172a">
        <span style="width:8px;height:8px;border-radius:999px;background:${typeColor};flex-shrink:0"></span>
        ${typeName}
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#64748b">${date} · ${time}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#64748b">Usuario: ${user}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#334155">${description}</p>
      <button
        type="button"
        data-commercial-map-detail="${activity.id}"
        style="margin-top:8px;width:100%;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:6px 8px;font-size:12px;cursor:pointer"
      >
        Ver detalle
      </button>
    </div>
  `
}

function isInsideBounds(
  activity: CommercialTerritorialActivity,
  bounds: CommercialMapBounds
): boolean {
  return (
    activity.latitude <= bounds.north &&
    activity.latitude >= bounds.south &&
    activity.longitude <= bounds.east &&
    activity.longitude >= bounds.west
  )
}

export function CommercialTerritorialActivityModule() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [view, setView] = useState<ViewMode>("map")
  const [types, setTypes] = useState<CommercialTerritorialActivityType[]>([])
  const [activities, setActivities] = useState<CommercialTerritorialActivity[]>(
    []
  )
  const [typeFilterIds, setTypeFilterIds] = useState<string[]>([])
  const [bounds, setBounds] = useState<CommercialMapBounds | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const activityId = searchParams.get("activityId")?.trim() || null
    if (!activityId) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setDetailId(activityId)
      setSelectedId(activityId)
    })
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

  const reload = useCallback(async () => {
    if (!companyId) return
    setIsLoading(true)
    setError(null)
    const [typesResult, activitiesResult] = await Promise.all([
      listCommercialTerritorialActivityTypesBrowser(companyId, {
        activeOnly: false,
      }),
      listCommercialTerritorialActivitiesBrowser(companyId),
    ])
    if (typesResult.error) {
      setError(typesResult.error.message)
    } else {
      setTypes(typesResult.data ?? [])
    }
    if (activitiesResult.error) {
      setError(activitiesResult.error.message)
      setActivities([])
    } else {
      setActivities(activitiesResult.data ?? [])
    }
    setIsLoading(false)
  }, [companyId])

  useEffect(() => {
    if (!isAuthReady || !companyId) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) void reload()
    })
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, reload])

  const activeTypes = useMemo(
    () => types.filter((entry) => entry.isActive),
    [types]
  )

  const rangeFilter = useMemo((): CommercialTerritorialActivityRange | null => {
    const raw = searchParams.get("range")
    return isCommercialTerritorialActivityRange(raw) ? raw : null
  }, [searchParams])

  const filteredActivities = useMemo(() => {
    const selectedTypes =
      typeFilterIds.length > 0 ? new Set(typeFilterIds) : null
    const todayKey =
      rangeFilter === "today"
        ? commercialTerritorialActivityDayKey(new Date())
        : null
    if (!selectedTypes && !todayKey) return activities
    return activities.filter((entry) => {
      if (selectedTypes && !selectedTypes.has(entry.activityTypeId)) return false
      if (
        todayKey &&
        commercialTerritorialActivityDayKey(entry.createdAt) !== todayKey
      ) {
        return false
      }
      return true
    })
  }, [activities, rangeFilter, typeFilterIds])

  const mapActivities = useMemo(() => {
    if (!bounds) return filteredActivities
    return filteredActivities.filter((entry) => isInsideBounds(entry, bounds))
  }, [bounds, filteredActivities])

  const markers = useMemo((): CommercialMapMarker[] => {
    return mapActivities.map((activity) => ({
      id: activity.id,
      latitude: activity.latitude,
      longitude: activity.longitude,
      color:
        activity.activityTypeColor?.trim() || COMMERCIAL_ETIQUETA_FALLBACK_COLOR,
      popupHtml: buildActivityPopupHtml(activity),
      detailActionId: activity.id,
    }))
  }, [mapActivities])

  function toggleTypeFilter(id: string) {
    setTypeFilterIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    )
  }

  function setRangeFilter(range: CommercialTerritorialActivityRange | null) {
    router.replace(buildCommercialTerritorialActivitiesHref(range ?? undefined))
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <CommercialModuleHero
        active="actividad"
        title="Actividad Comercial"
        description="Registro georreferenciado del trabajo territorial del equipo de ventas."
        showNewOpportunity={false}
        actions={
          <div className="flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "map" ? "default" : "ghost"}
              className="h-8 gap-1.5"
              onClick={() => setView("map")}
            >
              <MapIcon className="size-3.5" />
              Mapa
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              className="h-8 gap-1.5"
              onClick={() => setView("list")}
            >
              <List className="size-3.5" />
              Lista
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Filtros
        </span>
        <Button
          type="button"
          size="sm"
          variant={rangeFilter === "today" ? "default" : "outline"}
          className="h-7"
          aria-pressed={rangeFilter === "today"}
          onClick={() => setRangeFilter(rangeFilter === "today" ? null : "today")}
        >
          Hoy
        </Button>
        {activeTypes.map((type) => {
          const checked = typeFilterIds.includes(type.id)
          return (
            <label
              key={type.id}
              className="inline-flex cursor-pointer items-center gap-2"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleTypeFilter(type.id)}
                aria-label={type.name}
              />
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: type.color }}
                aria-hidden
              />
              <span>{type.name}</span>
            </label>
          )
        })}
        {typeFilterIds.length > 0 || rangeFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setTypeFilterIds([])
              setRangeFilter(null)
            }}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-9 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          Nueva Actividad
        </Button>
      </div>

      {view === "map" ? (
        <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-lg">
          <MapCanvas
            mode="activity"
            markers={markers}
            selectedId={selectedId}
            interactive={!createOpen && detailId == null}
            onBoundsChange={setBounds}
            onSelect={setSelectedId}
            onOpenDetail={setDetailId}
            className="absolute inset-0 h-full min-h-[480px]"
          />
          {isLoading ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <span className="rounded-md border bg-background/95 px-3 py-1 text-xs shadow-sm">
                Cargando actividades…
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Sin actividades registradas.
                  </TableCell>
                </TableRow>
              ) : (
                filteredActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-mono text-xs">
                      {activity.code}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{
                            backgroundColor:
                              activity.activityTypeColor ||
                              COMMERCIAL_ETIQUETA_FALLBACK_COLOR,
                          }}
                          aria-hidden
                        />
                        {activity.activityTypeName ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {activity.description}
                    </TableCell>
                    <TableCell>{activity.employeeName ?? "—"}</TableCell>
                    <TableCell>{formatDate(activity.createdAt)}</TableCell>
                    <TableCell>{formatTime(activity.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("h-8")}
                        onClick={() => setDetailId(activity.id)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CommercialTerritorialActivityCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
        actorEmployeeId={actorEmployeeId}
        types={activeTypes}
        onCreated={() => {
          void reload()
        }}
      />

      <CommercialTerritorialActivityDetailDialog
        open={detailId != null}
        activityId={detailId}
        companyId={companyId}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            if (searchParams.get("activityId")) {
              setRangeFilter(rangeFilter)
            }
          }
        }}
      />
    </div>
  )
}
