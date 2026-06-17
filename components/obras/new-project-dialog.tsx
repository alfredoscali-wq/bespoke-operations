"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { ProjectSupervisorSelect } from "@/components/obras/project-supervisor-select"
import type { NewProjectInput, Project, ProjectType } from "@/lib/types/projects"
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

type NewProjectDialogProps = {
  onSubmit: (input: NewProjectInput) => void | Promise<void> | Promise<Project>
}

const emptyForm: NewProjectInput = {
  name: "",
  code: "",
  client: "",
  type: "fiber",
  location: "",
  description: "",
  startDate: "",
  endDate: "",
  supervisor: "",
}

export function NewProjectDialog({ onSubmit }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewProjectInput>(emptyForm)

  function updateField<K extends keyof NewProjectInput>(
    key: K,
    value: NewProjectInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    try {
      await onSubmit(form)
      setForm(emptyForm)
      setOpen(false)
    } catch (error) {
      console.error("[PROJECT CREATE]", error)
    }
  }

  const isValid =
    form.name.trim() !== "" &&
    form.code.trim() !== "" &&
    form.client.trim() !== "" &&
    form.location.trim() !== "" &&
    form.supervisor.trim() !== ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Nueva obra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva obra</DialogTitle>
          <DialogDescription>
            Registra un nuevo proyecto de infraestructura o telecomunicaciones.
          </DialogDescription>
        </DialogHeader>

        <form id="new-project-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nombre del proyecto</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Despliegue FTTH Zona Norte"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) => updateField("code", event.target.value)}
                placeholder="FO-2026-001"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Input
                id="client"
                value={form.client}
                onChange={(event) => updateField("client", event.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  updateField("type", value as ProjectType)
                }
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ProjectSupervisorSelect
              id="supervisor"
              value={form.supervisor}
              onValueChange={(value) => updateField("supervisor", value)}
            />

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="Monterrey, N.L. — Col. Mitras"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Alcance, entregables y consideraciones técnicas..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio (opcional)</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha estimada de fin (opcional)</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-project-form" disabled={!isValid}>
            Crear obra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
