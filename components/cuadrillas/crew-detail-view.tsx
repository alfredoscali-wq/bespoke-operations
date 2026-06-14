"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, MoreHorizontal, Pencil, Trash2, User, Users } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { CrewFormDialog } from "@/components/cuadrillas/crew-form-dialog"
import { CrewDetailStats } from "@/components/cuadrillas/crew-detail-stats"
import { CrewStatusBadge } from "@/components/cuadrillas/crew-badges"
import { CrewActivityTab } from "@/components/cuadrillas/crew-tabs/activity-tab"
import { CrewMaterialsTab } from "@/components/cuadrillas/crew-tabs/materials-tab"
import { CrewMembersTab } from "@/components/cuadrillas/crew-tabs/members-tab"
import { CrewPerformanceTab } from "@/components/cuadrillas/crew-tabs/performance-tab"
import { CrewProjectsTab } from "@/components/cuadrillas/crew-tabs/projects-tab"
import { CrewTasksTab } from "@/components/cuadrillas/crew-tabs/tasks-tab"
import { useOperationalData } from "@/components/cuadrillas/use-operational-data"
import type { Crew, CrewDetail, NewCrewInput } from "@/lib/types/crews"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type CrewDetailViewProps = {
  crew: Crew
  detail: CrewDetail
}

export function CrewDetailView({ crew, detail }: CrewDetailViewProps) {
  const { tasks, projects } = useOperationalData()
  const { editCrew, removeCrew } = useCrews()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const activeMembers = useMemo(
    () => crew.members.filter((member) => member.active).length,
    [crew.members]
  )

  async function handleEdit(input: NewCrewInput) {
    const result = await editCrew(crew.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la cuadrilla.")
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    const result = await removeCrew(crew.id)
    setIsDeleting(false)
    if (result.success) {
      window.location.href = "/cuadrillas"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 text-muted-foreground"
            asChild
          >
            <Link href="/cuadrillas">
              <ArrowLeft className="size-4" />
              Volver a cuadrillas
            </Link>
          </Button>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CrewStatusBadge status={crew.status} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {crew.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Supervisión: {crew.supervisor}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 self-start">
              Acciones
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar cuadrilla
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Eliminar cuadrilla
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Información de la cuadrilla</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
              <Users className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="text-sm font-medium">{crew.name}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
              <User className="size-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Supervisor</p>
              <p className="text-sm font-medium">{crew.supervisor}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Users className="size-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Integrantes activos</p>
              <p className="text-sm font-medium">
                {activeMembers} de {crew.members.length}
              </p>
            </div>
          </div>
          <div className="flex gap-3 sm:col-span-2 lg:col-span-1">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <FileText className="size-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Descripción</p>
              <p className="text-sm font-medium">
                {crew.description || "Sin descripción"}
              </p>
            </div>
          </div>
        </CardContent>
        {crew.notes && (
          <CardContent className="border-t pt-4">
            <p className="text-xs text-muted-foreground">Observaciones</p>
            <p className="mt-1 text-sm">{crew.notes}</p>
          </CardContent>
        )}
      </Card>

      <CrewDetailStats stats={detail.stats} />

      <Separator />

      <Tabs defaultValue="members" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="members">Integrantes</TabsTrigger>
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
            <TabsTrigger value="projects">Proyectos</TabsTrigger>
            <TabsTrigger value="materials">Materiales</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="performance">Desempeño</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="members">
          <CrewMembersTab crew={crew} />
        </TabsContent>
        <TabsContent value="tasks">
          <CrewTasksTab crew={crew} tasks={tasks} />
        </TabsContent>
        <TabsContent value="projects">
          <CrewProjectsTab crew={crew} tasks={tasks} projects={projects} />
        </TabsContent>
        <TabsContent value="materials">
          <CrewMaterialsTab crew={crew} />
        </TabsContent>
        <TabsContent value="activity">
          <CrewActivityTab activity={detail.activity} />
        </TabsContent>
        <TabsContent value="performance">
          <CrewPerformanceTab performance={detail.performance} />
        </TabsContent>
      </Tabs>

      <CrewFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        crew={crew}
        onSubmit={handleEdit}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cuadrilla</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta cuadrilla? Las tareas asociadas conservarán el
              nombre pero perderán la referencia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
