"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, Map } from "lucide-react"

import { ProjectDesignExportDialog } from "@/components/obras/design/project-design-export-dialog"
import { ProjectDesignInspector } from "@/components/obras/design/project-design-inspector"
import { ProjectDesignMapCanvas } from "@/components/obras/design/project-design-map-canvas"
import { ProjectDesignMapPreviewDialog } from "@/components/obras/design/project-design-map-preview-dialog"
import { ProjectDesignSidebar } from "@/components/obras/design/project-design-sidebar"
import { ProjectDesignToolbar } from "@/components/obras/design/project-design-toolbar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { roundCoordinate } from "@/lib/gps/coordinates"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_NODE_COLOR,
} from "@/lib/projects/design/colors"
import {
  cancelDesignDrawing,
  isDesignDrawTool,
  isDesignGainTool,
  isDesignPlacementTool,
  resolveDrawingElementClick,
  resolveDrawingFinish,
  resolveDrawingMapClick,
} from "@/lib/projects/design/drawing"
import { defaultIconForKind } from "@/lib/projects/design/icons"
import { resolveDesignInspectorAfterSave } from "@/lib/projects/design/inspector"
import { suggestProjectDesignElementName } from "@/lib/projects/design/labels"
import {
  buildProjectDesignElementDeleteMessage,
  buildProjectDesignSegmentDeleteMessage,
  resolveProjectDesignElementDeleteImpact,
} from "@/lib/projects/design/deletion"
import {
  DEFAULT_TRACE_GAIN_M,
  resolveGainPlacement,
} from "@/lib/projects/design/gains"
import { associateSegmentEndpoints } from "@/lib/projects/design/snap"
import {
  prepareProjectDesignGainDraft,
  prepareProjectDesignSegmentDraft,
} from "@/lib/projects/design/validate"
import {
  createProjectDesignElement,
  createProjectDesignGain,
  createProjectDesignSegment,
  listProjectDesign,
  removeProjectDesignElement,
  removeProjectDesignGain,
  removeProjectDesignSegment,
  updateProjectDesignElement,
  updateProjectDesignGain,
  updateProjectDesignSegment,
} from "@/lib/supabase/project-design.browser"
import type { Project } from "@/lib/types/projects"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
  ProjectDesignSelection,
  ProjectDesignTool,
} from "@/lib/types/project-design"

type ProjectDesignWorkspaceProps = {
  project: Project
  companyId: string
  readOnly?: boolean
}

type PendingDelete =
  | { type: "element"; id: string; message: string }
  | { type: "segment"; id: string; message: string }
  | { type: "gain"; id: string; message: string }

export function ProjectDesignWorkspace({
  project,
  companyId,
  readOnly = false,
}: ProjectDesignWorkspaceProps) {
  const [elements, setElements] = useState<ProjectDesignElement[]>([])
  const [segments, setSegments] = useState<ProjectDesignSegment[]>([])
  const [gains, setGains] = useState<ProjectDesignGain[]>([])
  const [tool, setTool] = useState<ProjectDesignTool>("select")
  const [selected, setSelected] = useState<ProjectDesignSelection>(null)
  const [drawingPoints, setDrawingPoints] = useState<
    Array<{ latitude: number; longitude: number }>
  >([])
  const [drawingOriginElementId, setDrawingOriginElementId] = useState<
    string | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mapViewOpen, setMapViewOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const snapshot = useMemo(
    () => ({ elements, segments, gains }),
    [elements, segments, gains]
  )

  const selectedElement = useMemo(
    () =>
      selected?.type === "element"
        ? (elements.find((item) => item.id === selected.id) ?? null)
        : null,
    [elements, selected]
  )
  const selectedSegment = useMemo(
    () =>
      selected?.type === "segment"
        ? (segments.find((item) => item.id === selected.id) ?? null)
        : null,
    [segments, selected]
  )
  const selectedGain = useMemo(
    () =>
      selected?.type === "gain"
        ? (gains.find((item) => item.id === selected.id) ?? null)
        : null,
    [gains, selected]
  )

  const loadDesign = useCallback(async () => {
    const result = await listProjectDesign(companyId, project.id)
    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudo cargar el diseño.")
      return
    }
    setElements(result.data.elements)
    setSegments(result.data.segments)
    setGains(result.data.gains)
    setError(null)
  }, [companyId, project.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await listProjectDesign(companyId, project.id)
      if (cancelled) return
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo cargar el diseño.")
      } else {
        setElements(result.data.elements)
        setSegments(result.data.segments)
        setGains(result.data.gains)
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [companyId, project.id])

  const persistFinishedSegment = useCallback(
    async (input: {
      geometry: Array<{ latitude: number; longitude: number }>
      originElementId: string | null
      destinationElementId: string | null
    }) => {
      const prepared = prepareProjectDesignSegmentDraft({
        companyId,
        projectCompanyId: companyId,
        projectId: project.id,
        geometry: input.geometry,
        originElementId: input.originElementId,
        destinationElementId: input.destinationElementId,
      })
      if (!prepared.ok) {
        setError(prepared.message)
        return
      }

      setBusy(true)
      const result = await createProjectDesignSegment(companyId, project.id, {
        ...prepared.payload,
        displayOrder: segments.length,
      })
      setBusy(false)
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo guardar el tramo.")
        return
      }

      setSegments((current) => [...current, result.data!])
      const cancelled = cancelDesignDrawing()
      setDrawingPoints(cancelled.drawingPoints)
      setDrawingOriginElementId(cancelled.drawingOriginElementId)
      setSelected({ type: "segment", id: result.data.id })
      setTool("select")
      setError(null)
    },
    [companyId, project.id, segments.length]
  )

  const finishDrawing = useCallback(async () => {
    if (readOnly) {
      const cancelled = cancelDesignDrawing()
      setDrawingPoints(cancelled.drawingPoints)
      setDrawingOriginElementId(cancelled.drawingOriginElementId)
      return
    }

    const resolved = resolveDrawingFinish({
      drawingPoints,
      originElementId: drawingOriginElementId,
      elements,
    })
    if (resolved.action !== "finish") {
      return
    }

    await persistFinishedSegment(resolved)
  }, [
    drawingOriginElementId,
    drawingPoints,
    elements,
    persistFinishedSegment,
    readOnly,
  ])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const cancelled = cancelDesignDrawing()
        setDrawingPoints(cancelled.drawingPoints)
        setDrawingOriginElementId(cancelled.drawingOriginElementId)
        if (isDesignDrawTool(tool) || isDesignPlacementTool(tool) || isDesignGainTool(tool)) {
          setTool("select")
        }
        return
      }
      if (event.key === "Enter" && isDesignDrawTool(tool)) {
        event.preventDefault()
        void finishDrawing()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [finishDrawing, tool])

  async function applyDrawingResult(
    result:
      | ReturnType<typeof resolveDrawingMapClick>
      | ReturnType<typeof resolveDrawingElementClick>
  ) {
    if (result.action === "ignore") {
      return
    }
    if (result.action === "add-vertex") {
      setDrawingPoints(result.drawingPoints)
      setDrawingOriginElementId(result.originElementId)
      setSelected(null)
      return
    }
    await persistFinishedSegment(result)
  }

  async function handleMapClick(latitude: number, longitude: number) {
    if (readOnly || busy) {
      return
    }

    const lat = roundCoordinate(latitude)
    const lng = roundCoordinate(longitude)

    if (isDesignDrawTool(tool)) {
      await applyDrawingResult(
        resolveDrawingMapClick({
          click: { latitude: lat, longitude: lng },
          drawingPoints,
          originElementId: drawingOriginElementId,
          elements,
        })
      )
      return
    }

    if (isDesignGainTool(tool)) {
      const placement = resolveGainPlacement({
        click: { latitude: lat, longitude: lng },
        segments,
      })
      if (!placement) {
        setError("Coloque la ganancia sobre una traza.")
        return
      }

      const segment = segments.find((item) => item.id === placement.segmentId)
      if (!segment) {
        setError("Coloque la ganancia sobre una traza.")
        return
      }

      const prepared = prepareProjectDesignGainDraft({
        companyId,
        projectCompanyId: companyId,
        projectId: project.id,
        segmentId: placement.segmentId,
        segmentProjectId: segment.projectId,
        latitude: placement.latitude,
        longitude: placement.longitude,
        gainM: DEFAULT_TRACE_GAIN_M,
      })
      if (!prepared.ok) {
        setError(prepared.message)
        return
      }

      setBusy(true)
      const result = await createProjectDesignGain(
        companyId,
        project.id,
        prepared.payload
      )
      setBusy(false)
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo crear la ganancia.")
        return
      }

      setGains((current) => [...current, result.data!])
      setSelected({ type: "gain", id: result.data.id })
      setTool("select")
      setError(null)
      return
    }

    if (!isDesignPlacementTool(tool)) {
      setSelected(null)
      return
    }

    const kind = tool === "add-nap" ? "nap" : "node"
    setBusy(true)
    const result = await createProjectDesignElement(companyId, project.id, {
      companyId,
      projectId: project.id,
      kind,
      name: suggestProjectDesignElementName(elements, kind),
      latitude: lat,
      longitude: lng,
      color: kind === "nap" ? DEFAULT_NAP_COLOR : DEFAULT_NODE_COLOR,
      icon: defaultIconForKind(kind),
      displayOrder: elements.filter((item) => item.kind === kind).length,
    })
    setBusy(false)
    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudo crear el elemento.")
      return
    }

    setElements((current) => [...current, result.data!])
    setSelected({ type: "element", id: result.data.id })
    setTool("select")
    setError(null)
  }

  async function handleConnectElement(elementId: string) {
    if (readOnly || busy || !isDesignDrawTool(tool)) {
      return
    }
    const element = elements.find((item) => item.id === elementId)
    if (!element) {
      return
    }
    await applyDrawingResult(
      resolveDrawingElementClick({
        element,
        drawingPoints,
        originElementId: drawingOriginElementId,
        elements,
      })
    )
  }

  async function handleElementDragEnd(
    id: string,
    latitude: number,
    longitude: number
  ) {
    if (readOnly) {
      return
    }
    const result = await updateProjectDesignElement(companyId, project.id, id, {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    })
    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudo mover el elemento.")
      await loadDesign()
      return
    }
    setElements((current) =>
      current.map((item) => (item.id === id ? result.data! : item))
    )
  }

  async function handleVertexDragEnd(
    segmentId: string,
    vertexIndex: number,
    latitude: number,
    longitude: number
  ) {
    if (readOnly) {
      return
    }
    const segment = segments.find((item) => item.id === segmentId)
    if (!segment) {
      return
    }
    const geometry = segment.geometry.map((point, index) =>
      index === vertexIndex
        ? {
            latitude: roundCoordinate(latitude),
            longitude: roundCoordinate(longitude),
          }
        : point
    )
    const associations = associateSegmentEndpoints({ geometry, elements })
    const result = await updateProjectDesignSegment(
      companyId,
      project.id,
      segmentId,
      {
        geometry,
        originElementId: associations.originElementId,
        destinationElementId: associations.destinationElementId,
      }
    )
    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudo actualizar el tramo.")
      await loadDesign()
      return
    }
    setSegments((current) =>
      current.map((item) => (item.id === segmentId ? result.data! : item))
    )
  }

  function requestDelete() {
    if (selectedElement) {
      const impact = resolveProjectDesignElementDeleteImpact(
        selectedElement.id,
        segments
      )
      setPendingDelete({
        type: "element",
        id: selectedElement.id,
        message: buildProjectDesignElementDeleteMessage(selectedElement, impact),
      })
      return
    }
    if (selectedSegment) {
      const attachedGainCount = gains.filter(
        (gain) => gain.segmentId === selectedSegment.id
      ).length
      setPendingDelete({
        type: "segment",
        id: selectedSegment.id,
        message: buildProjectDesignSegmentDeleteMessage(attachedGainCount),
      })
      return
    }
    if (selectedGain) {
      setPendingDelete({
        type: "gain",
        id: selectedGain.id,
        message: "¿Eliminar esta ganancia? El tramo se conserva.",
      })
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return
    }
    setBusy(true)
    if (pendingDelete.type === "element") {
      const result = await removeProjectDesignElement(
        companyId,
        project.id,
        pendingDelete.id
      )
      setBusy(false)
      if (result.error) {
        setError(result.error.message)
        setPendingDelete(null)
        return
      }
      setElements((current) =>
        current.filter((item) => item.id !== pendingDelete.id)
      )
      setSegments((current) =>
        current.map((segment) => ({
          ...segment,
          originElementId:
            segment.originElementId === pendingDelete.id
              ? null
              : segment.originElementId,
          destinationElementId:
            segment.destinationElementId === pendingDelete.id
              ? null
              : segment.destinationElementId,
        }))
      )
    } else if (pendingDelete.type === "segment") {
      const result = await removeProjectDesignSegment(
        companyId,
        project.id,
        pendingDelete.id
      )
      setBusy(false)
      if (result.error) {
        setError(result.error.message)
        setPendingDelete(null)
        return
      }
      setSegments((current) =>
        current.filter((item) => item.id !== pendingDelete.id)
      )
      setGains((current) =>
        current.filter((item) => item.segmentId !== pendingDelete.id)
      )
    } else {
      const result = await removeProjectDesignGain(
        companyId,
        project.id,
        pendingDelete.id
      )
      setBusy(false)
      if (result.error) {
        setError(result.error.message)
        setPendingDelete(null)
        return
      }
      setGains((current) =>
        current.filter((item) => item.id !== pendingDelete.id)
      )
    }
    setSelected(null)
    setPendingDelete(null)
    setError(null)
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)] flex-col gap-3 overflow-hidden sm:h-[calc(100dvh-8.5rem)] sm:max-h-[calc(100dvh-8.5rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 text-muted-foreground"
            asChild
          >
            <Link href={`/obras/${project.id}`}>
              <ArrowLeft className="size-4" />
              Volver a la obra
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Diseño de Obra
          </h1>
          <p className="text-sm text-muted-foreground">
            {project.code} · {project.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => setMapViewOpen(true)}
          >
            <Map className="size-4" />
            Ver mapa
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" />
            Exportar
          </Button>
          <ProjectDesignToolbar
            tool={tool}
            onToolChange={(next) => {
              setTool(next)
              const cancelled = cancelDesignDrawing()
              setDrawingPoints(cancelled.drawingPoints)
              setDrawingOriginElementId(cancelled.drawingOriginElementId)
              if (isDesignDrawTool(next) || isDesignPlacementTool(next) || isDesignGainTool(next)) {
                setSelected(null)
              }
            }}
            disabled={readOnly || busy || loading}
            drawingPointCount={drawingPoints.length}
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {readOnly ? (
        <Alert className="shrink-0">
          <AlertDescription>
            El diseño está en solo lectura.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(12rem,1fr)_minmax(13rem,40%)] gap-3 overflow-hidden md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)]">
        <div className="relative min-h-0 overflow-hidden">
          <ProjectDesignMapCanvas
            elements={elements}
            segments={segments}
            gains={gains}
            selected={selected}
            tool={tool}
            drawingPoints={drawingPoints}
            projectLatitude={project.latitude}
            projectLongitude={project.longitude}
            onMapClick={(lat, lng) => void handleMapClick(lat, lng)}
            onMapDoubleClick={() => void finishDrawing()}
            onConnectElement={(id) => void handleConnectElement(id)}
            onSelectElement={(id) => {
              setSelected({ type: "element", id })
              setTool("select")
            }}
            onSelectSegment={(id) => {
              setSelected({ type: "segment", id })
              setTool("select")
            }}
            onSelectGain={(id) => {
              setSelected({ type: "gain", id })
              setTool("select")
            }}
            onElementDragEnd={(id, lat, lng) =>
              void handleElementDragEnd(id, lat, lng)
            }
            onVertexDragEnd={(id, index, lat, lng) =>
              void handleVertexDragEnd(id, index, lat, lng)
            }
          />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProjectDesignSidebar
              elements={elements}
              segments={segments}
              gains={gains}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="min-h-0 max-h-[55%] shrink-0 overflow-y-auto border-t bg-card p-3">
            <ProjectDesignInspector
              element={selectedElement}
              segment={selectedSegment}
              gain={selectedGain}
              elements={elements}
              segments={segments}
              gains={gains}
              disabled={readOnly || busy}
              onSaveElement={async (input) => {
                if (!selectedElement) return false
                const result = await updateProjectDesignElement(
                  companyId,
                  project.id,
                  selectedElement.id,
                  input
                )
                if (result.error || !result.data) {
                  setError(result.error?.message ?? "No se pudo guardar.")
                  return false
                }
                setElements((current) =>
                  current.map((item) =>
                    item.id === selectedElement.id ? result.data! : item
                  )
                )
                setError(null)
                const next = resolveDesignInspectorAfterSave(true)
                setSelected(next.selected)
                setTool(next.tool)
                return true
              }}
              onSaveSegment={async (input) => {
                if (!selectedSegment) return false
                const result = await updateProjectDesignSegment(
                  companyId,
                  project.id,
                  selectedSegment.id,
                  input
                )
                if (result.error || !result.data) {
                  setError(result.error?.message ?? "No se pudo guardar.")
                  return false
                }
                setSegments((current) =>
                  current.map((item) =>
                    item.id === selectedSegment.id ? result.data! : item
                  )
                )
                setError(null)
                const next = resolveDesignInspectorAfterSave(true)
                setSelected(next.selected)
                setTool(next.tool)
                return true
              }}
              onSaveGain={async (input) => {
                if (!selectedGain) return false
                const result = await updateProjectDesignGain(
                  companyId,
                  project.id,
                  selectedGain.id,
                  input
                )
                if (result.error || !result.data) {
                  setError(result.error?.message ?? "No se pudo guardar.")
                  return false
                }
                setGains((current) =>
                  current.map((item) =>
                    item.id === selectedGain.id ? result.data! : item
                  )
                )
                setError(null)
                const next = resolveDesignInspectorAfterSave(true)
                setSelected(next.selected)
                setTool(next.tool)
                return true
              }}
              onDelete={requestDelete}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar del diseño</DialogTitle>
            <DialogDescription>{pendingDelete?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectDesignMapPreviewDialog
        open={mapViewOpen}
        onOpenChange={setMapViewOpen}
        snapshot={snapshot}
        projectLatitude={project.latitude}
        projectLongitude={project.longitude}
      />
      <ProjectDesignExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
        snapshot={snapshot}
      />
    </div>
  )
}
