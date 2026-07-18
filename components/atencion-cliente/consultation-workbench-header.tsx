"use client"

import { Plus, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  normalizeSharedInboxSearch,
  type SharedInboxQuery,
} from "@/lib/customer-atenciones/shared-inbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ConsultationWorkbenchHeaderProps = {
  query: SharedInboxQuery
  onQueryChange: (query: SharedInboxQuery) => void
  onCreateClick: () => void
  showSearch?: boolean
}

/**
 * Workbench header: title on the left, the search box as the main element in
 * the center and the primary "Nueva Consulta" action on the right.
 * Search keeps the exact same debounced behavior the inbox used before.
 */
export function ConsultationWorkbenchHeader({
  query,
  onQueryChange,
  onCreateClick,
  showSearch = true,
}: ConsultationWorkbenchHeaderProps) {
  const [searchDraft, setSearchDraft] = useState(query.search ?? "")
  const queryRef = useRef(query)
  queryRef.current = query

  useEffect(() => {
    setSearchDraft(query.search ?? "")
  }, [query.search])

  useEffect(() => {
    const normalizedDraft = normalizeSharedInboxSearch(searchDraft)
    const normalizedQuery = normalizeSharedInboxSearch(queryRef.current.search)

    if (normalizedDraft === normalizedQuery) {
      return
    }

    const timer = window.setTimeout(() => {
      onQueryChange({
        ...queryRef.current,
        search: normalizedDraft,
      })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchDraft, onQueryChange])

  return (
    <header className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
      <div className="shrink-0 lg:w-64">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Gestión de Consultas
        </h1>
      </div>

      {showSearch ? (
        <div className="relative min-w-0 flex-1 lg:mx-auto lg:max-w-xl">
          <Label htmlFor="consultation-workbench-search" className="sr-only">
            Buscar consulta
          </Label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="consultation-workbench-search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Buscar cliente, teléfono, consulta, OT o DNI..."
            className="h-10 rounded-lg bg-background pl-9 text-sm shadow-sm"
          />
        </div>
      ) : (
        <div className="hidden flex-1 lg:block" />
      )}

      <div className="shrink-0 lg:ml-auto">
        <Button className="shadow-sm" onClick={onCreateClick}>
          <Plus className="mr-2 size-4" />
          Nueva Consulta
        </Button>
      </div>
    </header>
  )
}
