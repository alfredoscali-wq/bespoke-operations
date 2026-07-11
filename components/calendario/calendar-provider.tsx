"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  addDays,
  buildCalendarEvents,
  buildCalendarWeekDays,
  filterCalendarEvents,
  getCalendarWeekSummary,
  getWeekStart,
  groupEventsByDate,
  shiftWeek,
  sortCalendarEvents,
} from "@/lib/calendar/calendar-utils"
import { filterCalendarOperationalTasks } from "@/lib/tasks/status-groups"
import { toDateOnly } from "@/lib/availability/utils"
import type {
  CalendarEvent,
  CalendarFilters,
  CalendarWeekDay,
  CalendarWeekSummary,
} from "@/lib/types/calendar"
import { defaultCalendarFilters } from "@/lib/types/calendar"

export type CalendarTemporalView = "week" | "day"

type CalendarContextValue = {
  temporalView: CalendarTemporalView
  selectedDate: string
  weekStart: string
  weekDays: CalendarWeekDay[]
  eventsByDate: Record<string, CalendarEvent[]>
  summary: CalendarWeekSummary
  filters: CalendarFilters
  selectedEvent: CalendarEvent | null
  setFilters: (filters: CalendarFilters) => void
  goToPreviousPeriod: () => void
  goToNextPeriod: () => void
  goToToday: () => void
  showWeekView: () => void
  selectEvent: (event: CalendarEvent | null) => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { tasks } = useTasks()
  const { records: availabilityRecords } = useAvailability()
  const { crews } = useCrews()
  const { employees, getEmployee } = useEmployees()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [temporalView, setTemporalView] = useState<CalendarTemporalView>("week")
  const [selectedDate, setSelectedDate] = useState(() => toDateOnly())
  const [filters, setFilters] = useState<CalendarFilters>(defaultCalendarFilters)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const crewAvailabilityContext = useMemo(
    () => ({
      availabilityRecords,
      getEmployee,
    }),
    [availabilityRecords, getEmployee]
  )

  const operationalTasks = useMemo(
    () => filterCalendarOperationalTasks(tasks),
    [tasks]
  )

  const weekDays = useMemo(
    () => buildCalendarWeekDays(weekStart),
    [weekStart]
  )

  const eventsByDate = useMemo(() => {
    const events = sortCalendarEvents(
      filterCalendarEvents(
        buildCalendarEvents({
          tasks: operationalTasks,
          availabilityRecords,
          employees,
          crews,
          crewAvailabilityContext,
          weekStart,
        }),
        filters
      )
    )

    return groupEventsByDate(events)
  }, [
    operationalTasks,
    availabilityRecords,
    employees,
    crews,
    crewAvailabilityContext,
    weekStart,
    filters,
  ])

  const summary = useMemo(
    () =>
      getCalendarWeekSummary({
        tasks: operationalTasks,
        availabilityRecords,
        crews,
        crewAvailabilityContext,
        weekStart,
      }),
    [operationalTasks, availabilityRecords, crews, crewAvailabilityContext, weekStart]
  )

  const goToPreviousPeriod = useCallback(() => {
    if (temporalView === "day") {
      setSelectedDate((current) => addDays(current, -1))
      return
    }

    setWeekStart((current) => shiftWeek(current, -1))
  }, [temporalView])

  const goToNextPeriod = useCallback(() => {
    if (temporalView === "day") {
      setSelectedDate((current) => addDays(current, 1))
      return
    }

    setWeekStart((current) => shiftWeek(current, 1))
  }, [temporalView])

  const goToToday = useCallback(() => {
    const today = toDateOnly()
    setSelectedDate(today)
    setWeekStart(getWeekStart(today))
    setTemporalView("day")
  }, [])

  const showWeekView = useCallback(() => {
    setTemporalView("week")
    setWeekStart(getWeekStart(selectedDate))
  }, [selectedDate])

  const value = useMemo(
    () => ({
      temporalView,
      selectedDate,
      weekStart,
      weekDays,
      eventsByDate,
      summary,
      filters,
      selectedEvent,
      setFilters,
      goToPreviousPeriod,
      goToNextPeriod,
      goToToday,
      showWeekView,
      selectEvent: setSelectedEvent,
    }),
    [
      temporalView,
      selectedDate,
      weekStart,
      weekDays,
      eventsByDate,
      summary,
      filters,
      selectedEvent,
      goToPreviousPeriod,
      goToNextPeriod,
      goToToday,
      showWeekView,
    ]
  )

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider")
  }
  return context
}
