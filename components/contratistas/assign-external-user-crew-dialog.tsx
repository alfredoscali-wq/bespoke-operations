"use client"

import { useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import { filterExternalCrews } from "@/lib/crews/origin"
import type { Crew } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DiscardChangesDialog,
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AssignExternalUserCrewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractorId: string
  employee: Employee | null
  onAssigned?: () => void
}

type FormState = {
  crewId: string
  roleInCrew: string
}

function findActiveMembership(
  crews: Crew[],
  employeeId: string
): { crew: Crew; memberId: string } | null {
  for (const crew of crews) {
    const member = crew.members.find(
      (item) => item.employeeId === employeeId && item.active
    )
    if (member) {
      return { crew, memberId: member.id }
    }
  }
  return null
}

export function AssignExternalUserCrewDialog(
  props: AssignExternalUserCrewDialogProps
) {
  if (!props.open || !props.employee) {
    return <Dialog open={false} onOpenChange={props.onOpenChange} />
  }

  return (
    <AssignExternalUserCrewDialogBody
      key={`${props.employee.id}-${props.contractorId}`}
      {...props}
      employee={props.employee}
    />
  )
}

function AssignExternalUserCrewDialogBody({
  open,
  onOpenChange,
  contractorId,
  employee,
  onAssigned,
}: AssignExternalUserCrewDialogProps & { employee: Employee }) {
  const { crews, addMember, removeMember, editMember } = useCrews()
  const contractorCrews = useMemo(
    () => filterExternalCrews(crews, contractorId),
    [crews, contractorId]
  )
  const current = useMemo(
    () => findActiveMembership(contractorCrews, employee.id),
    [contractorCrews, employee.id]
  )

  const [form, setForm] = useState<FormState>({
    crewId: current?.crew.id ?? "",
    roleInCrew: "Operario",
  })
  const [baselineForm] = useState<FormState>({
    crewId: current?.crew.id ?? "",
    roleInCrew: "Operario",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const nextCrewId = form.crewId.trim()
    if (!nextCrewId) {
      setError("Seleccioná una cuadrilla externa.")
      return
    }

    setIsSubmitting(true)
    try {
      const displayName = getEmployeeDisplayName(employee)
      const role = form.roleInCrew.trim() || "Operario"

      if (current && current.crew.id === nextCrewId) {
        const member = current.crew.members.find(
          (item) => item.id === current.memberId
        )
        if (member && member.role !== role) {
          const result = await editMember(current.crew.id, current.memberId, {
            role,
          })
          if (!result.success) {
            throw new Error(result.message ?? "No se pudo actualizar el rol.")
          }
        }
      } else {
        if (current) {
          const removeResult = await removeMember(
            current.crew.id,
            current.memberId
          )
          if (!removeResult.success) {
            throw new Error(
              removeResult.message ??
                "No se pudo quitar al usuario de la cuadrilla actual."
            )
          }
        }

        const addResult = await addMember(nextCrewId, {
          employeeId: employee.id,
          name: displayName,
          role,
          phone: employee.phone,
          active: true,
        })
        if (!addResult.success) {
          throw new Error(
            addResult.message ?? "No se pudo asignar a la cuadrilla."
          )
        }
      }

      onAssigned?.()
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la asignación."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUnassign() {
    if (!current) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await removeMember(current.crew.id, current.memberId)
      if (!result.success) {
        throw new Error(result.message ?? "No se pudo desasignar.")
      }
      onAssigned?.()
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo desasignar."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>Asignar cuadrilla</DialogTitle>
            <DialogDescription>
              {getEmployeeDisplayName(employee)} — asociá el usuario Field Agent
              a una cuadrilla externa de este contratista.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Cuadrilla externa</Label>
              <Select
                value={form.crewId || undefined}
                onValueChange={(value) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    crewId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuadrilla" />
                </SelectTrigger>
                <SelectContent>
                  {contractorCrews.map((crew) => (
                    <SelectItem key={crew.id} value={crew.id}>
                      {crew.name}
                      {crew.status === "inactiva" ? " (inactiva)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contractorCrews.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Primero creá una cuadrilla externa en la pestaña Cuadrillas.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-role">Rol en la cuadrilla</Label>
              <Input
                id="assign-role"
                value={form.roleInCrew}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    roleInCrew: event.target.value,
                  }))
                }
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              {current ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleUnassign()}
                  disabled={isSubmitting}
                >
                  Quitar de cuadrilla
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </ProtectedFormDialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
