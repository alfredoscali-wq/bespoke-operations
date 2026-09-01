"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { Eye, Pencil, Trash2 } from "lucide-react"

import { IspCatalogDeleteDialog } from "@/components/isp/isp-catalog-delete-dialog"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function CatalogIconAction({
  label,
  href,
  destructive,
  onClick,
  children,
}: {
  label: string
  href?: string
  destructive?: boolean
  onClick?: () => void
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

export function IspCatalogRowActions({
  item,
  onDeleted,
  onError,
}: {
  item: IspCatalogItem
  onDeleted: () => void
  onError?: (message: string) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-0.5">
        <CatalogIconAction label="Ver" href={`/servicios/${item.id}`}>
          <Eye className="size-3.5" />
        </CatalogIconAction>
        <CatalogIconAction
          label="Editar"
          href={`/servicios/${item.id}/editar`}
        >
          <Pencil className="size-3.5" />
        </CatalogIconAction>
        <CatalogIconAction
          label="Eliminar"
          destructive
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" />
        </CatalogIconAction>
      </div>
      <IspCatalogDeleteDialog
        item={item}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
        onError={onError}
      />
    </>
  )
}
