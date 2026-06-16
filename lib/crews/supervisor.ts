import type { Employee } from "@/lib/types/employees"
import {
  getEmployeeDisplayName,
  isEmployeeAvailable,
  isSupervisorEmployee,
  resolveSupervisorDisplayName,
} from "@/lib/employees/utils"
import type { Crew, CrewMember } from "@/lib/types/crews"

export function resolveSupervisorAssignment(
  employee: Employee
): { ok: true; supervisorName: string } | { ok: false; message: string } {
  if (!isEmployeeAvailable(employee)) {
    return {
      ok: false,
      message: "El supervisor seleccionado no está activo.",
    }
  }

  if (!isSupervisorEmployee(employee)) {
    return {
      ok: false,
      message: "El empleado seleccionado no es de tipo Supervisor.",
    }
  }

  return {
    ok: true,
    supervisorName: resolveSupervisorDisplayName(employee),
  }
}

export function isCrewSupervisorEmployee(
  crew: Pick<Crew, "supervisorEmployeeId">,
  employeeId: string | null | undefined
): boolean {
  if (!employeeId || !crew.supervisorEmployeeId) return false
  return crew.supervisorEmployeeId === employeeId
}

export function validateSupervisorNotMember(
  crew: Pick<Crew, "supervisorEmployeeId" | "members">,
  supervisorEmployeeId: string
): { ok: true } | { ok: false; message: string } {
  const isAlreadyMember = crew.members.some(
    (member) => member.employeeId === supervisorEmployeeId
  )

  if (isAlreadyMember) {
    return {
      ok: false,
      message:
        "El supervisor no puede ser integrante de la misma cuadrilla.",
    }
  }

  return { ok: true }
}

export function validateMemberNotSupervisor(
  crew: Pick<Crew, "supervisorEmployeeId">,
  employeeId: string | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (isCrewSupervisorEmployee(crew, employeeId)) {
    return {
      ok: false,
      message: "El supervisor de la cuadrilla no puede ser integrante.",
    }
  }

  return { ok: true }
}

export type CrewSupervisorDisplay = {
  displayName: string
  employeeCode: string | null
  isLegacy: boolean
}

export function resolveCrewSupervisorDisplay(
  crew: Pick<Crew, "supervisor" | "supervisorEmployeeId">,
  getEmployee?: (id: string) => Employee | undefined
): CrewSupervisorDisplay {
  if (crew.supervisorEmployeeId && getEmployee) {
    const employee = getEmployee(crew.supervisorEmployeeId)
    if (employee) {
      return {
        displayName: getEmployeeDisplayName(employee),
        employeeCode: employee.employeeCode,
        isLegacy: false,
      }
    }
  }

  return {
    displayName: crew.supervisor.trim() || "Sin supervisor asignado",
    employeeCode: null,
    isLegacy: !crew.supervisorEmployeeId,
  }
}

export function getAssignedMemberEmployeeIds(
  members: CrewMember[],
  excludeMemberId?: string
): string[] {
  return members
    .filter(
      (member) => member.employeeId && member.id !== excludeMemberId
    )
    .map((member) => member.employeeId!)
}
