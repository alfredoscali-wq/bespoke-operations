import type { AvailabilityType } from "@/lib/types/availability"
import type { CrewStatus } from "@/lib/types/crews"
import type { EmploymentStatus } from "@/lib/types/employees"
import type { EmployeeType } from "@/lib/types/employees"
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
      customers: {
        Row: {
          id: string
          customer_number: string
          external_customer_code: string | null
          name: string
          phone: string | null
          email: string | null
          address: string | null
          locality: string | null
          technology: string | null
          status: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          customer_number: string
          external_customer_code?: string | null
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          locality?: string | null
          technology?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          customer_number?: string
          external_customer_code?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          locality?: string | null
          technology?: string | null
          status?: string
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
          start_date: string | null
          end_date: string | null
          supervisor: string
          location: string
          description: string
          pause_reason: string | null
          pause_notes: string | null
          paused_at: string | null
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
          start_date?: string | null
          end_date?: string | null
          supervisor: string
          location: string
          description?: string
          pause_reason?: string | null
          pause_notes?: string | null
          paused_at?: string | null
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
          start_date?: string | null
          end_date?: string | null
          supervisor?: string
          location?: string
          description?: string
          pause_reason?: string | null
          pause_notes?: string | null
          paused_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      project_history: {
        Row: {
          id: string
          company_id: string
          project_id: string
          event_type: string
          title: string
          description: string
          metadata: Record<string, unknown>
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string
          project_id: string
          event_type: string
          title: string
          description?: string
          metadata?: Record<string, unknown>
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          event_type?: string
          title?: string
          description?: string
          metadata?: Record<string, unknown>
          created_by?: string | null
          created_at?: string
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
          supervisor_employee_id: string | null
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
          supervisor_employee_id?: string | null
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
          supervisor_employee_id?: string | null
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
          employee_id: string | null
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
          employee_id?: string | null
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
          employee_id?: string | null
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
      employees: {
        Row: {
          id: string
          company_id: string
          employee_code: string
          first_name: string
          last_name: string
          preferred_name: string | null
          national_id: string | null
          birth_date: string | null
          email: string | null
          phone: string | null
          job_title: string
          department: string
          employee_type: EmployeeType
          employment_status: EmploymentStatus
          hire_date: string | null
          termination_date: string | null
          notes: string
          app_user_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id?: string
          employee_code: string
          first_name: string
          last_name: string
          preferred_name?: string | null
          national_id?: string | null
          birth_date?: string | null
          email?: string | null
          phone?: string | null
          job_title?: string
          department?: string
          employee_type?: EmployeeType
          employment_status?: EmploymentStatus
          hire_date?: string | null
          termination_date?: string | null
          notes?: string
          app_user_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          employee_code?: string
          first_name?: string
          last_name?: string
          preferred_name?: string | null
          national_id?: string | null
          birth_date?: string | null
          email?: string | null
          phone?: string | null
          job_title?: string
          department?: string
          employee_type?: EmployeeType
          employment_status?: EmploymentStatus
          hire_date?: string | null
          termination_date?: string | null
          notes?: string
          app_user_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      employee_availability: {
        Row: {
          id: string
          company_id: string
          employee_id: string
          start_date: string
          end_date: string
          availability_type: AvailabilityType
          reason: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id?: string
          employee_id: string
          start_date: string
          end_date: string
          availability_type: AvailabilityType
          reason?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          employee_id?: string
          start_date?: string
          end_date?: string
          availability_type?: AvailabilityType
          reason?: string | null
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
          customer_company: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_id: string | null
          service_address: string | null
          latitude: number | null
          longitude: number | null
          shared_location: string
          observations_for_crew: string
          rejection_reason: string
          work_order_number: string | null
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
          operational_steps: Json
          progress: number
          created_at: string
          updated_at: string
          completed_at: string | null
          closed_at: string | null
          deleted_at: string | null
          service_type: string | null
          locality: string | null
          task_metadata: Json
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
          customer_company?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_id?: string | null
          service_address?: string | null
          latitude?: number | null
          longitude?: number | null
          shared_location?: string
          observations_for_crew?: string
          rejection_reason?: string
          work_order_number?: string | null
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
          operational_steps?: Json
          progress?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          closed_at?: string | null
          deleted_at?: string | null
          service_type?: string | null
          locality?: string | null
          task_metadata?: Json
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
          customer_company?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_id?: string | null
          service_address?: string | null
          latitude?: number | null
          longitude?: number | null
          shared_location?: string
          observations_for_crew?: string
          rejection_reason?: string
          work_order_number?: string | null
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
          operational_steps?: Json
          progress?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          closed_at?: string | null
          deleted_at?: string | null
          service_type?: string | null
          locality?: string | null
          task_metadata?: Json
        }
        Relationships: []
      }
      task_photos: {
        Row: {
          id: string
          task_id: string
          company_id: string
          storage_bucket: string
          storage_path: string
          file_name: string
          mime_type: string | null
          file_size_bytes: number | null
          caption: string
          uploaded_by: string
          uploaded_at: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          photo_type: "reference" | "evidence"
          operational_step_id: string | null
          file_url: string | null
          description: string
          created_by: string | null
        }
        Insert: {
          id?: string
          task_id: string
          company_id?: string
          storage_bucket?: string
          storage_path: string
          file_name: string
          mime_type?: string | null
          file_size_bytes?: number | null
          caption?: string
          uploaded_by?: string
          uploaded_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          photo_type?: "reference" | "evidence"
          operational_step_id?: string | null
          file_url?: string | null
          description?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          company_id?: string
          storage_bucket?: string
          storage_path?: string
          file_name?: string
          mime_type?: string | null
          file_size_bytes?: number | null
          caption?: string
          uploaded_by?: string
          uploaded_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          photo_type?: "reference" | "evidence"
          operational_step_id?: string | null
          file_url?: string | null
          description?: string
          created_by?: string | null
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
      employment_status: EmploymentStatus
    }
    CompositeTypes: Record<string, never>
  }
}

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"]
export type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"]
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"]
export type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"]
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type ProjectHistoryRow = Database["public"]["Tables"]["project_history"]["Row"]
export type ProjectHistoryInsert =
  Database["public"]["Tables"]["project_history"]["Insert"]
export type ProjectHistoryUpdate =
  Database["public"]["Tables"]["project_history"]["Update"]
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
export type TaskPhotoRow = Database["public"]["Tables"]["task_photos"]["Row"]
export type TaskPhotoInsert =
  Database["public"]["Tables"]["task_photos"]["Insert"]
export type TaskPhotoUpdate =
  Database["public"]["Tables"]["task_photos"]["Update"]
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
export type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"]
export type EmployeeInsert =
  Database["public"]["Tables"]["employees"]["Insert"]
export type EmployeeUpdate =
  Database["public"]["Tables"]["employees"]["Update"]
export type EmployeeAvailabilityRow =
  Database["public"]["Tables"]["employee_availability"]["Row"]
export type EmployeeAvailabilityInsert =
  Database["public"]["Tables"]["employee_availability"]["Insert"]
export type EmployeeAvailabilityUpdate =
  Database["public"]["Tables"]["employee_availability"]["Update"]
