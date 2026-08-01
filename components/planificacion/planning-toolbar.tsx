"use client"

import { ClipboardList, Printer, Route } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PlanningToolbarProps = {
  date: string
  onDateChange: (date: string) => void
  onPrintMaterials?: () => void
  /** Sprint 24 — optional deep-link to Timeline Operativo (nav only). */
  timelineHref?: string | null
}

export function PlanningToolbar({
  date,
  onDateChange,
  onPrintMaterials,
  timelineHref,
}: PlanningToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xs">
        <Label htmlFor="planning-date">Fecha</Label>
        <Input
          id="planning-date"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="mt-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {timelineHref ? (
          <Button type="button" variant="outline" className="gap-2" asChild>
            <Link href={timelineHref}>
              <Route className="size-4" />
              Timeline Cuadrillas
            </Link>
          </Button>
        ) : null}
        {onPrintMaterials ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onPrintMaterials}
          >
            <Printer className="size-4" />
            Imprimir Materiales
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="gap-2" asChild>
          <Link href="/tareas">
            <ClipboardList className="size-4" />
            Ir a Órdenes de Trabajo
          </Link>
        </Button>
      </div>
    </div>
  )
}
