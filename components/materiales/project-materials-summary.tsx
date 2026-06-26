import Link from "next/link"
import { Package, PackageCheck } from "lucide-react"

import {
  getAssignmentsByProjectId,
  getProjectMaterialsStats,
} from "@/lib/data/materials"
import { formatMaterialDateTime } from "@/lib/materials/constants"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectMaterialsSummaryProps = {
  projectId: string
}

export function ProjectMaterialsSummary({
  projectId,
}: ProjectMaterialsSummaryProps) {
  const stats = getProjectMaterialsStats(projectId)
  const items = getAssignmentsByProjectId(projectId)
  const latestAssignment = items
    .map((item) => item.assignment)
    .sort(
      (a, b) =>
        new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
    )[0]

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Materiales de la obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
            <Package className="size-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Tipos de material</p>
              <p className="text-lg font-semibold tabular-nums">
                {stats.materialCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
            <PackageCheck className="size-4 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Asignaciones</p>
              <p className="text-lg font-semibold tabular-nums">
                {stats.totalItems}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Cantidad total asignada</p>
          <p className="font-medium tabular-nums">
            {stats.totalQuantity.toLocaleString("es-MX")} unidades
          </p>
          {latestAssignment && (
            <p className="mt-2 text-xs text-muted-foreground">
              Última asignación:{" "}
              {formatMaterialDateTime(latestAssignment.assignedAt)}
            </p>
          )}
        </div>

        <Link
          href="/materiales"
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          Ver inventario →
        </Link>
      </CardContent>
    </Card>
  )
}
