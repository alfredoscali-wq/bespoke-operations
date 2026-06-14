import type { CrewStatus } from "@/lib/types/crews"
import type {
  EvidenceCategoryType,
  EvidenceFileType,
  EvidenceStatus,
} from "@/lib/types/evidence"
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
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          company_id: string
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
          company_id?: string
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
          company_id?: string
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
      crews: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string
          supervisor: string
          status: CrewStatus
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id?: string
          name: string
          description?: string
          supervisor: string
          status?: CrewStatus
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string
          supervisor?: string
          status?: CrewStatus
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      crew_members: {
        Row: {
          id: string
          crew_id: string
          name: string
          role: string
          phone: string | null
          active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          crew_id: string
          name: string
          role: string
          phone?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          crew_id?: string
          name?: string
          role?: string
          phone?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          company_id: string
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
          crew_id: string | null
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
          company_id?: string
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
          crew_id?: string | null
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
          company_id?: string
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
          crew_id?: string | null
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
      evidences: {
        Row: {
          id: string
          company_id: string
          file_name: string
          file_type: EvidenceFileType
          evidence_type: EvidenceCategoryType
          storage_bucket: string
          storage_path: string | null
          mime_type: string | null
          file_size_bytes: number | null
          preview_url: string | null
          project_id: string | null
          project_code: string
          project_name: string
          task_id: string | null
          task_code: string
          task_title: string
          crew: string
          worker: string
          uploaded_at: string
          status: EvidenceStatus
          description: string
          category: string
          comments: Json
          upload_history: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id?: string
          file_name: string
          file_type: EvidenceFileType
          evidence_type?: EvidenceCategoryType
          storage_bucket?: string
          storage_path?: string | null
          mime_type?: string | null
          file_size_bytes?: number | null
          preview_url?: string | null
          project_id?: string | null
          project_code: string
          project_name: string
          task_id?: string | null
          task_code: string
          task_title: string
          crew: string
          worker: string
          uploaded_at?: string
          status?: EvidenceStatus
          description?: string
          category?: string
          comments?: Json
          upload_history?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          file_name?: string
          file_type?: EvidenceFileType
          evidence_type?: EvidenceCategoryType
          storage_bucket?: string
          storage_path?: string | null
          mime_type?: string | null
          file_size_bytes?: number | null
          preview_url?: string | null
          project_id?: string | null
          project_code?: string
          project_name?: string
          task_id?: string | null
          task_code?: string
          task_title?: string
          crew?: string
          worker?: string
          uploaded_at?: string
          status?: EvidenceStatus
          description?: string
          category?: string
          comments?: Json
          upload_history?: Json
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
      evidence_file_type: EvidenceFileType
      evidence_category_type: EvidenceCategoryType
      evidence_status: EvidenceStatus
      crew_status: CrewStatus
    }
    CompositeTypes: Record<string, never>
  }
}

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"]
export type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"]
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
export type EvidenceRow = Database["public"]["Tables"]["evidences"]["Row"]
export type EvidenceInsert =
  Database["public"]["Tables"]["evidences"]["Insert"]
export type EvidenceUpdate =
  Database["public"]["Tables"]["evidences"]["Update"]
export type CrewRow = Database["public"]["Tables"]["crews"]["Row"]
export type CrewInsert = Database["public"]["Tables"]["crews"]["Insert"]
export type CrewUpdate = Database["public"]["Tables"]["crews"]["Update"]
export type CrewMemberRow = Database["public"]["Tables"]["crew_members"]["Row"]
export type CrewMemberInsert =
  Database["public"]["Tables"]["crew_members"]["Insert"]
export type CrewMemberUpdate =
  Database["public"]["Tables"]["crew_members"]["Update"]
