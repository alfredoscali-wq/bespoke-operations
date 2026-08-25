"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronDown,
  Eye,
  Headphones,
  MapPin,
  Network,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  User,
} from "lucide-react"

import { IspEmptyState } from "@/components/isp/isp-detail-ui"
import { IspTonedStatusBadge } from "@/components/isp/isp-status-badges"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ISP_CUSTOMER_LIST_EMPTY_MESSAGE } from "@/lib/isp/customer-list-load"
import {
  ISP_SUBSCRIBER_REMOVAL_CONFIRMATION,
  ISP_SUBSCRIBER_REMOVAL_HISTORY_NOTE,
  isIspSubscriberRemovalConfirmation,
  ispSubscriberRemovalLead,
} from "@/lib/isp/subscriber-removal"
import {
  formatIspAbonadoCode,
  formatIspConnectionCountLabel,
  formatIspServiceCountLabel,
  ispSubscriberListStatusView,
} from "@/lib/isp/subscriber-list-presentation"
import type { IspCustomerListItem } from "@/lib/isp/types"
import { cn } from "@/lib/utils"

export function CustomerSelectionCheckbox({
  checked,
  indeterminate,
  label,
  onCheckedChange,
}: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Checkbox
      checked={indeterminate ? "indeterminate" : checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
    />
  )
}

export function CustomerCountBadge({
  children,
}: {
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  )
}

export function CustomerStatusBadge({
  item,
}: {
  item: Pick<IspCustomerListItem, "listStatus" | "serviceCount">
}) {
  const status = ispSubscriberListStatusView(item)
  return (
    <IspTonedStatusBadge tone={status.tone}>{status.label}</IspTonedStatusBadge>
  )
}

function CustomerIconAction({
  label,
  onClick,
  href,
  destructive,
  children,
}: {
  label: string
  onClick?: () => void
  href?: string
  destructive?: boolean
  children: ReactNode
}) {
  const button = href ? (
    <Button asChild size="icon-sm" variant="ghost">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  ) : (
    <Button
      type="button"
      size="icon-sm"
      variant={destructive ? "destructive" : "ghost"}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function CustomerRowActions({
  item,
  canEdit,
  canAddService,
  canCreateAtencion,
  canRemove,
  onEdit,
  onAddService,
  onNewAtencion,
  onRemove,
}: {
  item: IspCustomerListItem
  canEdit: boolean
  canAddService: boolean
  canCreateAtencion: boolean
  canRemove: boolean
  onEdit: (item: IspCustomerListItem) => void
  onAddService: (item: IspCustomerListItem) => void
  onNewAtencion: (item: IspCustomerListItem) => void
  onRemove: (item: IspCustomerListItem) => void
}) {
  return (
    <div className="flex flex-nowrap items-center justify-end gap-0.5">
      <CustomerIconAction
        label="Ver abonado"
        href={`/clientes-360/${item.id}`}
      >
        <Eye className="size-3.5" />
      </CustomerIconAction>
      {canEdit ? (
        <CustomerIconAction
          label="Editar cliente"
          onClick={() => onEdit(item)}
        >
          <Pencil className="size-3.5" />
        </CustomerIconAction>
      ) : null}
      {canAddService ? (
        <CustomerIconAction
          label="Agregar servicio"
          onClick={() => onAddService(item)}
        >
          <Plus className="size-3.5" />
        </CustomerIconAction>
      ) : null}
      {canCreateAtencion ? (
        <CustomerIconAction
          label="Nueva atención"
          onClick={() => onNewAtencion(item)}
        >
          <Headphones className="size-3.5" />
        </CustomerIconAction>
      ) : null}
      {canRemove ? (
        <CustomerIconAction
          label="Eliminar abonado"
          destructive
          onClick={() => onRemove(item)}
        >
          <Trash2 className="size-3.5" />
        </CustomerIconAction>
      ) : null}
    </div>
  )
}

export function CustomerBulkActions({
  count,
  canCreateAtencion,
  onClear,
  onNewAtencion,
  onExport,
  onViewSelected,
}: {
  count: number
  canCreateAtencion: boolean
  onClear: () => void
  onNewAtencion: () => void
  onExport: () => void
  onViewSelected: () => void
}) {
  if (count === 0) return null

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
      <CustomerSelectionCheckbox
        checked
        label="Selección activa"
        onCheckedChange={(checked) => {
          if (!checked) onClear()
        }}
      />
      <p className="text-sm font-medium">
        {count} abonado{count === 1 ? "" : "s"} seleccionado{count === 1 ? "" : "s"}
      </p>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>
        Limpiar selección
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canCreateAtencion ? (
          <Button type="button" size="sm" variant="outline" onClick={onNewAtencion}>
            <Headphones className="size-3.5" />
            Nueva atención
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              Más acciones
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport}>
              Exportar seleccionados
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewSelected}>
              Ver seleccionados
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Más acciones próximamente</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function CustomerEmptyState({
  canImport,
}: {
  canImport: boolean
}) {
  return (
    <IspEmptyState
      icon={User}
      title={ISP_CUSTOMER_LIST_EMPTY_MESSAGE}
      description="Todavía no hay abonados ISP incorporados."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/clientes-360/nuevo">
              <Plus className="size-4" />
              + Nuevo Cliente
            </Link>
          </Button>
          {canImport ? (
            <Button asChild variant="outline">
              <Link href="/clientes-360/migracion">
                <Upload className="size-4" />
                Importar abonados
              </Link>
            </Button>
          ) : null}
        </div>
      }
    />
  )
}

export function CustomerTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-b-0"
          >
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function CustomerIdentity({ item }: { item: IspCustomerListItem }) {
  const code = formatIspAbonadoCode(item.externalCustomerCode)
  return (
    <div className="min-w-0">
      <Link
        href={`/clientes-360/${item.id}`}
        className="font-medium hover:underline"
      >
        {item.name}
      </Link>
      {code ? (
        <p className="text-xs text-muted-foreground">{code}</p>
      ) : null}
    </div>
  )
}

export function CustomerTable({
  items,
  selectedIds,
  headerState,
  canEdit,
  canAddService,
  canCreateAtencion,
  canRemove,
  onToggleAllVisible,
  onToggleOne,
  onEdit,
  onAddService,
  onNewAtencion,
  onRemove,
}: {
  items: IspCustomerListItem[]
  selectedIds: ReadonlySet<string>
  headerState: "none" | "some" | "all"
  canEdit: boolean
  canAddService: boolean
  canCreateAtencion: boolean
  canRemove: boolean
  onToggleAllVisible: (checked: boolean) => void
  onToggleOne: (item: IspCustomerListItem, checked: boolean) => void
  onEdit: (item: IspCustomerListItem) => void
  onAddService: (item: IspCustomerListItem) => void
  onNewAtencion: (item: IspCustomerListItem) => void
  onRemove: (item: IspCustomerListItem) => void
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <CustomerSelectionCheckbox
                  checked={headerState === "all"}
                  indeterminate={headerState === "some"}
                  label="Seleccionar todos"
                  onCheckedChange={onToggleAllVisible}
                />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">DNI/CUIT</TableHead>
              <TableHead>Servicios</TableHead>
              <TableHead>Conexiones</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Localidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const selected = selectedIds.has(item.id)
              return (
                <TableRow
                  key={item.id}
                  className={cn(selected && "bg-muted/40")}
                >
                  <TableCell>
                    <CustomerSelectionCheckbox
                      checked={selected}
                      label={`Seleccionar ${item.name}`}
                      onCheckedChange={(checked) => onToggleOne(item, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {item.name.trim().slice(0, 1).toUpperCase() || "?"}
                      </span>
                      <CustomerIdentity item={item} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {item.dni || "—"}
                  </TableCell>
                  <TableCell>
                    <CustomerCountBadge>
                      {formatIspServiceCountLabel(item.serviceCount)}
                    </CustomerCountBadge>
                  </TableCell>
                  <TableCell>
                    <CustomerCountBadge>
                      {formatIspConnectionCountLabel(item.connectionCount)}
                    </CustomerCountBadge>
                  </TableCell>
                  <TableCell>
                    <CustomerStatusBadge item={item} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {item.locality || "—"}
                  </TableCell>
                  <TableCell>
                    <CustomerRowActions
                      item={item}
                      canEdit={canEdit}
                      canAddService={canAddService}
                      canCreateAtencion={canCreateAtencion}
                      canRemove={canRemove}
                      onEdit={onEdit}
                      onAddService={onAddService}
                      onNewAtencion={onNewAtencion}
                      onRemove={onRemove}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {items.map((item) => {
          const selected = selectedIds.has(item.id)
          return (
            <article
              key={item.id}
              className={cn(
                "rounded-xl border border-border/70 bg-card p-4 shadow-sm",
                selected && "ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <CustomerSelectionCheckbox
                    checked={selected}
                    label={`Seleccionar ${item.name}`}
                    onCheckedChange={(checked) => onToggleOne(item, checked)}
                  />
                  <CustomerIdentity item={item} />
                </div>
                <CustomerRowActions
                  item={item}
                  canEdit={canEdit}
                  canAddService={canAddService}
                  canCreateAtencion={canCreateAtencion}
                  canRemove={canRemove}
                  onEdit={onEdit}
                  onAddService={onAddService}
                  onNewAtencion={onNewAtencion}
                  onRemove={onRemove}
                />
              </div>
              <div className="mt-3 space-y-2 pl-7">
                <CustomerStatusBadge item={item} />
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Package className="size-3.5" />
                  {formatIspServiceCountLabel(item.serviceCount)}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Network className="size-3.5" />
                  {formatIspConnectionCountLabel(item.connectionCount)}
                </p>
                {item.locality ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {item.locality}
                  </p>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function CustomerRemoveSubscriberDialog({
  open,
  item,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  open: boolean
  item: IspCustomerListItem | null
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [confirmation, setConfirmation] = useState("")
  const canSubmit =
    isIspSubscriberRemovalConfirmation(confirmation) && !isSubmitting

  useEffect(() => {
    if (open) setConfirmation("")
  }, [item?.id, open])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation("")
      onCancel()
    }
  }

  function handleCancel() {
    setConfirmation("")
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar abonado</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{ispSubscriberRemovalLead(item?.name ?? "")}</p>
              <p>{ISP_SUBSCRIBER_REMOVAL_HISTORY_NOTE}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Cliente</dt>
          <dd className="font-medium">{item?.name || "—"}</dd>
          <dt className="text-muted-foreground">DNI/CUIT</dt>
          <dd>{item?.dni || "—"}</dd>
          <dt className="text-muted-foreground">Servicios</dt>
          <dd>{item ? formatIspServiceCountLabel(item.serviceCount) : "—"}</dd>
          <dt className="text-muted-foreground">Conexiones</dt>
          <dd>
            {item ? formatIspConnectionCountLabel(item.connectionCount) : "—"}
          </dd>
        </dl>
        <div className="space-y-2">
          <Label htmlFor="isp-subscriber-remove-confirm">
            Escribí {ISP_SUBSCRIBER_REMOVAL_CONFIRMATION} para confirmar
          </Label>
          <Input
            id="isp-subscriber-remove-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={ISP_SUBSCRIBER_REMOVAL_CONFIRMATION}
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!canSubmit}
          >
            Eliminar abonado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CustomerBulkAtencionConfirmDialog({
  open,
  count,
  onCancel,
  onContinue,
}: {
  open: boolean
  count: number
  onCancel: () => void
  onContinue: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva atención para {count} abonados</DialogTitle>
          <DialogDescription>
            Se creará una atención para los {count} abonados seleccionados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={onContinue}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CustomerSelectedViewDialog({
  open,
  items,
  onClose,
}: {
  open: boolean
  items: IspCustomerListItem[]
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abonados seleccionados</DialogTitle>
          <DialogDescription>
            {items.length} abonado{items.length === 1 ? "" : "s"} en la selección.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/clientes-360/${item.id}`}
                className="font-medium hover:underline"
                onClick={onClose}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CustomerListError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-6 dark:border-amber-800/60 dark:bg-amber-950/40">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" />
        No pudimos cargar los abonados.
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}
