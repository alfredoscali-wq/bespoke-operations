"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { AtencionFormDialog } from "@/components/atencion-cliente/atencion-form-dialog"
import { AtencionesList } from "@/components/atencion-cliente/atenciones-list"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { DEFAULT_ATENCION_PAGE_SIZE } from "@/lib/customer-atenciones/atencion-list"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const SEARCH_DEBOUNCE_MS = 300

export function AtencionClienteModule() {
  const { isReady, isListLoading, listPage, loadAtencionPage } =
    useAtencionCliente()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    void loadAtencionPage({
      page,
      pageSize: DEFAULT_ATENCION_PAGE_SIZE,
      search: debouncedSearch,
    })
  }, [debouncedSearch, loadAtencionPage, page])

  const items = listPage?.items ?? []
  const totalResults = listPage?.total ?? 0
  const pageSize = listPage?.pageSize ?? DEFAULT_ATENCION_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Atención al Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro general de atenciones resueltas.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          Nueva Atención
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Atenciones</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente"
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {!isReady || isListLoading ? (
            <TableRowsSkeleton rows={8} columns={6} />
          ) : (
            <>
              <AtencionesList items={items} />
              {totalResults > pageSize ? (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {totalResults.toLocaleString("es-AR")} atenciones
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <AtencionFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
