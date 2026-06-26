"use client"

import Link from "next/link"
import { Archive, CheckCircle2, Eye, MoreHorizontal, Pencil, ShieldAlert, Trash2 } from "lucide-react"

import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { CUSTOMER_QUICK_FILTER_LABELS } from "@/lib/customers/customer-operational"
import {
  formatValidationStatusLabel,
  validationStatusBadgeClassName,
  validationStatusDotClassName,
} from "@/lib/customers/customer-validation"
import { formatCustomerTechnologyLabel } from "@/lib/customers/format"
import type { CustomerListRow } from "@/lib/types/customers"
import type { CustomerQuickFilter } from "@/lib/customers/customer-operational"

type CustomersListProps = {
  customers: CustomerListRow[]
  quickFilter: CustomerQuickFilter
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  onEdit: (customer: CustomerListRow) => void
  onArchive: (customer: CustomerListRow) => void
  onDelete: (customer: CustomerListRow) => void
  onMarkActive: (customer: CustomerListRow) => void
  onPermanentDelete?: (customer: CustomerListRow) => void
}

export function CustomersList({
  customers,
  quickFilter,
  selectedIds,
  onSelectedIdsChange,
  onEdit,
  onArchive,
  onDelete,
  onMarkActive,
  onPermanentDelete,
}: CustomersListProps) {
  const allSelected =
    customers.length > 0 && customers.every((customer) => selectedIds.has(customer.id))

  function toggleAll(checked: boolean) {
    if (!checked) {
      onSelectedIdsChange(new Set())
      return
    }

    onSelectedIdsChange(new Set(customers.map((customer) => customer.id)))
  }

  function toggleOne(customerId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(customerId)
    } else {
      next.delete(customerId)
    }
    onSelectedIdsChange(next)
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron clientes
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {quickFilter === "operativos"
            ? "Ajustá la búsqueda para ver más resultados."
            : `No hay clientes en ${CUSTOMER_QUICK_FILTER_LABELS[quickFilter].toLowerCase()}.`}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(value) => toggleAll(value === true)}
                aria-label="Seleccionar todos"
              />
            </TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>N° Cliente</TableHead>
            <TableHead>DNI</TableHead>
            <TableHead>Domicilio</TableHead>
            <TableHead>Localidad</TableHead>
            <TableHead>Mail</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Tecnología</TableHead>
            <TableHead>Validación</TableHead>
            <TableHead className="w-[72px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              selected={selectedIds.has(customer.id)}
              onToggle={(checked) => toggleOne(customer.id, checked)}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
              onMarkActive={onMarkActive}
              onPermanentDelete={onPermanentDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CustomerRow({
  customer,
  selected,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
  onMarkActive,
  onPermanentDelete,
}: {
  customer: CustomerListRow
  selected: boolean
  onToggle: (checked: boolean) => void
  onEdit: (customer: CustomerListRow) => void
  onArchive: (customer: CustomerListRow) => void
  onDelete: (customer: CustomerListRow) => void
  onMarkActive: (customer: CustomerListRow) => void
  onPermanentDelete?: (customer: CustomerListRow) => void
}) {
  const technologyLabel = formatCustomerTechnologyLabel(customer.technology) ?? "—"

  return (
    <TableRow data-selected={selected}>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onToggle(value === true)}
          aria-label={`Seleccionar ${customer.name}`}
        />
      </TableCell>
      <TableCell className="min-w-[160px]">
        <Link
          href={`/clientes/${customer.id}`}
          className="font-semibold text-foreground hover:text-primary hover:underline"
        >
          {customer.name}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {customer.externalCustomerCode?.trim() || "—"}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {customer.dni?.trim() || "—"}
      </TableCell>
      <TableCell className="max-w-[160px] truncate">
        {customer.address?.trim() || "—"}
      </TableCell>
      <TableCell>{customer.locality?.trim() || "—"}</TableCell>
      <TableCell className="max-w-[160px] truncate">
        {customer.email?.trim() || "—"}
      </TableCell>
      <TableCell>
        {customer.phone ? (
          <WhatsAppLink phone={customer.phone} />
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>{technologyLabel}</TableCell>
      <TableCell>
        <span className={validationStatusBadgeClassName(customer.validationStatus)}>
          <span className={validationStatusDotClassName(customer.validationStatus)} />
          {formatValidationStatusLabel(customer.validationStatus)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/clientes/${customer.id}`}>
                <Eye className="size-4" />
                Ver ficha
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(customer)}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
            {customer.validationStatus === "review" ? (
              <DropdownMenuItem onClick={() => onMarkActive(customer)}>
                <CheckCircle2 className="size-4" />
                Marcar activo
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => onArchive(customer)}>
              <Archive className="size-4" />
              Archivar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(customer)}
            >
              <Trash2 className="size-4" />
              {customer.legacyMigrationId
                ? "Excluir de la migración"
                : "Eliminar"}
            </DropdownMenuItem>
            {onPermanentDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onPermanentDelete(customer)}
                >
                  <ShieldAlert className="size-4" />
                  Eliminar definitivamente
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
