"use client"

import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type CommercialActionMenuProps = {
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
  disabled?: boolean
}

export function CommercialActionMenu({
  onEdit,
  onDelete,
  onBack,
  disabled = false,
}: CommercialActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled}
          aria-label="Acciones del expediente"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={onDelete}
        >
          Eliminar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onBack}>Volver a Bandeja</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
