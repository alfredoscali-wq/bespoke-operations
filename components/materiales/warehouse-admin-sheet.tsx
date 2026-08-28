"use client"

import { useEffect, useState } from "react"

import { MaterialsSheetShell } from "@/components/materiales/materials-sheet-shell"
import type { Warehouse } from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type WarehouseAdminSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function WarehouseAdminSheet({
  open,
  onOpenChange,
  onChanged,
}: WarehouseAdminSheetProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function loadWarehouses() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/materiales/warehouses")
      const body = (await response.json()) as {
        success: boolean
        warehouses?: Warehouse[]
        message?: string
      }
      if (!response.ok || !body.success) {
        setError(body.message ?? "No se pudieron cargar los depósitos.")
        return
      }
      setWarehouses(body.warehouses ?? [])
    } catch {
      setError("Error de conexión al cargar depósitos.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadWarehouses()
      setNewName("")
      setEditingId(null)
      setEditingName("")
    }
  }, [open])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) {
      setError("Indique un nombre para el depósito.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/materiales/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!response.ok || !body.success) {
        setError(body.message ?? "No se pudo crear el depósito.")
        return
      }
      setNewName("")
      await loadWarehouses()
      onChanged()
    } catch {
      setError("Error de conexión al crear el depósito.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveEdit(warehouseId: string) {
    const name = editingName.trim()
    if (!name) {
      setError("El nombre no puede estar vacío.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/materiales/warehouses/${warehouseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!response.ok || !body.success) {
        setError(body.message ?? "No se pudo actualizar el depósito.")
        return
      }
      setEditingId(null)
      await loadWarehouses()
      onChanged()
    } catch {
      setError("Error de conexión al actualizar el depósito.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(warehouse: Warehouse, active: boolean) {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/materiales/warehouses/${warehouse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!response.ok || !body.success) {
        setError(body.message ?? "No se pudo actualizar el depósito.")
        return
      }
      await loadWarehouses()
      onChanged()
    } catch {
      setError("Error de conexión al actualizar el depósito.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <MaterialsSheetShell
      open={open}
      onOpenChange={onOpenChange}
      title="Depósitos"
      description="Administre los depósitos de inventario de la empresa."
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="new-warehouse-name">Nuevo depósito</Label>
          <div className="flex gap-2">
            <Input
              id="new-warehouse-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del depósito"
            />
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isSaving || !newName.trim()}
            >
              Crear
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Depósitos registrados</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay depósitos. Cree el primero para comenzar.
            </p>
          ) : (
            warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                className="rounded-lg border p-3 space-y-3"
              >
                {editingId === warehouse.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSaveEdit(warehouse.id)}
                      disabled={isSaving}
                    >
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{warehouse.name}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(warehouse.id)
                        setEditingName(warehouse.name)
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {warehouse.active ? "Activo" : "Inactivo"}
                  </span>
                  <Checkbox
                    checked={warehouse.active}
                    onCheckedChange={(checked) =>
                      handleToggleActive(warehouse, checked === true)
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}
      </div>
    </MaterialsSheetShell>
  )
}
