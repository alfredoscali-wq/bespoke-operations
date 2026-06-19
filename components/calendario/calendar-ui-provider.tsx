"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useSearchParams } from "next/navigation"

import { useCalendar } from "@/components/calendario/calendar-provider"
import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  defaultCalendarQuickFilters,
  filterEventsByProjectId,
  filterEventsByQuickFilters,
  filterEventsForProjectsView,
  getAbsenceOperationalImpact,
  getActiveAbsenceDetails,
  getCalendarViewFilters,
  getCrewDetailsByStatus,
  getOperationalAlerts,
  getWeekTaskDetails,
  type CalendarAbsenceDetail,
  type CalendarCrewDetail,
  type CalendarKpiKey,
  type CalendarOperationalAlert,
  type CalendarQuickFilters,
  type CalendarTaskDetail,
  type CalendarViewMode,
} from "@/lib/calendar/calendar-ui-utils"
import {
  groupEventsByDate,
  sortCalendarEvents,
} from "@/lib/calendar/calendar-utils"
import type { CalendarEvent } from "@/lib/types/calendar"
import { filterCalendarOperationalTasks } from "@/lib/tasks/status-groups"

type CalendarUIContextValue = {
  viewMode: CalendarViewMode
  setViewMode: (mode: CalendarViewMode) => void
  quickFilters: CalendarQuickFilters
  setQuickFilters: (filters: CalendarQuickFilters) => void
  projectIdFilter: string | null
  projectFilterLabel: string | null
  displayEventsByDate: Record<string, CalendarEvent[]>
  selectedKpi: CalendarKpiKey | null
  openKpiPanel: (key: CalendarKpiKey) => void
  closeKpiPanel: () => void
  legendVisible: boolean
  setLegendVisible: (visible: boolean) => void
  alerts: CalendarOperationalAlert[]
  absenceDetails: CalendarAbsenceDetail[]
  operationalCrewDetails: CalendarCrewDetail[]
  reducedCrewDetails: CalendarCrewDetail[]
  notOperationalCrewDetails: CalendarCrewDetail[]
  weekTaskDetails: CalendarTaskDetail[]
  getAbsenceImpact: (employeeId: string) => ReturnType<
    typeof getAbsenceOperationalImpact
  >
}

const CalendarUIContext = createContext<CalendarUIContextValue | null>(null)

export function CalendarUIProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const projectIdFilter = searchParams.get("projectId")
  const { eventsByDate, summary, weekStart, setFilters } = useCalendar()
  const { tasks } = useTasks()
  const operationalTasks = useMemo(
    () => filterCalendarOperationalTasks(tasks),
    [tasks]
  )
  const { records: availabilityRecords } = useAvailability()
  const { crews } = useCrews()
  const { employees, getEmployee } = useEmployees()
  const { getProject } = useProjects()

  const [viewMode, setViewMode] = useState<CalendarViewMode>("all")
  const [quickFilters, setQuickFilters] =
    useState<CalendarQuickFilters>(defaultCalendarQuickFilters)
  const [selectedKpi, setSelectedKpi] = useState<CalendarKpiKey | null>(null)
  const [legendVisible, setLegendVisible] = useState(true)

  const crewAvailabilityContext = useMemo(
    () => ({
      availabilityRecords,
      getEmployee,
    }),
    [availabilityRecords, getEmployee]
  )

  useEffect(() => {
    setFilters(getCalendarViewFilters(projectIdFilter ? "projects" : viewMode))
  }, [viewMode, setFilters, projectIdFilter])

  useEffect(() => {
    if (projectIdFilter) {
      setViewMode("projects")
    }
  }, [projectIdFilter])

  useEffect(() => {
    setQuickFilters(defaultCalendarQuickFilters)
  }, [viewMode])

  const flatEvents = useMemo(
    () => Object.values(eventsByDate).flat(),
    [eventsByDate]
  )

  const displayEventsByDate = useMemo(() => {
    let events = flatEvents

    if (viewMode === "projects") {
      events = filterEventsForProjectsView(events, operationalTasks)
    }

    events = filterEventsByQuickFilters(
      events,
      quickFilters,
      operationalTasks,
      crews
    )

    events = filterEventsByProjectId(
      events,
      projectIdFilter,
      operationalTasks,
      crews
    )

    return groupEventsByDate(sortCalendarEvents(events))
  }, [flatEvents, viewMode, quickFilters, operationalTasks, crews, projectIdFilter])

  const projectFilterLabel = useMemo(() => {
    if (!projectIdFilter) return null
    const project = getProject(projectIdFilter)
    return project ? `${project.code} — ${project.name}` : projectIdFilter
  }, [projectIdFilter, getProject])

  const alerts = useMemo(
    () => getOperationalAlerts({ summary, tasks: operationalTasks, weekStart }),
    [summary, operationalTasks, weekStart]
  )

  const absenceDetails = useMemo(
    () =>
      getActiveAbsenceDetails({
        availabilityRecords,
        employees,
        crews,
        weekStart,
      }),
    [availabilityRecords, employees, crews, weekStart]
  )

  const operationalCrewDetails = useMemo(
    () =>
      getCrewDetailsByStatus({
        crews,
        context: crewAvailabilityContext,
        weekStart,
        status: "OPERATIONAL",
      }),
    [crews, crewAvailabilityContext, weekStart]
  )

  const reducedCrewDetails = useMemo(
    () =>
      getCrewDetailsByStatus({
        crews,
        context: crewAvailabilityContext,
        weekStart,
        status: "REDUCED_CAPACITY",
      }),
    [crews, crewAvailabilityContext, weekStart]
  )

  const notOperationalCrewDetails = useMemo(
    () =>
      getCrewDetailsByStatus({
        crews,
        context: crewAvailabilityContext,
        weekStart,
        status: "NOT_OPERATIONAL",
      }),
    [crews, crewAvailabilityContext, weekStart]
  )

  const weekTaskDetails = useMemo(
    () => getWeekTaskDetails({ tasks: operationalTasks, weekStart }),
    [operationalTasks, weekStart]
  )

  const getAbsenceImpact = useCallback(
    (employeeId: string) =>
      getAbsenceOperationalImpact(
        employeeId,
        crews,
        crewAvailabilityContext
      ),
    [crews, crewAvailabilityContext]
  )

  const openKpiPanel = useCallback((key: CalendarKpiKey) => {
    setSelectedKpi(key)
  }, [])

  const closeKpiPanel = useCallback(() => {
    setSelectedKpi(null)
  }, [])

  const value = useMemo(
    () => ({
      viewMode,
      setViewMode,
      quickFilters,
      setQuickFilters,
      projectIdFilter,
      projectFilterLabel,
      displayEventsByDate,
      selectedKpi,
      openKpiPanel,
      closeKpiPanel,
      legendVisible,
      setLegendVisible,
      alerts,
      absenceDetails,
      operationalCrewDetails,
      reducedCrewDetails,
      notOperationalCrewDetails,
      weekTaskDetails,
      getAbsenceImpact,
    }),
    [
      viewMode,
      quickFilters,
      projectIdFilter,
      projectFilterLabel,
      displayEventsByDate,
      selectedKpi,
      openKpiPanel,
      closeKpiPanel,
      legendVisible,
      alerts,
      absenceDetails,
      operationalCrewDetails,
      reducedCrewDetails,
      notOperationalCrewDetails,
      weekTaskDetails,
      getAbsenceImpact,
    ]
  )

  return (
    <CalendarUIContext.Provider value={value}>
      {children}
    </CalendarUIContext.Provider>
  )
}

export function useCalendarUI() {
  const context = useContext(CalendarUIContext)
  if (!context) {
    throw new Error("useCalendarUI must be used within CalendarUIProvider")
  }
  return context
}
