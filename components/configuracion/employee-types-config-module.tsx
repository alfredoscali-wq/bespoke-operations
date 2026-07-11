"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Plus } from "lucide-react"

import { EmployeeTypeFormSheet } from "@/components/configuracion/employee-type-form-sheet"
import { useEmployeeTypes } from "@/components/configuracion/use-employee-types"
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
import type {
  EmployeeTypeCatalog,
  EmployeeTypeCatalogInput,
} from "@/lib/types/employee-types"

type EmployeeTypesConfigModuleProps = {
  readOnly?: boolean
}

export function EmployeeTypesConfigModule({
  readOnly = false,
}: EmployeeTypesConfigModuleProps) {
  const { items, isLoading, isSaving, error, createItem, updateItem } =
    useEmployeeTypes()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create")
  const [editTarget, setEditTarget] = useState<EmployeeTypeCatalog | null>(null)

  function openCreateSheet() {
    setSheetMode("create")
    setEditTarget(null)
    setSheetOpen(true)
  }

  function openEditSheet(record: EmployeeTypeCatalog) {
    setSheetMode("edit")
    setEditTarget(record)
    setSheetOpen(true)
  }

  async function handleSubmit(input: EmployeeTypeCatalogInput) {
    if (sheetMode === "create") {
      const result = await createItem(input)
      if (!result.success) {
        throw new Error(result.message)
      }
      return
    }

    if (!editTarget) {
      throw new Error("No se encontró el tipo de empleado a editar.")
    }

    const result = await updateItem(editTarget.id, input)
    if (!result.success) {
      throw new Error(result.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tipos de empleados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure la clasificación de personal de su empresa para RRHH y
            operaciones.
          </p>
        </div>

        {!readOnly ? (
          <Button className="gap-2" onClick={openCreateSheet}>
            <Plus className="size-4" />
            Nuevo tipo
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
          Cargando tipos de empleado...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            Todavía no hay tipos de empleado configurados
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cree el primero para clasificar su personal en RRHH.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[70px] text-right">Orden</TableHead>
                {!readOnly ? <TableHead className="w-[60px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="max-w-md text-sm text-muted-foreground">
                    {item.description?.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {item.sortOrder}
                  </TableCell>
                  {!readOnly ? (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditSheet(item)}>
                            <Pencil className="size-4" />
                            Editar
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
      )}

      <EmployeeTypeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        record={editTarget ?? undefined}
        isSubmitting={isSaving}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
