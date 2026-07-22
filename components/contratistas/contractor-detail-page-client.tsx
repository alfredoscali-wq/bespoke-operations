"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  KeyRound,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react"

import { AssignExternalUserCrewDialog } from "@/components/contratistas/assign-external-user-crew-dialog"
import { useContractors } from "@/components/contratistas/contractors-provider"
import { ContractorFormDialog } from "@/components/contratistas/contractor-form-dialog"
import { ExternalCrewFormDialog } from "@/components/contratistas/external-crew-form-dialog"
import { ExternalUserFormDialog } from "@/components/contratistas/external-user-form-dialog"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  buildPasswordResetToDniFeedback,
  buildProvisionedCredentialsFeedback,
  buildResetPasswordToDniDescription,
} from "@/lib/auth/initial-credentials-policy"
import { requestResetEmployeePassword } from "@/lib/auth/reset-password-client"
import { requestSoftDeleteEmployeeAccess } from "@/lib/auth/soft-delete-employee-client"
import { CONTRACTOR_STATUS_LABELS } from "@/lib/contractors/constants"
import {
  filterContractorEmployees,
  resolveExternalUserAccessLabel,
} from "@/lib/contractors/employees"
import { getContractorDisplayName } from "@/lib/contractors/utils"
import { CREW_STATUS_LABELS } from "@/lib/crews/constants"
import { filterExternalCrews } from "@/lib/crews/origin"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { NewContractorInput } from "@/lib/types/contractors"
import type { Crew, NewExternalCrewInput } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ContractorDetailPageClientProps = {
  contractorId: string
}

function findLinkedCrew(
  crews: Crew[],
  employeeId: string
): Crew | undefined {
  return crews.find((crew) =>
    crew.members.some(
      (member) => member.employeeId === employeeId && member.active
    )
  )
}

export function ContractorDetailPageClient({
  contractorId,
}: ContractorDetailPageClientProps) {
  const { getContractor, editContractor, isContractorsReady } = useContractors()
  const { crews, addExternalCrew, editCrew } = useCrews()
  const { employees, editEmployee, provisionEmployeeAccess, forgetEmployee } =
    useEmployees()
  const contractor = getContractor(contractorId)

  const [editOpen, setEditOpen] = useState(false)
  const [crewDialogOpen, setCrewDialogOpen] = useState(false)
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Employee | null>(null)
  const [assignUser, setAssignUser] = useState<Employee | null>(null)
  const [resetUser, setResetUser] = useState<Employee | null>(null)
  const [deleteUser, setDeleteUser] = useState<Employee | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  const contractorCrews = useMemo(
    () => filterExternalCrews(crews, contractorId),
    [crews, contractorId]
  )

  const contractorUsers = useMemo(
    () => filterContractorEmployees(employees, contractorId),
    [employees, contractorId]
  )

  if (!isContractorsReady) {
    return (
      <p className="text-sm text-muted-foreground">Cargando contratista…</p>
    )
  }

  if (!contractor) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link href="/contratistas">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          No se encontró el contratista.
        </p>
      </div>
    )
  }

  async function handleEditContractor(input: NewContractorInput) {
    const result = await editContractor(contractorId, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar.")
    }
    setFeedback("Datos generales actualizados.")
  }

  async function handleSaveCrew(input: NewExternalCrewInput) {
    if (editingCrew) {
      const result = await editCrew(editingCrew.id, {
        name: input.name,
        description: input.description,
        supervisor: input.supervisor,
        notes: input.notes,
      })
      if (!result.success) {
        throw new Error(result.message ?? "No se pudo actualizar la cuadrilla.")
      }
      setFeedback("Cuadrilla externa actualizada.")
      setEditingCrew(null)
      return
    }

    const result = await addExternalCrew(input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo crear la cuadrilla.")
    }
    setFeedback("Cuadrilla externa creada.")
  }

  async function handleToggleCrewStatus(crew: Crew) {
    const nextStatus = crew.status === "inactiva" ? "activa" : "inactiva"
    const result = await editCrew(crew.id, { status: nextStatus })
    if (!result.success) {
      setFeedback(result.message ?? "No se pudo cambiar el estado.")
      return
    }
    setFeedback(
      nextStatus === "inactiva"
        ? `Cuadrilla ${crew.name} desactivada.`
        : `Cuadrilla ${crew.name} activada.`
    )
  }

  async function handleProvisionUser(employee: Employee) {
    setBusyUserId(employee.id)
    try {
      const result = await provisionEmployeeAccess(employee.id)
      if (!result.success) {
        setFeedback(result.message ?? "No se pudo provisionar el acceso.")
        return
      }
      setFeedback(
        buildProvisionedCredentialsFeedback(
          getEmployeeDisplayName(result.employee ?? employee)
        )
      )
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleToggleUserAccess(employee: Employee) {
    setBusyUserId(employee.id)
    try {
      const nextAccess = !employee.systemAccess
      const result = await editEmployee(employee.id, {
        systemAccess: nextAccess,
      })
      if (!result.success) {
        setFeedback(result.message ?? "No se pudo cambiar el acceso.")
        return
      }
      setFeedback(
        nextAccess
          ? `Acceso activado para ${getEmployeeDisplayName(employee)}.`
          : `Acceso desactivado para ${getEmployeeDisplayName(employee)}.`
      )
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleConfirmResetPassword() {
    if (!resetUser) return
    setIsResettingPassword(true)
    try {
      const result = await requestResetEmployeePassword(resetUser.id)
      if (!result.success) {
        setFeedback(result.error)
        return
      }
      setFeedback(
        buildPasswordResetToDniFeedback(getEmployeeDisplayName(resetUser))
      )
      setResetUser(null)
    } finally {
      setIsResettingPassword(false)
    }
  }

  async function handleConfirmDeleteUser() {
    if (!deleteUser) return
    setIsDeletingUser(true)
    try {
      const result = await requestSoftDeleteEmployeeAccess(deleteUser.id)
      if (!result.success) {
        setFeedback(result.error)
        return
      }

      // Soft-delete already applied server-side; sync local cache only.
      forgetEmployee(deleteUser.id)

      setFeedback(
        `Usuario ${getEmployeeDisplayName(deleteUser)} eliminado. El historial operativo se conservó.`
      )
      setDeleteUser(null)
    } finally {
      setIsDeletingUser(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
            <Link href="/contratistas">
              <ArrowLeft className="size-4" />
              Volver al listado
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
              Ficha de administración · {contractor.legalName} · CUIT{" "}
              {contractor.taxId}
            </p>
            {feedback ? (
              <p className="mt-1 text-sm text-emerald-700" role="status">
                {feedback}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Desde acá gestionás datos, cuadrillas externas y usuarios Field
                Agent.
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="datos" className="gap-4">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="datos">Datos generales</TabsTrigger>
          <TabsTrigger value="cuadrillas">
            Cuadrillas ({contractorCrews.length})
          </TabsTrigger>
          <TabsTrigger value="usuarios">
            Usuarios ({contractorUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
              <div>
                <CardTitle className="text-base">Datos administrativos</CardTitle>
                <CardDescription>
                  Información comercial del contratista. No afecta el flujo
                  operativo de Field Agent.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Razón social</p>
                <p className="font-medium">{contractor.legalName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nombre comercial</p>
                <p className="font-medium">{contractor.tradeName || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CUIT</p>
                <p className="font-mono font-medium">{contractor.taxId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">
                  {CONTRACTOR_STATUS_LABELS[contractor.status]}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Responsable</p>
                <p className="font-medium">
                  {contractor.responsibleName || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium">{contractor.phone || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{contractor.email || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Observaciones</p>
                <p className="whitespace-pre-wrap">
                  {contractor.notes || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cuadrillas" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
              <div>
                <CardTitle className="text-base">Cuadrillas externas</CardTitle>
                <CardDescription>
                  Se registran en el mismo modelo operativo que las internas.
                  Solo se administran desde esta ficha.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingCrew(null)
                  setCrewDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                Nueva cuadrilla
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {contractorCrews.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay cuadrillas. Creá la primera para poder asignar
                  usuarios y OTs.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Integrantes</TableHead>
                      <TableHead className="w-[180px]" />
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
                          {
                            crew.members.filter((member) => member.active)
                              .length
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => {
                                setEditingCrew(crew)
                                setCrewDialogOpen(true)
                              }}
                            >
                              <Pencil className="size-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => void handleToggleCrewStatus(crew)}
                            >
                              <Power className="size-3.5" />
                              {crew.status === "inactiva"
                                ? "Activar"
                                : "Desactivar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
              <div>
                <CardTitle className="text-base">Usuarios Field Agent</CardTitle>
                <CardDescription>
                  Usuarios externos con rol Operario. Acceden al mismo Field
                  Agent y solo ven OTs de su cuadrilla.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingUser(null)
                  setUserDialogOpen(true)
                }}
              >
                <Plus className="size-4" />
                Nuevo usuario
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {contractorUsers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay usuarios. Creá uno y asociarlo a una cuadrilla
                  externa.
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
                      <TableHead className="w-[72px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractorUsers.map((employee) => {
                      const linkedCrew = findLinkedCrew(
                        contractorCrews,
                        employee.id
                      )
                      const isBusy = busyUserId === employee.id
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
                            {resolveExternalUserAccessLabel(employee)}
                          </TableCell>
                          <TableCell>{linkedCrew?.name ?? "—"}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  disabled={isBusy}
                                >
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">Acciones</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingUser(employee)
                                    setUserDialogOpen(true)
                                  }}
                                >
                                  <Pencil className="size-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setAssignUser(employee)}
                                >
                                  <Link2 className="size-4" />
                                  Cambiar cuadrilla
                                </DropdownMenuItem>
                                {employee.appUserId ? (
                                  <DropdownMenuItem
                                    disabled={!employee.nationalId?.trim()}
                                    onClick={() => setResetUser(employee)}
                                  >
                                    <KeyRound className="size-4" />
                                    Restablecer contraseña
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled={
                                      isBusy || !employee.systemAccess
                                    }
                                    onClick={() =>
                                      void handleProvisionUser(employee)
                                    }
                                  >
                                    <KeyRound className="size-4" />
                                    Provisionar acceso
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleToggleUserAccess(employee)
                                  }
                                >
                                  {employee.systemAccess ? (
                                    <>
                                      <UserX className="size-4" />
                                      Desactivar acceso
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="size-4" />
                                      Activar acceso
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteUser(employee)}
                                >
                                  <Trash2 className="size-4" />
                                  Eliminar usuario
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContractorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        contractor={contractor}
        onSubmit={handleEditContractor}
      />

      <ExternalCrewFormDialog
        open={crewDialogOpen}
        onOpenChange={(open) => {
          setCrewDialogOpen(open)
          if (!open) setEditingCrew(null)
        }}
        contractorId={contractorId}
        defaultSupervisor={contractor.responsibleName}
        crew={editingCrew ?? undefined}
        onSubmit={handleSaveCrew}
      />

      <ExternalUserFormDialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open)
          if (!open) setEditingUser(null)
        }}
        contractorId={contractorId}
        contractorName={getContractorDisplayName(contractor)}
        mode={editingUser ? "edit" : "create"}
        employee={editingUser}
        onSaved={(saved) =>
          setFeedback(
            editingUser
              ? "Usuario Field Agent actualizado."
              : buildProvisionedCredentialsFeedback(
                  getEmployeeDisplayName(saved)
                )
          )
        }
      />

      <AssignExternalUserCrewDialog
        open={Boolean(assignUser)}
        onOpenChange={(open) => {
          if (!open) setAssignUser(null)
        }}
        contractorId={contractorId}
        employee={assignUser}
        onAssigned={() =>
          setFeedback("Asignación de cuadrilla actualizada.")
        }
      />

      <Dialog
        open={Boolean(resetUser)}
        onOpenChange={(open) => {
          if (!open) setResetUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              {buildResetPasswordToDniDescription(resetUser?.nationalId)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetUser(null)}
              disabled={isResettingPassword}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmResetPassword()}
              disabled={isResettingPassword}
            >
              {isResettingPassword ? "Restableciendo…" : "Restablecer al DNI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteUser)}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Este usuario dejará de poder acceder al sistema. Su historial
              operativo será conservado.
              {deleteUser
                ? ` Se eliminará a ${getEmployeeDisplayName(deleteUser)}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteUser(null)}
              disabled={isDeletingUser}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDeleteUser()}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? "Eliminando…" : "Eliminar usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
