"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react"

import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { CrewFormDialog } from "@/components/cuadrillas/crew-form-dialog"
import {
  CrewAvailabilityBadge,
  CrewStatusBadge,
} from "@/components/cuadrillas/crew-badges"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { getCrewAvailability } from "@/lib/crews/availability"
import { resolveCrewSupervisorDisplay } from "@/lib/crews/supervisor"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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

type Feedback = {
  variant: "success" | "error"
  message: string
} | null

export function CrewsTable({ crews }: CrewsTableProps) {
  const router = useRouter()
  const { editCrew, removeCrew } = useCrews()
  const { getEmployee } = useEmployees()
  const { records: availabilityRecords } = useAvailability()
  const availabilityContext = useMemo(
    () => ({
      availabilityRecords,
      getEmployee,
    }),
    [availabilityRecords, getEmployee]
  )
  const [editTarget, setEditTarget] = useState<CrewListItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<CrewListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrewListItem | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  async function handleEdit(input: NewCrewInput) {
    if (!editTarget) return
    const result = await editCrew(editTarget.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la cuadrilla.")
    }
    setFeedback({
      variant: "success",
      message: "Cuadrilla actualizada correctamente.",
    })
  }

  async function handleConfirmArchive() {
    if (!archiveTarget) return
    setIsArchiving(true)
    setFeedback(null)

    const result = await editCrew(archiveTarget.id, {
      name: archiveTarget.name,
      description: archiveTarget.description,
      supervisorEmployeeId: archiveTarget.supervisorEmployeeId ?? "",
      notes: archiveTarget.notes,
      manuallyInactive: true,
    })

    setIsArchiving(false)

    if (!result.success) {
      setFeedback({
        variant: "error",
        message: result.message ?? "No se pudo archivar la cuadrilla.",
      })
      return
    }

    setArchiveTarget(null)
    setFeedback({
      variant: "success",
      message: `Cuadrilla "${archiveTarget.name}" archivada.`,
    })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setFeedback(null)

    const result = await removeCrew(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setFeedback({
        variant: "error",
        message: result.message ?? "No se pudo eliminar la cuadrilla.",
      })
      return
    }

    setDeleteTarget(null)
    setFeedback({
      variant: "success",
      message: `Cuadrilla "${deleteTarget.name}" eliminada.`,
    })
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
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" asChild>
              <Link href={`/cuadrillas/${crew.id}?tab=members`}>
                <Users className="size-4" />
                <span className="sr-only">Integrantes</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Integrantes</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/cuadrillas/${crew.id}`)}
            >
              <Eye className="size-4" />
              Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditTarget(crew)}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setArchiveTarget(crew)}>
              <Archive className="size-4" />
              Archivar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteTarget(crew)}
            >
              <Trash2 className="size-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <>
      <EntityActionFeedback
        message={feedback?.message ?? null}
        variant={feedback?.variant ?? "success"}
      />

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
                <TableHead>Disponibilidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[88px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {crews.map((crew) => {
                const supervisor = resolveCrewSupervisorDisplay(crew, getEmployee)
                const availability = getCrewAvailability(crew, availabilityContext)

                return (
                <TableRow key={crew.id}>
                  <TableCell>
                    <Link
                      href={`/cuadrillas/${crew.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {crew.name}
                    </Link>
                    {supervisor.displayName !== "Sin supervisor asignado" && (
                      <p className="text-xs text-muted-foreground">
                        Supervisor: {supervisor.displayName}
                      </p>
                    )}
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
                    <CrewAvailabilityBadge status={availability.status} />
                  </TableCell>
                  <TableCell>
                    <CrewStatusBadge status={crew.status} />
                  </TableCell>
                  <TableCell>{renderActions(crew)}</TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {crews.map((crew) => {
          const supervisor = resolveCrewSupervisorDisplay(crew, getEmployee)
          const availability = getCrewAvailability(crew, availabilityContext)

          return (
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
                    {crew.description ||
                      (supervisor.displayName !== "Sin supervisor asignado"
                        ? `Supervisor: ${supervisor.displayName}`
                        : "")}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <CrewAvailabilityBadge status={availability.status} />
                  <div className="flex items-center gap-1">
                    <CrewStatusBadge status={crew.status} />
                    {renderActions(crew)}
                  </div>
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
        )})}
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
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isArchiving) setArchiveTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archivar cuadrilla</DialogTitle>
            <DialogDescription>
              La cuadrilla quedará inactiva y no podrá recibir nuevas tareas.
              {archiveTarget ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {archiveTarget.name}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={isArchiving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmArchive}
              disabled={isArchiving}
            >
              {isArchiving ? "Archivando..." : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cuadrilla</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta cuadrilla? Esta acción no se puede deshacer.
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
