import Link from "next/link"
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Package,
  Users,
} from "lucide-react"

import { AssignmentStatusBadge } from "@/components/materiales/material-badges"
import { formatMaterialDateTime } from "@/lib/materials/constants"
import type { Material, MaterialAssignment } from "@/lib/types/materials"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EntityMaterialsListProps = {
  items: Array<{
    assignment: MaterialAssignment
    material: Material
  }>
  showMaterial?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function EntityMaterialsList({
  items,
  showMaterial = true,
  emptyTitle = "Sin materiales asignados",
  emptyDescription = "No hay asignaciones registradas para este registro.",
}: EntityMaterialsListProps) {
  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{emptyTitle}</CardTitle>
          <CardDescription>{emptyDescription}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(({ assignment, material }) => (
        <Card key={assignment.id} className="shadow-sm">
          <CardContent className="space-y-4 pt-6">
            {showMaterial && (
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                  <Package className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/materiales/${material.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {material.code}
                  </Link>
                  <p className="font-medium">{material.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.quantity.toLocaleString("es-MX")}{" "}
                    {assignment.unit}
                  </p>
                </div>
                <AssignmentStatusBadge status={assignment.status} />
              </div>
            )}

            {!showMaterial && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {assignment.quantity.toLocaleString("es-MX")}{" "}
                  {assignment.unit}
                </p>
                <AssignmentStatusBadge status={assignment.status} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {showMaterial && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
                    <Package className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{material.name}</span>
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </>
              )}

              <Link
                href={`/obras/${assignment.projectId}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 hover:bg-muted/50"
              >
                <Briefcase className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{assignment.projectCode}</span>
              </Link>

              <ArrowRight className="size-3.5 text-muted-foreground" />

              <Link
                href={`/tareas/${assignment.taskId}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 hover:bg-muted/50"
              >
                <CheckSquare className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{assignment.taskCode}</span>
              </Link>

              <ArrowRight className="size-3.5 text-muted-foreground" />

              <Link
                href={`/cuadrillas/${assignment.crewId}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 hover:bg-muted/50"
              >
                <Users className="size-3.5 text-muted-foreground" />
                <span>{assignment.crewName}</span>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              Asignado el {formatMaterialDateTime(assignment.assignedAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
