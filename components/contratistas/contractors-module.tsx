"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { useContractors } from "@/components/contratistas/contractors-provider"
import { ContractorFormDialog } from "@/components/contratistas/contractor-form-dialog"
import { ContractorsTable } from "@/components/contratistas/contractors-table"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { CONTRACTOR_STATUS_LABELS } from "@/lib/contractors/constants"
import {
  buildContractorListItems,
  defaultContractorFilters,
  filterContractors,
  getContractorSummary,
} from "@/lib/contractors/utils"
import type {
  ContractorFilters,
  NewContractorInput,
} from "@/lib/types/contractors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ContractorsModule() {
  const router = useRouter()
  const { contractors, addContractor } = useContractors()
  const { crews } = useCrews()
  const { employees } = useEmployees()
  const [filters, setFilters] = useState(defaultContractorFilters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const listItems = useMemo(
    () => buildContractorListItems(contractors, crews, employees),
    [contractors, crews, employees]
  )

  const summary = useMemo(
    () => getContractorSummary(contractors, crews),
    [contractors, crews]
  )

  const filtered = useMemo(
    () => filterContractors(listItems, filters),
    [listItems, filters]
  )

  async function handleCreate(input: NewContractorInput) {
    const result = await addContractor(input)
    if (!result.success || !result.contractor) {
      throw new Error(result.message ?? "No se pudo crear.")
    }
    setFeedback("Contratista creado. Abriendo ficha de administración…")
    router.push(`/contratistas/${result.contractor.id}`)
  }

  function updateFilter<K extends keyof ContractorFilters>(
    key: K,
    value: ContractorFilters[K]
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {feedback ? (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {summary.total} contratistas · {summary.externalCrews} cuadrillas
              externas. Abrí un contratista para administrar cuadrillas y
              usuarios Field Agent.
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5 self-start"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          Nuevo contratista
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Activos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.active}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactivos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.inactive}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cuadrillas externas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.externalCrews}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Empresas contratistas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Buscar por razón social, CUIT, responsable…"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              className="sm:max-w-sm"
            />
            <Select
              value={filters.status}
              onValueChange={(value) =>
                updateFilter("status", value as ContractorFilters["status"])
              }
            >
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="activo">
                  {CONTRACTOR_STATUS_LABELS.activo}
                </SelectItem>
                <SelectItem value="inactivo">
                  {CONTRACTOR_STATUS_LABELS.inactivo}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="self-center text-sm text-muted-foreground">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <ContractorsTable contractors={filtered} />
        </CardContent>
      </Card>

      <ContractorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        onSubmit={handleCreate}
      />
    </div>
  )
}
