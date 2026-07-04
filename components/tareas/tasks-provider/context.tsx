"use client"

import { createContext, useContext } from "react"

import type { TasksContextValue } from "./types"

export const TasksContext = createContext<TasksContextValue | null>(null)

export function useTasks() {
  const context = useContext(TasksContext)
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider")
  }
  return context
}
