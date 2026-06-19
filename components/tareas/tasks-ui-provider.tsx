"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useTasks } from "@/components/tareas/tasks-provider"
import {
  countTasksByOperationalCategory,
  filterTasksByOperationalCategory,
  type OperationalTaskCategory,
} from "@/lib/tasks/operational-category"
import type { Task } from "@/lib/types/tasks"

type TasksUIContextValue = {
  selectedCategory: OperationalTaskCategory | null
  openCategory: (category: OperationalTaskCategory) => void
  closeCategory: () => void
  filteredTasks: Task[]
  operationalSummary: Record<OperationalTaskCategory, number>
}

const TasksUIContext = createContext<TasksUIContextValue | null>(null)

export function TasksUIProvider({ children }: { children: React.ReactNode }) {
  const { tasks } = useTasks()
  const [selectedCategory, setSelectedCategory] =
    useState<OperationalTaskCategory | null>(null)

  const operationalSummary = useMemo(
    () => countTasksByOperationalCategory(tasks),
    [tasks]
  )

  const filteredTasks = useMemo(() => {
    if (!selectedCategory) {
      return tasks
    }

    return filterTasksByOperationalCategory(tasks, selectedCategory)
  }, [tasks, selectedCategory])

  const openCategory = useCallback((category: OperationalTaskCategory) => {
    setSelectedCategory((current) => (current === category ? null : category))
  }, [])

  const closeCategory = useCallback(() => {
    setSelectedCategory(null)
  }, [])

  const value = useMemo(
    () => ({
      selectedCategory,
      openCategory,
      closeCategory,
      filteredTasks,
      operationalSummary,
    }),
    [
      selectedCategory,
      openCategory,
      closeCategory,
      filteredTasks,
      operationalSummary,
    ]
  )

  return (
    <TasksUIContext.Provider value={value}>{children}</TasksUIContext.Provider>
  )
}

export function useTasksUI() {
  const context = useContext(TasksUIContext)
  if (!context) {
    throw new Error("useTasksUI must be used within TasksUIProvider")
  }
  return context
}
