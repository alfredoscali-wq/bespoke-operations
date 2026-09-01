"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import type { SubscriberServiceSheetMode } from "@/components/isp/isp-subscriber-service-sheet"
import { IspConnectionDeleteButton } from "@/components/isp/isp-connection-delete-dialog"
import { IspCommercialStatusBadge, IspTechnicalStatusBadge } from "@/components/isp/isp-status-badges"
import { IspSubscriberServiceSheet } from "@/components/isp/isp-subscriber-service-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ISP_COMMERCIAL_STATUSES,
  ISP_CONNECTION_TYPES,
  ISP_TECHNICAL_STATUSES,
  ISP_TECHNOLOGIES,
} from "@/lib/isp/constants"
import {
  ISP_COMMERCIAL_STATUS_LABELS,
  ISP_CONNECTION_TYPE_LABELS,
  ISP_TECHNICAL_STATUS_LABELS,
  ISP_TECHNOLOGY_LABELS,
  formatIspTechnologyLabel,
} from "@/lib/isp/labels"
import type {
  IspConnectionDetail,
  IspConnectionListItem,
  IspService,
  IspServiceWithConnection,
  IspUnconnectedServiceOption,
} from "@/lib/isp/types"

export function IspConnectionsListScreen() {
  const [search, setSearch] = useState("")
  const [technology, setTechnology] = useState("all")
  const [connectionType, setConnectionType] = useState("all")
  const [commercialStatus, setCommercialStatus] = useState("all")
  const [technicalStatus, setTechnicalStatus] = useState("all")
  const [coreName, setCoreName] = useState("")
  const [items, setItems] = useState<IspConnectionListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [unconnected, setUnconnected] = useState<IspUnconnectedServiceOption[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [sheetService, setSheetService] =
    useState<IspServiceWithConnection | null>(null)
  const [sheetMode, setSheetMode] =
    useState<SubscriberServiceSheetMode>("create-connection")
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({
      search,
      technology,
      connectionType,
      commercialStatus,
      technicalStatus,
      coreName,
    })
    fetch(`/api/isp/connections?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          connections?: IspConnectionListItem[]
          message?: string
        }
        if (!body.success) throw new Error(body.message)
        setItems(body.connections ?? [])
        setError(null)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Error inesperado.")
      })
  }, [commercialStatus, connectionType, coreName, reloadKey, search, technicalStatus, technology])

  async function openNewConnection() {
    setPickerOpen(true)
    const response = await fetch("/api/isp/services?unconnected=true")
    const body = (await response.json()) as {
      success: boolean
      services?: IspUnconnectedServiceOption[]
      message?: string
    }
    if (!body.success) {
      setError(body.message ?? "No se pudieron cargar los servicios.")
      return
    }
    setUnconnected(body.services ?? [])
    setSelectedServiceId("")
  }

  async function continueNewConnection() {
    if (!selectedServiceId) {
      setError("Una conexión no puede existir sin un servicio.")
      return
    }
    const response = await fetch(`/api/isp/services/${selectedServiceId}`)
    const body = (await response.json()) as {
      success: boolean
      service?: IspService
      message?: string
    }
    if (!body.success || !body.service) {
      setError(body.message ?? "Servicio no encontrado.")
      return
    }
    setSheetService({
      ...body.service,
      catalogCategory: null,
      connection: null,
    })
    setSheetMode("create-connection")
    setPickerOpen(false)
    setSheetOpen(true)
  }

  async function openEditConnection(item: IspConnectionListItem) {
    const response = await fetch(`/api/isp/connections/${item.id}`)
    const body = (await response.json()) as {
      success: boolean
      detail?: IspConnectionDetail
      message?: string
    }
    if (!body.success || !body.detail) {
      setError(body.message ?? "Conexión no encontrada.")
      return
    }
    setSheetService({
      ...body.detail.service,
      catalogCategory: null,
      connection: body.detail.connection,
    })
    setSheetMode("edit-connection")
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conexiones</h1>
          <p className="text-sm text-muted-foreground">
            Inventario técnico ISP. El Core/MikroTik queda preparado, sin
            provisioning real.
          </p>
        </div>
        <Button type="button" onClick={() => void openNewConnection()}>
          + Nueva conexión
        </Button>
      </div>

      {pickerOpen ? (
        <div className="space-y-3 rounded-xl border border-border/70 p-4">
          <p className="text-sm font-medium">Seleccionar servicio contratado</p>
          {unconnected.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay servicios contratados sin conexión. Cree el servicio desde
              Clientes 360°.
            </p>
          ) : (
            <Select
              value={selectedServiceId || undefined}
              onValueChange={setSelectedServiceId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Servicio contratado" />
              </SelectTrigger>
              <SelectContent>
                {unconnected.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.customerName} · {option.planName}
                    {option.catalogCode ? ` · ${option.catalogCode}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selectedServiceId}
              onClick={() => void continueNewConnection()}
            >
              Continuar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Input
          placeholder="Cliente, plan, IP o core"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          value={technology}
          onChange={setTechnology}
          items={[["all", "Tecnología"], ...ISP_TECHNOLOGIES.map((item) => [item, ISP_TECHNOLOGY_LABELS[item]])]}
        />
        <FilterSelect
          value={connectionType}
          onChange={setConnectionType}
          items={[["all", "Tipo"], ...ISP_CONNECTION_TYPES.map((item) => [item, ISP_CONNECTION_TYPE_LABELS[item]])]}
        />
        <FilterSelect
          value={commercialStatus}
          onChange={setCommercialStatus}
          items={[["all", "Comercial"], ...ISP_COMMERCIAL_STATUSES.map((item) => [item, ISP_COMMERCIAL_STATUS_LABELS[item]])]}
        />
        <FilterSelect
          value={technicalStatus}
          onChange={setTechnicalStatus}
          items={[["all", "Técnico"], ...ISP_TECHNICAL_STATUSES.map((item) => [item, ISP_TECHNICAL_STATUS_LABELS[item]])]}
        />
        <Input
          placeholder="Core / MikroTik"
          value={coreName}
          onChange={(event) => setCoreName(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Tecnología</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Core</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Salud</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link className="font-medium hover:underline" href={`/conexiones/${item.id}`}>
                    {item.customerName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link className="hover:underline" href={`/clientes-360/${item.customerId}`}>
                    Ver cliente
                  </Link>
                </TableCell>
                <TableCell>{formatIspTechnologyLabel(item.technology)}</TableCell>
                <TableCell>{item.planName}</TableCell>
                <TableCell>{ISP_CONNECTION_TYPE_LABELS[item.connectionType]}</TableCell>
                <TableCell>{item.ipAddress || "Dinámica"}</TableCell>
                <TableCell>{item.coreName || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <IspCommercialStatusBadge status={item.commercialStatus} />
                    <IspTechnicalStatusBadge status={item.technicalStatus} />
                  </div>
                </TableCell>
                <TableCell>{item.healthLabel}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/conexiones/${item.id}`}>Ver</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void openEditConnection(item)}
                    >
                      Editar
                    </Button>
                    <IspConnectionDeleteButton
                      target={{
                        id: item.id,
                        customerName: item.customerName,
                        planName: item.planName,
                        technology: item.technology,
                      }}
                      onDeleted={() => setReloadKey((value) => value + 1)}
                      onError={setError}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {sheetService ? (
        <IspSubscriberServiceSheet
          open={sheetOpen}
          mode={sheetMode}
          customerId={sheetService.customerId}
          service={sheetService}
          onClose={() => {
            setSheetOpen(false)
            setSheetService(null)
          }}
          onSaved={() => setReloadKey((value) => value + 1)}
        />
      ) : null}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (value: string) => void
  items: Array<string[] | [string, string]>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(([itemValue, label]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
