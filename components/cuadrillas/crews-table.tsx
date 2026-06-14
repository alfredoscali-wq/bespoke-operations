"use client"

import { useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { CrewFormDialog } from "@/components/cuadrillas/crew-form-dialog"
import { CrewStatusBadge } from "@/components/cuadrillas/crew-badges"
import type { CrewListItem, NewCrewInput } from "@/lib/types/crews"
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

type CrewsTableProps = {
  crews: CrewListItem[]
}

export function CrewsTable({ crews }: CrewsTableProps) {
  const { editCrew, removeCrew } = useCrews()
  const [editTarget, setEditTarget] = useState<CrewListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrewListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleEdit(input: NewCrewInput) {
    if (!editTarget) return
    const result = await editCrew(editTarget.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la cuadrilla.")
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await removeCrew(deleteTarget.id)
    setIsDeleting(false)
    if (!result.success) return
    setDeleteTarget(null)
  }

  if (crews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay cuadrillas registradas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cree una cuadrilla para comenzar a asignar tareas.
        </p>
      </div>
    )
  }

  function renderActions(crew: CrewListItem) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditTarget(crew)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteTarget(crew)}
          >
            <Trash2 className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cuadrilla</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Integrantes</TableHead>
                <TableHead>Tareas Activas</TableHead>
                <TableHead>Proyectos Activos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {crews.map((crew) => (
                <TableRow key={crew.id}>
                  <TableCell>
                    <Link
                      href={`/cuadrillas/${crew.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {crew.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {crew.supervisor}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                    {crew.description || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Users className="size-3.5 text-muted-foreground" />
                      {crew.memberCount}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {crew.activeTasks}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {crew.activeProjects}
                  </TableCell>
                  <TableCell>
                    <CrewStatusBadge status={crew.status} />
                  </TableCell>
                  <TableCell>{renderActions(crew)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {crews.map((crew) => (
          <Card key={crew.id} className="h-full shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/cuadrillas/${crew.id}`}>
                    <CardTitle className="text-base hover:text-primary">
                      {crew.name}
                    </CardTitle>
                  </Link>
                  <CardDescription className="line-clamp-2">
                    {crew.description || crew.supervisor}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <CrewStatusBadge status={crew.status} />
                  {renderActions(crew)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border bg-muted/20 p-2">
                <p className="font-semibold tabular-nums text-foreground">
                  {crew.memberCount}
                </p>
                <p className="text-muted-foreground">Integrantes</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-2">
                <p className="font-semibold tabular-nums text-foreground">
                  {crew.activeTasks}
                </p>
                <p className="text-muted-foreground">Tareas</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-2">
                <p className="font-semibold tabular-nums text-foreground">
                  {crew.activeProjects}
                </p>
                <p className="text-muted-foreground">Proyectos</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CrewFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        mode="edit"
        crew={editTarget ?? undefined}
        onSubmit={handleEdit}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cuadrilla</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta cuadrilla?
              {deleteTarget ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.name}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
