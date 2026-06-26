"use client"

import { useMemo } from "react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { OperarioTaskCard } from "@/components/operario/operario-task-card"
import {
  OperarioCrewEmptyState,
  OperarioCrewStatusMessage,
} from "@/components/operario/operario-crew-status-message"
import { useOperario } from "@/components/operario/operario-provider"
import {
  getOperarioTodayTasks,
  summarizeOperarioTodayTasks,
} from "@/lib/data/operario"

function OperarioJornadaKpis({
  programadas,
  vencidas,
  enCurso,
  pendientesCierre,
  incidencias,
}: {
  programadas: number
  vencidas: number
  enCurso: number
  pendientesCierre: number
  incidencias: number
}) {
  const items = [
    { label: "Programadas", value: programadas },
    { label: "Vencidas", value: vencidas },
    { label: "En curso", value: enCurso },
    { label: "Pend. de cierre", value: pendientesCierre },
    { label: "Incidencias", value: incidencias },
  ]

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border bg-card px-2 py-2.5 text-center shadow-sm"
        >
          <dt className="text-[10px] leading-tight text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function OperarioHomeScreen() {
  const { tasks } = useTasks()
  const {
    identity,
    isIdentityReady,
    workerCrewRef,
    crewStatus,
    assignedCrewNames,
    isCrewReady,
  } = useOperario()
  const hasCrew =
    crewStatus === "resolved" || crewStatus === "multiple"

  const todayTasks = useMemo(
    () =>
      hasCrew ? getOperarioTodayTasks(tasks, workerCrewRef) : [],
    [hasCrew, tasks, workerCrewRef]
  )
  const summary = useMemo(
    () => summarizeOperarioTodayTasks(todayTasks),
    [todayTasks]
  )

  return (
    <div className="space-y-5 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isIdentityReady ? (
            <>Hola, {identity.displayName}</>
          ) : (
            <span className="inline-block h-8 w-48 animate-pulse rounded bg-muted" />
          )}
        </h1>
      </header>

      <OperarioCrewStatusMessage
        crewStatus={crewStatus}
        primaryCrewName={workerCrewRef.name}
        assignedCrewNames={assignedCrewNames}
      />

      {!isCrewReady || crewStatus === "loading" || crewStatus === "unassigned" ? (
        <OperarioCrewEmptyState crewStatus={crewStatus} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Mi jornada
            </h2>
            <OperarioJornadaKpis
              programadas={summary.programadas}
              vencidas={summary.vencidas}
              enCurso={summary.enCurso}
              pendientesCierre={summary.pendientesCierre}
              incidencias={summary.incidencias}
            />
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Órdenes de trabajo de hoy
              </h2>
              <p className="text-xs text-muted-foreground">
                Solo se muestran las órdenes de trabajo de la jornada actual.
              </p>
            </div>

            {todayTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  No tenés órdenes de trabajo programadas para hoy.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <OperarioTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
