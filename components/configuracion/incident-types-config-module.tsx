"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { IncidentTypeDeleteDialog } from "@/components/configuracion/incident-type-delete-dialog"
import { IncidentTypeFormSheet } from "@/components/configuracion/incident-type-form-sheet"
import { useIncidentTypes } from "@/components/configuracion/use-incident-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { IncidentType, IncidentTypeInput } from "@/lib/types/incident-types"

type IncidentTypesConfigModuleProps = {
  readOnly?: boolean
}

function BooleanCell({ value }: { value: boolean }) {
  return (
    <span className="text-sm text-muted-foreground">{value ? "Sí" : "No"}</span>
  )
}

function ColorCell({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-4 rounded-full border"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-mono text-xs text-muted-foreground">{color}</span>
    </div>
  )
}

export function IncidentTypesConfigModule({
  readOnly = false,
}: IncidentTypesConfigModuleProps) {
  const {
    items,
    isLoading,
    isSaving,
    error,
    createItem,
    updateItem,
    deleteItem,
    getUsageCount,
  } = useIncidentTypes()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create")
  const [editTarget, setEditTarget] = useState<IncidentType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IncidentType | null>(null)

  function openCreateSheet() {
    setSheetMode("create")
    setEditTarget(null)
    setSheetOpen(true)
  }

  function openEditSheet(record: IncidentType) {
    setSheetMode("edit")
    setEditTarget(record)
    setSheetOpen(true)
  }

  async function handleSubmit(input: IncidentTypeInput) {
    if (sheetMode === "create") {
      const result = await createItem(input)
      if (!result.success) {
        throw new Error(result.message)
      }
      return
    }

    if (!editTarget) {
      throw new Error("No se encontró el tipo de incidencia a editar.")
    }

    const result = await updateItem(editTarget.id, input)
    if (!result.success) {
      throw new Error(result.message)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return
    }

    const result = await deleteItem(deleteTarget.id)
    if (!result.success) {
      throw new Error(result.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tipos de Incidencia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina qué incidencias pueden reportar sus cuadrillas durante la
            ejecución de una Orden de Trabajo.
          </p>
        </div>

        {!readOnly ? (
          <Button className="gap-2" onClick={openCreateSheet}>
            <Plus className="size-4" />
            Nueva Incidencia
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
          Cargando tipos de incidencia...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            Todavía no hay tipos de incidencia configurados
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cree el primero para que Field Agent pueda utilizarlo en futuras
            versiones.
          </p>
          {!readOnly ? (
            <Button className="mt-4 gap-2" onClick={openCreateSheet}>
              <Plus className="size-4" />
              Nueva Incidencia
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Pausa la OT</TableHead>
                  <TableHead>Requiere intervención del supervisor</TableHead>
                  <TableHead>Notifica Supervisor</TableHead>
                  <TableHead>Estado</TableHead>
                  {!readOnly ? (
                    <TableHead className="w-[70px]">Acciones</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="min-w-[160px]">
                        <p className="font-medium">{item.name}</p>
                        {item.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ColorCell color={item.color} />
                    </TableCell>
                    <TableCell>
                      <BooleanCell value={item.pausesWorkOrder} />
                    </TableCell>
                    <TableCell>
                      <BooleanCell value={item.requiresSupervisorIntervention} />
                    </TableCell>
                    <TableCell>
                      <BooleanCell value={item.notifySupervisor} />
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge variant="default">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    {!readOnly ? (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Acciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditSheet(item)}>
                              <Pencil className="size-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="size-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!readOnly ? (
        <>
          <IncidentTypeFormSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            mode={sheetMode}
            record={editTarget ?? undefined}
            isSubmitting={isSaving}
            onSubmit={handleSubmit}
          />

          <IncidentTypeDeleteDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteTarget(null)
              }
            }}
            record={deleteTarget}
            onConfirm={handleDelete}
            getUsageCount={getUsageCount}
          />
        </>
      ) : null}
    </div>
  )
}
