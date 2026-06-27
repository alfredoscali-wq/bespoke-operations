"use client"

import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Campana de notificaciones del header — reservada para una futura integración.
 * Importar en `AppHeader` cuando el centro de notificaciones esté implementado.
 */
export function AppHeaderNotifications() {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative text-muted-foreground"
      aria-label="Notificaciones"
    >
      <Bell className="size-4" />
      <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
    </Button>
  )
}
