"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import {
  getMobileSessionSnapshot,
  isMobileSessionFresh,
  mobileSessionStore,
  setMobileSessionSnapshot,
  subscribeMobileSessionStore,
  type MobileSessionSnapshot,
} from "@/lib/mobile/session"
import { resolveOperarioWorkerCrew } from "@/lib/operario/crew"
import { createBrowserCrewsClient } from "@/lib/supabase/crews.browser"
import { fetchCrewsForEmployeeMembership } from "@/lib/supabase/crews.queries"
import { getEmployeeById } from "@/lib/supabase/employees.browser"
import type { Crew } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"

type OperarioSessionContextValue = {
  snapshot: MobileSessionSnapshot | null
  crews: Crew[]
  employee: Employee | null
  isSessionReady: boolean
}

const OperarioSessionContext =
  createContext<OperarioSessionContextValue | null>(null)

function mapEmployeeToSession(employee: Employee) {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    preferredName: employee.preferredName,
    email: employee.email,
    phone: employee.phone,
    nationalId: employee.nationalId,
    jobTitle: employee.jobTitle,
    department: employee.department,
    systemRole: employee.systemRole,
  }
}

function buildSnapshot(input: {
  companyId: string
  employee: Employee | null
  crews: Crew[]
  employeeId: string | null | undefined
  visibleModuleKeys: readonly string[]
  systemRole: string | null
  dayTasks?: MobileSessionSnapshot["dayTasks"]
}): MobileSessionSnapshot {
  const resolution = resolveOperarioWorkerCrew(input.employeeId, input.crews)
  const previous = getMobileSessionSnapshot()

  return {
    fetchedAt: Date.now(),
    company: { id: input.companyId },
    employee: input.employee ? mapEmployeeToSession(input.employee) : null,
    crews: input.crews.map((crew) => ({ id: crew.id, name: crew.name })),
    jornada: {
      date: toLocalDateOnly(),
      crewId: resolution.workerCrewRef.id ?? null,
      crewName: resolution.workerCrewRef.name,
      crewStatus: resolution.crewStatus,
      assignedCrewNames: resolution.assignedCrewNames,
    },
    dayTasks: input.dayTasks ?? previous?.dayTasks ?? [],
    permissions: {
      systemRole: input.systemRole,
      systemAccess: Boolean(input.employee?.systemAccess),
      modules: input.visibleModuleKeys,
    },
  }
}

/**
 * Loads employee + membership crews once per jornada into Mobile Session Store.
 * Mount outside TasksProvider so it runs in parallel with the tasks download.
 */
export function OperarioSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser, isAuthReady } = useAuth()
  const [crews, setCrews] = useState<Crew[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const loadedKeyRef = useRef<string | null>(null)
  const loadGenerationRef = useRef(0)

  const snapshot = useSyncExternalStore(
    subscribeMobileSessionStore,
    getMobileSessionSnapshot,
    getMobileSessionSnapshot
  )

  useEffect(() => {
    if (!isAuthReady || !sessionUser?.companyId) {
      setIsSessionReady(false)
      loadedKeyRef.current = null
      return
    }

    const companyId = sessionUser.companyId
    const employeeId = sessionUser.employeeId
    const loadKey = `${companyId}:${employeeId ?? ""}`

    if (
      loadedKeyRef.current === loadKey &&
      isMobileSessionFresh() &&
      getMobileSessionSnapshot()?.company.id === companyId
    ) {
      setIsSessionReady(true)
      return
    }

    const generation = ++loadGenerationRef.current
    const visibleModuleKeys = sessionUser.visibleModuleKeys
    const systemRole = sessionUser.systemRole

    async function loadSession() {
      let nextEmployee: Employee | null = null
      let nextCrews: Crew[] = []

      if (employeeId) {
        const client = createBrowserCrewsClient()
        const [employeeResult, crewsResult] = await Promise.all([
          getEmployeeById(employeeId),
          fetchCrewsForEmployeeMembership(client, companyId, employeeId),
        ])

        if (generation !== loadGenerationRef.current) return

        nextEmployee = employeeResult.data
        nextCrews = crewsResult.data ?? []
      }

      if (generation !== loadGenerationRef.current) return

      setEmployee(nextEmployee)
      setCrews(nextCrews)
      setMobileSessionSnapshot(
        buildSnapshot({
          companyId,
          employee: nextEmployee,
          crews: nextCrews,
          employeeId,
          visibleModuleKeys,
          systemRole,
        })
      )
      loadedKeyRef.current = loadKey
      setIsSessionReady(true)
    }

    void loadSession()
  }, [
    isAuthReady,
    sessionUser?.companyId,
    sessionUser?.employeeId,
    sessionUser?.systemRole,
    sessionUser?.visibleModuleKeys,
  ])

  const value = useMemo(
    () => ({
      snapshot,
      crews,
      employee,
      isSessionReady,
    }),
    [snapshot, crews, employee, isSessionReady]
  )

  return (
    <OperarioSessionContext.Provider value={value}>
      {children}
    </OperarioSessionContext.Provider>
  )
}

/**
 * Syncs day-task refs from TasksProvider into the session store (no extra fetch).
 */
export function OperarioSessionDayTasksSync() {
  const { tasks } = useTasks()

  const dayTaskRefs = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        status: task.status,
        dueDate: task.dueDate,
      })),
    [tasks]
  )

  useEffect(() => {
    const current = getMobileSessionSnapshot()
    if (!current) return

    mobileSessionStore.patch({
      dayTasks: dayTaskRefs,
      jornada: {
        ...current.jornada,
        date: toLocalDateOnly(),
      },
    })
  }, [dayTaskRefs])

  return null
}

export function useOperarioSession() {
  const context = useContext(OperarioSessionContext)
  if (!context) {
    throw new Error(
      "useOperarioSession must be used within OperarioSessionProvider"
    )
  }
  return context
}
