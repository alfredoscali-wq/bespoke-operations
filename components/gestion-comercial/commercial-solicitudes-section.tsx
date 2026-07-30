"use client"

import { FilePlus2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CommercialSolicitudesSectionProps = {
  className?: string
}

/**
 * Visual placeholder for future Solicitudes (Internet, TV, etc.).
 * No data model in this sprint — structure only.
 */
export function CommercialSolicitudesSection({
  className,
}: CommercialSolicitudesSectionProps) {
  return (
    <Card className={cn("overflow-hidden rounded-xl border shadow-sm", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Solicitudes</CardTitle>
        <CardDescription>
          Pedidos del cliente (Internet, Televisión, Telefonía y más).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
          <FilePlus2
            className="size-8 text-muted-foreground/70"
            aria-hidden
          />
          <p className="text-sm font-medium text-foreground">
            Todavía no hay solicitudes
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            En próximos sprints vas a poder registrar y gestionar solicitudes
            desde esta ficha.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
