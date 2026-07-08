import type { CustomerSeguimientoAgendaRow } from "@/lib/types/customer-seguimientos"

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

export function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

export function isSeguimientoOverdue(
  item: Pick<CustomerSeguimientoAgendaRow, "scheduledDate" | "status">,
  referenceDate: Date
): boolean {
  if (item.status !== "pendiente") {
    return false
  }

  return item.scheduledDate < toDateKey(referenceDate)
}

export function enrichAgendaRowOverdue(
  item: Omit<CustomerSeguimientoAgendaRow, "isOverdue">,
  referenceDate: Date
): CustomerSeguimientoAgendaRow {
  return {
    ...item,
    isOverdue: isSeguimientoOverdue(item, referenceDate),
  }
}

export function compareAgendaRows(
  left: CustomerSeguimientoAgendaRow,
  right: CustomerSeguimientoAgendaRow
): number {
  if (left.isOverdue !== right.isOverdue) {
    return left.isOverdue ? -1 : 1
  }

  if (left.scheduledTime && right.scheduledTime) {
    return left.scheduledTime.localeCompare(right.scheduledTime)
  }

  if (left.scheduledTime) {
    return -1
  }

  if (right.scheduledTime) {
    return 1
  }

  return left.customerName.localeCompare(right.customerName, "es")
}

export function sortAgendaTodayItems(
  items: CustomerSeguimientoAgendaRow[]
): {
  overdue: CustomerSeguimientoAgendaRow[]
  scheduled: CustomerSeguimientoAgendaRow[]
  unscheduled: CustomerSeguimientoAgendaRow[]
} {
  const overdue: CustomerSeguimientoAgendaRow[] = []
  const scheduled: CustomerSeguimientoAgendaRow[] = []
  const unscheduled: CustomerSeguimientoAgendaRow[] = []

  for (const item of items) {
    if (item.isOverdue) {
      overdue.push(item)
      continue
    }

    if (item.scheduledTime) {
      scheduled.push(item)
      continue
    }

    unscheduled.push(item)
  }

  overdue.sort(compareAgendaRows)
  scheduled.sort(compareAgendaRows)
  unscheduled.sort(compareAgendaRows)

  return { overdue, scheduled, unscheduled }
}

export type AgendaWeekDayGroup = {
  dateKey: string
  label: string
  items: CustomerSeguimientoAgendaRow[]
}

export function groupAgendaWeekItems(
  items: CustomerSeguimientoAgendaRow[],
  referenceDate: Date
): { overdue: CustomerSeguimientoAgendaRow[]; days: AgendaWeekDayGroup[] } {
  const weekStart = startOfWeekMonday(referenceDate)
  const overdue = items.filter((item) => item.isOverdue).sort(compareAgendaRows)

  const days: AgendaWeekDayGroup[] = []

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + offset)
    const dateKey = toDateKey(day)
    const dayItems = items
      .filter((item) => !item.isOverdue && item.scheduledDate === dateKey)
      .sort(compareAgendaRows)

    days.push({
      dateKey,
      label: day.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      items: dayItems,
    })
  }

  return { overdue, days }
}

export function filterAgendaForTodayView(
  items: CustomerSeguimientoAgendaRow[],
  referenceDate: Date
): CustomerSeguimientoAgendaRow[] {
  const todayKey = toDateKey(referenceDate)

  return items.filter(
    (item) => item.isOverdue || item.scheduledDate === todayKey
  )
}

export function filterAgendaForWeekView(
  items: CustomerSeguimientoAgendaRow[],
  referenceDate: Date
): CustomerSeguimientoAgendaRow[] {
  const weekStartKey = toDateKey(startOfWeekMonday(referenceDate))
  const weekEndKey = toDateKey(endOfWeekSunday(referenceDate))

  return items.filter(
    (item) =>
      item.isOverdue ||
      (item.scheduledDate >= weekStartKey && item.scheduledDate <= weekEndKey)
  )
}
