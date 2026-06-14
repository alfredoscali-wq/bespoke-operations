import Link from "next/link"
import { Package } from "lucide-react"

import { EntityMaterialsList } from "@/components/materiales/entity-materials-list"
import { getAssignmentsByTaskId } from "@/lib/data/materials"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskMaterialsPanelProps = {
  taskId: string
}

export function TaskMaterialsPanel({ taskId }: TaskMaterialsPanelProps) {
  const items = getAssignmentsByTaskId(taskId)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Materiales asignados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
          <Package className="size-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total asignaciones</p>
            <p className="text-lg font-semibold tabular-nums">{items.length}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay materiales asignados a esta tarea.
          </p>
        ) : (
          <EntityMaterialsList items={items} />
        )}

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
