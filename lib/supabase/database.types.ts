import type { ProjectStatus, ProjectType } from "@/lib/types/projects"
import type {
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          code: string
          name: string
          client: string
          type: ProjectType
          status: ProjectStatus
          progress: number
          start_date: string
          end_date: string
          supervisor: string
          location: string
          description: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          client: string
          type: ProjectType
          status?: ProjectStatus
          progress?: number
          start_date: string
          end_date: string
          supervisor: string
          location: string
          description?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          client?: string
          type?: ProjectType
          status?: ProjectStatus
          progress?: number
          start_date?: string
          end_date?: string
          supervisor?: string
          location?: string
          description?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          code: string
          title: string
          description: string
          project_id: string | null
          project_code: string
          project_name: string
          type: TaskType
          status: TaskStatus
          priority: TaskPriority
          supervisor: string
          crew: string
          start_date: string
          due_date: string
          estimated_duration: string
          checklist: Json
          progress: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          code: string
          title: string
          description?: string
          project_id?: string | null
          project_code: string
          project_name: string
          type: TaskType
          status?: TaskStatus
          priority?: TaskPriority
          supervisor: string
          crew: string
          start_date: string
          due_date: string
          estimated_duration?: string
          checklist?: Json
          progress?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          title?: string
          description?: string
          project_id?: string | null
          project_code?: string
          project_name?: string
          type?: TaskType
          status?: TaskStatus
          priority?: TaskPriority
          supervisor?: string
          crew?: string
          start_date?: string
          due_date?: string
          estimated_duration?: string
          checklist?: Json
          progress?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      project_type: ProjectType
      project_status: ProjectStatus
      task_type: TaskType
      task_status: TaskStatus
      task_priority: TaskPriority
    }
    CompositeTypes: Record<string, never>
  }
}

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
