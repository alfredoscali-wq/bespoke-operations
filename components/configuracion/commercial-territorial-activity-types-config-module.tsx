"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createCommercialTerritorialActivityTypeBrowser,
  listCommercialTerritorialActivityTypesBrowser,
  removeCommercialTerritorialActivityTypeBrowser,
  updateCommercialTerritorialActivityTypeBrowser,
} from "@/lib/supabase/commercial-territorial-activity-types.browser"
import type { CommercialTerritorialActivityType } from "@/lib/types/commercial-territorial-activity"

const DEFAULT_COLORS = [
  "#64748b",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
]

export function CommercialTerritorialActivityTypesConfigModule() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [items, setItems] = useState<CommercialTerritorialActivityType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [isSaving, setIsSaving] = useState(false)

  async function reload() {
    if (!companyId) return
    setIsLoading(true)
    const result = await listCommercialTerritorialActivityTypesBrowser(companyId)
    if (result.error || !result.data) {
      setItems([])
      setError(result.error?.message ?? "No se pudieron cargar los tipos.")
    } else {
      setItems(result.data)
      setError(null)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!isAuthReady || !companyId) return
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isAuthReady])

  async function handleCreate() {
    if (!companyId || !name.trim()) return
    setIsSaving(true)
    const result = await createCommercialTerritorialActivityTypeBrowser(
      companyId,
      {
        name: name.trim(),
        color,
      }
    )
    setIsSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setName("")
    await reload()
  }

  async function handleToggle(item: CommercialTerritorialActivityType) {
    if (!companyId) return
    await updateCommercialTerritorialActivityTypeBrowser(companyId, item.id, {
      isActive: !item.isActive,
    })
    await reload()
  }

  async function handleColorChange(
    item: CommercialTerritorialActivityType,
    nextColor: string
  ) {
    if (!companyId) return
    await updateCommercialTerritorialActivityTypeBrowser(companyId, item.id, {
      color: nextColor,
    })
    await reload()
  }

  async function handleDelete(item: CommercialTerritorialActivityType) {
    if (!companyId) return
    await removeCommercialTerritorialActivityTypeBrowser(companyId, item.id)
    await reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tipos de Actividad Comercial
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogo de acciones territoriales (publicidad, visitas, relevamientos,
          etc.). Sin datos precargados: cada empresa define los suyos.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="territorial-type-name"
          >
            Nombre
          </label>
          <Input
            id="territorial-type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Folletos"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="territorial-type-color"
          >
            Color
          </label>
          <Input
            id="territorial-type-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-9 w-14 cursor-pointer p-1"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={isSaving || !name.trim()}
          onClick={() => void handleCreate()}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Orden</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-[160px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Cargando…
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Sin tipos configurados.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    {item.name}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="color"
                    value={item.color}
                    onChange={(event) =>
                      void handleColorChange(item, event.target.value)
                    }
                    className="h-8 w-12 cursor-pointer p-1"
                    aria-label={`Color de ${item.name}`}
                  />
                </TableCell>
                <TableCell>{item.sortOrder}</TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? "secondary" : "outline"}>
                    {item.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleToggle(item)}
                    >
                      {item.isActive ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void handleDelete(item)}
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
