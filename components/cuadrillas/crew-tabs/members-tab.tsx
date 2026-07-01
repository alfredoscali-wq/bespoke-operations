"use client"

import { useMemo, useState } from "react"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { MemberFormDialog } from "@/components/cuadrillas/member-form-dialog"
import { MemberOperationalStatus } from "@/components/cuadrillas/member-operational-status"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { useCrewAvailabilityRecords } from "@/components/cuadrillas/use-crew-availability-records"
import { resolveCrewMemberDisplay } from "@/lib/crews/utils"
import type { Crew, CrewMember, NewCrewMemberInput } from "@/lib/types/crews"
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

type CrewMembersTabProps = {
  crew: Crew
}

export function CrewMembersTab({ crew }: CrewMembersTabProps) {
  const { addMember, editMember, removeMember } = useCrews()
  const { getEmployee } = useEmployees()
  const { records: availabilityRecords } = useCrewAvailabilityRecords()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedMember, setSelectedMember] = useState<CrewMember | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<CrewMember | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const memberRows = useMemo(
    () =>
      crew.members.map((member) => ({
        member,
        display: resolveCrewMemberDisplay(member, getEmployee),
      })),
    [crew.members, getEmployee]
  )

  function openCreateDialog() {
    setDialogMode("create")
    setSelectedMember(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(member: CrewMember) {
    setDialogMode("edit")
    setSelectedMember(member)
    setDialogOpen(true)
  }

  async function handleSubmit(input: NewCrewMemberInput) {
    if (dialogMode === "edit" && selectedMember) {
      const result = await editMember(crew.id, selectedMember.id, input)
      if (!result.success) {
        throw new Error(result.message ?? "No se pudo actualizar el integrante.")
      }
      return
    }

    const result = await addMember(crew.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo agregar el integrante.")
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await removeMember(crew.id, deleteTarget.id)
    setIsDeleting(false)
    if (result.success) setDeleteTarget(null)
  }

  function renderActions(member: CrewMember) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEditDialog(member)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteTarget(member)}
          >
            <Trash2 className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const deleteTargetDisplay = deleteTarget
    ? resolveCrewMemberDisplay(deleteTarget, getEmployee)
    : null

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Integrantes</CardTitle>
          <CardDescription>
            Personal asignado a {crew.name}
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Agregar integrante
        </Button>
      </CardHeader>
      <CardContent>
        {crew.members.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            No hay integrantes registrados.
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Código empleado</TableHead>
                    <TableHead>Nombre completo</TableHead>
                    <TableHead>Rol en cuadrilla</TableHead>
                    <TableHead>Estado Operativo</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberRows.map(({ member, display }) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {display.employeeCode ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {display.fullName}
                        {display.isLegacy && (
                          <p className="text-xs font-normal text-muted-foreground">
                            Registro legacy
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.role}
                      </TableCell>
                      <TableCell>
                        <MemberOperationalStatus
                          employeeId={member.employeeId}
                          records={availabilityRecords}
                        />
                      </TableCell>
                      <TableCell>{renderActions(member)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 lg:hidden">
              {memberRows.map(({ member, display }) => (
                <div
                  key={member.id}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div>
                    {display.employeeCode && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {display.employeeCode}
                      </p>
                    )}
                    <p className="font-medium">{display.fullName}</p>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                    {display.isLegacy && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Registro legacy
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <MemberOperationalStatus
                      employeeId={member.employeeId}
                      records={availabilityRecords}
                      className="items-end text-right"
                    />
                    {renderActions(member)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <MemberFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        crew={crew}
        member={selectedMember}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar integrante</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar a {deleteTargetDisplay?.fullName ?? deleteTarget?.name}{" "}
              de la cuadrilla?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
