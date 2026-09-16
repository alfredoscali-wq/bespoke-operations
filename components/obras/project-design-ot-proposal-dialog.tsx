"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { ProjectTaskChecklistEditor } from "@/components/obras/project-task-checklist-editor"
import { Button } from "@/components/ui/button"
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
import { LocationInput } from "@/components/location/location-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatGainMeters } from "@/lib/gps/distance"
import { hasCoordinates } from "@/lib/gps/coordinates"
import { resolveLocationViaApi } from "@/lib/location/client/resolve-via-api"
import {
  formatCrewOptionLabel,
} from "@/lib/crews/origin"
import {
  getCrewsForTaskSelection,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import {
  buildProposalEditPatch,
  canCancelProjectDesignOtProposal,
  canCreateObraTaskFromProposal,
  formatProjectDesignOtProposalStatusLabel,
  formatProjectDesignOtWorkTypeLabel,
  listProposalCreateMissingFields,
} from "@/lib/projects/design/ot-proposals"
import { formatProjectDesignKindLabel } from "@/lib/projects/design/labels"
import { TASK_PRIORITY_OPTIONS } from "@/lib/tasks/constants"
import {
  normalizeOperationalChecklistTemplate,
  type OperationalChecklistTemplateItem,
} from "@/lib/tasks/operational-checklist-template"
import type {
  ProjectDesignOtProposal,
  ProjectDesignOtWorkType,
} from "@/lib/types/project-design-ot"
import type { TaskPriority } from "@/lib/types/tasks"
import { Badge } from "@/components/ui/badge"

type ProposalFormState = {
  title: string
  workType: ProjectDesignOtWorkType
  priority: TaskPriority | ""
  crewId: string
  startDate: string
  dueDate: string
  sharedLocation: string
  latitude: number | null
  longitude: number | null
  observations: string
  operationalChecklistTemplate: OperationalChecklistTemplateItem[]
}

type ProjectDesignOtProposalDialogProps = {
  open: boolean
  proposal: ProjectDesignOtProposal | null
  taskCode?: string | null
  disabled?: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (proposal: ProjectDesignOtProposal) => Promise<boolean>
  onCreateOt: (proposal: ProjectDesignOtProposal) => Promise<boolean>
  onCancelProposal: (proposal: ProjectDesignOtProposal) => Promise<boolean>
}

function buildForm(proposal: ProjectDesignOtProposal): ProposalFormState {
  return {
    title: proposal.title,
    workType: proposal.workType === "nap" || proposal.workType === "node"
      ? proposal.workType
      : proposal.sourceElementKind,
    priority: proposal.priority ?? "",
    crewId: proposal.crewId ?? "",
    startDate: proposal.startDate ?? "",
    dueDate: proposal.dueDate ?? "",
    sharedLocation: "",
    latitude: proposal.latitude,
    longitude: proposal.longitude,
    observations: proposal.observations,
    operationalChecklistTemplate: normalizeOperationalChecklistTemplate(
      proposal.operationalChecklistTemplate ?? [],
      { dropEmptyTitles: false }
    ),
  }
}

function formatGps(latitude: number | null, longitude: number | null): string {
  if (!hasCoordinates(latitude, longitude)) {
    return "Sin GPS"
  }
  return `${latitude!.toFixed(6)}, ${longitude!.toFixed(6)}`
}

export function ProjectDesignOtProposalDialog({
  open,
  proposal,
  taskCode,
  disabled = false,
  busy = false,
  onOpenChange,
  onSave,
  onCreateOt,
  onCancelProposal,
}: ProjectDesignOtProposalDialogProps) {
  const { crews } = useCrews()
  const crewOptions = useMemo(
    () => getCrewsForTaskSelection(crews, proposal?.crewId),
    [crews, proposal?.crewId]
  )
  const [form, setForm] = useState<ProposalFormState>(() =>
    proposal ? buildForm(proposal) : {
      title: "",
      workType: "node",
      priority: "",
      crewId: "",
      startDate: "",
      dueDate: "",
      sharedLocation: "",
      latitude: null,
      longitude: null,
      observations: "",
      operationalChecklistTemplate: [],
    }
  )
  const [baseline, setBaseline] = useState(form)
  const [error, setError] = useState<string | null>(null)

  const { requestClose, forceClose, handleOpenChange, discardOpen, setDiscardOpen, confirmDiscard } = useProtectedFormDialog({
    open,
    onOpenChange,
    isDirty: isFormStateDirty(form, baseline),
  })

  if (!proposal) {
    return null
  }

  const created = proposal.status === "created" || Boolean(proposal.taskId)
  const cancelled = proposal.status === "cancelled"
  const readOnly = disabled || created || cancelled
  const draftLike = {
    ...proposal,
    title: form.title,
    crewId: form.crewId || null,
    startDate: form.startDate || null,
    dueDate: form.dueDate || null,
  }
  const missing = listProposalCreateMissingFields(draftLike)

  function updateField<K extends keyof ProposalFormState>(
    key: K,
    value: ProposalFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
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

  async function handleSave(): Promise<boolean> {
    if (!proposal || readOnly) return false
    setError(null)
    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return false
    }
    const gps = await resolveGps()
    try {
      const patch = buildProposalEditPatch(proposal, {
        title: form.title,
        workType: form.workType,
        priority: form.priority || null,
        crewId: form.crewId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        latitude: gps.latitude,
        longitude: gps.longitude,
        observations: form.observations,
        operationalChecklistTemplate: normalizeOperationalChecklistTemplate(
          form.operationalChecklistTemplate
        ),
      })
      const nextForm: ProposalFormState = {
        ...form,
        title: form.title.trim(),
        latitude: gps.latitude,
        longitude: gps.longitude,
      }
      const saved = await onSave({
        ...proposal,
        ...patch,
        ...gps,
        title: nextForm.title,
        operationalChecklistTemplate: nextForm.operationalChecklistTemplate,
      })
      if (saved) {
        setForm(nextForm)
        setBaseline(nextForm)
      }
      return saved
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar la preliminar."
      )
      return false
    }
  }

  async function handleCreate() {
    if (!proposal) return
    const selectedCrew = crewOptions.find((crew) => crew.id === form.crewId)
    if (form.crewId) {
      const crewValidation = validateCrewAssignment(selectedCrew)
      if (!crewValidation.allowed) {
        setError(crewValidation.message ?? "Cuadrilla no disponible.")
        return
      }
    }
    const gps = await resolveGps()
    const next: ProjectDesignOtProposal = {
      ...proposal,
      title: form.title.trim(),
      workType: form.workType,
      priority: form.priority || null,
      crewId: form.crewId || null,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      latitude: gps.latitude,
      longitude: gps.longitude,
      observations: form.observations.trim(),
      operationalChecklistTemplate: normalizeOperationalChecklistTemplate(
        form.operationalChecklistTemplate
      ),
    }
    if (!canCreateObraTaskFromProposal(next)) {
      const fields = listProposalCreateMissingFields(next)
      setError(
        fields.length
          ? `Falta completar: ${fields.join(", ")}.`
          : "No se puede crear la OT desde esta preliminar."
      )
      return
    }
    try {
      const saved = await onSave(next)
      if (!saved) return
      const createdOt = await onCreateOt(next)
      if (createdOt) {
        forceClose()
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo crear la OT desde esta preliminar."
      )
    }
  }

  async function handleCancel() {
    if (!proposal) return
    try {
      const cancelledOk = await onCancelProposal(proposal)
      if (cancelledOk) {
        forceClose()
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cancelar la preliminar."
      )
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ProtectedFormDialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onRequestClose={requestClose}
        isDirty={isFormStateDirty(form, baseline)}
      >
        <DialogHeader>
          <DialogTitle>OT preliminar</DialogTitle>
          <DialogDescription>
            Revisá los datos del diseño antes de crear la OT real. El mapa de
            Diseño no se modifica desde acá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Preliminar</Badge>
            <Badge variant={created ? "secondary" : "outline"}>
              {formatProjectDesignOtProposalStatusLabel(proposal.status)}
            </Badge>
            {created && taskCode ? (
              <span className="font-mono text-xs text-primary">OT: {taskCode}</span>
            ) : null}
          </div>

          <section className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Origen del diseño</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                Elemento: {proposal.designName || "—"} ·{" "}
                {formatProjectDesignKindLabel(proposal.sourceElementKind)}
              </li>
              <li>Tipo: {formatProjectDesignKindLabel(proposal.sourceElementKind)}</li>
              <li>Ganancia planificada: {formatGainMeters(proposal.designGainM)}</li>
              <li>
                Color: {proposal.designColor || "—"} · Icono:{" "}
                {proposal.designIcon || "—"}
              </li>
            </ul>
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!created && missing.length > 0 ? (
            <p className="text-xs text-amber-800">
              Para crear la OT falta: {missing.join(", ")}.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="proposal-title">Título</Label>
            <Input
              id="proposal-title"
              value={form.title}
              disabled={readOnly || busy}
              onChange={(event) => updateField("title", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-type">Tipo</Label>
              <select
                id="proposal-type"
                value={form.workType}
                disabled={readOnly || busy}
                onChange={(event) =>
                  updateField(
                    "workType",
                    event.target.value as ProjectDesignOtWorkType
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="node">
                  {formatProjectDesignOtWorkTypeLabel("node")}
                </option>
                <option value="nap">
                  {formatProjectDesignOtWorkTypeLabel("nap")}
                </option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select
                value={form.priority || "none"}
                disabled={readOnly || busy}
                onValueChange={(value) =>
                  updateField(
                    "priority",
                    value === "none" ? "" : (value as TaskPriority)
                  )
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sin prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin prioridad</SelectItem>
                  {TASK_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proposal-crew">Cuadrilla</Label>
            <select
              id="proposal-crew"
              value={form.crewId}
              disabled={readOnly || busy}
              onChange={(event) => updateField("crewId", event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Sin cuadrilla</option>
              {crewOptions.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {formatCrewOptionLabel(crew)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-start">Fecha inicio</Label>
              <Input
                id="proposal-start"
                type="date"
                value={form.startDate}
                disabled={readOnly || busy}
                onChange={(event) => updateField("startDate", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proposal-due">Fecha vencimiento (opcional)</Label>
              <Input
                id="proposal-due"
                type="date"
                value={form.dueDate}
                disabled={readOnly || busy}
                onChange={(event) => updateField("dueDate", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <LocationInput
              id="proposal-gps"
              label="GPS"
              value={form.sharedLocation}
              disabled={readOnly || busy}
              onChange={(value) => updateField("sharedLocation", value)}
              hint={`Actual: ${formatGps(form.latitude, form.longitude)}`}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proposal-notes">Observaciones</Label>
            <Textarea
              id="proposal-notes"
              value={form.observations}
              disabled={readOnly || busy}
              onChange={(event) => updateField("observations", event.target.value)}
              rows={2}
            />
          </div>

          <ProjectTaskChecklistEditor
            items={form.operationalChecklistTemplate}
            disabled={readOnly || busy}
            onChange={(items) =>
              updateField("operationalChecklistTemplate", items)
            }
          />
        </div>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {canCancelProjectDesignOtProposal(proposal) ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => void handleCancel()}
              >
                Cancelar preliminar
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {created && proposal.taskId ? (
              <Button type="button" asChild>
                <Link href={`/tareas/${proposal.taskId}`}>Ver OT</Link>
              </Button>
            ) : null}
            {!created && !cancelled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || readOnly}
                  onClick={() => void handleSave()}
                >
                  Guardar
                </Button>
                <Button
                  type="button"
                  disabled={busy || readOnly}
                  onClick={() => void handleCreate()}
                >
                  Crear OT
                </Button>
              </>
            ) : null}
          </div>
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
