"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, MapPin, Plus } from "lucide-react"

import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import {
  CommercialTerritoryPanel,
  type CommercialTerritoryFilters,
} from "@/components/gestion-comercial/territory/commercial-territory-panel"
import { EmployeesProvider, useEmployees } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { formatCoordinate } from "@/lib/gps"
import type {
  CommercialLocationSource,
} from "@/lib/commercial/catalogs"
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

  const [bounds, setBounds] = useState<CommercialMapBounds | null>(null)
  const [filters, setFilters] = useState<CommercialTerritoryFilters>(DEFAULT_FILTERS)
  const [opportunities, setOpportunities] = useState<CommercialMapOpportunity[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(false)
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

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((employee) => employee.employmentStatus !== "inactive")
        .map((employee) => ({
          id: employee.id,
          label:
            `${employee.firstName} ${employee.lastName}`.trim() ||
            employee.employeeCode,
        })),
    [employees]
  )

  const employeeNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const employee of employeeOptions) {
      map[employee.id] = employee.label
    }
    return map
  }, [employeeOptions])

  const fetchMap = useCallback(async () => {
    if (!bounds) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        north: String(bounds.north),
        south: String(bounds.south),
        east: String(bounds.east),
        west: String(bounds.west),
        assignment: filters.assignment,
      })
      if (filters.assignedEmployeeId) {
        params.set("assignedEmployeeId", filters.assignedEmployeeId)
      }
      if (filters.status) params.set("status", filters.status)
      if (filters.priority) params.set("priority", filters.priority)
      if (filters.source) params.set("source", filters.source)
      if (filters.search.trim()) params.set("search", filters.search.trim())

      const response = await fetch(`/api/gestion-comercial/map?${params}`)
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        opportunities?: CommercialMapOpportunity[]
      } | null

      if (!response.ok || !payload?.success || !payload.opportunities) {
        setError(payload?.message ?? "No se pudo cargar el territorio.")
        setOpportunities([])
        return
      }

      setOpportunities(payload.opportunities)
    } finally {
      setIsLoading(false)
    }
  }, [bounds, filters])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchMap()
    }, 250)
    return () => window.clearTimeout(handle)
  }, [fetchMap])

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    setDrawerOpen(false)
    setPickMode(false)
    setLocationDraft({
      latitude: null,
      longitude: null,
      locationSource: null,
    })
    void fetchMap()
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
      await fetchMap()
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
            opportunities={opportunities}
            selectedId={selectedId}
            selectedIds={selectedIds}
            employeeOptions={employeeOptions}
            employeeNameById={employeeNameById}
            isLoading={isLoading}
            onSelect={setSelectedId}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) =>
                checked
                  ? [...new Set([...current, id])]
                  : current.filter((entry) => entry !== id)
              )
            }}
            onToggleSelectAll={(checked) => {
              setSelectedIds(
                checked ? opportunities.map((entry) => entry.id) : []
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
            onBoundsChange={setBounds}
            onSelect={setSelectedId}
            onOpenDossier={(id) => router.push(`/gestion-comercial/${id}`)}
            onPickLocation={handleMapPick}
            className="h-full"
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
