import Link from "next/link"

import { ProjectStatusBadge } from "@/components/obras/project-badges"
import { getCrewProjects } from "@/lib/crews/utils"
import type { Crew } from "@/lib/types/crews"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import { Progress } from "@/components/ui/progress"
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

type CrewProjectsTabProps = {
  crew: Crew
  tasks: Task[]
  projects: Project[]
}

export function CrewProjectsTab({
  crew,
  tasks,
  projects,
}: CrewProjectsTabProps) {
  const crewProjects = getCrewProjects(crew, tasks, projects)

  if (crewProjects.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Obras activas</CardTitle>
          <CardDescription>
            No hay obras activas vinculadas a esta cuadrilla.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Obras activas</CardTitle>
        <CardDescription>
          Obras en curso con asignaciones de {crew.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-hidden rounded-xl border lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Obra</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crewProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/obras/${project.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {project.code}
                    </Link>
                    <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {project.name}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <Progress value={project.progress} className="h-1.5" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {project.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={project.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 lg:hidden">
          {crewProjects.map((project) => (
            <Link
              key={project.id}
              href={`/obras/${project.id}`}
              className="block rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-primary">
                    {project.code}
                  </p>
                  <p className="font-medium">{project.name}</p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Avance</span>
                  <span className="tabular-nums">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-1.5" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
