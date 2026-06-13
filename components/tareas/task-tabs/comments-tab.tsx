import type { TaskComment } from "@/lib/types/tasks"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskCommentsTabProps = {
  comments: TaskComment[]
}

const roleLabels = {
  supervisor: "Supervisor",
  operario: "Operario",
  coordinador: "Coordinador",
}

const roleStyles = {
  supervisor: "bg-primary/10 text-primary",
  operario: "bg-slate-100 text-slate-700",
  coordinador: "bg-violet-50 text-violet-700",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function TaskCommentsTab({ comments }: TaskCommentsTabProps) {
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  if (sortedComments.length === 0) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay comentarios registrados.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Comentarios del proyecto</CardTitle>
        <CardDescription>
          Notas de supervisión y respuestas de campo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedComments.map((comment) => (
          <div
            key={comment.id}
            className="flex gap-3 rounded-lg border bg-muted/20 p-4"
          >
            <Avatar size="sm">
              <AvatarFallback
                className={cn("text-[10px] font-medium", roleStyles[comment.role])}
              >
                {getInitials(comment.author)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {comment.author}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {roleLabels[comment.role]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  · {formatTaskDateTime(comment.timestamp)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
