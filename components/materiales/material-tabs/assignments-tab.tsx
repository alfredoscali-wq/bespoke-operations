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
  if (assignments.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Asignaciones</CardTitle>
          <CardDescription>
            Las asignaciones a órdenes de trabajo se habilitarán en Materiales
            1.1 junto con Planning.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return null
}
