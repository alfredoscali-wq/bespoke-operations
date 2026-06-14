"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { MemberFormDialog } from "@/components/cuadrillas/member-form-dialog"
import { MemberActiveBadge } from "@/components/cuadrillas/crew-badges"
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedMember, setSelectedMember] = useState<CrewMember | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<CrewMember | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crew.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.role}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <MemberActiveBadge active={member.active} />
                      </TableCell>
                      <TableCell>{renderActions(member)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 lg:hidden">
              {crew.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                    {member.phone && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {member.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <MemberActiveBadge active={member.active} />
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
              ¿Desea eliminar a {deleteTarget?.name} de la cuadrilla?
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
