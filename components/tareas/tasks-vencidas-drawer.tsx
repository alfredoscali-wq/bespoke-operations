"use client"

import { useMemo, useState } from "react"

import { TaskReprogramFromVencidaDialog } from "@/components/tareas/task-reprogram-from-vencida-dialog"
import {
  formatTaskDate,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import { listVencidaTasks } from "@/lib/tasks/vencida-status"
import type { Task } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TasksVencidasDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
}

export function TasksVencidasDrawer({
  open,
  onOpenChange,
  tasks,
}: TasksVencidasDrawerProps) {
  const vencidas = useMemo(() => listVencidaTasks(tasks), [tasks])
  const [reprogramTask, setReprogramTask] = useState<Task | null>(null)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 sm:max-w-xl"
          aria-describedby={undefined}
        >
          <SheetHeader className="border-b">
            <SheetTitle>OT Vencidas</SheetTitle>
            <SheetDescription>
              Órdenes que no pudieron ejecutarse y requieren reprogramación.
              No se pueden eliminar ni cerrar desde aquí.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {vencidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay OT vencidas en el listado activo.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha original</TableHead>
                    <TableHead>Cuadrilla</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vencidas.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium tabular-nums">
                        {formatTaskAdminDisplayCode(task.code)}
                      </TableCell>
                      <TableCell className="max-w-[9rem] truncate">
                        {task.customerName?.trim() || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {formatTaskDate(task.dueDate)}
                      </TableCell>
                      <TableCell className="max-w-[8rem] truncate">
                        {task.crew?.trim() || "Sin cuadrilla"}
                      </TableCell>
                      <TableCell>
                        {TASK_STATUS_LABELS[task.status] ?? task.status}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setReprogramTask(task)}
                        >
                          Reprogramar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TaskReprogramFromVencidaDialog
        open={Boolean(reprogramTask)}
        onOpenChange={(next) => {
          if (!next) setReprogramTask(null)
        }}
        task={reprogramTask}
        onSuccess={() => setReprogramTask(null)}
      />
    </>
  )
}
