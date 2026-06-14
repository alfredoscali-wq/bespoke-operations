import Link from "next/link"
import { Package } from "lucide-react"

import { EntityMaterialsList } from "@/components/materiales/entity-materials-list"
import {
  getAssignmentsByCrewId,
  getCrewMaterialsStats,
} from "@/lib/data/materials"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CrewMaterialsPanelProps = {
  crewId: string
  crewName: string
}

export function CrewMaterialsPanel({
  crewId,
  crewName,
}: CrewMaterialsPanelProps) {
  const stats = getCrewMaterialsStats(crewId)
  const items = getAssignmentsByCrewId(crewId)

  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Materiales asignados</CardTitle>
          <CardDescription>
            No hay materiales asignados a {crewName}.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Materiales en campo</CardTitle>
          <CardDescription>
            {stats.materialCount}{" "}
            {stats.materialCount === 1 ? "tipo" : "tipos"} de material ·{" "}
            {stats.totalItems}{" "}
            {stats.totalItems === 1 ? "asignación" : "asignaciones"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
            <Package className="size-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">
                Cantidad total bajo custodia
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {stats.totalQuantity.toLocaleString("es-MX")} unidades
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <EntityMaterialsList items={items} />

      <Link
        href="/materiales"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        Ver inventario completo →
      </Link>
    </div>
  )
}
