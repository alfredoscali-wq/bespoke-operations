"use client"

import { useEffect, useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { defaultChecklist } from "@/components/obras/project-task-dialog"
import { useProjects } from "@/components/obras/projects-provider"
import type {
  Task,
  TaskOperationMode,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"
import { SUPERVISORS } from "@/lib/projects/constants"
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/lib/tasks/constants"
import {
  generateFieldServiceTaskCode,
  generateTaskCode,
} from "@/lib/tasks/utils"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TaskFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingTasks: Task[]
  onSubmit: (payload: {
    operationMode: TaskOperationMode
    code: string
    title: string
    description: string
    projectId?: string | null
    projectCode: string
    projectName: string
    customerCompany?: string
    customerName?: string
    customerPhone?: string
    serviceAddress?: string
    workOrderNumber?: string
    type: TaskType
    status: TaskStatus
    priority: TaskPriority
    supervisor: string
    crew: string
    startDate: string
    dueDate: string
    estimatedDuration: string
  }) => Promise<void>
}

type TaskFormState = {
  operationMode: TaskOperationMode
  projectId: string
  title: string
  description: string
  customerCompany: string
  customerName: string
  customerPhone: string
  serviceAddress: string
  workOrderNumber: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  supervisor: string
  crew: string
  startDate: string
  dueDate: string
  estimatedDuration: string
}

function buildDefaultForm(): TaskFormState {
  const today = new Date().toISOString().slice(0, 10)

  return {
    operationMode: "obra",
    projectId: "",
    title: "",
    description: "",
    customerCompany: "",
    customerName: "",
    customerPhone: "",
    serviceAddress: "",
    workOrderNumber: "",
    type: "maintenance",
    status: "pendiente",
    priority: "media",
    supervisor: SUPERVISORS[0] ?? "",
    crew: "",
    startDate: today,
    dueDate: today,
    estimatedDuration: "",
  }
}

export function TaskFormDialog({
  open,
  onOpenChange,
  existingTasks,
  onSubmit,
}: TaskFormDialogProps) {
  const { projects } = useProjects()
  const { crews } = useCrews()
  const [form, setForm] = useState<TaskFormState>(buildDefaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId),
    [form.projectId, projects]
  )

  useEffect(() => {
    if (!open) return

    setError(null)
    setForm({
      ...buildDefaultForm(),
      projectId: projects[0]?.id ?? "",
      supervisor: projects[0]?.supervisor ?? SUPERVISORS[0] ?? "",
      crew: crews[0]?.name ?? "",
      dueDate: projects[0]?.endDate ?? new Date().toISOString().slice(0, 10),
    })
  }, [open, projects, crews])

  useEffect(() => {
    if (form.operationMode !== "obra" || !selectedProject) return

    const today = new Date().toISOString().slice(0, 10)

    setForm((current) => ({
      ...current,
      supervisor: selectedProject.supervisor,
      dueDate: selectedProject.endDate || today,
      type: selectedProject.type,
    }))
  }, [form.operationMode, selectedProject])

  function updateField<K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError("El título es obligatorio.")
      return
    }

    if (!form.dueDate || !form.startDate) {
      setError("Las fechas de inicio y límite son obligatorias.")
      return
    }

    if (form.dueDate < form.startDate) {
      setError("La fecha límite no puede ser anterior a la fecha de inicio.")
      return
    }

    if (form.operationMode === "obra") {
      if (!form.projectId || !selectedProject) {
        setError("Seleccione una obra.")
        return
      }
    } else {
      if (!form.customerCompany.trim()) {
        setError("El cliente operativo es obligatorio.")
        return
      }

      if (!form.customerName.trim()) {
        setError("El cliente final es obligatorio.")
        return
      }

      if (!form.serviceAddress.trim()) {
        setError("La dirección es obligatoria.")
        return
      }

      if (!form.workOrderNumber.trim()) {
        setError("El número de orden es obligatorio.")
        return
      }
    }

    setIsSubmitting(true)

    try {
      const isObra = form.operationMode === "obra"
      const code = isObra
        ? generateTaskCode(selectedProject!.code, existingTasks)
        : generateFieldServiceTaskCode(existingTasks)

      await onSubmit({
        operationMode: form.operationMode,
        code,
        title: form.title.trim(),
        description: form.description.trim(),
        projectId: isObra ? selectedProject!.id : null,
        projectCode: isObra ? selectedProject!.code : "SERVICIO",
        projectName: isObra
          ? selectedProject!.name
          : form.customerCompany.trim(),
        customerCompany: isObra ? undefined : form.customerCompany.trim(),
        customerName: isObra ? undefined : form.customerName.trim(),
        customerPhone: isObra ? undefined : form.customerPhone.trim() || undefined,
        serviceAddress: isObra ? undefined : form.serviceAddress.trim(),
        workOrderNumber: isObra ? undefined : form.workOrderNumber.trim(),
        type: form.type,
        status: form.status,
        priority: form.priority,
        supervisor: form.supervisor,
        crew: form.crew,
        startDate: form.startDate,
        dueDate: form.dueDate,
        estimatedDuration: form.estimatedDuration.trim(),
      })

      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la tarea."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    form.title.trim() !== "" &&
    form.supervisor !== "" &&
    form.crew !== "" &&
    form.startDate !== "" &&
    form.dueDate !== "" &&
    (form.operationMode === "obra"
      ? form.projectId !== ""
      : form.customerCompany.trim() !== "" &&
        form.customerName.trim() !== "" &&
        form.serviceAddress.trim() !== "" &&
        form.workOrderNumber.trim() !== "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            Cree una tarea vinculada a una obra o un servicio de campo
            independiente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de tarea</Label>
            <div className="flex rounded-lg border bg-muted/40 p-0.5">
              <Button
                type="button"
                variant={form.operationMode === "obra" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 flex-1"
                onClick={() => updateField("operationMode", "obra")}
              >
                Obra
              </Button>
              <Button
                type="button"
                variant={
                  form.operationMode === "servicio" ? "secondary" : "ghost"
                }
                size="sm"
                className="h-8 flex-1"
                onClick={() => updateField("operationMode", "servicio")}
              >
                Servicio de Campo
              </Button>
            </div>
          </div>

          {form.operationMode === "obra" ? (
            <div className="space-y-2">
              <Label>Obra</Label>
              <Select
                value={form.projectId}
                onValueChange={(value) => updateField("projectId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar obra" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code} — {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-2">
                <Label htmlFor="customer-company">Cliente Operativo</Label>
                <Input
                  id="customer-company"
                  value={form.customerCompany}
                  onChange={(event) =>
                    updateField("customerCompany", event.target.value)
                  }
                  placeholder="Ej. Claro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-name">Cliente Final</Label>
                <Input
                  id="customer-name"
                  value={form.customerName}
                  onChange={(event) =>
                    updateField("customerName", event.target.value)
                  }
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Teléfono</Label>
                <Input
                  id="customer-phone"
                  value={form.customerPhone}
                  onChange={(event) =>
                    updateField("customerPhone", event.target.value)
                  }
                  placeholder="Ej. +54 11 5555-1234"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-address">Dirección</Label>
                <Input
                  id="service-address"
                  value={form.serviceAddress}
                  onChange={(event) =>
                    updateField("serviceAddress", event.target.value)
                  }
                  placeholder="Ej. Av. Colón 1234"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work-order-number">Número de Orden</Label>
                <Input
                  id="work-order-number"
                  value={form.workOrderNumber}
                  onChange={(event) =>
                    updateField("workOrderNumber", event.target.value)
                  }
                  placeholder="Ej. CLA-45872"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Ej. Instalar CTO"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Descripción</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Detalle de la actividad..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  updateField("priority", value as TaskPriority)
                }
              >
                <SelectTrigger className="w-full">
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

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  updateField("status", value as TaskStatus)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-start-date">Fecha de inicio</Label>
              <Input
                id="task-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due-date">Fecha límite</Label>
              <Input
                id="task-due-date"
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField("dueDate", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supervisor</Label>
              <Select
                value={form.supervisor}
                onValueChange={(value) => updateField("supervisor", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPERVISORS.map((supervisor) => (
                    <SelectItem key={supervisor} value={supervisor}>
                      {supervisor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cuadrilla</Label>
              <Select
                value={form.crew}
                onValueChange={(value) => updateField("crew", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {crews.map((crew) => (
                    <SelectItem key={crew.id} value={crew.name}>
                      {crew.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo técnico</Label>
            <Select
              value={form.type}
              onValueChange={(value) => updateField("type", value as TaskType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Guardando..." : "Crear tarea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { defaultChecklist as taskDefaultChecklist }
