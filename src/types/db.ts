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
    PostgrestVersion: "14.17"
  }
  acct: {
    Tables: {
      audit_comment: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          finding_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          finding_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          finding_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_comment_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "audit_finding"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_finding: {
        Row: {
          assigned_to: string | null
          auto_closed: boolean
          detected_at: string
          entity_id: string | null
          entity_type: string | null
          evidence: Json
          id: string
          last_seen_at: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_key: string
          severity: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          auto_closed?: boolean
          detected_at?: string
          entity_id?: string | null
          entity_type?: string | null
          evidence?: Json
          id?: string
          last_seen_at?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key: string
          severity: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          auto_closed?: boolean
          detected_at?: string
          entity_id?: string | null
          entity_type?: string | null
          evidence?: Json
          id?: string
          last_seen_at?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key?: string
          severity?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      audit_rule: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          name: string
          severity: string
          threshold: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          name: string
          severity: string
          threshold?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          severity?: string
          threshold?: Json
        }
        Relationships: []
      }
      deposit: {
        Row: {
          amount: number
          id: string
          invoice_id: string | null
          lease_id: string
          paid_amount: number
          refunded_amount: number
          status: string
        }
        Insert: {
          amount: number
          id?: string
          invoice_id?: string | null
          lease_id: string
          paid_amount?: number
          refunded_amount?: number
          status?: string
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string | null
          lease_id?: string
          paid_amount?: number
          refunded_amount?: number
          status?: string
        }
        Relationships: []
      }
      invoice: {
        Row: {
          amount: number
          created_at: string
          display_number: string | null
          due_date: string
          id: string
          lease_id: string | null
          reservation_id: string | null
          status: string
          tenant_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          display_number?: string | null
          due_date: string
          id?: string
          lease_id?: string | null
          reservation_id?: string | null
          status?: string
          tenant_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          display_number?: string | null
          due_date?: string
          id?: string
          lease_id?: string | null
          reservation_id?: string | null
          status?: string
          tenant_id?: string | null
          type?: string
        }
        Relationships: []
      }
      ledger_entry: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          ref_invoice_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          ref_invoice_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          ref_invoice_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entry_ref_invoice_id_fkey"
            columns: ["ref_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      meter: {
        Row: {
          active: boolean
          created_at: string
          id: string
          initial_reading: number
          meter_number: string | null
          unit_id: string
          unit_label: string
          utility_type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          initial_reading?: number
          meter_number?: string | null
          unit_id: string
          unit_label?: string
          utility_type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          initial_reading?: number
          meter_number?: string | null
          unit_id?: string
          unit_label?: string
          utility_type?: string
        }
        Relationships: []
      }
      meter_reading: {
        Row: {
          amount_due: number | null
          created_at: string
          id: string
          invoice_id: string | null
          meter_id: string
          notes: string | null
          or_number: string | null
          penalty_amount: number
          photo_url: string | null
          rate_snapshot: number | null
          reading: number
          reading_date: string
          recorded_by: string | null
          total_due: number | null
        }
        Insert: {
          amount_due?: number | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          meter_id: string
          notes?: string | null
          or_number?: string | null
          penalty_amount?: number
          photo_url?: string | null
          rate_snapshot?: number | null
          reading: number
          reading_date: string
          recorded_by?: string | null
          total_due?: number | null
        }
        Update: {
          amount_due?: number | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          meter_id?: string
          notes?: string | null
          or_number?: string | null
          penalty_amount?: number
          photo_url?: string | null
          rate_snapshot?: number | null
          reading?: number
          reading_date?: string
          recorded_by?: string | null
          total_due?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meter_reading_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meter"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          method: string
          paid_at: string
          receipt_number: string | null
          recorded_by: string | null
          reference_no: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          invoice_id: string
          method: string
          paid_at?: string
          receipt_number?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          method?: string
          paid_at?: string
          receipt_number?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          channel: string
          id: string
          reminder_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          id?: string
          reminder_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          id?: string
          reminder_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_pref: {
        Row: {
          days_before: number
          email_enabled: boolean
          invoice_overdue: boolean
          lease_expiring: boolean
          rent_due_soon: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          days_before?: number
          email_enabled?: boolean
          invoice_overdue?: boolean
          lease_expiring?: boolean
          rent_due_soon?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          days_before?: number
          email_enabled?: boolean
          invoice_overdue?: boolean
          lease_expiring?: boolean
          rent_due_soon?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_receipt: {
        Row: {
          custom_label: string | null
          drive_file_ids: Json
          drive_folder_id: string
          drive_folder_url: string
          id: string
          notes: string | null
          payment_for: string[]
          payment_month: string | null
          property_id: string | null
          reference_no: string | null
          reservation_id: string | null
          tenant_id: string | null
          unit_id: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          custom_label?: string | null
          drive_file_ids?: Json
          drive_folder_id: string
          drive_folder_url: string
          id?: string
          notes?: string | null
          payment_for?: string[]
          payment_month?: string | null
          property_id?: string | null
          reference_no?: string | null
          reservation_id?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          custom_label?: string | null
          drive_file_ids?: Json
          drive_folder_id?: string
          drive_folder_url?: string
          id?: string
          notes?: string | null
          payment_for?: string[]
          payment_month?: string | null
          property_id?: string | null
          reference_no?: string | null
          reservation_id?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      unit_reservation: {
        Row: {
          add_ons: Json | null
          add_ons_amount: number | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          deposit_1: number | null
          deposit_1_due_date: string | null
          deposit_2: number | null
          deposit_2_due_date: string | null
          id: string
          inquiry_id: string | null
          intent: string | null
          lease_end_date: string | null
          lease_start_date: string | null
          lease_status: string | null
          monthly_rent: number | null
          move_in_date: string | null
          notice_period_days: number | null
          or_reference: string | null
          payment_mode: string | null
          reference_number: string | null
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          rent_due_date: string | null
          reservation_fee: number | null
          reserved_at: string
          reserved_by: string | null
          term: string | null
          unit_id: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          add_ons?: Json | null
          add_ons_amount?: number | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          deposit_1?: number | null
          deposit_1_due_date?: string | null
          deposit_2?: number | null
          deposit_2_due_date?: string | null
          id?: string
          inquiry_id?: string | null
          intent?: string | null
          lease_end_date?: string | null
          lease_start_date?: string | null
          lease_status?: string | null
          monthly_rent?: number | null
          move_in_date?: string | null
          notice_period_days?: number | null
          or_reference?: string | null
          payment_mode?: string | null
          reference_number?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          rent_due_date?: string | null
          reservation_fee?: number | null
          reserved_at?: string
          reserved_by?: string | null
          term?: string | null
          unit_id: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          add_ons?: Json | null
          add_ons_amount?: number | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          deposit_1?: number | null
          deposit_1_due_date?: string | null
          deposit_2?: number | null
          deposit_2_due_date?: string | null
          id?: string
          inquiry_id?: string | null
          intent?: string | null
          lease_end_date?: string | null
          lease_start_date?: string | null
          lease_status?: string | null
          monthly_rent?: number | null
          move_in_date?: string | null
          notice_period_days?: number | null
          or_reference?: string | null
          payment_mode?: string | null
          reference_number?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          rent_due_date?: string | null
          reservation_fee?: number | null
          reserved_at?: string
          reserved_by?: string | null
          term?: string | null
          unit_id?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      utility_rate: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          property_id: string | null
          rate_per_unit: number
          utility_type: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          property_id?: string | null
          rate_per_unit: number
          utility_type: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          property_id?: string | null
          rate_per_unit?: number
          utility_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  core: {
    Tables: {
      app_user: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_event: {
        Row: {
          dead_letter: boolean
          emitted_at: string
          emitted_by_user_id: string | null
          event_key: string
          id: string
          payload: Json
          processed_at: string | null
          retry_count: number
        }
        Insert: {
          dead_letter?: boolean
          emitted_at?: string
          emitted_by_user_id?: string | null
          event_key: string
          id?: string
          payload: Json
          processed_at?: string | null
          retry_count?: number
        }
        Update: {
          dead_letter?: boolean
          emitted_at?: string
          emitted_by_user_id?: string | null
          event_key?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "domain_event_emitted_by_user_id_fkey"
            columns: ["emitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      lease: {
        Row: {
          ad_ons: Json
          ad_ons_amount: number | null
          address: string | null
          advance_amount: number
          advance_due_date: string | null
          barcode_value: string | null
          control_number: string | null
          created_at: string
          deposit_1: number | null
          deposit_1_due_date: string | null
          deposit_2: number | null
          deposit_2_due_date: string | null
          deposit_amount: number
          deposit_nonrefundable_on: string | null
          due_date: string | null
          due_day: number | null
          end_date: string
          id: string
          intent: string | null
          monthly_rent: number
          move_in_date: string | null
          notice_period_days: number
          occupancy_fee: number
          reservation_fee: number | null
          reservation_fee_nonrefundable_on: string | null
          reservation_id: string | null
          reservation_total_due: number | null
          start_date: string
          status: string
          target_move_in_date: string | null
          tenant_id: string
          term: string | null
          term_label: string | null
          term_months: number | null
          unit_id: string
          utility_deposit: number
        }
        Insert: {
          ad_ons?: Json
          ad_ons_amount?: number | null
          address?: string | null
          advance_amount?: number
          advance_due_date?: string | null
          barcode_value?: string | null
          control_number?: string | null
          created_at?: string
          deposit_1?: number | null
          deposit_1_due_date?: string | null
          deposit_2?: number | null
          deposit_2_due_date?: string | null
          deposit_amount?: number
          deposit_nonrefundable_on?: string | null
          due_date?: string | null
          due_day?: number | null
          end_date: string
          id?: string
          intent?: string | null
          monthly_rent: number
          move_in_date?: string | null
          notice_period_days?: number
          occupancy_fee?: number
          reservation_fee?: number | null
          reservation_fee_nonrefundable_on?: string | null
          reservation_id?: string | null
          reservation_total_due?: number | null
          start_date: string
          status?: string
          target_move_in_date?: string | null
          tenant_id: string
          term?: string | null
          term_label?: string | null
          term_months?: number | null
          unit_id: string
          utility_deposit?: number
        }
        Update: {
          ad_ons?: Json
          ad_ons_amount?: number | null
          address?: string | null
          advance_amount?: number
          advance_due_date?: string | null
          barcode_value?: string | null
          control_number?: string | null
          created_at?: string
          deposit_1?: number | null
          deposit_1_due_date?: string | null
          deposit_2?: number | null
          deposit_2_due_date?: string | null
          deposit_amount?: number
          deposit_nonrefundable_on?: string | null
          due_date?: string | null
          due_day?: number | null
          end_date?: string
          id?: string
          intent?: string | null
          monthly_rent?: number
          move_in_date?: string | null
          notice_period_days?: number
          occupancy_fee?: number
          reservation_fee?: number | null
          reservation_fee_nonrefundable_on?: string | null
          reservation_id?: string | null
          reservation_total_due?: number | null
          start_date?: string
          status?: string
          target_move_in_date?: string | null
          tenant_id?: string
          term?: string | null
          term_label?: string | null
          term_months?: number | null
          unit_id?: string
          utility_deposit?: number
        }
        Relationships: [
          {
            foreignKeyName: "lease_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      permission: {
        Row: {
          description: string | null
          id: string
          key: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      property: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          id: string
          logo_filename: string
          name: string
          total_units: number
          type: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          logo_filename?: string
          name: string
          total_units?: number
          type?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          logo_filename?: string
          name?: string
          total_units?: number
          type?: string
        }
        Relationships: []
      }
      property_payment_channel: {
        Row: {
          account_name: string | null
          account_number: string | null
          id: string
          kind: string
          label: string | null
          property_id: string | null
          sort_order: number | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          id?: string
          kind: string
          label?: string | null
          property_id?: string | null
          sort_order?: number | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          id?: string
          kind?: string
          label?: string | null
          property_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_payment_channel_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      role: {
        Row: {
          id: string
          key: string
          name: string
        }
        Insert: {
          id?: string
          key: string
          name: string
        }
        Update: {
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      role_permission: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permission_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          birth_date: string | null
          civil_status: string | null
          company: string | null
          company_address: string | null
          company_email: string | null
          company_messenger: string | null
          company_tel: string | null
          created_at: string
          ec1_email: string | null
          ec1_messenger: string | null
          ec1_name: string | null
          ec1_phone: string | null
          ec2_email: string | null
          ec2_messenger: string | null
          ec2_name: string | null
          ec2_phone: string | null
          email: string | null
          first_name: string | null
          full_name: string
          gender: string | null
          government_id: string | null
          id: string
          inquiry_id: string | null
          last_name: string | null
          marketing_source: string | null
          messenger_name: string | null
          middle_name: string | null
          nationality: string | null
          permanent_address: string | null
          phone: string | null
          recent_address: string | null
          religion: string | null
          reservation_id: string | null
          status: string
          work_position: string | null
          work_status: string | null
        }
        Insert: {
          birth_date?: string | null
          civil_status?: string | null
          company?: string | null
          company_address?: string | null
          company_email?: string | null
          company_messenger?: string | null
          company_tel?: string | null
          created_at?: string
          ec1_email?: string | null
          ec1_messenger?: string | null
          ec1_name?: string | null
          ec1_phone?: string | null
          ec2_email?: string | null
          ec2_messenger?: string | null
          ec2_name?: string | null
          ec2_phone?: string | null
          email?: string | null
          first_name?: string | null
          full_name: string
          gender?: string | null
          government_id?: string | null
          id?: string
          inquiry_id?: string | null
          last_name?: string | null
          marketing_source?: string | null
          messenger_name?: string | null
          middle_name?: string | null
          nationality?: string | null
          permanent_address?: string | null
          phone?: string | null
          recent_address?: string | null
          religion?: string | null
          reservation_id?: string | null
          status?: string
          work_position?: string | null
          work_status?: string | null
        }
        Update: {
          birth_date?: string | null
          civil_status?: string | null
          company?: string | null
          company_address?: string | null
          company_email?: string | null
          company_messenger?: string | null
          company_tel?: string | null
          created_at?: string
          ec1_email?: string | null
          ec1_messenger?: string | null
          ec1_name?: string | null
          ec1_phone?: string | null
          ec2_email?: string | null
          ec2_messenger?: string | null
          ec2_name?: string | null
          ec2_phone?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          gender?: string | null
          government_id?: string | null
          id?: string
          inquiry_id?: string | null
          last_name?: string | null
          marketing_source?: string | null
          messenger_name?: string | null
          middle_name?: string | null
          nationality?: string | null
          permanent_address?: string | null
          phone?: string | null
          recent_address?: string | null
          religion?: string | null
          reservation_id?: string | null
          status?: string
          work_position?: string | null
          work_status?: string | null
        }
        Relationships: []
      }
      tenant_invite: {
        Row: {
          created_at: string
          created_by: string | null
          email_hint: string | null
          expires_at: string
          id: string
          tenant_id: string
          token_hash: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_hint?: string | null
          expires_at: string
          id?: string
          tenant_id: string
          token_hash: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_hint?: string | null
          expires_at?: string
          id?: string
          tenant_id?: string
          token_hash?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invite_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invite_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invite_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_user: {
        Row: {
          auth_user_id: string
          created_at: string
          relationship: string
          tenant_id: string
          terms_agreed_at: string | null
          terms_version_agreed: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          relationship?: string
          tenant_id: string
          terms_agreed_at?: string | null
          terms_version_agreed?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          relationship?: string
          tenant_id?: string
          terms_agreed_at?: string | null
          terms_version_agreed?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_user_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_user_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_user_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      unit: {
        Row: {
          area_sqm: number | null
          base_rent: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          floor: number | null
          id: string
          property_id: string
          status: string
          unit_number: string
        }
        Insert: {
          area_sqm?: number | null
          base_rent?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          floor?: number | null
          id?: string
          property_id: string
          status?: string
          unit_number: string
        }
        Update: {
          area_sqm?: number | null
          base_rent?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          floor?: number | null
          id?: string
          property_id?: string
          status?: string
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role: {
        Row: {
          role_id: string
          scope_property_id: string | null
          scope_type: string
          user_id: string
        }
        Insert: {
          role_id: string
          scope_property_id?: string | null
          scope_type?: string
          user_id: string
        }
        Update: {
          role_id?: string
          scope_property_id?: string | null
          scope_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_scope_property_fk"
            columns: ["scope_property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  maint: {
    Tables: {
      asset: {
        Row: {
          id: string
          install_date: string | null
          name: string
          type: string | null
          unit_id: string
          warranty_until: string | null
        }
        Insert: {
          id?: string
          install_date?: string | null
          name: string
          type?: string | null
          unit_id: string
          warranty_until?: string | null
        }
        Update: {
          id?: string
          install_date?: string | null
          name?: string
          type?: string | null
          unit_id?: string
          warranty_until?: string | null
        }
        Relationships: []
      }
      job_order: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          cost_estimate: number | null
          created_at: string
          description: string | null
          id: string
          priority: string
          requested_by_user_id: string | null
          scheduled_date: string | null
          status: string
          task_type_id: string
          unit_id: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          requested_by_user_id?: string | null
          scheduled_date?: string | null
          status?: string
          task_type_id: string
          unit_id: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          requested_by_user_id?: string | null
          scheduled_date?: string | null
          status?: string
          task_type_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_order_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "job_task_type"
            referencedColumns: ["id"]
          },
        ]
      }
      job_task_type: {
        Row: {
          approval_threshold_php: number
          id: string
          key: string
          name: string
        }
        Insert: {
          approval_threshold_php?: number
          id?: string
          key: string
          name: string
        }
        Update: {
          approval_threshold_php?: number
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      work_log: {
        Row: {
          completed_at: string | null
          hours: number | null
          id: string
          job_order_id: string
          notes: string | null
          parts_used: Json
          technician_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          hours?: number | null
          id?: string
          job_order_id: string
          notes?: string | null
          parts_used?: Json
          technician_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          hours?: number | null
          id?: string
          job_order_id?: string
          notes?: string | null
          parts_used?: Json
          technician_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_log_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_order"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  mkt: {
    Tables: {
      availability_forecast: {
        Row: {
          computed_at: string
          confidence: string
          earliest_available_date: string
          id: string
          notes: string | null
          unit_id: string
        }
        Insert: {
          computed_at?: string
          confidence?: string
          earliest_available_date: string
          id?: string
          notes?: string | null
          unit_id: string
        }
        Update: {
          computed_at?: string
          confidence?: string
          earliest_available_date?: string
          id?: string
          notes?: string | null
          unit_id?: string
        }
        Relationships: []
      }
      inquiry: {
        Row: {
          contact: string | null
          created_at: string
          email: string | null
          government_id: string | null
          id: string
          messenger_name: string | null
          prospect_name: string
          source: string | null
          status: string
          unit_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          government_id?: string | null
          id?: string
          messenger_name?: string | null
          prospect_name: string
          source?: string | null
          status?: string
          unit_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          government_id?: string | null
          id?: string
          messenger_name?: string | null
          prospect_name?: string
          source?: string | null
          status?: string
          unit_id?: string | null
        }
        Relationships: []
      }
      listing: {
        Row: {
          asking_rent: number | null
          description: string | null
          id: string
          photos: Json
          published_at: string | null
          status: string
          title: string
          unit_id: string
        }
        Insert: {
          asking_rent?: number | null
          description?: string | null
          id?: string
          photos?: Json
          published_at?: string | null
          status?: string
          title: string
          unit_id: string
        }
        Update: {
          asking_rent?: number | null
          description?: string | null
          id?: string
          photos?: Json
          published_at?: string | null
          status?: string
          title?: string
          unit_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  prep: {
    Tables: {
      contract: {
        Row: {
          created_at: string
          generated_body: string | null
          id: string
          lease_id: string
          signed_at: string | null
          signed_document_url: string | null
          status: string
          template_id: string | null
          tenant_signature: string | null
        }
        Insert: {
          created_at?: string
          generated_body?: string | null
          id?: string
          lease_id: string
          signed_at?: string | null
          signed_document_url?: string | null
          status?: string
          template_id?: string | null
          tenant_signature?: string | null
        }
        Update: {
          created_at?: string
          generated_body?: string | null
          id?: string
          lease_id?: string
          signed_at?: string | null
          signed_document_url?: string | null
          status?: string
          template_id?: string | null
          tenant_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_template"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_template: {
        Row: {
          active: boolean
          body_markdown: string
          doc_type: string
          id: string
          name: string
          property_id: string | null
          term_type: string | null
          title: string | null
          version: number
        }
        Insert: {
          active?: boolean
          body_markdown: string
          doc_type?: string
          id?: string
          name: string
          property_id?: string | null
          term_type?: string | null
          title?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          body_markdown?: string
          doc_type?: string
          id?: string
          name?: string
          property_id?: string | null
          term_type?: string | null
          title?: string | null
          version?: number
        }
        Relationships: []
      }
      reservation_contract: {
        Row: {
          created_at: string
          generated_body: string | null
          id: string
          reservation_id: string
          signature_token: string | null
          signed_at: string | null
          status: string
          template_id: string | null
          tenant_signature: string | null
          token_expires_at: string | null
        }
        Insert: {
          created_at?: string
          generated_body?: string | null
          id?: string
          reservation_id: string
          signature_token?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string | null
          tenant_signature?: string | null
          token_expires_at?: string | null
        }
        Update: {
          created_at?: string
          generated_body?: string | null
          id?: string
          reservation_id?: string
          signature_token?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string | null
          tenant_signature?: string | null
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_contract_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_template"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_inspection: {
        Row: {
          cabinet: string | null
          cabinet_comment: string | null
          created_at: string
          declogging: string | null
          declogging_comment: string | null
          door: string | null
          door_comment: string | null
          electric_initial: number | null
          faucets: string | null
          faucets_comment: string | null
          filled_by_staff_at: string | null
          filled_by_tenant_at: string | null
          filled_by_user_id: string | null
          id: string
          kitchen_sink: string | null
          kitchen_sink_comment: string | null
          lavatory: string | null
          lavatory_comment: string | null
          lease_id: string
          light_bulb: string | null
          light_bulb_comment: string | null
          number_of_persons: number | null
          optional_items: string | null
          optional_items_comment: string | null
          shower_head: string | null
          shower_head_comment: string | null
          sockets: string | null
          sockets_comment: string | null
          switches: string | null
          switches_comment: string | null
          toilet_bowl: string | null
          toilet_bowl_comment: string | null
          updated_at: string
          wall_paint: string | null
          wall_paint_comment: string | null
          water_initial: number | null
        }
        Insert: {
          cabinet?: string | null
          cabinet_comment?: string | null
          created_at?: string
          declogging?: string | null
          declogging_comment?: string | null
          door?: string | null
          door_comment?: string | null
          electric_initial?: number | null
          faucets?: string | null
          faucets_comment?: string | null
          filled_by_staff_at?: string | null
          filled_by_tenant_at?: string | null
          filled_by_user_id?: string | null
          id?: string
          kitchen_sink?: string | null
          kitchen_sink_comment?: string | null
          lavatory?: string | null
          lavatory_comment?: string | null
          lease_id: string
          light_bulb?: string | null
          light_bulb_comment?: string | null
          number_of_persons?: number | null
          optional_items?: string | null
          optional_items_comment?: string | null
          shower_head?: string | null
          shower_head_comment?: string | null
          sockets?: string | null
          sockets_comment?: string | null
          switches?: string | null
          switches_comment?: string | null
          toilet_bowl?: string | null
          toilet_bowl_comment?: string | null
          updated_at?: string
          wall_paint?: string | null
          wall_paint_comment?: string | null
          water_initial?: number | null
        }
        Update: {
          cabinet?: string | null
          cabinet_comment?: string | null
          created_at?: string
          declogging?: string | null
          declogging_comment?: string | null
          door?: string | null
          door_comment?: string | null
          electric_initial?: number | null
          faucets?: string | null
          faucets_comment?: string | null
          filled_by_staff_at?: string | null
          filled_by_tenant_at?: string | null
          filled_by_user_id?: string | null
          id?: string
          kitchen_sink?: string | null
          kitchen_sink_comment?: string | null
          lavatory?: string | null
          lavatory_comment?: string | null
          lease_id?: string
          light_bulb?: string | null
          light_bulb_comment?: string | null
          number_of_persons?: number | null
          optional_items?: string | null
          optional_items_comment?: string | null
          shower_head?: string | null
          shower_head_comment?: string | null
          sockets?: string | null
          sockets_comment?: string | null
          switches?: string | null
          switches_comment?: string | null
          toilet_bowl?: string | null
          toilet_bowl_comment?: string | null
          updated_at?: string
          wall_paint?: string | null
          wall_paint_comment?: string | null
          water_initial?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
      [_ in never]: never
    }
    Views: {
      app_user: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      asset: {
        Row: {
          id: string | null
          install_date: string | null
          name: string | null
          type: string | null
          unit_id: string | null
          warranty_until: string | null
        }
        Insert: {
          id?: string | null
          install_date?: string | null
          name?: string | null
          type?: string | null
          unit_id?: string | null
          warranty_until?: string | null
        }
        Update: {
          id?: string | null
          install_date?: string | null
          name?: string | null
          type?: string | null
          unit_id?: string | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          reason: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_forecast: {
        Row: {
          computed_at: string | null
          confidence: string | null
          earliest_available_date: string | null
          id: string | null
          notes: string | null
          unit_id: string | null
        }
        Insert: {
          computed_at?: string | null
          confidence?: string | null
          earliest_available_date?: string | null
          id?: string | null
          notes?: string | null
          unit_id?: string | null
        }
        Update: {
          computed_at?: string | null
          confidence?: string | null
          earliest_available_date?: string | null
          id?: string | null
          notes?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_forecast_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      contract: {
        Row: {
          created_at: string | null
          generated_body: string | null
          id: string | null
          lease_id: string | null
          signed_at: string | null
          signed_document_url: string | null
          status: string | null
          template_id: string | null
          tenant_signature: string | null
        }
        Insert: {
          created_at?: string | null
          generated_body?: string | null
          id?: string | null
          lease_id?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          status?: string | null
          template_id?: string | null
          tenant_signature?: string | null
        }
        Update: {
          created_at?: string | null
          generated_body?: string | null
          id?: string | null
          lease_id?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          status?: string | null
          template_id?: string | null
          tenant_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_template"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_template: {
        Row: {
          active: boolean | null
          body_markdown: string | null
          id: string | null
          name: string | null
          property_id: string | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          body_markdown?: string | null
          id?: string | null
          name?: string | null
          property_id?: string | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          body_markdown?: string | null
          id?: string | null
          name?: string | null
          property_id?: string | null
          version?: number | null
        }
        Relationships: []
      }
      deposit: {
        Row: {
          amount: number | null
          id: string | null
          invoice_id: string | null
          lease_id: string | null
          paid_amount: number | null
          refunded_amount: number | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          id?: string | null
          invoice_id?: string | null
          lease_id?: string | null
          paid_amount?: number | null
          refunded_amount?: number | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          id?: string | null
          invoice_id?: string | null
          lease_id?: string | null
          paid_amount?: number | null
          refunded_amount?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_event: {
        Row: {
          dead_letter: boolean | null
          emitted_at: string | null
          emitted_by_user_id: string | null
          event_key: string | null
          id: string | null
          payload: Json | null
          processed_at: string | null
          retry_count: number | null
        }
        Insert: {
          dead_letter?: boolean | null
          emitted_at?: string | null
          emitted_by_user_id?: string | null
          event_key?: string | null
          id?: string | null
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number | null
        }
        Update: {
          dead_letter?: boolean | null
          emitted_at?: string | null
          emitted_by_user_id?: string | null
          event_key?: string | null
          id?: string | null
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_event_emitted_by_user_id_fkey"
            columns: ["emitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      exec_monthly_revenue: {
        Row: {
          month: string | null
          total: number | null
        }
        Relationships: []
      }
      exec_occupancy_by_property: {
        Row: {
          occupancy_pct: number | null
          occupied: number | null
          property_id: string | null
          property_name: string | null
          total_units: number | null
          unavailable: number | null
          vacant: number | null
        }
        Relationships: []
      }
      inquiry: {
        Row: {
          contact: string | null
          created_at: string | null
          email: string | null
          government_id: string | null
          id: string | null
          messenger_name: string | null
          prospect_name: string | null
          source: string | null
          status: string | null
          unit_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string | null
          email?: string | null
          government_id?: string | null
          id?: string | null
          messenger_name?: string | null
          prospect_name?: string | null
          source?: string | null
          status?: string | null
          unit_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string | null
          email?: string | null
          government_id?: string | null
          id?: string | null
          messenger_name?: string | null
          prospect_name?: string | null
          source?: string | null
          status?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice: {
        Row: {
          amount: number | null
          created_at: string | null
          display_number: string | null
          due_date: string | null
          id: string | null
          lease_id: string | null
          reservation_id: string | null
          status: string | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          display_number?: string | null
          due_date?: string | null
          id?: string | null
          lease_id?: string | null
          reservation_id?: string | null
          status?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          display_number?: string | null
          due_date?: string | null
          id?: string | null
          lease_id?: string | null
          reservation_id?: string | null
          status?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      job_order: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          cost_estimate: number | null
          created_at: string | null
          description: string | null
          id: string | null
          priority: string | null
          requested_by_user_id: string | null
          scheduled_date: string | null
          status: string | null
          task_type_id: string | null
          unit_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          priority?: string | null
          requested_by_user_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          task_type_id?: string | null
          unit_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          priority?: string | null
          requested_by_user_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          task_type_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_order_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "job_task_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      job_task_type: {
        Row: {
          approval_threshold_php: number | null
          id: string | null
          key: string | null
          name: string | null
        }
        Insert: {
          approval_threshold_php?: number | null
          id?: string | null
          key?: string | null
          name?: string | null
        }
        Update: {
          approval_threshold_php?: number | null
          id?: string | null
          key?: string | null
          name?: string | null
        }
        Relationships: []
      }
      lease: {
        Row: {
          ad_ons: Json | null
          ad_ons_amount: number | null
          created_at: string | null
          deposit_1: number | null
          deposit_1_due_date: string | null
          deposit_2: number | null
          deposit_2_due_date: string | null
          deposit_amount: number | null
          due_date: string | null
          end_date: string | null
          id: string | null
          intent: string | null
          monthly_rent: number | null
          move_in_date: string | null
          notice_period_days: number | null
          reservation_id: string | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          tenant_name: string | null
          term: string | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entry: {
        Row: {
          amount: number | null
          balance_after: number | null
          created_at: string | null
          id: string | null
          ref_invoice_id: string | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          amount?: number | null
          balance_after?: number | null
          created_at?: string | null
          id?: string | null
          ref_invoice_id?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          amount?: number | null
          balance_after?: number | null
          created_at?: string | null
          id?: string | null
          ref_invoice_id?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entry_ref_invoice_id_fkey"
            columns: ["ref_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      listing: {
        Row: {
          asking_rent: number | null
          description: string | null
          id: string | null
          photos: Json | null
          published_at: string | null
          status: string | null
          title: string | null
          unit_id: string | null
        }
        Insert: {
          asking_rent?: number | null
          description?: string | null
          id?: string | null
          photos?: Json | null
          published_at?: string | null
          status?: string | null
          title?: string | null
          unit_id?: string | null
        }
        Update: {
          asking_rent?: number | null
          description?: string | null
          id?: string | null
          photos?: Json | null
          published_at?: string | null
          status?: string | null
          title?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount: number | null
          id: string | null
          invoice_id: string | null
          method: string | null
          paid_at: string | null
          receipt_number: string | null
          recorded_by: string | null
          reference_no: string | null
          tenant_id: string | null
        }
        Insert: {
          amount?: number | null
          id?: string | null
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number | null
          id?: string | null
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      permission: {
        Row: {
          description: string | null
          id: string | null
          key: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          key?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          key?: string | null
        }
        Relationships: []
      }
      property: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string | null
          id: string | null
          name: string | null
          total_units: number | null
          type: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          total_units?: number | null
          type?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          total_units?: number | null
          type?: string | null
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          channel: string | null
          id: string | null
          reminder_key: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          id?: string | null
          reminder_key?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          id?: string | null
          reminder_key?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_pref: {
        Row: {
          days_before: number | null
          email_enabled: boolean | null
          invoice_overdue: boolean | null
          lease_expiring: boolean | null
          rent_due_soon: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          days_before?: number | null
          email_enabled?: boolean | null
          invoice_overdue?: boolean | null
          lease_expiring?: boolean | null
          rent_due_soon?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          days_before?: number | null
          email_enabled?: boolean | null
          invoice_overdue?: boolean | null
          lease_expiring?: boolean | null
          rent_due_soon?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_pref_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      role: {
        Row: {
          id: string | null
          key: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          key?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          key?: string | null
          name?: string | null
        }
        Relationships: []
      }
      tenant: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          government_id: string | null
          id: string | null
          inquiry_id: string | null
          messenger_name: string | null
          phone: string | null
          reservation_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          government_id?: string | null
          id?: string | null
          inquiry_id?: string | null
          messenger_name?: string | null
          phone?: string | null
          reservation_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          government_id?: string | null
          id?: string | null
          inquiry_id?: string | null
          messenger_name?: string | null
          phone?: string | null
          reservation_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      tenant_receipt: {
        Row: {
          custom_label: string | null
          drive_file_ids: Json | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          id: string | null
          notes: string | null
          payment_for: string[] | null
          payment_month: string | null
          property_id: string | null
          reference_no: string | null
          reservation_id: string | null
          tenant_id: string | null
          unit_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          custom_label?: string | null
          drive_file_ids?: Json | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          id?: string | null
          notes?: string | null
          payment_for?: string[] | null
          payment_month?: string | null
          property_id?: string | null
          reference_no?: string | null
          reservation_id?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          custom_label?: string | null
          drive_file_ids?: Json | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          id?: string | null
          notes?: string | null
          payment_for?: string[] | null
          payment_month?: string | null
          property_id?: string | null
          reference_no?: string | null
          reservation_id?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      unit: {
        Row: {
          area_sqm: number | null
          base_rent: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          floor: number | null
          id: string | null
          property_id: string | null
          status: string | null
          unit_number: string | null
        }
        Insert: {
          area_sqm?: number | null
          base_rent?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          floor?: number | null
          id?: string | null
          property_id?: string | null
          status?: string | null
          unit_number?: string | null
        }
        Update: {
          area_sqm?: number | null
          base_rent?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          floor?: number | null
          id?: string | null
          property_id?: string | null
          status?: string | null
          unit_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "exec_occupancy_by_property"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "unit_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role: {
        Row: {
          role_id: string | null
          role_key: string | null
          role_name: string | null
          scope_property_id: string | null
          scope_type: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_role_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_scope_property_fk"
            columns: ["scope_property_id"]
            isOneToOne: false
            referencedRelation: "exec_occupancy_by_property"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "user_role_scope_property_fk"
            columns: ["scope_property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      work_log: {
        Row: {
          completed_at: string | null
          hours: number | null
          id: string | null
          job_order_id: string | null
          notes: string | null
          parts_used: Json | null
          technician_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          hours?: number | null
          id?: string | null
          job_order_id?: string | null
          notes?: string | null
          parts_used?: Json | null
          technician_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          hours?: number | null
          id?: string | null
          job_order_id?: string | null
          notes?: string | null
          parts_used?: Json | null
          technician_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_log_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_log_technician_user_id_fkey"
            columns: ["technician_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      has_perm: { Args: { p_key: string }; Returns: boolean }
      in_scope: { Args: { p_property_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  acct: {
    Enums: {},
  },
  core: {
    Enums: {},
  },
  maint: {
    Enums: {},
  },
  mkt: {
    Enums: {},
  },
  prep: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
