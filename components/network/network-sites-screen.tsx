"use client"

import { useEffect, useState } from "react"

import { NetworkSubnav } from "@/components/network/network-subnav"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NETWORK_SITE_KINDS } from "@/lib/network/constants"
import {
  NETWORK_SITE_KIND_LABELS,
} from "@/lib/network/labels"
import type { NetworkSite } from "@/lib/network/types"

export function NetworkSitesScreen() {
  const [sites, setSites] = useState<NetworkSite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<(typeof NETWORK_SITE_KINDS)[number]>("pop")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)

  function load() {
    fetch("/api/network/sites")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          sites?: NetworkSite[]
          message?: string
        }
        if (!body.success) throw new Error(body.message)
        setSites(body.sites ?? [])
        setError(null)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los sitios."
        )
      })
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    setSaving(true)
    try {
      const response = await fetch("/api/network/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, address }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      setOpen(false)
      setName("")
      setAddress("")
      load()
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo crear el sitio."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sitios de red</h1>
          <p className="text-sm text-muted-foreground">
            POP, nodos, torres y demás infraestructura. No reemplaza al cliente.
          </p>
          <NetworkSubnav current="sites" />
        </div>
        <Button onClick={() => setOpen(true)}>Nuevo sitio</Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead>Agents</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No hay sitios de infraestructura.
              </TableCell>
            </TableRow>
          ) : (
            sites.map((site) => (
              <TableRow key={site.id}>
                <TableCell className="font-medium">{site.name}</TableCell>
                <TableCell>
                  <StatusBadge className={cn(STATUS_TONE_STYLES.blue)}>
                    {NETWORK_SITE_KIND_LABELS[site.kind]}
                  </StatusBadge>
                </TableCell>
                <TableCell>{site.address || "—"}</TableCell>
                <TableCell>{site.agentCount}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear sitio</DialogTitle>
            <DialogDescription>
              El sitio pertenece a tu empresa. Los agents se asocian después.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Select
              value={kind}
              onValueChange={(value) =>
                setKind(value as (typeof NETWORK_SITE_KINDS)[number])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {NETWORK_SITE_KINDS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {NETWORK_SITE_KIND_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Dirección (opcional)"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving || !name.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
