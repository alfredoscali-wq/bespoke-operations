import { getAssignmentsByProjectId } from "@/lib/data/materials"
import type { AssignmentStatus } from "@/lib/types/materials"
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

type ProjectMaterialsTabProps = {
  projectId: string
}

function getUsedQuantity(quantity: number, status: AssignmentStatus): number {
  switch (status) {
    case "consumed":
      return quantity
    case "in-use":
      return Math.round(quantity * 0.6)
    case "returned":
      return 0
    default:
      return 0
  }
}

export function ProjectMaterialsTab({ projectId }: ProjectMaterialsTabProps) {
  const items = getAssignmentsByProjectId(projectId)

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          Sin materiales asignados
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Estructura preparada para integración futura con inventario y consumo.
        </p>
      </div>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Materiales del proyecto</CardTitle>
        <CardDescription>
          Asignaciones, utilización y pendiente por material
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Cantidad asignada</TableHead>
              <TableHead className="text-right">Cantidad utilizada</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(({ assignment, material }) => {
              const assigned = assignment.quantity
              const used = getUsedQuantity(assigned, assignment.status)
              const pending = Math.max(assigned - used, 0)

              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium">{material.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {material.code}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {assigned.toLocaleString("es-MX")} {assignment.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {used.toLocaleString("es-MX")} {assignment.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pending.toLocaleString("es-MX")} {assignment.unit}
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
