import type {
  TreasuryMovementType,
  TreasuryOrigin,
  TreasuryStatus,
} from "@/lib/tesoreria/categories"
import type { AvailabilityType } from "@/lib/types/availability"
import type { ContractorStatus } from "@/lib/types/contractors"
import type { CrewOrigin, CrewStatus } from "@/lib/types/crews"
import type { EmploymentStatus } from "@/lib/types/employees"
import type { EmployeeType } from "@/lib/types/employees"
import type { SystemRole } from "@/lib/types/employees"
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
import type { TaskIncidentStatus } from "@/lib/types/task-incidents"

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
      company_roles: {
        Row: {
          id: string
          company_id: string
          code: string
          name: string
          is_system: boolean
          module_visibility: Json
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          name: string
          is_system?: boolean
          module_visibility?: Json
          sort_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          name?: string
          is_system?: boolean
          module_visibility?: Json
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      automatic_report_settings: {
        Row: {
          id: string
          report_type: string
          enabled: boolean
          company_name: string
          recipient_email: string
          send_day: number
          send_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          report_type: string
          enabled?: boolean
          company_name?: string
          recipient_email?: string
          send_day?: number
          send_time?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          report_type?: string
          enabled?: boolean
          company_name?: string
          recipient_email?: string
          send_day?: number
          send_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      automatic_report_history: {
        Row: {
          id: string
          report_type: string
          generated_at: string
          generated_by: string
          recipient: string
          status: string
          pdf_storage_path: string | null
          pdf_file_name: string | null
          week_number: number | null
          error_message: string | null
          execution_time_ms: number | null
          email_sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_type: string
          generated_at?: string
          generated_by: string
          recipient: string
          status: string
          pdf_storage_path?: string | null
          pdf_file_name?: string | null
          week_number?: number | null
          error_message?: string | null
          execution_time_ms?: number | null
          email_sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          report_type?: string
          generated_at?: string
          generated_by?: string
          recipient?: string
          status?: string
          pdf_storage_path?: string | null
          pdf_file_name?: string | null
          week_number?: number | null
          error_message?: string | null
          execution_time_ms?: number | null
          email_sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      customer_atenciones: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          attended_by_employee_id: string
          channel: string
          motivo: string
          detail: string
          resolution: string
          resultado: string
          status: string
          next_step: string | null
          moroso_tracking_status: string | null
          linked_task_id: string | null
          linked_task_code: string | null
          ot_linked_at: string | null
          ot_linked_by_employee_id: string | null
          active_management_employee_id: string | null
          active_management_started_at: string | null
          active_management_last_activity_at: string | null
          follow_up_actions: string[]
          resolved_at: string | null
          resolved_by_employee_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          attended_by_employee_id: string
          channel: string
          motivo: string
          detail: string
          resolution: string
          resultado: string
          status?: string
          next_step?: string | null
          moroso_tracking_status?: string | null
          linked_task_id?: string | null
          linked_task_code?: string | null
          ot_linked_at?: string | null
          ot_linked_by_employee_id?: string | null
          active_management_employee_id?: string | null
          active_management_started_at?: string | null
          active_management_last_activity_at?: string | null
          follow_up_actions?: string[]
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          attended_by_employee_id?: string
          channel?: string
          motivo?: string
          detail?: string
          resolution?: string
          resultado?: string
          status?: string
          next_step?: string | null
          moroso_tracking_status?: string | null
          linked_task_id?: string | null
          linked_task_code?: string | null
          ot_linked_at?: string | null
          ot_linked_by_employee_id?: string | null
          active_management_employee_id?: string | null
          active_management_started_at?: string | null
          active_management_last_activity_at?: string | null
          follow_up_actions?: string[]
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_atenciones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atenciones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atenciones_attended_by_employee_id_fkey"
            columns: ["attended_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atenciones_active_management_employee_id_fkey"
            columns: ["active_management_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_atencion_events: {
        Row: {
          id: string
          company_id: string
          customer_atencion_id: string
          employee_id: string
          action_type: string
          detail: string | null
          previous_status: string | null
          new_status: string | null
          previous_next_step: string | null
          new_next_step: string | null
          interaction_kind: string | null
          interaction_result: string | null
          next_action_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_atencion_id: string
          employee_id: string
          action_type: string
          detail?: string | null
          previous_status?: string | null
          new_status?: string | null
          previous_next_step?: string | null
          new_next_step?: string | null
          interaction_kind?: string | null
          interaction_result?: string | null
          next_action_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_atencion_id?: string
          employee_id?: string
          action_type?: string
          detail?: string | null
          previous_status?: string | null
          new_status?: string | null
          previous_next_step?: string | null
          new_next_step?: string | null
          interaction_kind?: string | null
          interaction_result?: string | null
          next_action_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_atencion_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atencion_events_customer_atencion_id_fkey"
            columns: ["customer_atencion_id"]
            isOneToOne: false
            referencedRelation: "customer_atenciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atencion_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_seguimientos: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          source_atencion_id: string | null
          previous_seguimiento_id: string | null
          assigned_employee_id: string
          scheduled_date: string
          scheduled_time: string | null
          observation: string
          status: string
          completion_action: string | null
          completed_at: string | null
          completed_by_employee_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          source_atencion_id?: string | null
          previous_seguimiento_id?: string | null
          assigned_employee_id: string
          scheduled_date: string
          scheduled_time?: string | null
          observation: string
          status?: string
          completion_action?: string | null
          completed_at?: string | null
          completed_by_employee_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          source_atencion_id?: string | null
          previous_seguimiento_id?: string | null
          assigned_employee_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          observation?: string
          status?: string
          completion_action?: string | null
          completed_at?: string | null
          completed_by_employee_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_seguimientos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_source_atencion_id_fkey"
            columns: ["source_atencion_id"]
            isOneToOne: false
            referencedRelation: "customer_atenciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_previous_seguimiento_id_fkey"
            columns: ["previous_seguimiento_id"]
            isOneToOne: false
            referencedRelation: "customer_seguimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_completed_by_employee_id_fkey"
            columns: ["completed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_retenciones: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          assigned_employee_id: string
          assigned_by_employee_id: string
          motivo_baja: string
          detail: string
          status: string
          resultado: string | null
          resolution: string | null
          completed_at: string | null
          completed_by_employee_id: string | null
          administration_pending_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          assigned_employee_id: string
          assigned_by_employee_id: string
          motivo_baja: string
          detail: string
          status?: string
          resultado?: string | null
          resolution?: string | null
          completed_at?: string | null
          completed_by_employee_id?: string | null
          administration_pending_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          assigned_employee_id?: string
          assigned_by_employee_id?: string
          motivo_baja?: string
          detail?: string
          status?: string
          resultado?: string | null
          resolution?: string | null
          completed_at?: string | null
          completed_by_employee_id?: string | null
          administration_pending_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_retenciones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_retenciones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_retenciones_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_retenciones_assigned_by_employee_id_fkey"
            columns: ["assigned_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_retenciones_completed_by_employee_id_fkey"
            columns: ["completed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_recuperaciones: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          manual_customer_name: string | null
          manual_zone: string | null
          manual_phone: string | null
          performed_by_employee_id: string
          channel: string
          offer: string
          observation: string
          resultado: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_id?: string | null
          manual_customer_name?: string | null
          manual_zone?: string | null
          manual_phone?: string | null
          performed_by_employee_id: string
          channel: string
          offer: string
          observation: string
          resultado: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string | null
          manual_customer_name?: string | null
          manual_zone?: string | null
          manual_phone?: string | null
          performed_by_employee_id?: string
          channel?: string
          offer?: string
          observation?: string
          resultado?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_recuperaciones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_recuperaciones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_recuperaciones_performed_by_employee_id_fkey"
            columns: ["performed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          id: string
          company_id: string
          customer_number: string
          external_customer_code: string | null
          dni: string | null
          name: string
          phone: string | null
          email: string | null
          address: string | null
          locality: string | null
          technology: string | null
          contracted_plan: string | null
          latitude: number | null
          longitude: number | null
          location_resolution_method: string | null
          shared_location: string | null
          nap_box: string | null
          nap_port: string | null
          onu_serial: string | null
          status_reason: string | null
          status: string
          validation_status: string
          validated_by: string | null
          validated_at: string | null
          legacy_client_state: string | null
          legacy_migration_id: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id?: string
          customer_number: string
          external_customer_code?: string | null
          dni?: string | null
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          locality?: string | null
          technology?: string | null
          contracted_plan?: string | null
          latitude?: number | null
          longitude?: number | null
          location_resolution_method?: string | null
          shared_location?: string | null
          nap_box?: string | null
          nap_port?: string | null
          onu_serial?: string | null
          status_reason?: string | null
          status?: string
          validation_status?: string
          validated_by?: string | null
          validated_at?: string | null
          legacy_client_state?: string | null
          legacy_migration_id?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_number?: string
          external_customer_code?: string | null
          dni?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          locality?: string | null
          technology?: string | null
          contracted_plan?: string | null
          latitude?: number | null
          longitude?: number | null
          location_resolution_method?: string | null
          shared_location?: string | null
          nap_box?: string | null
          nap_port?: string | null
          onu_serial?: string | null
          status_reason?: string | null
          status?: string
          validation_status?: string
          validated_by?: string | null
          validated_at?: string | null
          legacy_client_state?: string | null
          legacy_migration_id?: number | null
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
          latitude: number | null
          longitude: number | null
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
          latitude?: number | null
          longitude?: number | null
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
          latitude?: number | null
          longitude?: number | null
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
      system_audit_log: {
        Row: {
          id: string
          company_id: string
          module: string
          action: string
          entity_type: string
          entity_id: string | null
          entity_label: string | null
          description: string
          severity: string
          performed_by_user_id: string | null
          performed_by_name: string
          performed_by_role: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string
          module: string
          action: string
          entity_type: string
          entity_id?: string | null
          entity_label?: string | null
          description: string
          severity?: string
          performed_by_user_id?: string | null
          performed_by_name: string
          performed_by_role?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          module?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          entity_label?: string | null
          description?: string
          severity?: string
          performed_by_user_id?: string | null
          performed_by_name?: string
          performed_by_role?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          id: string
          company_id: string
          employee_id: string | null
          actor_type: string
          module: string
          entity_type: string
          entity_id: string | null
          action: string
          detail: string
          metadata: Record<string, unknown>
          origin: string
          correlation_id: string | null
          severity: string
          created_at: string
          result: string | null
          session_id: string | null
          duration_ms: number | null
          latitude: number | null
          longitude: number | null
          accuracy_m: number | null
        }
        Insert: {
          id?: string
          company_id: string
          employee_id?: string | null
          actor_type: string
          module: string
          entity_type: string
          entity_id?: string | null
          action: string
          detail?: string
          metadata?: Record<string, unknown>
          origin: string
          correlation_id?: string | null
          severity?: string
          created_at?: string
          result?: string | null
          session_id?: string | null
          duration_ms?: number | null
          latitude?: number | null
          longitude?: number | null
          accuracy_m?: number | null
        }
        Update: {
          id?: string
          company_id?: string
          employee_id?: string | null
          actor_type?: string
          module?: string
          entity_type?: string
          entity_id?: string | null
          action?: string
          detail?: string
          metadata?: Record<string, unknown>
          origin?: string
          correlation_id?: string | null
          severity?: string
          created_at?: string
          result?: string | null
          session_id?: string | null
          duration_ms?: number | null
          latitude?: number | null
          longitude?: number | null
          accuracy_m?: number | null
        }
        Relationships: []
      }
      treasury_movements: {
        Row: {
          id: string
          company_id: string
          movement_type: TreasuryMovementType
          origin: TreasuryOrigin
          category: string
          amount: number
          movement_date: string
          employee_id: string | null
          registered_by: string | null
          status: TreasuryStatus
          notes: string
          receipt_url: string | null
          cashbox_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          movement_type: TreasuryMovementType
          origin?: TreasuryOrigin
          category: string
          amount: number
          movement_date?: string
          employee_id?: string | null
          registered_by?: string | null
          status?: TreasuryStatus
          notes?: string
          receipt_url?: string | null
          cashbox_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          movement_type?: TreasuryMovementType
          origin?: TreasuryOrigin
          category?: string
          amount?: number
          movement_date?: string
          employee_id?: string | null
          registered_by?: string | null
          status?: TreasuryStatus
          notes?: string
          receipt_url?: string | null
          cashbox_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_movements_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          id: string
          company_id: string
          legal_name: string
          trade_name: string
          tax_id: string
          responsible_name: string
          phone: string
          email: string
          status: ContractorStatus
          notes: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id?: string
          legal_name: string
          trade_name?: string
          tax_id: string
          responsible_name?: string
          phone?: string
          email?: string
          status?: ContractorStatus
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          legal_name?: string
          trade_name?: string
          tax_id?: string
          responsible_name?: string
          phone?: string
          email?: string
          status?: ContractorStatus
          notes?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          origin: CrewOrigin
          contractor_id: string | null
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
          origin?: CrewOrigin
          contractor_id?: string | null
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
          origin?: CrewOrigin
          contractor_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_types: {
        Row: {
          id: string
          company_id: string
          code: string
          name: string
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          name: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          name?: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          employee_type_id: string | null
          employment_status: EmploymentStatus
          hire_date: string | null
          termination_date: string | null
          notes: string
          app_user_id: string | null
          system_role: SystemRole
          role_id: string | null
          system_access: boolean
          must_change_password: boolean
          last_login_at: string | null
          contractor_id: string | null
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
          employee_type_id?: string | null
          employment_status?: EmploymentStatus
          hire_date?: string | null
          termination_date?: string | null
          notes?: string
          app_user_id?: string | null
          system_role?: SystemRole
          contractor_id?: string | null
          role_id?: string | null
          system_access?: boolean
          must_change_password?: boolean
          last_login_at?: string | null
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
          employee_type_id?: string | null
          employment_status?: EmploymentStatus
          hire_date?: string | null
          termination_date?: string | null
          notes?: string
          app_user_id?: string | null
          system_role?: SystemRole
          role_id?: string | null
          system_access?: boolean
          must_change_password?: boolean
          last_login_at?: string | null
          contractor_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_type_id_fkey"
            columns: ["employee_type_id"]
            isOneToOne: false
            referencedRelation: "employee_types"
            referencedColumns: ["id"]
          },
        ]
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
          customer_dni: string | null
          customer_id: string | null
          service_address: string | null
          latitude: number | null
          longitude: number | null
          location_resolution_method: string | null
          shared_location: string
          observations_for_crew: string
          rejection_reason: string
          incident_reason: string
          incident_observation: string
          incident_reported_at: string | null
          incident_reported_by: string
          cancellation_reason: string
          cancellation_observation: string
          work_order_number: string | null
          type: TaskType
          status: TaskStatus
          priority: TaskPriority
          supervisor: string
          crew_id: string | null
          crew: string
          start_date: string
          due_date: string
          scheduled_time: string | null
          original_scheduled_date: string | null
          original_scheduled_time: string | null
          rescheduled_by: string
          rescheduled_at: string | null
          reschedule_reason: string
          reschedule_notes: string
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
          contracted_plan: string | null
          installation_cost: number | null
          amount_to_collect: number | null
          payment_method: string | null
          task_metadata: Json
          execution_order: number | null
          dispatch_order: number | null
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
          customer_dni?: string | null
          customer_id?: string | null
          service_address?: string | null
          latitude?: number | null
          longitude?: number | null
          location_resolution_method?: string | null
          shared_location?: string
          observations_for_crew?: string
          rejection_reason?: string
          incident_reason?: string
          incident_observation?: string
          incident_reported_at?: string | null
          incident_reported_by?: string
          cancellation_reason?: string
          cancellation_observation?: string
          work_order_number?: string | null
          type: TaskType
          status?: TaskStatus
          priority?: TaskPriority
          supervisor: string
          crew_id?: string | null
          crew: string
          start_date: string
          due_date: string
          scheduled_time?: string | null
          original_scheduled_date?: string | null
          original_scheduled_time?: string | null
          rescheduled_by?: string
          rescheduled_at?: string | null
          reschedule_reason?: string
          reschedule_notes?: string
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
          contracted_plan?: string | null
          installation_cost?: number | null
          amount_to_collect?: number | null
          payment_method?: string | null
          task_metadata?: Json
          execution_order?: number | null
          dispatch_order?: number | null
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
          customer_dni?: string | null
          customer_id?: string | null
          service_address?: string | null
          latitude?: number | null
          longitude?: number | null
          location_resolution_method?: string | null
          shared_location?: string
          observations_for_crew?: string
          rejection_reason?: string
          incident_reason?: string
          incident_observation?: string
          incident_reported_at?: string | null
          incident_reported_by?: string
          cancellation_reason?: string
          cancellation_observation?: string
          work_order_number?: string | null
          type?: TaskType
          status?: TaskStatus
          priority?: TaskPriority
          supervisor?: string
          crew_id?: string | null
          crew?: string
          start_date?: string
          due_date?: string
          scheduled_time?: string | null
          original_scheduled_date?: string | null
          original_scheduled_time?: string | null
          rescheduled_by?: string
          rescheduled_at?: string | null
          reschedule_reason?: string
          reschedule_notes?: string
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
          contracted_plan?: string | null
          installation_cost?: number | null
          amount_to_collect?: number | null
          payment_method?: string | null
          task_metadata?: Json
          execution_order?: number | null
          dispatch_order?: number | null
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
      work_order_type_checklist_items: {
        Row: {
          id: string
          company_id: string
          service_type: string
          technology: string
          title: string
          required: boolean
          field_type: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          service_type: string
          technology?: string
          title: string
          required?: boolean
          field_type: string
          sort_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          service_type?: string
          technology?: string
          title?: string
          required?: boolean
          field_type?: string
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incident_types: {
        Row: {
          id: string
          company_id: string
          code: string
          name: string
          description: string
          color: string
          pauses_work_order: boolean
          requires_supervisor_intervention: boolean
          notify_supervisor: boolean
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          name: string
          description?: string
          color?: string
          pauses_work_order?: boolean
          requires_supervisor_intervention?: boolean
          notify_supervisor?: boolean
          is_active?: boolean
          sort_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          name?: string
          description?: string
          color?: string
          pauses_work_order?: boolean
          requires_supervisor_intervention?: boolean
          notify_supervisor?: boolean
          is_active?: boolean
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_incidents: {
        Row: {
          id: string
          company_id: string
          task_id: string
          employee_id: string
          crew_id: string | null
          incident_type_id: string
          status: TaskIncidentStatus
          comment: string | null
          can_continue: boolean
          requires_supervisor_action: boolean
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          task_id: string
          employee_id: string
          crew_id?: string | null
          incident_type_id: string
          status: TaskIncidentStatus
          comment?: string | null
          can_continue?: boolean
          requires_supervisor_action?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          task_id?: string
          employee_id?: string
          crew_id?: string | null
          incident_type_id?: string
          status?: TaskIncidentStatus
          comment?: string | null
          can_continue?: boolean
          requires_supervisor_action?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      task_incident_photos: {
        Row: {
          id: string
          incident_id: string
          storage_path: string
          thumbnail_path: string | null
          file_name: string | null
          mime_type: string | null
          size_bytes: number | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          storage_path: string
          thumbnail_path?: string | null
          file_name?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          incident_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          file_name?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      task_incident_events: {
        Row: {
          id: string
          incident_id: string
          event_type: string
          comment: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          event_type: string
          comment?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          incident_id?: string
          event_type?: string
          comment?: string | null
          created_by?: string
          created_at?: string
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
    Functions: {
      hard_delete_contractor: {
        Args: {
          p_company_id: string
          p_contractor_id: string
          p_actor_employee_id: string
        }
        Returns: Record<string, unknown>
      }
      record_activity_event: {
        Args: {
          p_company_id: string
          p_employee_id: string | null
          p_actor_type: string
          p_module: string
          p_entity_type: string
          p_entity_id: string | null
          p_action: string
          p_detail: string
          p_metadata: Record<string, unknown>
          p_origin: string
          p_correlation_id: string | null
          p_severity: string
          p_result?: string | null
          p_session_id?: string | null
          p_duration_ms?: number | null
          p_latitude?: number | null
          p_longitude?: number | null
          p_accuracy_m?: number | null
        }
        Returns: string
      }
    }
    Enums: {
      project_type: ProjectType
      project_status: ProjectStatus
      task_type: TaskType
      task_status: TaskStatus
      task_priority: TaskPriority
      task_incident_status: TaskIncidentStatus
      evidence_file_type: EvidenceFileType
      evidence_category_type: EvidenceCategoryType
      evidence_status: EvidenceStatus
      crew_status: CrewStatus
      crew_origin: CrewOrigin
      contractor_status: ContractorStatus
      employment_status: EmploymentStatus
      system_role: SystemRole
    }
    CompositeTypes: Record<string, never>
  }
}

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"]
export type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"]
export type ContractorRow = Database["public"]["Tables"]["contractors"]["Row"]
export type ContractorInsert =
  Database["public"]["Tables"]["contractors"]["Insert"]
export type ContractorUpdate =
  Database["public"]["Tables"]["contractors"]["Update"]
export type CustomerAtencionRow =
  Database["public"]["Tables"]["customer_atenciones"]["Row"]
export type CustomerAtencionInsert =
  Database["public"]["Tables"]["customer_atenciones"]["Insert"]
export type CustomerAtencionUpdate =
  Database["public"]["Tables"]["customer_atenciones"]["Update"]
export type CustomerAtencionEventRow =
  Database["public"]["Tables"]["customer_atencion_events"]["Row"]
export type CustomerAtencionEventInsert =
  Database["public"]["Tables"]["customer_atencion_events"]["Insert"]
export type CustomerAtencionEventUpdate =
  Database["public"]["Tables"]["customer_atencion_events"]["Update"]
export type CustomerSeguimientoRow =
  Database["public"]["Tables"]["customer_seguimientos"]["Row"]
export type CustomerSeguimientoInsert =
  Database["public"]["Tables"]["customer_seguimientos"]["Insert"]
export type CustomerSeguimientoUpdate =
  Database["public"]["Tables"]["customer_seguimientos"]["Update"]
export type CustomerRetencionRow =
  Database["public"]["Tables"]["customer_retenciones"]["Row"]
export type CustomerRetencionInsert =
  Database["public"]["Tables"]["customer_retenciones"]["Insert"]
export type CustomerRetencionUpdate =
  Database["public"]["Tables"]["customer_retenciones"]["Update"]
export type CustomerRecuperacionRow =
  Database["public"]["Tables"]["customer_recuperaciones"]["Row"]
export type CustomerRecuperacionInsert =
  Database["public"]["Tables"]["customer_recuperaciones"]["Insert"]
export type CustomerRecuperacionUpdate =
  Database["public"]["Tables"]["customer_recuperaciones"]["Update"]
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
export type SystemAuditLogRow =
  Database["public"]["Tables"]["system_audit_log"]["Row"]
export type SystemAuditLogInsert =
  Database["public"]["Tables"]["system_audit_log"]["Insert"]
export type SystemAuditLogUpdate =
  Database["public"]["Tables"]["system_audit_log"]["Update"]
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
export type TaskPhotoRow = Database["public"]["Tables"]["task_photos"]["Row"]
export type TaskPhotoInsert =
  Database["public"]["Tables"]["task_photos"]["Insert"]
export type TaskPhotoUpdate =
  Database["public"]["Tables"]["task_photos"]["Update"]
export type TaskIncidentRow = Database["public"]["Tables"]["task_incidents"]["Row"]
export type TaskIncidentInsert =
  Database["public"]["Tables"]["task_incidents"]["Insert"]
export type TaskIncidentUpdate =
  Database["public"]["Tables"]["task_incidents"]["Update"]
export type TaskIncidentPhotoRow =
  Database["public"]["Tables"]["task_incident_photos"]["Row"]
export type TaskIncidentPhotoInsert =
  Database["public"]["Tables"]["task_incident_photos"]["Insert"]
export type TaskIncidentPhotoUpdate =
  Database["public"]["Tables"]["task_incident_photos"]["Update"]
export type TaskIncidentEventRow =
  Database["public"]["Tables"]["task_incident_events"]["Row"]
export type TaskIncidentEventInsert =
  Database["public"]["Tables"]["task_incident_events"]["Insert"]
export type TaskIncidentEventUpdate =
  Database["public"]["Tables"]["task_incident_events"]["Update"]
export type EvidenceRow = Database["public"]["Tables"]["evidences"]["Row"]
export type EvidenceInsert =
  Database["public"]["Tables"]["evidences"]["Insert"]
export type EvidenceUpdate =
  Database["public"]["Tables"]["evidences"]["Update"]
export type TreasuryMovementRow =
  Database["public"]["Tables"]["treasury_movements"]["Row"]
export type TreasuryMovementInsert =
  Database["public"]["Tables"]["treasury_movements"]["Insert"]
export type TreasuryMovementUpdate =
  Database["public"]["Tables"]["treasury_movements"]["Update"]
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
