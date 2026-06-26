"use client"

import { useMemo } from "react"
import Link from "next/link"

import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  CrewAvailabilityBadge,
  CrewStatusBadge,
} from "@/components/cuadrillas/crew-badges"
import { getCrewAvailability } from "@/lib/crews/availability"
import { resolveCrewSupervisorDisplay } from "@/lib/crews/supervisor"
import {
  getActiveTasksForProject,
  getProjectCrews,
} from "@/lib/projects/utils"
import type { Project } from "@/lib/types/projects"
import {
  Card,
  CardContent,
  CardDescription,
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

type ProjectCrewsTabProps = {
  project: Project
}

export function ProjectCrewsTab({ project }: ProjectCrewsTabProps) {
  const { tasks } = useTasks()
  const { crews } = useCrews()
  const { getEmployee } = useEmployees()
  const { records: availabilityRecords } = useAvailability()

  const availabilityContext = useMemo(
    () => ({
      availabilityRecords,
      getEmployee,
    }),
    [availabilityRecords, getEmployee]
  )

  const activeProjectTasks = useMemo(
    () => getActiveTasksForProject(project, tasks),
    [project, tasks]
  )

  const projectCrews = useMemo(
    () => getProjectCrews(project, tasks, crews),
    [project, tasks, crews]
  )

  if (activeProjectTasks.length === 0 || projectCrews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          Sin cuadrillas asignadas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeProjectTasks.length === 0
            ? "No hay órdenes de trabajo activas en esta obra."
            : "Asigne cuadrilla en las órdenes de trabajo activas para ver su disponibilidad operativa aquí."}
        </p>
      </div>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Cuadrillas asignadas</CardTitle>
        <CardDescription>
          Cuadrillas derivadas de órdenes de trabajo activas de la obra (
          {activeProjectTasks.length}{" "}
          {activeProjectTasks.length === 1 ? "orden de trabajo" : "órdenes de trabajo"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Estado operativo</TableHead>
              <TableHead className="text-right">Integrantes</TableHead>
              <TableHead className="text-right">Disponibles</TableHead>
              <TableHead className="text-right">Ausentes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectCrews.map((crew) => {
              const availability = getCrewAvailability(crew, availabilityContext)

              return (
                <TableRow key={crew.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <Link
                        href={`/cuadrillas/${crew.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {crew.name}
                      </Link>
                      <CrewStatusBadge status={crew.status} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {resolveCrewSupervisorDisplay(crew, getEmployee).displayName}
                  </TableCell>
                  <TableCell>
                    <CrewAvailabilityBadge status={availability.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {availability.totalMembers}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {availability.availableMembers}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {availability.absentMembers}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
