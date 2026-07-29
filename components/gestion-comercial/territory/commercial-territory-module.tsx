"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, MapPin } from "lucide-react"

import { CommercialModuleHero } from "@/components/gestion-comercial/commercial-module-hero"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import { CommercialTerritoryLegend } from "@/components/gestion-comercial/territory/commercial-territory-legend"
import {
  CommercialTerritoryPanel,
  type CommercialTerritoryCardOpportunity,
  type CommercialTerritoryFilters,
  type CommercialTerritoryLocationScope,
} from "@/components/gestion-comercial/territory/commercial-territory-panel"
import { EmployeesProvider, useEmployees } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { formatDateOnly } from "@/lib/dates/date-only"
import { formatCoordinate } from "@/lib/gps"
import type { CommercialLocationSource } from "@/lib/commercial/catalogs"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listCommercialEtiquetasBrowser } from "@/lib/supabase/commercial-etiquetas.browser"
import type { CommercialEtiqueta } from "@/lib/types/commercial-etiquetas"
import { resolveCommercialEtiquetaMapColor } from "@/lib/commercial/map-layers"
import {
  enrichOpportunityWithEtiqueta,
  indexCommercialEtiquetasById,
} from "@/lib/commercial/etiqueta-display"
import { listCommercialResponsibleOptions } from "@/lib/commercial/responsible-employees"
import { buildCommercialDossierHref } from "@/lib/commercial/dossier-navigation"
import type {
  CommercialMapBounds,
  CommercialMapOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

const CommercialTerritoryMapCanvas = dynamic(
  () =>
    import("@/components/gestion-comercial/territory/commercial-territory-map-canvas").then(
      (mod) => mod.CommercialTerritoryMapCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  }
)

const DEFAULT_FILTERS: CommercialTerritoryFilters = {
  search: "",
  assignment: "all",
  assignedEmployeeId: "",
  status: "",
  priority: "",
  source: "",
  etiquetaIds: [],
}

type LocationDraft = {
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
}

function matchesTerritoryFilters(
  entry: CommercialOpportunityListItem,
  filters: CommercialTerritoryFilters,
  personById: Map<string, CommercialPerson>
): boolean {
  if (filters.status && entry.status !== filters.status) return false
  if (filters.priority && entry.priority !== filters.priority) return false
  if (filters.source && entry.source !== filters.source) return false
  if (filters.assignment === "assigned" && !entry.assignedEmployeeId) {
    return false
  }
  if (filters.assignment === "unassigned" && entry.assignedEmployeeId) {
    return false
  }
  if (
    filters.assignedEmployeeId &&
    entry.assignedEmployeeId !== filters.assignedEmployeeId
  ) {
    return false
  }
  if (filters.etiquetaIds.length > 0) {
    if (
      !entry.etiquetaId ||
      !filters.etiquetaIds.includes(entry.etiquetaId)
    ) {
      return false
    }
  }
  if (filters.search.trim()) {
    const person = personById.get(entry.personId)
    const haystack = [
      entry.code,
      entry.title,
      entry.personDisplayName,
      entry.etiquetaName ?? "",
      person?.companyName ?? "",
      person?.phone ?? "",
      person?.mobile ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase("es")
    if (!haystack.includes(filters.search.trim().toLocaleLowerCase("es"))) {
      return false
    }
  }
  return true
}

function isInsideBounds(
  opportunity: Pick<CommercialMapOpportunity, "latitude" | "longitude">,
  bounds: CommercialMapBounds
): boolean {
  const south = Math.min(bounds.south, bounds.north)
  const north = Math.max(bounds.south, bounds.north)
  const west = Math.min(bounds.west, bounds.east)
  const east = Math.max(bounds.west, bounds.east)
  return (
    opportunity.latitude >= south &&
    opportunity.latitude <= north &&
    opportunity.longitude >= west &&
    opportunity.longitude <= east
  )
}

function resolveNextActionLabel(
  entry: CommercialOpportunityListItem
): string | null {
  if (!entry.expectedCloseDate?.trim()) return null
  return `Cierre est. ${formatDateOnly(entry.expectedCloseDate)}`
}

function toMapOpportunity(
  entry: CommercialOpportunityListItem,
  personById: Map<string, CommercialPerson>
): CommercialTerritoryCardOpportunity | null {
  if (entry.latitude == null || entry.longitude == null) return null
  const person = personById.get(entry.personId)
  return {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    status: entry.status,
    priority: entry.priority,
    latitude: Number(entry.latitude),
    longitude: Number(entry.longitude),
    assignedEmployeeId: entry.assignedEmployeeId,
    personName: entry.personDisplayName,
    companyName: person?.companyName?.trim() ?? "",
    updatedAt: entry.updatedAt,
    etiquetaId: entry.etiquetaId,
    etiquetaName: entry.etiquetaName,
    etiquetaColor: entry.etiquetaColor,
    nextActionLabel: resolveNextActionLabel(entry),
  }
}

function CommercialTerritoryContent() {
  const router = useRouter()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { employees } = useEmployees()
  const { data: people } = useCommercialPeople()
  const {
    data: allOpportunities,
    isLoading: opportunitiesLoading,
    refetch: refreshOpportunities,
  } = useCommercialOpportunities()

  const [bounds, setBounds] = useState<CommercialMapBounds | null>(null)
  const [filters, setFilters] = useState<CommercialTerritoryFilters>(DEFAULT_FILTERS)
  const [etiquetas, setEtiquetas] = useState<CommercialEtiqueta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [panelOpen, setPanelOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [locationDraft, setLocationDraft] = useState<LocationDraft>({
    latitude: null,
    longitude: null,
    locationSource: null,
  })
  const [assignEmployeeId, setAssignEmployeeId] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [locationScope, setLocationScope] =
    useState<CommercialTerritoryLocationScope>("all")

  useEffect(() => {
    if (!isAuthReady || !companyId) return
    let cancelled = false
    void listCommercialEtiquetasBrowser(companyId, { activeOnly: true }).then(
      (result) => {
        if (cancelled) return
        setEtiquetas(result.data ?? [])
      }
    )
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  const employeeOptions = useMemo(
    () => listCommercialResponsibleOptions(employees),
    [employees]
  )

  const employeeNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const employee of employees) {
      map[employee.id] =
        `${employee.firstName} ${employee.lastName}`.trim() ||
        employee.employeeCode
    }
    return map
  }, [employees])

  const personById = useMemo(() => {
    const map = new Map<string, CommercialPerson>()
    for (const person of people) {
      map.set(person.id, person)
    }
    return map
  }, [people])

  const etiquetasById = useMemo(
    () => indexCommercialEtiquetasById(etiquetas),
    [etiquetas]
  )

  const enrichedOpportunities = useMemo(
    () =>
      allOpportunities.map((entry) =>
        enrichOpportunityWithEtiqueta(entry, etiquetasById)
      ),
    [allOpportunities, etiquetasById]
  )

  const geolocatedCount = useMemo(
    () =>
      enrichedOpportunities.filter(
        (entry) => entry.latitude != null && entry.longitude != null
      ).length,
    [enrichedOpportunities]
  )
  const withoutLocationCount = useMemo(
    () =>
      enrichedOpportunities.filter(
        (entry) => entry.latitude == null || entry.longitude == null
      ).length,
    [enrichedOpportunities]
  )

  const filteredGeolocatedOpportunities =
    useMemo((): CommercialTerritoryCardOpportunity[] => {
      const rows: CommercialTerritoryCardOpportunity[] = []
      for (const entry of enrichedOpportunities) {
        if (!matchesTerritoryFilters(entry, filters, personById)) continue
        const mapped = toMapOpportunity(entry, personById)
        if (mapped) rows.push(mapped)
      }
      return rows
    }, [enrichedOpportunities, filters, personById])

  const visibleOpportunities =
    useMemo((): CommercialTerritoryCardOpportunity[] => {
      if (!bounds) return []
      return filteredGeolocatedOpportunities.filter((entry) =>
        isInsideBounds(entry, bounds)
      )
    }, [bounds, filteredGeolocatedOpportunities])

  const withoutLocationOpportunities =
    useMemo((): CommercialTerritoryCardOpportunity[] => {
      return enrichedOpportunities
        .filter((entry) => entry.latitude == null || entry.longitude == null)
        .filter((entry) => matchesTerritoryFilters(entry, filters, personById))
        .map((entry) => {
          const person = personById.get(entry.personId)
          return {
            id: entry.id,
            code: entry.code,
            title: entry.title,
            status: entry.status,
            priority: entry.priority,
            latitude: 0,
            longitude: 0,
            assignedEmployeeId: entry.assignedEmployeeId,
            personName: entry.personDisplayName,
            companyName: person?.companyName?.trim() ?? "",
            updatedAt: entry.updatedAt,
            etiquetaId: entry.etiquetaId,
            etiquetaName: entry.etiquetaName,
            etiquetaColor: entry.etiquetaColor,
            nextActionLabel: resolveNextActionLabel(entry),
          }
        })
    }, [enrichedOpportunities, filters, personById])

  const panelOpportunities =
    locationScope === "without"
      ? withoutLocationOpportunities
      : visibleOpportunities

  const legendItems = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of filteredGeolocatedOpportunities) {
      const key = entry.etiquetaId ?? "__none__"
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const items = etiquetas
      .map((etiqueta) => ({
        key: etiqueta.id,
        shortName: etiqueta.name,
        count: counts.get(etiqueta.id) ?? 0,
        color: {
          hex: resolveCommercialEtiquetaMapColor(etiqueta.color),
          soft: `${resolveCommercialEtiquetaMapColor(etiqueta.color)}22`,
        },
      }))
      .filter((item) => item.count > 0)

    const untagged = counts.get("__none__") ?? 0
    if (untagged > 0) {
      items.push({
        key: "__none__",
        shortName: "Sin etiqueta",
        count: untagged,
        color: {
          hex: resolveCommercialEtiquetaMapColor(null),
          soft: `${resolveCommercialEtiquetaMapColor(null)}22`,
        },
      })
    }
    return items
  }, [etiquetas, filteredGeolocatedOpportunities])

  const handleBoundsChange = useCallback((next: CommercialMapBounds) => {
    setBounds((current) => {
      if (
        current &&
        Math.abs(current.north - next.north) < 1e-7 &&
        Math.abs(current.south - next.south) < 1e-7 &&
        Math.abs(current.east - next.east) < 1e-7 &&
        Math.abs(current.west - next.west) < 1e-7
      ) {
        return current
      }
      return next
    })
  }, [])

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    setDrawerOpen(false)
    setPickMode(false)
    setLocationDraft({
      latitude: null,
      longitude: null,
      locationSource: null,
    })
    if (opportunity.latitude != null && opportunity.longitude != null) {
      setSelectedId(opportunity.id)
      setLocationScope("all")
    } else {
      setLocationScope("without")
      setSelectedId(opportunity.id)
    }
  }

  function handleUseCurrentLocation() {
    setGpsError(null)
    if (!navigator.geolocation) {
      setGpsError("Geolocalización no disponible en este navegador.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationDraft({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
          locationSource: "gps",
        })
        setPickMode(false)
      },
      () => {
        setGpsError("No se pudo obtener la ubicación actual.")
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  function handlePickOnMap() {
    setGpsError(null)
    setPickMode(true)
  }

  function handleMapPick(coords: { latitude: number; longitude: number }) {
    setLocationDraft({
      latitude: coords.latitude,
      longitude: coords.longitude,
      locationSource: "manual",
    })
    setPickMode(false)
  }

  async function handleBulkAssign() {
    if (!assignEmployeeId || selectedIds.length === 0) return
    setIsAssigning(true)
    setError(null)
    try {
      const response = await fetch(
        "/api/gestion-comercial/opportunities/bulk-assign",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunityIds: selectedIds,
            assignedEmployeeId: assignEmployeeId,
          }),
        }
      )
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
      } | null
      if (!response.ok || !payload?.success) {
        setError(payload?.message ?? "No se pudo asignar el responsable.")
        return
      }
      setSelectedIds([])
      setAssignEmployeeId("")
      await refreshOpportunities()
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[560px] flex-col gap-3">
      <CommercialModuleHero
        active="territorio"
        title="Territorio Comercial"
        description="Navegá el mapa con todos los clientes geolocalizados y trabajá el listado del área visible."
        onNewOpportunity={() => {
          setDrawerOpen(true)
          setPickMode(false)
        }}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-2 lg:hidden"
            onClick={() => setPanelOpen((open) => !open)}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                panelOpen ? "rotate-180" : "rotate-0"
              )}
            />
            Panel
          </Button>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {pickMode ? (
        <p className="text-sm text-muted-foreground" role="status">
          Seleccioná un punto en el mapa para guardar la ubicación.
        </p>
      ) : null}
      {gpsError ? (
        <p className="text-sm text-destructive" role="alert">
          {gpsError}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col overflow-hidden rounded-lg border bg-background p-3 lg:w-[400px]",
            panelOpen
              ? "max-h-[58vh] sm:max-h-[60vh] lg:max-h-none"
              : "hidden lg:flex"
          )}
        >
          <CommercialTerritoryPanel
            filters={filters}
            onFiltersChange={setFilters}
            opportunities={panelOpportunities}
            totalGeolocatedFilteredCount={filteredGeolocatedOpportunities.length}
            visibleCount={visibleOpportunities.length}
            geolocatedCount={geolocatedCount}
            withoutLocationCount={withoutLocationCount}
            locationScope={locationScope}
            onLocationScopeChange={(scope) => {
              setLocationScope(scope)
              setSelectedIds([])
              setSelectedId(null)
            }}
            selectedId={selectedId}
            selectedIds={selectedIds}
            employeeOptions={employeeOptions}
            etiquetas={etiquetas}
            isLoading={opportunitiesLoading && locationScope === "all"}
            onSelect={(id) => {
              setSelectedId(id)
              if (locationScope === "without") {
                router.push(buildCommercialDossierHref(id, "territorio"))
              }
            }}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) =>
                checked
                  ? [...new Set([...current, id])]
                  : current.filter((entry) => entry !== id)
              )
            }}
            onToggleSelectAll={(checked) => {
              setSelectedIds(
                checked ? panelOpportunities.map((entry) => entry.id) : []
              )
            }}
            assignEmployeeId={assignEmployeeId}
            onAssignEmployeeIdChange={setAssignEmployeeId}
            onAssignResponsible={() => void handleBulkAssign()}
            isAssigning={isAssigning}
          />
        </aside>

        <div className="relative min-h-0 min-w-0 flex-1">
          <CommercialTerritoryMapCanvas
            opportunities={filteredGeolocatedOpportunities}
            selectedId={selectedId}
            pickMode={pickMode}
            employeeNameById={employeeNameById}
            onBoundsChange={handleBoundsChange}
            onSelect={setSelectedId}
            onOpenDossier={(id) =>
              router.push(buildCommercialDossierHref(id, "territorio"))
            }
            onPickLocation={handleMapPick}
            // Picking a point keeps the drawer open on purpose, so the map has
            // to sit above the drawer overlay while that mode is active.
            className={cn("h-full", pickMode && "z-[60]")}
          />
          <CommercialTerritoryLegend
            items={legendItems}
            className="absolute bottom-3 left-3 z-10"
          />
        </div>
      </div>

      <CommercialNewOpportunityDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) {
            setPickMode(false)
            setLocationDraft({
              latitude: null,
              longitude: null,
              locationSource: null,
            })
          }
        }}
        people={people}
        onCreated={handleCreated}
        location={locationDraft}
        locationControls={
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4" />
              Ubicación
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleUseCurrentLocation}
              >
                Usar ubicación actual
              </Button>
              <Button
                type="button"
                size="sm"
                variant={pickMode ? "secondary" : "outline"}
                onClick={handlePickOnMap}
              >
                Seleccionar punto sobre el mapa
              </Button>
            </div>
            {locationDraft.latitude != null &&
            locationDraft.longitude != null ? (
              <p className="text-xs text-muted-foreground">
                {formatCoordinate(locationDraft.latitude)},{" "}
                {formatCoordinate(locationDraft.longitude)}
                {locationDraft.locationSource
                  ? ` · ${locationDraft.locationSource}`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin ubicación (opcional).
              </p>
            )}
          </div>
        }
      />
    </div>
  )
}

export function CommercialTerritoryModule() {
  return (
    <EmployeesProvider>
      <CommercialProvider>
        <CommercialTerritoryContent />
      </CommercialProvider>
    </EmployeesProvider>
  )
}
