"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createOperationalMotivo,
  listOperationalMotivos,
  patchOperationalMotivo,
  removeOperationalMotivo,
} from "@/lib/supabase/operational-control.browser"
import type {
  OperationalMotivo,
  OperationalMotivoKind,
} from "@/lib/types/operational-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function MotivosKindPanel({
  kind,
  title,
}: {
  kind: OperationalMotivoKind
  title: string
}) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [items, setItems] = useState<OperationalMotivo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function reload() {
    if (!companyId) return
    setIsLoading(true)
    const result = await listOperationalMotivos(companyId, kind)
    if (result.error || !result.data) {
      setItems([])
      setError(result.error?.message ?? "No se pudieron cargar los motivos.")
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
  }, [companyId, isAuthReady, kind])

  async function handleCreate() {
    if (!companyId || !label.trim()) return
    setIsSaving(true)
    const result = await createOperationalMotivo(companyId, {
      kind,
      label: label.trim(),
    })
    setIsSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setLabel("")
    await reload()
  }

  async function handleToggle(item: OperationalMotivo) {
    if (!companyId) return
    await patchOperationalMotivo(item.id, companyId, {
      isActive: !item.isActive,
    })
    await reload()
  }

  async function handleDelete(item: OperationalMotivo) {
    if (!companyId) return
    await removeOperationalMotivo(item.id, companyId)
    await reload()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">
          Motivos propios de la empresa. Se usan en los diálogos de OT.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Nuevo motivo"
          className="max-w-sm"
        />
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={isSaving || !label.trim()}
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
            <TableHead>Motivo</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-[140px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Cargando…
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Sin motivos configurados.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? "default" : "secondary"}>
                    {item.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleToggle(item)}
                    >
                      {item.isActive ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
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
  )
}

export function OperationalMotivosConfigModule() {
  const tabs = useMemo(
    () =>
      [
        {
          value: "cancelacion" as const,
          label: "Motivos de Cancelación",
        },
        {
          value: "reprogramacion" as const,
          label: "Motivos de Reprogramación",
        },
      ] as const,
    []
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Motivos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuración reutilizable de motivos de cancelación y
          reprogramación de Órdenes de Trabajo.
        </p>
      </div>

      <Tabs defaultValue="cancelacion">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <MotivosKindPanel kind={tab.value} title={tab.label} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
