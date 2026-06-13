import {
  HardHat,
  Package,
  Truck,
  Users,
  Wrench,
} from "lucide-react"

import type { ProjectCosts } from "@/lib/types/projects"
import { formatCurrency } from "@/lib/projects/constants"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectCostsTabProps = {
  costs: ProjectCosts
}

const costItems = [
  {
    key: "materials" as const,
    label: "Materiales",
    description: "Cable, conectores, postes, cámaras y consumibles",
    icon: Package,
  },
  {
    key: "labor" as const,
    label: "Mano de Obra",
    description: "Cuadrillas de campo y supervisión técnica",
    icon: Users,
  },
  {
    key: "equipment" as const,
    label: "Equipo",
    description: "Fusionadoras, OTDR, herramientas especializadas",
    icon: Wrench,
  },
  {
    key: "vehicles" as const,
    label: "Vehículos",
    description: "Transporte, grúas y unidades de soporte",
    icon: Truck,
  },
]

export function ProjectCostsTab({ costs }: ProjectCostsTabProps) {
  const total =
    costs.materials + costs.labor + costs.equipment + costs.vehicles

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {costItems.map((item) => {
          const Icon = item.icon

          return (
            <Card key={item.key} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {item.label}
                  </CardTitle>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {item.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold tracking-tight">
                  {formatCurrency(costs[item.key])}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="size-5" />
            </div>
            <div>
              <CardTitle>Costo Total</CardTitle>
              <CardDescription>
                Suma estimada de todos los rubros del proyecto
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tracking-tight">
            {formatCurrency(total)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Datos de referencia. Integración con ERP pendiente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
