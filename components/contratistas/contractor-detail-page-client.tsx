"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { notFound } from "next/navigation"

import { useContractors } from "@/components/contratistas/contractors-provider"
import { ContractorFormDialog } from "@/components/contratistas/contractor-form-dialog"
import { ExternalCrewFormDialog } from "@/components/contratistas/external-crew-form-dialog"
import { ExternalUserFormDialog } from "@/components/contratistas/external-user-form-dialog"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { CONTRACTOR_STATUS_LABELS } from "@/lib/contractors/constants"
import { filterContractorEmployees } from "@/lib/contractors/employees"
import {
  getContractorDisplayName,
} from "@/lib/contractors/utils"
import { filterExternalCrews } from "@/lib/crews/origin"
import { CREW_STATUS_LABELS } from "@/lib/crews/constants"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { NewContractorInput } from "@/lib/types/contractors"
import type { NewExternalCrewInput } from "@/lib/types/crews"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ContractorDetailPageClientProps = {
  contractorId: string
}

export function ContractorDetailPageClient({
  contractorId,
}: ContractorDetailPageClientProps) {
  const { getContractor, editContractor } = useContractors()
  const { crews, addExternalCrew } = useCrews()
  const { employees } = useEmployees()
  const contractor = getContractor(contractorId)

  const [editOpen, setEditOpen] = useState(false)
  const [crewDialogOpen, setCrewDialogOpen] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const contractorCrews = useMemo(
    () => filterExternalCrews(crews, contractorId),
    [crews, contractorId]
  )

  const contractorUsers = useMemo(
    () => filterContractorEmployees(employees, contractorId),
    [employees, contractorId]
  )

  if (!contractor) {
    notFound()
  }

  async function handleEditContractor(input: NewContractorInput) {
    const result = await editContractor(contractorId, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar.")
    }
    setFeedback("Datos del contratista actualizados.")
  }

  async function handleCreateCrew(input: NewExternalCrewInput) {
    const result = await addExternalCrew(input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo crear la cuadrilla.")
    }
    setFeedback("Cuadrilla externa creada.")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
            <Link href="/contratistas">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {getContractorDisplayName(contractor)}
              </h1>
              <Badge
                variant={
                  contractor.status === "activo" ? "default" : "secondary"
                }
              >
                {CONTRACTOR_STATUS_LABELS[contractor.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {contractor.legalName} · CUIT {contractor.taxId}
            </p>
            {feedback ? (
              <p className="mt-1 text-sm text-emerald-700" role="status">
                {feedback}
              </p>
            ) : null}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          Editar datos
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Datos administrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Responsable</p>
              <p className="font-medium">
                {contractor.responsibleName || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Teléfono</p>
              <p className="font-medium">{contractor.phone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{contractor.email || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Observaciones</p>
              <p className="whitespace-pre-wrap">
                {contractor.notes || "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-base">Cuadrillas externas</CardTitle>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setCrewDialogOpen(true)}
            >
              <Plus className="size-4" />
              Nueva cuadrilla
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {contractorCrews.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todavía no hay cuadrillas externas para este contratista.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Integrantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractorCrews.map((crew) => (
                    <TableRow key={crew.id}>
                      <TableCell className="font-medium">{crew.name}</TableCell>
                      <TableCell>{crew.supervisor || "—"}</TableCell>
                      <TableCell>
                        {CREW_STATUS_LABELS[crew.status]}
                      </TableCell>
                      <TableCell className="text-right">
                        {crew.members.filter((member) => member.active).length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="text-base">Usuarios Field Agent</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Acceso solo operativo (Operario). Sin módulos administrativos ni
              RRHH.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setUserDialogOpen(true)}
          >
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {contractorUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay usuarios externos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Cuadrilla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractorUsers.map((employee) => {
                  const linkedCrew = contractorCrews.find((crew) =>
                    crew.members.some(
                      (member) =>
                        member.employeeId === employee.id && member.active
                    )
                  )
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-mono text-sm">
                        {employee.employeeCode}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getEmployeeDisplayName(employee)}
                      </TableCell>
                      <TableCell>{employee.nationalId || "—"}</TableCell>
                      <TableCell>
                        {employee.appUserId
                          ? "Provisionado"
                          : employee.systemAccess
                            ? "Pendiente"
                            : "Sin acceso"}
                      </TableCell>
                      <TableCell>{linkedCrew?.name ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContractorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        contractor={contractor}
        onSubmit={handleEditContractor}
      />

      <ExternalCrewFormDialog
        open={crewDialogOpen}
        onOpenChange={setCrewDialogOpen}
        contractorId={contractorId}
        defaultSupervisor={contractor.responsibleName}
        onSubmit={handleCreateCrew}
      />

      <ExternalUserFormDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        contractorId={contractorId}
        contractorName={getContractorDisplayName(contractor)}
        onCreated={() => setFeedback("Usuario externo creado y provisionado.")}
      />
    </div>
  )
}
