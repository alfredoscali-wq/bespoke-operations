import { History } from "lucide-react"

import { PlaceholderPanel } from "@/components/ui/placeholder-panel"

export default function HistorialPage() {
  return (
    <PlaceholderPanel
      icon={History}
      title="Registro histórico"
      description="Audita movimientos por obra, cuadrilla y tipo de operación con filtros avanzados."
    />
  )
}
