import Link from "next/link"
import {
  Camera,
  CircleDot,
  Radio,
  TowerControl,
  Workflow,
} from "lucide-react"

import type { ActivityItem } from "@/lib/data/dashboard"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

const activityConfig = {
  fiber: {
    label: "Fibra",
    icon: Radio,
    className: "bg-blue-50 text-blue-700 border-blue-100",
  },
  camera: {
    label: "Cámaras",
    icon: Camera,
    className: "bg-violet-50 text-violet-700 border-violet-100",
  },
  wireless: {
    label: "Wireless",
    icon: TowerControl,
    className: "bg-amber-50 text-amber-700 border-amber-100",
  },
  pole: {
    label: "Postes",
    icon: CircleDot,
    className: "bg-stone-100 text-stone-700 border-stone-200",
  },
  general: {
    label: "General",
    icon: Workflow,
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
} as const

type RecentActivityProps = {
  items: ActivityItem[]
}

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>
          Últimas actualizaciones de obras y cuadrillas en campo
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <ScrollArea className="h-[420px] pr-3">
          <div className="space-y-4">
            {items.map((item, index) => {
              const config = activityConfig[item.type]
              const Icon = config.icon

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="relative flex gap-3 rounded-lg transition-colors hover:bg-muted/30"
                >
                  {index < items.length - 1 && (
                    <span className="absolute top-8 left-[15px] h-[calc(100%+4px)] w-px bg-border" />
                  )}

                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium",
                          config.className
                        )}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{item.project}</span>
                      <span>·</span>
                      <span>{item.crew}</span>
                      <span>·</span>
                      <span>{item.timestamp}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
