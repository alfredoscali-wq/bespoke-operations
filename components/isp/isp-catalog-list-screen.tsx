"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

import {
  ISP_CATALOG_CATEGORIES,
  ISP_CATALOG_CUSTOMER_TYPE_LABELS,
  ISP_CATALOG_CUSTOMER_TYPES,
  ISP_CATALOG_TECHNOLOGIES,
} from "@/lib/isp/catalog-constants"
import {
  catalogCategoryLabel,
  catalogConnectionTypeLabel,
  catalogTechnologyLabel,
  catalogTvComponentListLabel,
  formatCatalogSpeedLabel,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import { IspCatalogDeleteButton } from "@/components/isp/isp-catalog-delete-dialog"
import { Badge } from "@/components/ui/badge"
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

function formatPrice(value: number | null | undefined, currency?: string) {
  if (value == null) return "—"
  const amount = `$ ${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
  return currency && currency !== "ARS" ? `${amount} ${currency}` : amount
}

export function IspCatalogListScreen() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [customerType, setCustomerType] = useState("all")
  const [technology, setTechnology] = useState("all")
  const [status, setStatus] = useState("all")
  const [items, setItems] = useState<IspCatalogItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      search,
      category,
      customerType,
      technology,
      status,
    })
    setLoading(true)
    fetch(`/api/isp/catalog?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          items?: IspCatalogItem[]
          message?: string
        }
        if (!body.success) {
          throw new Error(body.message ?? "No se pudo cargar el catálogo.")
        }
        setItems(body.items ?? [])
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setError(cause instanceof Error ? cause.message : "Error inesperado.")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [search, category, customerType, technology, status, reloadToken])

  const subtitle = useMemo(() => {
    if (loading) return "Cargando servicios..."
    return `${items.length} servicio${items.length === 1 ? "" : "s"}`
  }, [items.length, loading])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de servicios y planes comerciales del ISP.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/servicios/nuevo">
            <Plus className="size-4" />
            Nuevo Servicio
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar"
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {ISP_CATALOG_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {catalogCategoryLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={customerType} onValueChange={setCustomerType}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo de cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ISP_CATALOG_CUSTOMER_TYPES.map((item) => (
              <SelectItem key={item} value={item}>
                {ISP_CATALOG_CUSTOMER_TYPE_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={technology} onValueChange={setTechnology}>
          <SelectTrigger>
            <SelectValue placeholder="Tecnología" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {ISP_CATALOG_TECHNOLOGIES.map((item) => (
              <SelectItem key={item} value={item}>
                {catalogTechnologyLabel(item)}
              </SelectItem>
            ))}
            <SelectItem value="none">No aplica</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tecnología</TableHead>
              <TableHead>Velocidad</TableHead>
              <TableHead>Precio mensual</TableHead>
              <TableHead>TV</TableHead>
              <TableHead>Tipo de conexión</TableHead>
              <TableHead>Perfil técnico</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  No hay servicios para los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : null}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">
                  {item.code || "—"}
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {catalogCategoryLabel(item.category)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {catalogTechnologyLabel(
                    item.technicalProfile?.technology ?? item.technology
                  )}
                </TableCell>
                <TableCell>{formatCatalogSpeedLabel(item)}</TableCell>
                <TableCell>
                  {formatPrice(item.monthlyPrice, item.currency)}
                </TableCell>
                <TableCell>
                  {item.category === "tv"
                    ? "—"
                    : catalogTvComponentListLabel(item.tvPlan)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.allowedConnectionTypes.length > 0 ? (
                      item.allowedConnectionTypes.map((type) => (
                        <Badge key={type} variant="outline">
                          {catalogConnectionTypeLabel(type)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {item.technicalProfile?.code ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? "secondary" : "outline"}>
                    {item.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/servicios/${item.id}`}>Ver</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/servicios/${item.id}/editar`}>Editar</Link>
                    </Button>
                    <IspCatalogDeleteButton
                      item={item}
                      onDeleted={() => setReloadToken((token) => token + 1)}
                      onError={setError}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
