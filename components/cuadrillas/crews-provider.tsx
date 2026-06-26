"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  isCrewAuditableFieldUpdate,
  recordCrewArchiveAudit,
  recordCrewCreateAudit,
  recordCrewMemberAddAudit,
  recordCrewMemberRemoveAudit,
  recordCrewUpdateAudit,
} from "@/lib/audit/rrhh-audit"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  resolveSupervisorAssignment,
  validateMemberNotSupervisor,
  validateSupervisorNotMember,
} from "@/lib/crews/supervisor"
import {
  createBrowserCrewsClient,
  createCrew,
  createCrewMember,
  deleteCrew,
  deleteCrewMember,
  listCrews,
  updateCrew,
  updateCrewMember,
} from "@/lib/supabase/crews.browser"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  shouldPersistCrewStatusSync,
  withResolvedCrewStatuses,
} from "@/lib/crews/status-workflow"
import type {
  Crew,
  CrewMember,
  NewCrewInput,
  NewCrewMemberInput,
} from "@/lib/types/crews"
import type {
  CreateCrewMemberPayload,
  UpdateCrewMemberPayload,
  UpdateCrewPayload,
} from "@/lib/types/supabase/crews"

type CrewMutationResult = {
  success: boolean
  message?: string
}

type CrewsContextValue = {
  crews: Crew[]
  isCrewsReady: boolean
  usesSupabase: boolean
  getCrew: (id: string) => Crew | undefined
  addCrew: (input: NewCrewInput) => Promise<CrewMutationResult & { crew?: Crew }>
  editCrew: (
    id: string,
    input: UpdateCrewPayload | NewCrewInput
  ) => Promise<CrewMutationResult & { crew?: Crew }>
  removeCrew: (id: string) => Promise<CrewMutationResult>
  addMember: (
    crewId: string,
    input: NewCrewMemberInput
  ) => Promise<CrewMutationResult & { member?: CrewMember }>
  editMember: (
    crewId: string,
    memberId: string,
    input: UpdateCrewMemberPayload
  ) => Promise<CrewMutationResult & { member?: CrewMember }>
  removeMember: (
    crewId: string,
    memberId: string
  ) => Promise<CrewMutationResult>
}

const CrewsContext = createContext<CrewsContextValue | null>(null)

function replaceCrewInList(crews: Crew[], crew: Crew): Crew[] {
  return crews.map((item) => (item.id === crew.id ? crew : item))
}

export function CrewsProvider({ children }: { children: React.ReactNode }) {
  const { tasks, isTasksReady } = useTasks()
  const { getEmployee } = useEmployees()
  const [crews, setCrews] = useState<Crew[]>([])
  const [isCrewsReady, setIsCrewsReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const syncInFlightRef = useRef(false)

  const resolvedCrews = useMemo(
    () => withResolvedCrewStatuses(crews, tasks),
    [crews, tasks]
  )

  useEffect(() => {
    let cancelled = false

    async function loadCrewsFromSupabase() {
      try {
        const client = createBrowserCrewsClient()
        const result = await listCrews(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          setCrews([])
          setUsesSupabase(false)
          return
        }

        setCrews(result.data)
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setCrews([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsCrewsReady(true)
        }
      }
    }

    void loadCrewsFromSupabase()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isCrewsReady || !isTasksReady || !usesSupabase || syncInFlightRef.current) {
      return
    }

    const pendingUpdates = crews
      .map((crew) => {
        const nextStatus = shouldPersistCrewStatusSync(crew, tasks)
        return nextStatus ? { id: crew.id, status: nextStatus } : null
      })
      .filter(
        (update): update is { id: string; status: Crew["status"] } =>
          update !== null
      )

    if (pendingUpdates.length === 0) {
      return
    }

    syncInFlightRef.current = true

    void (async () => {
      try {
        const client = createBrowserCrewsClient()

        for (const update of pendingUpdates) {
          const result = await updateCrew(
            update.id,
            { status: update.status },
            client
          )

          if (result.data) {
            setCrews((current) => replaceCrewInList(current, result.data!))
          }
        }
      } finally {
        syncInFlightRef.current = false
      }
    })()
  }, [crews, tasks, isCrewsReady, isTasksReady, usesSupabase])

  const getCrew = useCallback(
    (id: string) => resolvedCrews.find((crew) => crew.id === id),
    [resolvedCrews]
  )

  const addCrew = useCallback(
    async (input: NewCrewInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message: "Supabase no está disponible. No se pudo crear la cuadrilla.",
        }
      }

      try {
        const employee = getEmployee(input.supervisorEmployeeId)
        if (!employee) {
          return {
            success: false,
            message: "El supervisor seleccionado no está disponible.",
          }
        }

        const supervisorValidation = resolveSupervisorAssignment(employee)
        if (!supervisorValidation.ok) {
          return {
            success: false,
            message: supervisorValidation.message,
          }
        }

        const client = createBrowserCrewsClient()
        const result = await createCrew(
          {
            name: input.name,
            description: input.description,
            supervisor: supervisorValidation.supervisorName,
            supervisorEmployeeId: employee.id,
            status: "activa",
            notes: input.notes,
          },
          client
        )

        if (result.data) {
          setCrews((current) =>
            [...current, result.data!].sort((a, b) =>
              a.name.localeCompare(b.name, "es")
            )
          )
          recordCrewCreateAudit(result.data)
          return { success: true, crew: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo crear la cuadrilla.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo crear la cuadrilla.",
        }
      }
    },
    [usesSupabase, getEmployee]
  )

  const editCrew = useCallback(
    async (id: string, input: UpdateCrewPayload | NewCrewInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message: "Supabase no está disponible. No se pudo actualizar.",
        }
      }

      const existingCrew = crews.find((crew) => crew.id === id)

      const payload: UpdateCrewPayload =
        "manuallyInactive" in input
          ? {
              name: input.name,
              description: input.description,
              notes: input.notes,
              supervisorEmployeeId: input.supervisorEmployeeId,
              status: input.manuallyInactive ? "inactiva" : "activa",
            }
          : input

      if (payload.supervisorEmployeeId) {
        const employee = getEmployee(payload.supervisorEmployeeId)
        if (!employee) {
          return {
            success: false,
            message: "El supervisor seleccionado no está disponible.",
          }
        }

        const supervisorValidation = resolveSupervisorAssignment(employee)
        if (!supervisorValidation.ok) {
          return {
            success: false,
            message: supervisorValidation.message,
          }
        }

        if (existingCrew) {
          const memberValidation = validateSupervisorNotMember(
            existingCrew,
            payload.supervisorEmployeeId
          )
          if (!memberValidation.ok) {
            return {
              success: false,
              message: memberValidation.message,
            }
          }
        }

        payload.supervisor = supervisorValidation.supervisorName
      }

      try {
        const client = createBrowserCrewsClient()
        const result = await updateCrew(id, payload, client)

        if (result.data) {
          if (
            existingCrew &&
            (isCrewAuditableFieldUpdate(payload) || payload.status !== undefined)
          ) {
            recordCrewUpdateAudit(existingCrew, payload, result.data)
          }
          setCrews((current) => replaceCrewInList(current, result.data!))
          return { success: true, crew: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo actualizar la cuadrilla.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo actualizar la cuadrilla.",
        }
      }
    },
    [usesSupabase, crews, getEmployee]
  )

  const removeCrew = useCallback(
    async (id: string) => {
      if (!usesSupabase) {
        return {
          success: false,
          message: "Supabase no está disponible. No se pudo eliminar.",
        }
      }

      try {
        const client = createBrowserCrewsClient()
        const existingCrew = crews.find((crew) => crew.id === id)
        const result = await deleteCrew(id, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message,
          }
        }

        if (existingCrew) {
          recordCrewArchiveAudit(existingCrew)
        }

        setCrews((current) => current.filter((crew) => crew.id !== id))
        return { success: true }
      } catch {
        return {
          success: false,
          message: "No se pudo eliminar la cuadrilla.",
        }
      }
    },
    [usesSupabase, crews]
  )

  const addMember = useCallback(
    async (crewId: string, input: NewCrewMemberInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message: "Supabase no está disponible. No se pudo agregar el integrante.",
        }
      }

      const crew = crews.find((item) => item.id === crewId)
      if (crew) {
        const memberValidation = validateMemberNotSupervisor(
          crew,
          input.employeeId
        )
        if (!memberValidation.ok) {
          return {
            success: false,
            message: memberValidation.message,
          }
        }
      }

      const payload: CreateCrewMemberPayload = {
        crewId,
        employeeId: input.employeeId ?? null,
        name: input.name,
        role: input.role,
        phone: input.phone ?? null,
        active: input.active,
      }

      try {
        const client = createBrowserCrewsClient()
        const result = await createCrewMember(payload, client)

        if (result.data) {
          const resolvedCrew = crew ?? { id: crewId, name: "" }
          recordCrewMemberAddAudit({
            crew: resolvedCrew,
            member: result.data,
          })
          setCrews((current) =>
            current.map((crew) =>
              crew.id === crewId
                ? {
                    ...crew,
                    members: [...crew.members, result.data!].sort((a, b) =>
                      a.name.localeCompare(b.name, "es")
                    ),
                  }
                : crew
            )
          )
          return { success: true, member: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo agregar el integrante.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo agregar el integrante.",
        }
      }
    },
    [usesSupabase, crews]
  )

  const editMember = useCallback(
    async (
      crewId: string,
      memberId: string,
      input: UpdateCrewMemberPayload
    ) => {
      if (!usesSupabase) {
        return {
          success: false,
          message: "Supabase no está disponible. No se pudo actualizar.",
        }
      }

      const crew = crews.find((item) => item.id === crewId)
      if (crew && input.employeeId) {
        const memberValidation = validateMemberNotSupervisor(
          crew,
          input.employeeId
        )
        if (!memberValidation.ok) {
          return {
            success: false,
            message: memberValidation.message,
          }
        }
      }

      try {
        const client = createBrowserCrewsClient()
        const result = await updateCrewMember(memberId, input, client)

        if (result.data) {
          setCrews((current) =>
            current.map((crew) =>
              crew.id === crewId
                ? {
                    ...crew,
                    members: crew.members
                      .map((member) =>
                        member.id === memberId ? result.data! : member
                      )
                      .sort((a, b) => a.name.localeCompare(b.name, "es")),
                  }
                : crew
            )
          )
          return { success: true, member: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo actualizar el integrante.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo actualizar el integrante.",
        }
      }
    },
    [usesSupabase, crews]
  )

  const removeMember = useCallback(
    async (crewId: string, memberId: string) => {
      if (!usesSupabase) {
        return {
          success: false,
          message: "Supabase no está disponible. No se pudo eliminar.",
        }
      }

      try {
        const crew = crews.find((item) => item.id === crewId)
        const member = crew?.members.find((item) => item.id === memberId)
        const client = createBrowserCrewsClient()
        const result = await deleteCrewMember(memberId, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message,
          }
        }

        if (crew && member) {
          recordCrewMemberRemoveAudit({ crew, member })
        }

        setCrews((current) =>
          current.map((crew) =>
            crew.id === crewId
              ? {
                  ...crew,
                  members: crew.members.filter(
                    (member) => member.id !== memberId
                  ),
                }
              : crew
          )
        )

        return { success: true }
      } catch {
        return {
          success: false,
          message: "No se pudo eliminar el integrante.",
        }
      }
    },
    [usesSupabase, crews]
  )

  const value = useMemo(
    () => ({
      crews: resolvedCrews,
      isCrewsReady,
      usesSupabase,
      getCrew,
      addCrew,
      editCrew,
      removeCrew,
      addMember,
      editMember,
      removeMember,
    }),
    [
      resolvedCrews,
      isCrewsReady,
      usesSupabase,
      getCrew,
      addCrew,
      editCrew,
      removeCrew,
      addMember,
      editMember,
      removeMember,
    ]
  )

  return (
    <CrewsContext.Provider value={value}>
      {isCrewsReady ? children : null}
    </CrewsContext.Provider>
  )
}

export function useCrews() {
  const context = useContext(CrewsContext)
  if (!context) {
    throw new Error("useCrews must be used within CrewsProvider")
  }
  return context
}

export function useCrewsOptional() {
  return useContext(CrewsContext)
}
