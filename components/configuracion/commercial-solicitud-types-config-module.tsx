"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createCommercialSolicitudTypeBrowser,
  listCommercialSolicitudTypesBrowser,
  removeCommercialSolicitudTypeBrowser,
  updateCommercialSolicitudTypeBrowser,
} from "@/lib/supabase/commercial-solicitud-types.browser"
import type { CommercialSolicitudType } from "@/lib/types/commercial-solicitudes"
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

export function CommercialSolicitudTypesConfigModule() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [items, setItems] = useState<CommercialSolicitudType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [isSaving, setIsSaving] = useState(false)

  async function reload() {
    if (!companyId) return
    setIsLoading(true)
    const result = await listCommercialSolicitudTypesBrowser(companyId, {
      ensureDefaults: true,
    })
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
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) void reload()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isAuthReady])

  async function handleCreate() {
    if (!companyId || !name.trim()) return
    setIsSaving(true)
    const result = await createCommercialSolicitudTypeBrowser(companyId, {
      name: name.trim(),
      color,
    })
    setIsSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setName("")
    await reload()
  }

  async function handleToggle(item: CommercialSolicitudType) {
    if (!companyId) return
    await updateCommercialSolicitudTypeBrowser(companyId, item.id, {
      isActive: !item.isActive,
    })
    await reload()
  }

  async function handleColorChange(
    item: CommercialSolicitudType,
    nextColor: string
  ) {
    if (!companyId) return
    await updateCommercialSolicitudTypeBrowser(companyId, item.id, {
      color: nextColor,
    })
    await reload()
  }

  async function handleDelete(item: CommercialSolicitudType) {
    if (!companyId) return
    await removeCommercialSolicitudTypeBrowser(companyId, item.id)
    await reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tipos de Solicitud
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogo configurable de pedidos comerciales (Internet, TV, Combo,
          etc.).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="solicitud-type-name"
          >
            Nombre
          </label>
          <Input
            id="solicitud-type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej: Internet"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="solicitud-type-color"
          >
            Color
          </label>
          <Input
            id="solicitud-type-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-9 w-14 p-1"
          />
        </div>
        <Button
          type="button"
          className="gap-2"
          disabled={isSaving || !name.trim()}
          onClick={() => void handleCreate()}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[120px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Sin tipos configurados.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={item.color}
                        aria-label={`Color de ${item.name}`}
                        className="size-7 cursor-pointer rounded border bg-transparent p-0"
                        onChange={(event) =>
                          void handleColorChange(item, event.target.value)
                        }
                      />
                      <span>{item.name}</span>
                    </div>
                  </TableCell>
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
                        className="h-8"
                        onClick={() => void handleToggle(item)}
                      >
                        {item.isActive ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() => void handleDelete(item)}
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
    </div>
  )
}
