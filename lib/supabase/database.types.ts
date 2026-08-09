export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          accuracy_m: number | null
          action: string
          actor_type: string
          category: string | null
          company_id: string
          correlation_id: string | null
          created_at: string
          detail: string
          duration_ms: number | null
          employee_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          impact: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json
          module: string
          origin: string
          result: string | null
          session_id: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          accuracy_m?: number | null
          action: string
          actor_type: string
          category?: string | null
          company_id: string
          correlation_id?: string | null
          created_at?: string
          detail?: string
          duration_ms?: number | null
          employee_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          impact?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          module: string
          origin: string
          result?: string | null
          session_id?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          accuracy_m?: number | null
          action?: string
          actor_type?: string
          category?: string | null
          company_id?: string
          correlation_id?: string | null
          created_at?: string
          detail?: string
          duration_ms?: number | null
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          impact?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          module?: string
          origin?: string
          result?: string | null
          session_id?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          module: string
          original_name: string
          record_id: string
          storage_path: string
          timeline_event_id: string | null
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          module: string
          original_name: string
          record_id: string
          storage_path: string
          timeline_event_id?: string | null
          uploaded_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          module?: string
          original_name?: string
          record_id?: string
          storage_path?: string
          timeline_event_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      automatic_report_history: {
        Row: {
          created_at: string
          email_sent_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          generated_at: string
          generated_by: string
          id: string
          pdf_file_name: string | null
          pdf_storage_path: string | null
          recipient: string
          report_type: string
          status: string
          week_number: number | null
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          generated_at?: string
          generated_by: string
          id?: string
          pdf_file_name?: string | null
          pdf_storage_path?: string | null
          recipient: string
          report_type: string
          status: string
          week_number?: number | null
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          generated_at?: string
          generated_by?: string
          id?: string
          pdf_file_name?: string | null
          pdf_storage_path?: string | null
          recipient?: string
          report_type?: string
          status?: string
          week_number?: number | null
        }
        Relationships: []
      }
      automatic_report_settings: {
        Row: {
          company_name: string
          created_at: string
          enabled: boolean
          id: string
          recipient_email: string
          report_type: string
          send_day: number
          send_time: string
          updated_at: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          recipient_email?: string
          report_type: string
          send_day?: number
          send_time?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          recipient_email?: string
          report_type?: string
          send_day?: number
          send_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      commercial_activities: {
        Row: {
          activity_type_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          employee_id: string | null
          id: string
          metadata: Json
          opportunity_id: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["commercial_activity_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_type_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          employee_id?: string | null
          id?: string
          metadata?: Json
          opportunity_id: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["commercial_activity_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_type_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          employee_id?: string | null
          id?: string
          metadata?: Json
          opportunity_id?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["commercial_activity_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_activities_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "commercial_activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_activity_types: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      commercial_commitments: {
        Row: {
          activity_id: string | null
          assigned_employee_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          due_at: string
          id: string
          metadata: Json
          opportunity_id: string
          priority: Database["public"]["Enums"]["commercial_commitment_priority"]
          status: Database["public"]["Enums"]["commercial_commitment_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id?: string | null
          assigned_employee_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          due_at: string
          id?: string
          metadata?: Json
          opportunity_id: string
          priority?: Database["public"]["Enums"]["commercial_commitment_priority"]
          status?: Database["public"]["Enums"]["commercial_commitment_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string | null
          assigned_employee_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          due_at?: string
          id?: string
          metadata?: Json
          opportunity_id?: string
          priority?: Database["public"]["Enums"]["commercial_commitment_priority"]
          status?: Database["public"]["Enums"]["commercial_commitment_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_commitments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "commercial_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commitments_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commitments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commitments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commitments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commitments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commitments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_opportunities: {
        Row: {
          assigned_employee_id: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          estimated_amount: number | null
          expected_close_date: string | null
          id: string
          latitude: number | null
          location_source:
            | Database["public"]["Enums"]["commercial_location_source"]
            | null
          longitude: number | null
          lost_reason: string
          person_id: string
          priority: string
          probability: number | null
          seller_opened_at: string | null
          source: string
          source_atencion_id: string | null
          source_customer_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_employee_id?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          estimated_amount?: number | null
          expected_close_date?: string | null
          id?: string
          latitude?: number | null
          location_source?:
            | Database["public"]["Enums"]["commercial_location_source"]
            | null
          longitude?: number | null
          lost_reason?: string
          person_id: string
          priority?: string
          probability?: number | null
          seller_opened_at?: string | null
          source?: string
          source_atencion_id?: string | null
          source_customer_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_employee_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          estimated_amount?: number | null
          expected_close_date?: string | null
          id?: string
          latitude?: number | null
          location_source?:
            | Database["public"]["Enums"]["commercial_location_source"]
            | null
          longitude?: number | null
          lost_reason?: string
          person_id?: string
          priority?: string
          probability?: number | null
          seller_opened_at?: string | null
          source?: string
          source_atencion_id?: string | null
          source_customer_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_opportunities_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "commercial_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_priority_fkey"
            columns: ["priority"]
            isOneToOne: false
            referencedRelation: "commercial_priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "commercial_opportunities_source_atencion_id_fkey"
            columns: ["source_atencion_id"]
            isOneToOne: false
            referencedRelation: "customer_atenciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_source_customer_id_fkey"
            columns: ["source_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_opportunities_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "commercial_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "commercial_opportunities_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "commercial_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "commercial_opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_opportunity_counters: {
        Row: {
          company_id: string
          last_number: number
        }
        Insert: {
          company_id: string
          last_number?: number
        }
        Update: {
          company_id?: string
          last_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_opportunity_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_people: {
        Row: {
          address: string
          apartment: string
          city: string
          company_id: string
          company_name: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          document_number: string
          email: string
          first_name: string
          floor: string
          id: string
          last_name: string
          latitude: number | null
          location_source:
            | Database["public"]["Enums"]["commercial_location_source"]
            | null
          longitude: number | null
          mobile: string
          neighborhood: string
          notes: string
          person_type: Database["public"]["Enums"]["commercial_person_type"]
          phone: string
          postal_code: string
          province: string
          street: string
          street_number: string
          tax_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string
          apartment?: string
          city?: string
          company_id: string
          company_name?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_number?: string
          email?: string
          first_name?: string
          floor?: string
          id?: string
          last_name?: string
          latitude?: number | null
          location_source?:
            | Database["public"]["Enums"]["commercial_location_source"]
            | null
          longitude?: number | null
          mobile?: string
          neighborhood?: string
          notes?: string
          person_type?: Database["public"]["Enums"]["commercial_person_type"]
          phone?: string
          postal_code?: string
          province?: string
          street?: string
          street_number?: string
          tax_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          apartment?: string
          city?: string
          company_id?: string
          company_name?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_number?: string
          email?: string
          first_name?: string
          floor?: string
          id?: string
          last_name?: string
          latitude?: number | null
          location_source?:
            | Database["public"]["Enums"]["commercial_location_source"]
            | null
          longitude?: number | null
          mobile?: string
          neighborhood?: string
          notes?: string
          person_type?: Database["public"]["Enums"]["commercial_person_type"]
          phone?: string
          postal_code?: string
          province?: string
          street?: string
          street_number?: string
          tax_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_people_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_people_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_priorities: {
        Row: {
          code: string
          created_at: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      commercial_sources: {
        Row: {
          code: string
          created_at: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      commercial_statuses: {
        Row: {
          code: string
          created_at: string
          is_closed: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          is_closed?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          is_closed?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_roles: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_system: boolean
          module_visibility: Json
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          module_visibility?: Json
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          module_visibility?: Json
          name?: string
          sort_order?: number
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
      contractors: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          legal_name: string
          notes: string
          phone: string
          responsible_name: string
          status: Database["public"]["Enums"]["contractor_status"]
          tax_id: string
          trade_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          legal_name: string
          notes?: string
          phone?: string
          responsible_name?: string
          status?: Database["public"]["Enums"]["contractor_status"]
          tax_id: string
          trade_name?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          legal_name?: string
          notes?: string
          phone?: string
          responsible_name?: string
          status?: Database["public"]["Enums"]["contractor_status"]
          tax_id?: string
          trade_name?: string
          updated_at?: string
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
      crew_members: {
        Row: {
          active: boolean
          created_at: string
          crew_id: string
          deleted_at: string | null
          employee_id: string | null
          id: string
          name: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          crew_id: string
          deleted_at?: string | null
          employee_id?: string | null
          id?: string
          name: string
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          crew_id?: string
          deleted_at?: string | null
          employee_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string
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
      crews: {
        Row: {
          company_id: string
          contractor_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          habitual_shift_minutes: number | null
          habitual_start_time: string | null
          id: string
          name: string
          notes: string
          operational_base_address: string | null
          operational_base_latitude: number | null
          operational_base_longitude: number | null
          operational_base_name: string | null
          origin: Database["public"]["Enums"]["crew_origin"]
          status: Database["public"]["Enums"]["crew_status"]
          supervisor: string
          supervisor_employee_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          contractor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          habitual_shift_minutes?: number | null
          habitual_start_time?: string | null
          id?: string
          name: string
          notes?: string
          operational_base_address?: string | null
          operational_base_latitude?: number | null
          operational_base_longitude?: number | null
          operational_base_name?: string | null
          origin?: Database["public"]["Enums"]["crew_origin"]
          status?: Database["public"]["Enums"]["crew_status"]
          supervisor: string
          supervisor_employee_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contractor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          habitual_shift_minutes?: number | null
          habitual_start_time?: string | null
          id?: string
          name?: string
          notes?: string
          operational_base_address?: string | null
          operational_base_latitude?: number | null
          operational_base_longitude?: number | null
          operational_base_name?: string | null
          origin?: Database["public"]["Enums"]["crew_origin"]
          status?: Database["public"]["Enums"]["crew_status"]
          supervisor?: string
          supervisor_employee_id?: string | null
          updated_at?: string
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
      customer_atencion_events: {
        Row: {
          action_type: string
          company_id: string
          created_at: string
          customer_atencion_id: string
          detail: string | null
          employee_id: string
          id: string
          interaction_kind: string | null
          interaction_result: string | null
          new_next_step: string | null
          new_status: string | null
          next_action_at: string | null
          previous_next_step: string | null
          previous_status: string | null
        }
        Insert: {
          action_type: string
          company_id: string
          created_at?: string
          customer_atencion_id: string
          detail?: string | null
          employee_id: string
          id?: string
          interaction_kind?: string | null
          interaction_result?: string | null
          new_next_step?: string | null
          new_status?: string | null
          next_action_at?: string | null
          previous_next_step?: string | null
          previous_status?: string | null
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string
          customer_atencion_id?: string
          detail?: string | null
          employee_id?: string
          id?: string
          interaction_kind?: string | null
          interaction_result?: string | null
          new_next_step?: string | null
          new_status?: string | null
          next_action_at?: string | null
          previous_next_step?: string | null
          previous_status?: string | null
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
      customer_atenciones: {
        Row: {
          active_management_employee_id: string | null
          active_management_last_activity_at: string | null
          active_management_started_at: string | null
          attended_by_employee_id: string
          channel: string
          company_id: string
          created_at: string
          customer_id: string
          deleted_at: string | null
          detail: string
          follow_up_actions: string[]
          id: string
          linked_task_code: string | null
          linked_task_id: string | null
          moroso_tracking_status: string | null
          motivo: string
          next_step: string | null
          ot_linked_at: string | null
          ot_linked_by_employee_id: string | null
          resolution: string
          resolved_at: string | null
          resolved_by_employee_id: string | null
          resultado: string
          status: string
          updated_at: string
        }
        Insert: {
          active_management_employee_id?: string | null
          active_management_last_activity_at?: string | null
          active_management_started_at?: string | null
          attended_by_employee_id: string
          channel: string
          company_id: string
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          detail: string
          follow_up_actions?: string[]
          id?: string
          linked_task_code?: string | null
          linked_task_id?: string | null
          moroso_tracking_status?: string | null
          motivo: string
          next_step?: string | null
          ot_linked_at?: string | null
          ot_linked_by_employee_id?: string | null
          resolution: string
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          resultado: string
          status?: string
          updated_at?: string
        }
        Update: {
          active_management_employee_id?: string | null
          active_management_last_activity_at?: string | null
          active_management_started_at?: string | null
          attended_by_employee_id?: string
          channel?: string
          company_id?: string
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          detail?: string
          follow_up_actions?: string[]
          id?: string
          linked_task_code?: string | null
          linked_task_id?: string | null
          moroso_tracking_status?: string | null
          motivo?: string
          next_step?: string | null
          ot_linked_at?: string | null
          ot_linked_by_employee_id?: string | null
          resolution?: string
          resolved_at?: string | null
          resolved_by_employee_id?: string | null
          resultado?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_atenciones_active_management_employee_id_fkey"
            columns: ["active_management_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "customer_atenciones_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atenciones_ot_linked_by_employee_id_fkey"
            columns: ["ot_linked_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_atenciones_resolved_by_employee_id_fkey"
            columns: ["resolved_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_recuperaciones: {
        Row: {
          channel: string
          company_id: string
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          id: string
          manual_customer_name: string | null
          manual_phone: string | null
          manual_zone: string | null
          observation: string
          offer: string
          performed_by_employee_id: string
          resultado: string
          updated_at: string
        }
        Insert: {
          channel: string
          company_id: string
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          manual_customer_name?: string | null
          manual_phone?: string | null
          manual_zone?: string | null
          observation: string
          offer: string
          performed_by_employee_id: string
          resultado: string
          updated_at?: string
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          manual_customer_name?: string | null
          manual_phone?: string | null
          manual_zone?: string | null
          observation?: string
          offer?: string
          performed_by_employee_id?: string
          resultado?: string
          updated_at?: string
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
      customer_retenciones: {
        Row: {
          administration_pending_at: string | null
          assigned_by_employee_id: string
          assigned_employee_id: string
          company_id: string
          completed_at: string | null
          completed_by_employee_id: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          detail: string
          id: string
          motivo_baja: string
          resolution: string | null
          resultado: string | null
          status: string
          updated_at: string
        }
        Insert: {
          administration_pending_at?: string | null
          assigned_by_employee_id: string
          assigned_employee_id: string
          company_id: string
          completed_at?: string | null
          completed_by_employee_id?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          detail: string
          id?: string
          motivo_baja: string
          resolution?: string | null
          resultado?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          administration_pending_at?: string | null
          assigned_by_employee_id?: string
          assigned_employee_id?: string
          company_id?: string
          completed_at?: string | null
          completed_by_employee_id?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          detail?: string
          id?: string
          motivo_baja?: string
          resolution?: string | null
          resultado?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_retenciones_assigned_by_employee_id_fkey"
            columns: ["assigned_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "customer_retenciones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_retenciones_completed_by_employee_id_fkey"
            columns: ["completed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_retenciones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_seguimientos: {
        Row: {
          assigned_employee_id: string
          company_id: string
          completed_at: string | null
          completed_by_employee_id: string | null
          completion_action: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          id: string
          observation: string
          previous_seguimiento_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          source_atencion_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_employee_id: string
          company_id: string
          completed_at?: string | null
          completed_by_employee_id?: string | null
          completion_action?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          id?: string
          observation: string
          previous_seguimiento_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          source_atencion_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_employee_id?: string
          company_id?: string
          completed_at?: string | null
          completed_by_employee_id?: string | null
          completion_action?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          id?: string
          observation?: string
          previous_seguimiento_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          source_atencion_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_seguimientos_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_completed_by_employee_id_fkey"
            columns: ["completed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "customer_seguimientos_previous_seguimiento_id_fkey"
            columns: ["previous_seguimiento_id"]
            isOneToOne: false
            referencedRelation: "customer_seguimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_seguimientos_source_atencion_id_fkey"
            columns: ["source_atencion_id"]
            isOneToOne: false
            referencedRelation: "customer_atenciones"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string
          contracted_plan: string | null
          created_at: string
          customer_number: string
          deleted_at: string | null
          dni: string | null
          email: string | null
          external_customer_code: string | null
          id: string
          latitude: number | null
          legacy_client_state: string | null
          legacy_migration_id: number | null
          locality: string | null
          longitude: number | null
          name: string
          nap_box: string | null
          nap_port: string | null
          onu_serial: string | null
          phone: string | null
          shared_location: string | null
          status: string
          status_reason: string | null
          technology: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          address?: string | null
          company_id?: string
          contracted_plan?: string | null
          created_at?: string
          customer_number: string
          deleted_at?: string | null
          dni?: string | null
          email?: string | null
          external_customer_code?: string | null
          id?: string
          latitude?: number | null
          legacy_client_state?: string | null
          legacy_migration_id?: number | null
          locality?: string | null
          longitude?: number | null
          name: string
          nap_box?: string | null
          nap_port?: string | null
          onu_serial?: string | null
          phone?: string | null
          shared_location?: string | null
          status?: string
          status_reason?: string | null
          technology?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          contracted_plan?: string | null
          created_at?: string
          customer_number?: string
          deleted_at?: string | null
          dni?: string | null
          email?: string | null
          external_customer_code?: string | null
          id?: string
          latitude?: number | null
          legacy_client_state?: string | null
          legacy_migration_id?: number | null
          locality?: string | null
          longitude?: number | null
          name?: string
          nap_box?: string | null
          nap_port?: string | null
          onu_serial?: string | null
          phone?: string | null
          shared_location?: string | null
          status?: string
          status_reason?: string | null
          technology?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_availability: {
        Row: {
          availability_type: string
          company_id: string
          created_at: string
          deleted_at: string | null
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          availability_type: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          availability_type?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_availability_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_availability_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_types: {
        Row: {
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
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
          app_user_id: string | null
          birth_date: string | null
          company_id: string
          contractor_id: string | null
          created_at: string
          deleted_at: string | null
          department: string
          email: string | null
          employee_code: string
          employee_type: Database["public"]["Enums"]["employee_type"]
          employee_type_id: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          first_name: string
          hire_date: string | null
          id: string
          job_title: string
          last_login_at: string | null
          last_name: string
          must_change_password: boolean
          national_id: string | null
          notes: string
          phone: string | null
          preferred_name: string | null
          role_id: string | null
          system_access: boolean
          system_role: Database["public"]["Enums"]["system_role"]
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          app_user_id?: string | null
          birth_date?: string | null
          company_id?: string
          contractor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string
          email?: string | null
          employee_code: string
          employee_type?: Database["public"]["Enums"]["employee_type"]
          employee_type_id?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name: string
          hire_date?: string | null
          id?: string
          job_title?: string
          last_login_at?: string | null
          last_name: string
          must_change_password?: boolean
          national_id?: string | null
          notes?: string
          phone?: string | null
          preferred_name?: string | null
          role_id?: string | null
          system_access?: boolean
          system_role?: Database["public"]["Enums"]["system_role"]
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          app_user_id?: string | null
          birth_date?: string | null
          company_id?: string
          contractor_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string
          email?: string | null
          employee_code?: string
          employee_type?: Database["public"]["Enums"]["employee_type"]
          employee_type_id?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string
          last_login_at?: string | null
          last_name?: string
          must_change_password?: boolean
          national_id?: string | null
          notes?: string
          phone?: string | null
          preferred_name?: string | null
          role_id?: string | null
          system_access?: boolean
          system_role?: Database["public"]["Enums"]["system_role"]
          termination_date?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          category: string
          comments: Json
          company_id: string
          created_at: string
          crew: string
          deleted_at: string | null
          description: string
          evidence_type: Database["public"]["Enums"]["evidence_category_type"]
          file_name: string
          file_size_bytes: number | null
          file_type: Database["public"]["Enums"]["evidence_file_type"]
          id: string
          mime_type: string | null
          preview_url: string | null
          project_code: string
          project_id: string | null
          project_name: string
          status: Database["public"]["Enums"]["evidence_status"]
          storage_bucket: string
          storage_path: string | null
          task_code: string
          task_id: string | null
          task_title: string
          updated_at: string
          upload_history: Json
          uploaded_at: string
          worker: string
        }
        Insert: {
          category?: string
          comments?: Json
          company_id?: string
          created_at?: string
          crew: string
          deleted_at?: string | null
          description?: string
          evidence_type?: Database["public"]["Enums"]["evidence_category_type"]
          file_name: string
          file_size_bytes?: number | null
          file_type: Database["public"]["Enums"]["evidence_file_type"]
          id?: string
          mime_type?: string | null
          preview_url?: string | null
          project_code: string
          project_id?: string | null
          project_name: string
          status?: Database["public"]["Enums"]["evidence_status"]
          storage_bucket?: string
          storage_path?: string | null
          task_code: string
          task_id?: string | null
          task_title: string
          updated_at?: string
          upload_history?: Json
          uploaded_at?: string
          worker: string
        }
        Update: {
          category?: string
          comments?: Json
          company_id?: string
          created_at?: string
          crew?: string
          deleted_at?: string | null
          description?: string
          evidence_type?: Database["public"]["Enums"]["evidence_category_type"]
          file_name?: string
          file_size_bytes?: number | null
          file_type?: Database["public"]["Enums"]["evidence_file_type"]
          id?: string
          mime_type?: string | null
          preview_url?: string | null
          project_code?: string
          project_id?: string | null
          project_name?: string
          status?: Database["public"]["Enums"]["evidence_status"]
          storage_bucket?: string
          storage_path?: string | null
          task_code?: string
          task_id?: string | null
          task_title?: string
          updated_at?: string
          upload_history?: Json
          uploaded_at?: string
          worker?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_types: {
        Row: {
          code: string
          color: string
          company_id: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          notify_supervisor: boolean
          pauses_work_order: boolean
          requires_supervisor_intervention: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          company_id: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          notify_supervisor?: boolean
          pauses_work_order?: boolean
          requires_supervisor_intervention?: boolean
          sort_order: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          notify_supervisor?: boolean
          pauses_work_order?: boolean
          requires_supervisor_intervention?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_devices: {
        Row: {
          android_version: string
          app_version: string
          company_id: string
          created_at: string
          deleted_at: string | null
          device_id: string
          id: string
          last_seen_at: string
          manufacturer: string
          model: string
          platform: string
          registered_at: string
          status: Database["public"]["Enums"]["mobile_device_status"]
          updated_at: string
          work_team_id: string | null
        }
        Insert: {
          android_version?: string
          app_version?: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          device_id: string
          id?: string
          last_seen_at?: string
          manufacturer?: string
          model?: string
          platform?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["mobile_device_status"]
          updated_at?: string
          work_team_id?: string | null
        }
        Update: {
          android_version?: string
          app_version?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          device_id?: string
          id?: string
          last_seen_at?: string
          manufacturer?: string
          model?: string
          platform?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["mobile_device_status"]
          updated_at?: string
          work_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mobile_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_devices_work_team_id_fkey"
            columns: ["work_team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_motivos: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          kind: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_motivos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_engine_settings: {
        Row: {
          company_id: string
          created_at: string
          operational_radius_meters: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          operational_radius_meters?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          operational_radius_meters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_engine_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_history: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          metadata: Json
          project_id: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_type: string
          id?: string
          metadata?: Json
          project_id: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          metadata?: Json
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string
          end_date: string | null
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          name: string
          pause_notes: string | null
          pause_reason: string | null
          paused_at: string | null
          progress: number
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          supervisor: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          client: string
          code: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          end_date?: string | null
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          name: string
          pause_notes?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervisor: string
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          client?: string
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          end_date?: string | null
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          name?: string
          pause_notes?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervisor?: string
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          description: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json
          module: string
          performed_by_name: string
          performed_by_role: string | null
          performed_by_user_id: string | null
          severity: string
          user_agent: string | null
        }
        Insert: {
          action: string
          company_id?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          module: string
          performed_by_name: string
          performed_by_role?: string | null
          performed_by_user_id?: string | null
          severity?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          module?: string
          performed_by_name?: string
          performed_by_role?: string | null
          performed_by_user_id?: string | null
          severity?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_execution_starts: {
        Row: {
          accuracy_meters: number | null
          company_id: string
          created_at: string
          distance_to_client_meters: number | null
          id: string
          latitude: number
          longitude: number
          mobile_device_id: string
          started_at: string
          started_by: string
          task_id: string
          work_team_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          company_id: string
          created_at?: string
          distance_to_client_meters?: number | null
          id?: string
          latitude: number
          longitude: number
          mobile_device_id: string
          started_at?: string
          started_by: string
          task_id: string
          work_team_id: string
        }
        Update: {
          accuracy_meters?: number | null
          company_id?: string
          created_at?: string
          distance_to_client_meters?: number | null
          id?: string
          latitude?: number
          longitude?: number
          mobile_device_id?: string
          started_at?: string
          started_by?: string
          task_id?: string
          work_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_execution_starts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_execution_starts_mobile_device_id_fkey"
            columns: ["mobile_device_id"]
            isOneToOne: false
            referencedRelation: "mobile_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_execution_starts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_incident_events: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          event_type: string
          id: string
          incident_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by: string
          event_type: string
          id?: string
          incident_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          event_type?: string
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_incident_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "task_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      task_incident_photos: {
        Row: {
          created_at: string
          created_by: string
          file_name: string | null
          id: string
          incident_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          thumbnail_path: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name?: string | null
          id?: string
          incident_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          thumbnail_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string | null
          id?: string
          incident_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_incident_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "task_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      task_incidents: {
        Row: {
          can_continue: boolean
          comment: string | null
          company_id: string
          created_at: string
          crew_id: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          incident_type_id: string
          requires_supervisor_action: boolean
          resolved_at: string | null
          resolved_by: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          can_continue?: boolean
          comment?: string | null
          company_id: string
          created_at?: string
          crew_id?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          incident_type_id: string
          requires_supervisor_action?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          status: string
          task_id: string
          updated_at?: string
        }
        Update: {
          can_continue?: boolean
          comment?: string | null
          company_id?: string
          created_at?: string
          crew_id?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          incident_type_id?: string
          requires_supervisor_action?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incidents_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incidents_incident_type_id_fkey"
            columns: ["incident_type_id"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_incidents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_operational_events: {
        Row: {
          actor_display_name: string
          actor_employee_id: string | null
          actor_user_id: string | null
          company_id: string
          created_at: string
          description: string
          event_type: string
          id: string
          observations: string
          occurred_at: string
          payload: Json
          task_id: string
          title: string
        }
        Insert: {
          actor_display_name?: string
          actor_employee_id?: string | null
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          description?: string
          event_type: string
          id?: string
          observations?: string
          occurred_at?: string
          payload?: Json
          task_id: string
          title: string
        }
        Update: {
          actor_display_name?: string
          actor_employee_id?: string | null
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          observations?: string
          occurred_at?: string
          payload?: Json
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_operational_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_operational_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_photos: {
        Row: {
          caption: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          file_name: string
          file_size_bytes: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          operational_step_id: string | null
          photo_type: string
          storage_bucket: string
          storage_path: string
          task_id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          caption?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          file_name: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          operational_step_id?: string | null
          photo_type?: string
          storage_bucket?: string
          storage_path: string
          task_id: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Update: {
          caption?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          operational_step_id?: string | null
          photo_type?: string
          storage_bucket?: string
          storage_path?: string
          task_id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_presence_events: {
        Row: {
          accuracy: number | null
          company_id: string
          created_at: string
          device_id: string
          employee_id: string
          event_type: string
          id: string
          latitude: number
          longitude: number
          provider: string
          received_at: string
          task_id: string
        }
        Insert: {
          accuracy?: number | null
          company_id: string
          created_at: string
          device_id: string
          employee_id: string
          event_type: string
          id?: string
          latitude: number
          longitude: number
          provider: string
          received_at?: string
          task_id: string
        }
        Update: {
          accuracy?: number | null
          company_id?: string
          created_at?: string
          device_id?: string
          employee_id?: string
          event_type?: string
          id?: string
          latitude?: number
          longitude?: number
          provider?: string
          received_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_presence_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_presence_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_presence_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          amount_to_collect: number | null
          cancellation_observation: string
          cancellation_reason: string
          checklist: Json
          closed_at: string | null
          code: string
          company_id: string
          completed_at: string | null
          contracted_plan: string | null
          created_at: string
          crew: string
          crew_id: string | null
          customer_company: string | null
          customer_dni: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          description: string
          dispatch_order: number | null
          due_date: string
          estimated_duration: string
          execution_order: number | null
          id: string
          incident_observation: string
          incident_reason: string
          incident_reported_at: string | null
          incident_reported_by: string
          installation_cost: number | null
          latitude: number | null
          locality: string | null
          location_resolution_method: string | null
          longitude: number | null
          observations_for_crew: string
          operational_steps: Json
          original_scheduled_date: string | null
          original_scheduled_time: string | null
          payment_method: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          project_code: string
          project_id: string | null
          project_name: string
          rejection_reason: string
          reschedule_notes: string
          reschedule_reason: string
          rescheduled_at: string | null
          rescheduled_by: string
          scheduled_time: string | null
          service_address: string | null
          service_type: string | null
          shared_location: string
          start_date: string
          status: Database["public"]["Enums"]["task_status"]
          supervisor: string
          task_metadata: Json
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          amount_to_collect?: number | null
          cancellation_observation?: string
          cancellation_reason?: string
          checklist?: Json
          closed_at?: string | null
          code: string
          company_id?: string
          completed_at?: string | null
          contracted_plan?: string | null
          created_at?: string
          crew: string
          crew_id?: string | null
          customer_company?: string | null
          customer_dni?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          description?: string
          dispatch_order?: number | null
          due_date: string
          estimated_duration?: string
          execution_order?: number | null
          id?: string
          incident_observation?: string
          incident_reason?: string
          incident_reported_at?: string | null
          incident_reported_by?: string
          installation_cost?: number | null
          latitude?: number | null
          locality?: string | null
          location_resolution_method?: string | null
          longitude?: number | null
          observations_for_crew?: string
          operational_steps?: Json
          original_scheduled_date?: string | null
          original_scheduled_time?: string | null
          payment_method?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_code: string
          project_id?: string | null
          project_name: string
          rejection_reason?: string
          reschedule_notes?: string
          reschedule_reason?: string
          rescheduled_at?: string | null
          rescheduled_by?: string
          scheduled_time?: string | null
          service_address?: string | null
          service_type?: string | null
          shared_location?: string
          start_date: string
          status?: Database["public"]["Enums"]["task_status"]
          supervisor: string
          task_metadata?: Json
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          amount_to_collect?: number | null
          cancellation_observation?: string
          cancellation_reason?: string
          checklist?: Json
          closed_at?: string | null
          code?: string
          company_id?: string
          completed_at?: string | null
          contracted_plan?: string | null
          created_at?: string
          crew?: string
          crew_id?: string | null
          customer_company?: string | null
          customer_dni?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          description?: string
          dispatch_order?: number | null
          due_date?: string
          estimated_duration?: string
          execution_order?: number | null
          id?: string
          incident_observation?: string
          incident_reason?: string
          incident_reported_at?: string | null
          incident_reported_by?: string
          installation_cost?: number | null
          latitude?: number | null
          locality?: string | null
          location_resolution_method?: string | null
          longitude?: number | null
          observations_for_crew?: string
          operational_steps?: Json
          original_scheduled_date?: string | null
          original_scheduled_time?: string | null
          payment_method?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_code?: string
          project_id?: string | null
          project_name?: string
          rejection_reason?: string
          reschedule_notes?: string
          reschedule_reason?: string
          rescheduled_at?: string | null
          rescheduled_by?: string
          scheduled_time?: string | null
          service_address?: string | null
          service_type?: string | null
          shared_location?: string
          start_date?: string
          status?: Database["public"]["Enums"]["task_status"]
          supervisor?: string
          task_metadata?: Json
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_movements: {
        Row: {
          amount: number
          cashbox_id: string | null
          category: string
          company_id: string
          created_at: string
          deleted_at: string | null
          employee_id: string | null
          id: string
          metadata: Json
          movement_date: string
          movement_type: Database["public"]["Enums"]["treasury_movement_type"]
          notes: string
          origin: Database["public"]["Enums"]["treasury_movement_origin"]
          receipt_url: string | null
          registered_by: string | null
          status: Database["public"]["Enums"]["treasury_movement_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          cashbox_id?: string | null
          category: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json
          movement_date?: string
          movement_type: Database["public"]["Enums"]["treasury_movement_type"]
          notes?: string
          origin?: Database["public"]["Enums"]["treasury_movement_origin"]
          receipt_url?: string | null
          registered_by?: string | null
          status?: Database["public"]["Enums"]["treasury_movement_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          cashbox_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["treasury_movement_type"]
          notes?: string
          origin?: Database["public"]["Enums"]["treasury_movement_origin"]
          receipt_url?: string | null
          registered_by?: string | null
          status?: Database["public"]["Enums"]["treasury_movement_status"]
          updated_at?: string
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
      work_order_type_checklist_items: {
        Row: {
          company_id: string
          created_at: string
          field_type: string
          id: string
          required: boolean
          service_type: string
          sort_order: number
          technology: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          field_type: string
          id?: string
          required?: boolean
          service_type: string
          sort_order: number
          technology?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          field_type?: string
          id?: string
          required?: boolean
          service_type?: string
          sort_order?: number
          technology?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_type_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_type_incident_types: {
        Row: {
          company_id: string
          created_at: string
          id: string
          incident_type_id: string
          service_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          incident_type_id: string
          service_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          incident_type_id?: string
          service_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_type_incident_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_type_incident_types_incident_type_id_fkey"
            columns: ["incident_type_id"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["id"]
          },
        ]
      }
      work_team_shifts: {
        Row: {
          company_id: string
          created_at: string
          end_latitude: number | null
          end_longitude: number | null
          finished_at: string | null
          finished_by: string | null
          id: string
          mobile_device_id: string
          start_latitude: number
          start_longitude: number
          started_at: string
          started_by: string
          status: Database["public"]["Enums"]["work_team_shift_status"]
          updated_at: string
          work_team_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_latitude?: number | null
          end_longitude?: number | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          mobile_device_id: string
          start_latitude: number
          start_longitude: number
          started_at?: string
          started_by: string
          status?: Database["public"]["Enums"]["work_team_shift_status"]
          updated_at?: string
          work_team_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_latitude?: number | null
          end_longitude?: number | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          mobile_device_id?: string
          start_latitude?: number
          start_longitude?: number
          started_at?: string
          started_by?: string
          status?: Database["public"]["Enums"]["work_team_shift_status"]
          updated_at?: string
          work_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_team_shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_team_shifts_finished_by_fkey"
            columns: ["finished_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_team_shifts_mobile_device_id_fkey"
            columns: ["mobile_device_id"]
            isOneToOne: false
            referencedRelation: "mobile_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_team_shifts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_team_shifts_work_team_id_fkey"
            columns: ["work_team_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_customer_atencion_management_session_end: {
        Args: {
          p_atencion: Database["public"]["Tables"]["customer_atenciones"]["Row"]
          p_employee_id: string
        }
        Returns: string
      }
      apply_dispatch_order_updates: {
        Args: { p_company_id: string; p_updates: Json }
        Returns: undefined
      }
      auth_can_assign_customer_retencion: { Args: never; Returns: boolean }
      auth_can_create_customer_retencion: { Args: never; Returns: boolean }
      auth_can_manage_company_roles: { Args: never; Returns: boolean }
      auth_can_manage_employee_types: { Args: never; Returns: boolean }
      auth_can_manage_incident_types: { Args: never; Returns: boolean }
      auth_can_manage_operational_motivos: { Args: never; Returns: boolean }
      auth_can_manage_task_incident: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      auth_can_manage_work_order_type_checklist: {
        Args: never
        Returns: boolean
      }
      auth_can_read_task_incident: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      auth_is_administrador: { Args: never; Returns: boolean }
      auth_is_demo_platform_read_only: { Args: never; Returns: boolean }
      auth_is_supervisor_or_administrador: { Args: never; Returns: boolean }
      auth_operario_can_access_task: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      auth_operario_is_assigned_to_task_crew: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      auth_user_allowed_modules: { Args: never; Returns: Json }
      auth_user_company_id: { Args: never; Returns: string }
      auth_user_employee_id: { Args: never; Returns: string }
      auth_user_has_allowed_module: {
        Args: { p_module_key: string }
        Returns: boolean
      }
      auth_user_role_code: { Args: never; Returns: string }
      auth_user_system_role: { Args: never; Returns: string }
      cancel_customer_atencion_management: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
        }
        Returns: Json
      }
      crew_member_belongs_to_user_company: {
        Args: { p_crew_id: string }
        Returns: boolean
      }
      customer_atencion_management_lock_timeout_minutes: {
        Args: never
        Returns: number
      }
      defer_customer_atencion_consultation: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_detail?: string
          p_employee_id: string
          p_next_step: string
        }
        Returns: Json
      }
      finalize_project_operational: {
        Args: {
          p_actor_display_name?: string
          p_company_id: string
          p_project_id: string
        }
        Returns: Json
      }
      hard_delete_contractor: {
        Args: {
          p_actor_employee_id: string
          p_company_id: string
          p_contractor_id: string
        }
        Returns: Json
      }
      hard_delete_customer_atencion_consultation: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
        }
        Returns: Json
      }
      is_allowed_task_status_transition: {
        Args: {
          new_status: Database["public"]["Enums"]["task_status"]
          old_status: Database["public"]["Enums"]["task_status"]
        }
        Returns: boolean
      }
      link_customer_atencion_ot: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
          p_task_id: string
        }
        Returns: Json
      }
      link_customer_atencion_to_task: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
          p_task_id: string
        }
        Returns: Json
      }
      record_activity_engine_event: {
        Args: {
          p_action: string
          p_category: string
          p_company_id: string
          p_employee_id: string
          p_entity_id: string
          p_entity_type: string
          p_impact: string
          p_metadata: Json
          p_module: string
          p_origin: string
        }
        Returns: string
      }
      record_activity_event: {
        Args: {
          p_accuracy_m?: number
          p_action: string
          p_actor_type: string
          p_company_id: string
          p_correlation_id: string
          p_detail: string
          p_duration_ms?: number
          p_employee_id: string
          p_entity_id: string
          p_entity_type: string
          p_latitude?: number
          p_longitude?: number
          p_metadata: Json
          p_module: string
          p_origin: string
          p_result?: string
          p_session_id?: string
          p_severity: string
        }
        Returns: string
      }
      register_customer_atencion_interaction: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_detail: string
          p_employee_id: string
          p_interaction_kind: string
          p_interaction_result: string
          p_next_action_at?: string
        }
        Returns: Json
      }
      release_expired_customer_atencion_management_row: {
        Args: {
          p_atencion: Database["public"]["Tables"]["customer_atenciones"]["Row"]
        }
        Returns: {
          active_management_employee_id: string | null
          active_management_last_activity_at: string | null
          active_management_started_at: string | null
          attended_by_employee_id: string
          channel: string
          company_id: string
          created_at: string
          customer_id: string
          deleted_at: string | null
          detail: string
          follow_up_actions: string[]
          id: string
          linked_task_code: string | null
          linked_task_id: string | null
          moroso_tracking_status: string | null
          motivo: string
          next_step: string | null
          ot_linked_at: string | null
          ot_linked_by_employee_id: string | null
          resolution: string
          resolved_at: string | null
          resolved_by_employee_id: string | null
          resultado: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "customer_atenciones"
          to: "customer_atenciones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_expired_customer_atencion_managements: {
        Args: { p_company_id: string }
        Returns: Json
      }
      resolve_customer_atencion_consultation: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
          p_follow_up_actions?: string[]
          p_resolution: string
        }
        Returns: Json
      }
      seed_company_employee_types: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_default_operational_motivos: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      soft_delete_task_reference_photo: {
        Args: { p_company_id: string; p_photo_id: string; p_task_id: string }
        Returns: Json
      }
      start_customer_atencion_management: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
        }
        Returns: Json
      }
      start_project_operational_dispatch: {
        Args: {
          p_actor_display_name?: string
          p_company_id: string
          p_project_id: string
        }
        Returns: Json
      }
      supervisor_reschedule_active_task_from_incident: {
        Args: {
          p_actor_employee_id: string
          p_company_id: string
          p_crew: string
          p_crew_id: string
          p_due_date: string
          p_incident_event_comment: string
          p_incident_id: string
          p_original_scheduled_date: string
          p_original_scheduled_time: string
          p_post_dispatch_assignments: Json
          p_pre_dispatch_clears: Json
          p_reschedule_notes: string
          p_reschedule_reason: string
          p_rescheduled_by: string
          p_scheduled_time: string
          p_supervisor: string
          p_task_id: string
          p_task_metadata: Json
        }
        Returns: Json
      }
      supervisor_resolve_active_task_incident: {
        Args: {
          p_action: string
          p_actor_employee_id: string
          p_cancellation_observation?: string
          p_cancellation_reason?: string
          p_comment: string
          p_company_id: string
          p_incident_id: string
          p_pre_dispatch_clears?: Json
          p_task_metadata?: Json
        }
        Returns: Json
      }
      touch_customer_atencion_management_activity: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
        }
        Returns: Json
      }
      update_customer_atencion_moroso_tracking: {
        Args: {
          p_atencion_id: string
          p_company_id: string
          p_employee_id: string
          p_tracking_status: string
        }
        Returns: Json
      }
    }
    Enums: {
      commercial_activity_status: "pending" | "completed"
      commercial_commitment_priority: "alta" | "media" | "baja"
      commercial_commitment_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
      commercial_location_source:
        | "manual"
        | "gps"
        | "customer_service"
        | "import"
      commercial_person_type: "individual" | "company"
      contractor_status: "activo" | "inactivo"
      crew_origin: "internal" | "external"
      crew_status: "activa" | "inactiva" | "en-campo"
      employee_type:
        | "operario"
        | "supervisor"
        | "administrativo"
        | "gerente"
        | "otro"
      employment_status:
        | "active"
        | "vacation"
        | "medical_leave"
        | "training"
        | "suspended"
        | "inactive"
      evidence_category_type:
        | "initial-photo"
        | "progress-photo"
        | "final-photo"
        | "otdr-certification"
        | "plan"
        | "client-document"
      evidence_file_type: "photo" | "pdf" | "plan" | "video"
      evidence_status: "pending-review" | "approved" | "rejected"
      mobile_device_status: "ACTIVE" | "BLOCKED"
      project_status:
        | "planned"
        | "active"
        | "paused"
        | "pending-closure"
        | "closed"
        | "cancelled"
      project_type: "fiber" | "camera" | "wireless" | "pole" | "maintenance"
      system_role:
        | "administrador"
        | "supervisor"
        | "administrativo"
        | "operario"
        | "demo"
      task_priority: "alta" | "media" | "baja"
      task_status:
        | "pendiente"
        | "borrador"
        | "asignada"
        | "en-curso"
        | "finalizada"
        | "en-aprobacion"
        | "cerrada"
        | "cancelada"
        | "pendiente-cierre"
        | "incidencia"
        | "vencida"
        | "programada"
      task_type:
        | "fiber"
        | "camera"
        | "wireless"
        | "pole"
        | "maintenance"
        | "inspection"
      treasury_movement_origin:
        | "manual"
        | "task"
        | "sales"
        | "customer_service"
        | "administration"
      treasury_movement_status: "pending" | "confirmed" | "cancelled"
      treasury_movement_type: "income" | "expense" | "withdrawal"
      work_team_shift_status: "NOT_STARTED" | "ACTIVE" | "FINISHED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      commercial_activity_status: ["pending", "completed"],
      commercial_commitment_priority: ["alta", "media", "baja"],
      commercial_commitment_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
      ],
      commercial_location_source: [
        "manual",
        "gps",
        "customer_service",
        "import",
      ],
      commercial_person_type: ["individual", "company"],
      contractor_status: ["activo", "inactivo"],
      crew_origin: ["internal", "external"],
      crew_status: ["activa", "inactiva", "en-campo"],
      employee_type: [
        "operario",
        "supervisor",
        "administrativo",
        "gerente",
        "otro",
      ],
      employment_status: [
        "active",
        "vacation",
        "medical_leave",
        "training",
        "suspended",
        "inactive",
      ],
      evidence_category_type: [
        "initial-photo",
        "progress-photo",
        "final-photo",
        "otdr-certification",
        "plan",
        "client-document",
      ],
      evidence_file_type: ["photo", "pdf", "plan", "video"],
      evidence_status: ["pending-review", "approved", "rejected"],
      mobile_device_status: ["ACTIVE", "BLOCKED"],
      project_status: [
        "planned",
        "active",
        "paused",
        "pending-closure",
        "closed",
        "cancelled",
      ],
      project_type: ["fiber", "camera", "wireless", "pole", "maintenance"],
      system_role: [
        "administrador",
        "supervisor",
        "administrativo",
        "operario",
        "demo",
      ],
      task_priority: ["alta", "media", "baja"],
      task_status: [
        "pendiente",
        "borrador",
        "asignada",
        "en-curso",
        "finalizada",
        "en-aprobacion",
        "cerrada",
        "cancelada",
        "pendiente-cierre",
        "incidencia",
        "vencida",
        "programada",
      ],
      task_type: [
        "fiber",
        "camera",
        "wireless",
        "pole",
        "maintenance",
        "inspection",
      ],
      treasury_movement_origin: [
        "manual",
        "task",
        "sales",
        "customer_service",
        "administration",
      ],
      treasury_movement_status: ["pending", "confirmed", "cancelled"],
      treasury_movement_type: ["income", "expense", "withdrawal"],
      work_team_shift_status: ["NOT_STARTED", "ACTIVE", "FINISHED"],
    },
  },
} as const
