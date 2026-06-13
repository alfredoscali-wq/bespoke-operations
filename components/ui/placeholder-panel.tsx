import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PlaceholderPanelProps = {
  title: string
  description: string
  icon: LucideIcon
}

export function PlaceholderPanel({
  title,
  description,
  icon: Icon,
}: PlaceholderPanelProps) {
  return (
    <Card className="border-dashed shadow-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-md">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Módulo en construcción. La navegación y el layout están listos para
          integrar datos reales.
        </div>
      </CardContent>
    </Card>
  )
}
