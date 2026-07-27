"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, MapPin, Plus } from "lucide-react"

import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import { CommercialTerritoryLegend } from "@/components/gestion-comercial/territory/commercial-territory-legend"
import {
  CommercialTerritoryPanel,
  type CommercialTerritoryFilters,
  type CommercialTerritoryLocationScope,
} from "@/components/gestion-comercial/territory/commercial-territory-panel"
import { EmployeesProvider, useEmployees } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { formatCoordinate } from "@/lib/gps"
import type {
  CommercialLocationSource,
} from "@/lib/commercial/catalogs"
import { buildCommercialResponsibleLegend } from "@/lib/commercial/responsible-colors"
import { listCommercialResponsibleOptions } from "@/lib/commercial/responsible-employees"
import type {
  CommercialMapBounds,
  CommercialMapOpportunity,
  CommercialOpportunityListItem,
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
}

type LocationDraft = {
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
}

function CommercialTerritoryContent() {
  const router = useRouter()
  const { employees } = useEmployees()
  const { data: people } = useCommercialPeople()
  const { data: allOpportunities } = useCommercialOpportunities()

  const geolocatedCount = useMemo(
    () =>
      allOpportunities.filter(
        (entry) => entry.latitude != null && entry.longitude != null
      ).length,
    [allOpportunities]
  )
  const withoutLocationCount = useMemo(
    () =>
      allOpportunities.filter(
        (entry) => entry.latitude == null || entry.longitude == null
      ).length,
    [allOpportunities]
  )

  const [bounds, setBounds] = useState<CommercialMapBounds | null>(null)
  const [filters, setFilters] = useState<CommercialTerritoryFilters>(DEFAULT_FILTERS)
  const [opportunities, setOpportunities] = useState<CommercialMapOpportunity[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchGenerationRef = useRef(0)
  const boundsRef = useRef<CommercialMapBounds | null>(null)
  const filtersRef = useRef(filters)
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

  const withoutLocationOpportunities = useMemo((): CommercialMapOpportunity[] => {
    return allOpportunities
      .filter((entry) => entry.latitude == null || entry.longitude == null)
      .filter((entry) => {
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
        if (filters.search.trim()) {
          const haystack = [
            entry.code,
            entry.title,
            entry.personDisplayName,
          ]
            .join(" ")
            .toLocaleLowerCase("es")
          if (!haystack.includes(filters.search.trim().toLocaleLowerCase("es"))) {
            return false
          }
        }
        return true
      })
      .map((entry) => ({
        id: entry.id,
        code: entry.code,
        title: entry.title,
        status: entry.status,
        priority: entry.priority,
        latitude: 0,
        longitude: 0,
        assignedEmployeeId: entry.assignedEmployeeId,
        personName: entry.personDisplayName,
        companyName: "",
        updatedAt: entry.updatedAt,
      }))
  }, [allOpportunities, filters])

  const panelOpportunities =
    locationScope === "without" ? withoutLocationOpportunities : opportunities

  const legendItems = useMemo(
    () =>
      buildCommercialResponsibleLegend(opportunities, employeeNameById),
    [employeeNameById, opportunities]
  )

  filtersRef.current = filters
  boundsRef.current = bounds

  const filtersKey = [
    filters.assignment,
    filters.assignedEmployeeId,
    filters.status,
    filters.priority,
    filters.source,
    filters.search,
  ].join("|")
  const previousFiltersKeyRef = useRef(filtersKey)
  const hasLoadedOnceRef = useRef(hasLoadedOnce)
  hasLoadedOnceRef.current = hasLoadedOnce

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

  const fetchMap = useCallback(async (options?: { showLoading?: boolean }) => {
    const activeBounds = boundsRef.current
    const activeFilters = filtersRef.current
    if (!activeBounds) return

    const showLoading =
      options?.showLoading ?? !hasLoadedOnceRef.current
    const generation = ++fetchGenerationRef.current
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        north: String(activeBounds.north),
        south: String(activeBounds.south),
        east: String(activeBounds.east),
        west: String(activeBounds.west),
        assignment: activeFilters.assignment,
      })
      if (activeFilters.assignedEmployeeId) {
        params.set("assignedEmployeeId", activeFilters.assignedEmployeeId)
      }
      if (activeFilters.status) params.set("status", activeFilters.status)
      if (activeFilters.priority) params.set("priority", activeFilters.priority)
      if (activeFilters.source) params.set("source", activeFilters.source)
      if (activeFilters.search.trim()) {
        params.set("search", activeFilters.search.trim())
      }

      const response = await fetch(`/api/gestion-comercial/map?${params}`)
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        opportunities?: CommercialMapOpportunity[]
      } | null

      if (generation !== fetchGenerationRef.current) return

      if (!response.ok || !payload?.success || !payload.opportunities) {
        setError(payload?.message ?? "No se pudo cargar el territorio.")
        setOpportunities([])
        return
      }

      setOpportunities(payload.opportunities)
      setHasLoadedOnce(true)
    } finally {
      if (generation === fetchGenerationRef.current && showLoading) {
        setIsLoading(false)
      }
    }
  }, [])

  // Refetch when the visible area or filters change. Loading only on first load / filter changes.
  useEffect(() => {
    if (!bounds) return
    const filtersChanged = previousFiltersKeyRef.current !== filtersKey
    previousFiltersKeyRef.current = filtersKey
    const showLoading = !hasLoadedOnceRef.current || filtersChanged
    const handle = window.setTimeout(() => {
      void fetchMap({ showLoading })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [bounds, filtersKey, fetchMap])

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    setDrawerOpen(false)
    setPickMode(false)
    setLocationDraft({
      latitude: null,
      longitude: null,
      locationSource: null,
    })
    void fetchMap({ showLoading: false })
    if (
      opportunity.latitude != null &&
      opportunity.longitude != null
    ) {
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
      await fetchMap({ showLoading: false })
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Territorio Comercial
          </h1>
          <p className="text-sm text-muted-foreground">
            Trabajá oportunidades sobre el mapa del área visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/gestion-comercial")}
          >
            Bandeja
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => {
              setDrawerOpen(true)
              setPickMode(false)
            }}
          >
            <Plus className="size-4" />
            Nueva Oportunidad
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 lg:hidden"
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
        </div>
      </div>

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
            "w-full shrink-0 overflow-hidden rounded-lg border bg-background p-3 lg:w-[380px]",
            panelOpen
              ? "flex max-h-[42vh] flex-col sm:max-h-[46vh] lg:max-h-none"
              : "hidden lg:flex lg:flex-col"
          )}
        >
          <CommercialTerritoryPanel
            filters={filters}
            onFiltersChange={setFilters}
            opportunities={panelOpportunities}
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
            employeeNameById={employeeNameById}
            isLoading={isLoading && locationScope === "all"}
            onSelect={(id) => {
              setSelectedId(id)
              if (locationScope === "without") {
                router.push(`/gestion-comercial/${id}`)
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
            opportunities={opportunities}
            selectedId={selectedId}
            pickMode={pickMode}
            employeeNameById={employeeNameById}
            onBoundsChange={handleBoundsChange}
            onSelect={setSelectedId}
            onOpenDossier={(id) => router.push(`/gestion-comercial/${id}`)}
            onPickLocation={handleMapPick}
            className="h-full"
          />
          <CommercialTerritoryLegend
            items={legendItems}
            className="absolute bottom-3 left-3 z-[1000]"
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
