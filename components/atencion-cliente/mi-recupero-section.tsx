"use client"

import { useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { RecuperoViewDialog } from "@/components/atencion-cliente/recupero-view-dialog"
import {
  formatCustomerRecuperacionChannelLabel,
  formatCustomerRecuperacionResultadoLabel,
  getCustomerRecuperacionResultadoTone,
} from "@/lib/customer-recuperaciones/format"
import type { CustomerRecuperacionActivityRow } from "@/lib/types/customer-recuperaciones"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

type MiRecuperoSectionProps = {
  highlighted?: boolean
}

function RecuperoItemButton({
  item,
  onOpen,
}: {
  item: CustomerRecuperacionActivityRow
  onOpen: (item: CustomerRecuperacionActivityRow) => void
}) {
  const tone = getCustomerRecuperacionResultadoTone(item.resultado)

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.displayName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("es-AR")}{" "}
          {new Date(item.createdAt).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <Badge variant="outline" className={STATUS_TONE_STYLES[tone]}>
          {formatCustomerRecuperacionResultadoLabel(item.resultado)}
        </Badge>
      </div>
      {item.zoneLabel ? (
        <p className="text-sm text-muted-foreground">{item.zoneLabel}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {formatCustomerRecuperacionChannelLabel(item.channel)} ·{" "}
        <span className="line-clamp-1">{item.offer}</span>
      </p>
    </button>
  )
}

export function MiRecuperoSection({ highlighted = false }: MiRecuperoSectionProps) {
  const { myRecuperaciones, isDashboardLoading } = useAtencionCliente()
  const [selectedItem, setSelectedItem] =
    useState<CustomerRecuperacionActivityRow | null>(null)

  return (
    <>
      <Card className={cn(highlighted && "ring-2 ring-primary/20")}>
        <CardHeader>
          <CardTitle>Mi actividad de Recupero</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isDashboardLoading ? (
            <p className="text-sm text-muted-foreground">Cargando recuperos…</p>
          ) : myRecuperaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no registraste gestiones de recupero.
            </p>
          ) : (
            myRecuperaciones.map((item) => (
              <RecuperoItemButton
                key={item.id}
                item={item}
                onOpen={setSelectedItem}
              />
            ))
          )}
        </CardContent>
      </Card>

      <RecuperoViewDialog
        recuperacionId={selectedItem?.id ?? null}
        summary={selectedItem}
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null)
          }
        }}
      />
    </>
  )
}
