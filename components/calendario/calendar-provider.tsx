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
  buildCalendarEvents,
  buildCalendarWeekDays,
  filterCalendarEvents,
  getCalendarWeekSummary,
  getWeekStart,
  groupEventsByDate,
  shiftWeek,
  sortCalendarEvents,
} from "@/lib/calendar/calendar-utils"
import type {
  CalendarEvent,
  CalendarFilters,
  CalendarWeekDay,
  CalendarWeekSummary,
} from "@/lib/types/calendar"
import { defaultCalendarFilters } from "@/lib/types/calendar"

type CalendarContextValue = {
  weekStart: string
  weekDays: CalendarWeekDay[]
  eventsByDate: Record<string, CalendarEvent[]>
  summary: CalendarWeekSummary
  filters: CalendarFilters
  selectedEvent: CalendarEvent | null
  setFilters: (filters: CalendarFilters) => void
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToToday: () => void
  selectEvent: (event: CalendarEvent | null) => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { tasks } = useTasks()
  const { records: availabilityRecords } = useAvailability()
  const { crews } = useCrews()
  const { employees, getEmployee } = useEmployees()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [filters, setFilters] = useState<CalendarFilters>(defaultCalendarFilters)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const crewAvailabilityContext = useMemo(
    () => ({
      availabilityRecords,
      getEmployee,
    }),
    [availabilityRecords, getEmployee]
  )

  const weekDays = useMemo(
    () => buildCalendarWeekDays(weekStart),
    [weekStart]
  )

  const eventsByDate = useMemo(() => {
    const events = sortCalendarEvents(
      filterCalendarEvents(
        buildCalendarEvents({
          tasks,
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
    tasks,
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
        tasks,
        availabilityRecords,
        crews,
        crewAvailabilityContext,
        weekStart,
      }),
    [tasks, availabilityRecords, crews, crewAvailabilityContext, weekStart]
  )

  const goToPreviousWeek = useCallback(() => {
    setWeekStart((current) => shiftWeek(current, -1))
  }, [])

  const goToNextWeek = useCallback(() => {
    setWeekStart((current) => shiftWeek(current, 1))
  }, [])

  const goToToday = useCallback(() => {
    setWeekStart(getWeekStart())
  }, [])

  const value = useMemo(
    () => ({
      weekStart,
      weekDays,
      eventsByDate,
      summary,
      filters,
      selectedEvent,
      setFilters,
      goToPreviousWeek,
      goToNextWeek,
      goToToday,
      selectEvent: setSelectedEvent,
    }),
    [
      weekStart,
      weekDays,
      eventsByDate,
      summary,
      filters,
      selectedEvent,
      goToPreviousWeek,
      goToNextWeek,
      goToToday,
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
