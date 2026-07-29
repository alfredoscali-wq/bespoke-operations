"use client"

import { useEffect, useId, useRef, useState } from "react"
import { FolderOpen, Footprints, Loader2, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type {
  CommercialSearchGroup,
  CommercialSearchResultItem,
} from "@/lib/types/commercial-search"
import { cn } from "@/lib/utils"

export type CommercialSearchProps = {
  placeholder?: string
  debounceMs?: number
  minChars?: number
  className?: string
  /**
   * Data source — keep this free of domain knowledge.
   * The caller decides how to fetch/group results.
   */
  search: (query: string) => Promise<CommercialSearchGroup[]>
  onSelect: (item: CommercialSearchResultItem) => void
}

function categoryIcon(category: string) {
  if (category === "activities") return Footprints
  return FolderOpen
}

export function CommercialSearch({
  placeholder = "Buscar clientes, actividades, teléfonos, etiquetas...",
  debounceMs = 300,
  minChars = 2,
  className,
  search,
  onSelect,
}: CommercialSearchProps) {
  const inputId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [groups, setGroups] = useState<CommercialSearchGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, debounceMs)
    return () => window.clearTimeout(handle)
  }, [debounceMs, query])

  useEffect(() => {
    if (debouncedQuery.length < minChars) {
      setGroups([])
      setIsLoading(false)
      setError(null)
      setActiveIndex(-1)
      return
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)
    setIsOpen(true)

    void search(debouncedQuery)
      .then((nextGroups) => {
        if (requestId !== requestIdRef.current) return
        setGroups(nextGroups)
        setActiveIndex(-1)
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return
        setGroups([])
        setError(
          err instanceof Error ? err.message : "No se pudo completar la búsqueda."
        )
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return
        setIsLoading(false)
      })
  }, [debouncedQuery, minChars, search])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) return
      if (rootRef.current.contains(event.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const flatItems = groups.flatMap((group) => group.items)
  const showPanel =
    isOpen && (query.trim().length >= minChars || isLoading || error != null)

  function handleSelect(item: CommercialSearchResultItem) {
    setIsOpen(false)
    setQuery("")
    setDebouncedQuery("")
    setGroups([])
    onSelect(item)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) =>
        flatItems.length === 0 ? -1 : (current + 1) % flatItems.length
      )
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) =>
        flatItems.length === 0
          ? -1
          : (current - 1 + flatItems.length) % flatItems.length
      )
      return
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      const item = flatItems[activeIndex]
      if (item) handleSelect(item)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <label htmlFor={inputId} className="sr-only">
        Buscar en Comercial
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={inputId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (query.trim().length >= minChars) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-10 bg-background/90 pr-9 pl-9 shadow-sm"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${inputId}-results`}
          aria-autocomplete="list"
        />
        {query ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              setQuery("")
              setDebouncedQuery("")
              setGroups([])
              setIsOpen(false)
            }}
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          id={`${inputId}-results`}
          role="listbox"
          className="absolute z-[70] mt-2 max-h-[min(28rem,70vh)] w-full overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-lg"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </div>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-destructive">{error}</p>
          ) : flatItems.length === 0 ? (
            <div className="space-y-1 px-4 py-6 text-sm">
              <p className="font-medium text-foreground">
                No se encontraron resultados.
              </p>
              <p className="text-muted-foreground">
                Probar con otro nombre, teléfono o descripción.
              </p>
            </div>
          ) : (
            <div className="py-2">
              {groups.map((group, groupIndex) => {
                const Icon = categoryIcon(group.key)
                const groupOffset = groups
                  .slice(0, groupIndex)
                  .reduce((sum, entry) => sum + entry.items.length, 0)
                return (
                  <section key={group.key} className="px-2 py-1">
                    <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map((item, itemIndex) => {
                        const index = groupOffset + itemIndex
                        const isActive = index === activeIndex
                        return (
                          <li key={`${group.key}-${item.id}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                                isActive
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-muted/70"
                              )}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => handleSelect(item)}
                            >
                              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                                <Icon className="size-4 text-muted-foreground" />
                              </span>
                              <span className="min-w-0 flex-1 space-y-0.5">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-medium">
                                    {item.title}
                                  </span>
                                  {item.badge ? (
                                    <Badge
                                      variant="outline"
                                      className="gap-1.5 border-transparent font-medium"
                                      style={{
                                        backgroundColor: item.badge.color
                                          ? `${item.badge.color}22`
                                          : undefined,
                                      }}
                                    >
                                      {item.badge.color ? (
                                        <span
                                          className="size-1.5 rounded-full"
                                          style={{
                                            backgroundColor: item.badge.color,
                                          }}
                                          aria-hidden
                                        />
                                      ) : null}
                                      {item.badge.label}
                                    </Badge>
                                  ) : null}
                                </span>
                                {item.subtitle ? (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {item.subtitle}
                                  </span>
                                ) : null}
                                {item.meta ? (
                                  <span className="block text-[11px] text-muted-foreground">
                                    {item.meta}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
