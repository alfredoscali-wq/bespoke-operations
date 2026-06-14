import { EntityMaterialsList } from "@/components/materiales/entity-materials-list"
import { getMaterialById } from "@/lib/data/materials"
import type { MaterialAssignment } from "@/lib/types/materials"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type MaterialAssignmentsTabProps = {
  assignments: MaterialAssignment[]
}

export function MaterialAssignmentsTab({
  assignments,
}: MaterialAssignmentsTabProps) {
  const items = assignments
    .map((assignment) => {
      const material = getMaterialById(assignment.materialId)
      return material ? { assignment, material } : null
    })
    .filter(
      (
        item
      ): item is {
        assignment: MaterialAssignment
        material: NonNullable<ReturnType<typeof getMaterialById>>
      } => Boolean(item)
    )

  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Asignaciones</CardTitle>
          <CardDescription>
            Este material no tiene asignaciones activas o históricas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Cadena de asignación</h3>
        <p className="text-sm text-muted-foreground">
          Material → Proyecto → Tarea → Cuadrilla
        </p>
      </div>
      <EntityMaterialsList items={items} />
    </div>
  )
}
