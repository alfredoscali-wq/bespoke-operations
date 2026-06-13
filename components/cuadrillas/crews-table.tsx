"use client"

import Link from "next/link"
import { Users } from "lucide-react"

import { CrewStatusBadge } from "@/components/cuadrillas/crew-badges"
import type { CrewListItem } from "@/lib/types/crews"
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

type CrewsTableProps = {
  crews: CrewListItem[]
}

export function CrewsTable({ crews }: CrewsTableProps) {
  if (crews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron cuadrillas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los filtros para ver más resultados.
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
                <TableHead>Cuadrilla</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Integrantes</TableHead>
                <TableHead>Tareas Activas</TableHead>
                <TableHead>Proyectos Activos</TableHead>
                <TableHead>Estado</TableHead>
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
                  <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                    {crew.specialty}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {crews.map((crew) => (
          <Link key={crew.id} href={`/cuadrillas/${crew.id}`}>
            <Card className="h-full shadow-sm transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{crew.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {crew.specialty}
                    </CardDescription>
                  </div>
                  <CrewStatusBadge status={crew.status} />
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
          </Link>
        ))}
      </div>
    </>
  )
}
