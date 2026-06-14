import type { OperationsSegment } from "@/lib/data/dashboard"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type OperationsOverviewProps = {
  segments: OperationsSegment[]
}

export function OperationsOverview({ segments }: OperationsOverviewProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Avance por Tipo de Obra</CardTitle>
        <CardDescription>
          Distribución del progreso operativo en obras activas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {segments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay obras activas para mostrar avance por tipo.
          </p>
        ) : (
          segments.map((segment) => (
          <div key={segment.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{segment.label}</span>
              <span className="text-muted-foreground">{segment.value}%</span>
            </div>
            <Progress value={segment.value} className="h-2" />
          </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
