"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArrowUpRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { ProjectEditDialog } from "@/components/obras/project-edit-dialog"
import {
  ProjectStatusBadge,
  ProjectTypeBadge,
} from "@/components/obras/project-badges"
import type { NewProjectInput, Project } from "@/lib/types/projects"
import { formatDate } from "@/lib/projects/constants"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { PROJECT_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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

type ProjectsTableProps = {
  projects: Project[]
}

type DestructiveAction = "archive" | "delete"

export function ProjectsTable({ projects }: ProjectsTableProps) {
  const { updateProject, archiveProject } = useProjects()
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [destructiveTarget, setDestructiveTarget] = useState<Project | null>(
    null
  )
  const [destructiveAction, setDestructiveAction] =
    useState<DestructiveAction>("archive")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  async function handleEdit(input: NewProjectInput) {
    if (!editTarget) return

    const result = await updateProject(editTarget.id, {
      name: input.name,
      code: input.code,
      client: input.client,
      type: input.type,
      location: input.location,
      description: input.description,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      supervisor: input.supervisor,
    })

    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la obra.")
    }

    setEditTarget(null)
    setFeedback({
      variant: "success",
      message: "Obra actualizada correctamente.",
    })
  }

  function openDestructiveDialog(project: Project, action: DestructiveAction) {
    setDestructiveAction(action)
    setDestructiveTarget(project)
  }

  async function handleConfirmDestructive() {
    if (!destructiveTarget) return

    setIsSubmitting(true)
    const result = await archiveProject(destructiveTarget.id)
    setIsSubmitting(false)

    if (!result.success) {
      setFeedback({
        variant: "error",
        message: PROJECT_DELETE_USER_MESSAGE,
      })
      return
    }

    setDestructiveTarget(null)
    setFeedback({
      variant: "success",
      message:
        destructiveAction === "archive"
          ? "Obra archivada correctamente."
          : "Obra eliminada del listado operativo.",
    })
  }

  function renderActions(project: Project) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hover:bg-muted"
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/obras/${project.id}`}>
              <Eye className="size-4" />
              Ver detalle
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditTarget(project)}>
            <Pencil className="size-4" />
            Editar obra
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => openDestructiveDialog(project, "archive")}
          >
            <Archive className="size-4" />
            Archivar obra
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => openDestructiveDialog(project, "delete")}
          >
            <Trash2 className="size-4" />
            Eliminar obra
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron obras
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los filtros o crea una nueva obra para comenzar.
        </p>
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
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="min-w-[140px]">Avance</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id} className="group">
                  <TableCell className="font-mono text-xs font-medium">
                    {project.code}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/obras/${project.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.client}
                  </TableCell>
                  <TableCell>
                    <ProjectTypeBadge type={project.type} />
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={project.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={project.progress} className="h-1.5 flex-1" />
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                        {project.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(project.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(project.endDate)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {project.supervisor}
                  </TableCell>
                  <TableCell>{renderActions(project)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <Link href={`/obras/${project.id}`} className="min-w-0 flex-1">
                <p className="font-mono text-xs font-medium text-primary">
                  {project.code}
                </p>
                <p className="font-medium leading-snug text-foreground">
                  {project.name}
                </p>
                <p className="text-xs text-muted-foreground">{project.client}</p>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                {renderActions(project)}
                <Link href={`/obras/${project.id}`}>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </Link>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ProjectTypeBadge type={project.type} />
              <ProjectStatusBadge status={project.status} />
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avance</span>
                <span className="font-medium tabular-nums">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-1.5" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <span>Inicio: {formatDate(project.startDate)}</span>
              <span>Fin: {formatDate(project.endDate)}</span>
              <span className="col-span-2 truncate">{project.supervisor}</span>
            </div>
          </div>
        ))}
      </div>

      {editTarget && (
        <ProjectEditDialog
          project={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
          onSubmit={handleEdit}
        />
      )}

      <Dialog
        open={destructiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDestructiveTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {destructiveAction === "archive"
                ? "Archivar obra"
                : "Eliminar obra"}
            </DialogTitle>
            <DialogDescription>
              {destructiveAction === "archive"
                ? "La obra dejará de aparecer en operaciones activas. Los datos se conservan en archivo lógico."
                : "La obra se eliminará del listado operativo (archivo lógico). Esta acción no borra datos históricos."}
              {destructiveTarget ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {destructiveTarget.name}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDestructiveTarget(null)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDestructive}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Procesando..."
                : destructiveAction === "archive"
                  ? "Archivar"
                  : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
