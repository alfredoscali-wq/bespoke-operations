"use client"

import Link from "next/link"
import { ArrowUpRight, MoreHorizontal } from "lucide-react"

import type { Project } from "@/lib/types/projects"
import { formatDate } from "@/lib/projects/constants"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
import {
  ProjectStatusBadge,
  ProjectTypeBadge,
} from "@/components/obras/project-badges"

type ProjectsTableProps = {
  projects: Project[]
}

export function ProjectsTable({ projects }: ProjectsTableProps) {
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/obras/${project.id}`}>
                            Ver detalle
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/obras/${project.id}`}
            className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-mono text-xs font-medium text-primary">
                  {project.code}
                </p>
                <p className="font-medium leading-snug text-foreground">
                  {project.name}
                </p>
                <p className="text-xs text-muted-foreground">{project.client}</p>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
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
          </Link>
        ))}
      </div>
    </>
  )
}
