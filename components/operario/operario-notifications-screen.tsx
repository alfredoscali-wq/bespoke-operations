"use client"

import Link from "next/link"
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  XCircle,
} from "lucide-react"

import { useOperario } from "@/components/operario/operario-provider"
import type { OperarioNotificationType } from "@/lib/data/operario"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const notificationIcons: Record<
  OperarioNotificationType,
  { icon: typeof Bell; className: string }
> = {
  "task-assigned": {
    icon: ClipboardList,
    className: "bg-blue-50 text-blue-600",
  },
  "comment-received": {
    icon: MessageSquare,
    className: "bg-violet-50 text-violet-600",
  },
  "task-approved": {
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-600",
  },
  "task-rejected": {
    icon: XCircle,
    className: "bg-red-50 text-red-600",
  },
}

export function OperarioNotificationsScreen() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useOperario()

  return (
    <div className="space-y-4 px-4 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount} sin leer
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl"
            onClick={markAllAsRead}
          >
            Marcar todas
          </Button>
        )}
      </header>

      <div className="space-y-3">
        {notifications.map((notification) => {
          const config = notificationIcons[notification.type]
          const Icon = config.icon

          const card = (
            <div
              className={cn(
                "flex gap-3 rounded-2xl border bg-card p-4 shadow-sm",
                !notification.read && "border-primary/25 bg-primary/5"
              )}
              onClick={() => markAsRead(notification.id)}
            >
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl",
                  config.className
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {notification.title}
                  </p>
                  {!notification.read && (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {notification.message}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {formatTaskDateTime(notification.timestamp)}
                </p>
              </div>
            </div>
          )

          if (notification.taskId) {
            return (
              <Link
                key={notification.id}
                href={`/operario/tarea/${notification.taskId}`}
                className="block active:opacity-80"
              >
                {card}
              </Link>
            )
          }

          return <div key={notification.id}>{card}</div>
        })}
      </div>
    </div>
  )
}
