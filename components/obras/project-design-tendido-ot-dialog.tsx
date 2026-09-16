"use client"

import { useEffect, useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { ProjectTaskChecklistEditor } from "@/components/obras/project-task-checklist-editor"
import { LocationInput } from "@/components/location/location-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DiscardChangesDialog,
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCrewOptionLabel } from "@/lib/crews/origin"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import { hasCoordinates } from "@/lib/gps/coordinates"
import {
  formatGainMeters,
  formatPlannedLengthMeters,
} from "@/lib/gps/distance"
import { resolveLocationViaApi } from "@/lib/location/client/resolve-via-api"
import {
  TENDIDO_EMPTY_SELECTION_MESSAGE,
  TENDIDO_NO_TRACES_MESSAGE,
  listTendidoTraceOptions,
  resolveTendidoPlan,
  type TendidoPlan,
} from "@/lib/projects/design/tendido"
import { listProjectDesign } from "@/lib/supabase/project-design.browser"
import { TASK_PRIORITY_OPTIONS } from "@/lib/tasks/constants"
import {
  normalizeOperationalChecklistTemplate,
  type OperationalChecklistTemplateItem,
} from "@/lib/tasks/operational-checklist-template"
import type { Project } from "@/lib/types/projects"
import type { ProjectDesignSnapshot } from "@/lib/types/project-design"
import type { TaskPriority } from "@/lib/types/tasks"

type TendidoFormState = {
  title: string
  priority: TaskPriority
  crewId: string
  startDate: string
  dueDate: string
  sharedLocation: string
  latitude: number | null
  longitude: number | null
  observations: string
  operationalChecklistTemplate: OperationalChecklistTemplateItem[]
  segmentIds: string[]
}

export type TendidoOtCreatePayload = {
  title: string
  crewId: string
  priority: TaskPriority
  startDate: string
  dueDate: string
  latitude: number | null
  longitude: number | null
  observations: string
  operationalChecklistTemplate: OperationalChecklistTemplateItem[]
  plan: TendidoPlan
}

type ProjectDesignTendidoOtDialogProps = {
  open: boolean
  project: Pick<Project, "id">
  companyId: string
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (payload: TendidoOtCreatePayload) => Promise<boolean>
}

function emptyForm(): TendidoFormState {
  return {
    title: "Tendido",
    priority: "media",
    crewId: "",
    startDate: toLocalDateOnly(),
    dueDate: "",
    sharedLocation: "",
    latitude: null,
    longitude: null,
    observations: "",
    operationalChecklistTemplate: [],
    segmentIds: [],
  }
}

function formatGps(latitude: number | null, longitude: number | null): string {
  if (!hasCoordinates(latitude, longitude)) {
    return "Sin GPS"
  }
  return `${latitude!.toFixed(6)}, ${longitude!.toFixed(6)}`
}

export function ProjectDesignTendidoOtDialog({
  open,
  project,
  companyId,
  busy = false,
  onOpenChange,
  onCreate,
}: ProjectDesignTendidoOtDialogProps) {
  const { crews } = useCrews()
  const crewOptions = useMemo(
    () => getCrewsForTaskSelection(crews, null),
    [crews]
  )
  const [form, setForm] = useState<TendidoFormState>(emptyForm)
  const [baseline] = useState(form)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<ProjectDesignSnapshot | null>(null)
  const [loadingDesign, setLoadingDesign] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const traces = useMemo(
    () => listTendidoTraceOptions(snapshot, project.id),
    [snapshot, project.id]
  )
  const livePlan = useMemo(
    () =>
      resolveTendidoPlan({
        snapshot,
        projectId: project.id,
        segmentIds: form.segmentIds,
      }),
    [snapshot, project.id, form.segmentIds]
  )
  const disabled = busy || submitting || loadingDesign

  const {
    requestClose,
    forceClose,
    handleOpenChange,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({
    open,
    onOpenChange,
    isDirty: isFormStateDirty(form, baseline),
  })

  useEffect(() => {
    let cancelled = false
    void listProjectDesign(companyId, project.id).then((result) => {
      if (cancelled) {
        return
      }
      if (result.error || !result.data) {
        setError(
          result.error?.message ??
            "No se pudo cargar el Diseño de Obra."
        )
        setSnapshot({ elements: [], segments: [], gains: [] })
        setLoadingDesign(false)
        return
      }
      setSnapshot(result.data)
      setLoadingDesign(false)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, project.id])

  function updateField<K extends keyof TendidoFormState>(
    key: K,
    value: TendidoFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleSegment(segmentId: string, checked: boolean) {
    setForm((current) => {
      if (checked) {
        if (current.segmentIds.includes(segmentId)) {
          return current
        }
        return { ...current, segmentIds: [...current.segmentIds, segmentId] }
      }
      return {
        ...current,
        segmentIds: current.segmentIds.filter((id) => id !== segmentId),
      }
    })
  }

  async function resolveGps(): Promise<{
    latitude: number | null
    longitude: number | null
  }> {
    let latitude = form.latitude
    let longitude = form.longitude
    const sharedLocation = form.sharedLocation.trim()
    if (sharedLocation) {
      if (!hasCoordinates(latitude, longitude)) {
        const resolved = await resolveLocationViaApi(sharedLocation)
        latitude = resolved.latitude
        longitude = resolved.longitude
      }
    } else if (!hasCoordinates(latitude, longitude)) {
      latitude = null
      longitude = null
    }
    return { latitude, longitude }
  }

  async function handleCreate() {
    setError(null)
    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return
    }
    if (!form.crewId) {
      setError("La cuadrilla es obligatoria.")
      return
    }
    const selectedCrew = crewOptions.find((crew) => crew.id === form.crewId)
    const crewValidation = validateCrewAssignment(selectedCrew)
    if (!crewValidation.allowed) {
      setError(crewValidation.message ?? "Cuadrilla no disponible.")
      return
    }
    if (!form.startDate) {
      setError("La fecha de inicio es obligatoria.")
      return
    }
    if (form.dueDate && form.dueDate < form.startDate) {
      setError("El vencimiento no puede ser anterior al inicio.")
      return
    }

    setSubmitting(true)
    try {
      const latest = await listProjectDesign(companyId, project.id)
      if (latest.error || !latest.data) {
        setError(
          latest.error?.message ??
            "No se pudo obtener el diseño actual para crear la OT."
        )
        return
      }
      setSnapshot(latest.data)

      const plan = resolveTendidoPlan({
        snapshot: latest.data,
        projectId: project.id,
        segmentIds: form.segmentIds,
      })
      if (!plan.ok) {
        setError(plan.message)
        return
      }

      const gps = await resolveGps()
      const created = await onCreate({
        title: form.title.trim(),
        crewId: form.crewId,
        priority: form.priority,
        startDate: form.startDate,
        dueDate: form.dueDate.trim(),
        latitude: gps.latitude,
        longitude: gps.longitude,
        observations: form.observations.trim(),
        operationalChecklistTemplate: normalizeOperationalChecklistTemplate(
          form.operationalChecklistTemplate
        ),
        plan: plan.plan,
      })
      if (created) {
        forceClose()
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo crear la orden de trabajo de Tendido."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const plannedLengthM = livePlan.ok ? livePlan.plan.plannedLengthM : 0
  const traceGainM = livePlan.ok ? livePlan.plan.traceGainM : 0
  const plannedCableM = livePlan.ok ? livePlan.plan.plannedCableM : 0

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
          onRequestClose={requestClose}
          isDirty={isFormStateDirty(form, baseline)}
        >
          <DialogHeader>
            <DialogTitle>OT de Tendido</DialogTitle>
            <DialogDescription>
              Seleccioná una o más trazas de Tendido. La OT guarda referencias,
              no copia geometría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <section className="space-y-2">
              <p className="text-sm font-medium">Trazas de Tendido</p>
              {loadingDesign ? (
                <p className="text-sm text-muted-foreground">
                  Cargando trazas del diseño…
                </p>
              ) : traces.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {TENDIDO_NO_TRACES_MESSAGE}
                </p>
              ) : (
                <ul className="space-y-2">
                  {traces.map((trace) => {
                    const checked = form.segmentIds.includes(trace.id)
                    return (
                      <li key={trace.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 has-[[data-slot=checkbox][data-checked]]:border-primary">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(value) =>
                              toggleSegment(trace.id, value === true)
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {trace.label}
                            </span>
                            {trace.originDestination ? (
                              <span className="block text-xs text-muted-foreground">
                                {trace.originDestination}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formatPlannedLengthMeters(trace.plannedLengthM)}
                              {" · "}
                              {trace.gainCount === 1
                                ? "1 ganancia"
                                : `${trace.gainCount} ganancias`}
                              {" · "}
                              {formatGainMeters(trace.gainM)}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
              {traces.length > 0 && form.segmentIds.length === 0 ? (
                <p className="text-xs text-amber-800">
                  {TENDIDO_EMPTY_SELECTION_MESSAGE}
                </p>
              ) : null}
            </section>

            <section className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 px-3 py-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Metros de tendido</p>
                <p className="text-sm font-semibold">
                  {formatPlannedLengthMeters(plannedLengthM)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Ganancias de trazas
                </p>
                <p className="text-sm font-semibold">
                  {formatGainMeters(traceGainM)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cable planificado</p>
                <p className="text-sm font-semibold">
                  {formatPlannedLengthMeters(plannedCableM)}
                </p>
              </div>
            </section>

            <div className="space-y-1.5">
              <Label htmlFor="tendido-title">Título</Label>
              <Input
                id="tendido-title"
                value={form.title}
                disabled={disabled}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tendido-crew">Cuadrilla</Label>
                <select
                  id="tendido-crew"
                  value={form.crewId}
                  disabled={disabled}
                  onChange={(event) => updateField("crewId", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Seleccioná una cuadrilla</option>
                  {crewOptions.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {formatCrewOptionLabel(crew)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={form.priority}
                  disabled={disabled}
                  onValueChange={(value) =>
                    updateField("priority", value as TaskPriority)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tendido-start">Fecha inicio</Label>
                <Input
                  id="tendido-start"
                  type="date"
                  value={form.startDate}
                  disabled={disabled}
                  onChange={(event) =>
                    updateField("startDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tendido-due">Fecha vencimiento (opcional)</Label>
                <Input
                  id="tendido-due"
                  type="date"
                  value={form.dueDate}
                  disabled={disabled}
                  onChange={(event) =>
                    updateField("dueDate", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <LocationInput
                id="tendido-gps"
                label="GPS"
                value={form.sharedLocation}
                disabled={disabled}
                onChange={(value) => updateField("sharedLocation", value)}
                hint={`Actual: ${formatGps(form.latitude, form.longitude)}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tendido-notes">Observaciones</Label>
              <Textarea
                id="tendido-notes"
                value={form.observations}
                disabled={disabled}
                onChange={(event) =>
                  updateField("observations", event.target.value)
                }
              />
            </div>

            <ProjectTaskChecklistEditor
              items={form.operationalChecklistTemplate}
              disabled={disabled}
              onChange={(items) =>
                updateField("operationalChecklistTemplate", items)
              }
            />
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={requestClose}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={disabled || traces.length === 0}
              onClick={() => void handleCreate()}
            >
              {submitting ? "Creando…" : "Crear OT de Tendido"}
            </Button>
          </DialogFooter>
        </ProtectedFormDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
