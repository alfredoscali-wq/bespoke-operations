"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { WorkOrderFtthInstallationFields } from "@/components/tareas/work-order-ftth-installation-fields"
import {
  applyFtthValuesToOperationalSteps,
  findFtthTextStepId,
  resolveFtthInstallationFromTask,
  taskRequiresFtthInstallation,
  type FtthTextStepKey,
} from "@/lib/tasks/ftth-installation"
import type { Task } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"

type OperarioFtthInstallationCardProps = {
  task: Task
  actionsDisabled?: boolean
  onSaved?: () => void
}

export function OperarioFtthInstallationCard({
  task,
  actionsDisabled = false,
  onSaved,
}: OperarioFtthInstallationCardProps) {
  const { updateOperationalStepObservation } = useTasks()
  const [values, setValues] = useState(() => resolveFtthInstallationFromTask(task))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(resolveFtthInstallationFromTask(task))
  }, [task])

  if (!taskRequiresFtthInstallation(task)) {
    return null
  }

  const savedValues = resolveFtthInstallationFromTask(task)
  const isDirty =
    values.napBox.trim() !== savedValues.napBox.trim() ||
    values.napPort.trim() !== savedValues.napPort.trim() ||
    values.onuSerial.trim() !== savedValues.onuSerial.trim()

  async function persistField(
    stepKey: FtthTextStepKey,
    value: string,
    nextValues: typeof values
  ) {
    const stepId = findFtthTextStepId(task.operationalSteps ?? [], stepKey)
    if (!stepId) {
      throw new Error("No se encontró el paso operativo FTTH.")
    }

    const result = await updateOperationalStepObservation(task.id, stepId, value)
    if (!result.success) {
      throw new Error(result.message ?? "No fue posible guardar los datos FTTH.")
    }

    applyFtthValuesToOperationalSteps(task.operationalSteps ?? [], {
      napBox: nextValues.napBox,
      napPort: nextValues.napPort,
      onuSerial: nextValues.onuSerial,
    })
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      await persistField("nap_box", values.napBox, values)
      await persistField("nap_port", values.napPort, values)
      await persistField("onu_serial", values.onuSerial, values)
      onSaved?.()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar los datos FTTH."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Instalación FTTH
      </h2>
      <WorkOrderFtthInstallationFields
        technology="fiber"
        values={values}
        onNapBoxChange={(value) =>
          setValues((current) => ({ ...current, napBox: value }))
        }
        onNapPortChange={(value) =>
          setValues((current) => ({ ...current, napPort: value }))
        }
        onOnuSerialChange={(value) =>
          setValues((current) => ({ ...current, onuSerial: value }))
        }
        readOnly={actionsDisabled}
        planReadOnly
        showPlan
        showInstallationFields
        idPrefix="operario-ftth"
        planLabel="Plan contratado"
      />
      {!actionsDisabled && isDirty ? (
        <Button
          type="button"
          className="mt-3 h-11 w-full rounded-xl text-base font-semibold"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar datos FTTH"
          )}
        </Button>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
