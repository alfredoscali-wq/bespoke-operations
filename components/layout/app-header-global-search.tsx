"use client"

import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Buscador global del header — reservado para una futura integración.
 * Importar en `AppHeader` cuando la búsqueda transversal esté implementada.
 */
export function AppHeaderGlobalSearch() {
  return (
    <>
      <div className="hidden w-full max-w-sm md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar obras, órdenes de trabajo, cuadrillas..."
            className="h-8 bg-muted/40 pl-8"
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground md:hidden"
        aria-label="Buscar"
      >
        <Search className="size-4" />
      </Button>
    </>
  )
}
