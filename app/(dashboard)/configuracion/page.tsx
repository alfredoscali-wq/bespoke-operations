import { Settings } from "lucide-react"

import { PlaceholderPanel } from "@/components/ui/placeholder-panel"

export default function ConfiguracionPage() {
  return (
    <PlaceholderPanel
      icon={Settings}
      title="Ajustes generales"
      description="Configura unidades, tipos de obra, plantillas de tareas y notificaciones operativas."
    />
  )
}
