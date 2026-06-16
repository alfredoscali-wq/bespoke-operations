"use client"

import { AlertTriangle } from "lucide-react"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CalendarOperationalAlerts() {
  const { alerts } = useCalendarUI()

  if (alerts.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-200/80 bg-amber-500/[0.04] shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5">
        <CardTitle className="text-sm font-semibold text-foreground">
          Alertas Operativas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>{alert.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
