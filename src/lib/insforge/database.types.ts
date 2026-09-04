// Derived from the migrations in migrations/.

export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type EventKind = 'academic' | 'personal'
export type EventStatus = 'pending' | 'completed'
export type AcademicActivityType =
  | 'assignment'
  | 'graded_discussion'
  | 'quiz'
  | 'oral_assessment'
  | 'test'
  | 'exam'
  | 'other'
export type NoteTargetType = 'subject' | 'personal_group'
export type DeviceTokenScope = 'read:snapshot' | 'write:events'
export type HabitTrackingType = 'boolean' | 'count' | 'duration'
export type HabitEvaluationMode = 'scheduled_occurrence' | 'period_quota'
export type HabitMissPolicy = 'mark_missed' | 'keep_pending'
export type HabitLifecycleStatus = 'active' | 'paused' | 'archived'
export type HabitNotePolicy = 'none' | 'general' | 'daily' | 'both'
export type HabitLogStatus = 'completed' | 'partial' | 'skipped'
export type HabitLogSource = 'manual' | 'koreader'
export type HabitQuotaPeriod = 'day' | 'week' | 'month'
export type RecurringTaskOccurrenceStatus = 'completed' | 'rescheduled'

export type Database = {
  public: {
    Tables: {
      subjects: {
        Row: {
          id: string
          owner_id: string
          name: string
          code: string
          abbreviation: string
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          code: string
          abbreviation: string
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          code?: string
          abbreviation?: string
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subjects_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      personal_groups: {
        Row: {
          id: string
          owner_id: string
          name: string
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'personal_groups_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          id: string
          owner_id: string
          kind: EventKind
          title: string
          subject_id: string | null
          personal_group_id: string | null
          start_at: string
          end_at: string | null
          is_all_day: boolean
          status: EventStatus
          location: string | null
          description: string | null
          academic_activity_type?: AcademicActivityType | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          kind: EventKind
          title: string
          subject_id?: string | null
          personal_group_id?: string | null
          start_at: string
          end_at?: string | null
          is_all_day?: boolean
          status?: EventStatus
          location?: string | null
          description?: string | null
          academic_activity_type?: AcademicActivityType | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          kind?: EventKind
          title?: string
          subject_id?: string | null
          personal_group_id?: string | null
          start_at?: string
          end_at?: string | null
          is_all_day?: boolean
          status?: EventStatus
          location?: string | null
          description?: string | null
          academic_activity_type?: AcademicActivityType | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_personal_group_id_fkey'
            columns: ['personal_group_id']
            isOneToOne: false
            referencedRelation: 'personal_groups'
            referencedColumns: ['id']
          },
        ]
      }
      notes: {
        Row: {
          id: string
          owner_id: string
          target_type: NoteTargetType
          target_id: string
          title: string
          content_markdown: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          target_type: NoteTargetType
          target_id: string
          title: string
          content_markdown: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          target_type?: NoteTargetType
          target_id?: string
          title?: string
          content_markdown?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notes_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      device_tokens: {
        Row: {
          id: string
          owner_id: string
          token_hash: string
          label: string
          scopes: DeviceTokenScope[]
          created_at: string
          updated_at: string
          last_used_at: string | null
          revoked_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          token_hash: string
          label?: string
          scopes?: DeviceTokenScope[]
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          token_hash?: string
          label?: string
          scopes?: DeviceTokenScope[]
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'device_tokens_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      device_pairing_codes: {
        Row: {
          id: string
          owner_id: string
          code_hash: string
          label: string
          created_at: string
          expires_at: string
          consumed_at: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          code_hash: string
          label?: string
          created_at?: string
          expires_at: string
          consumed_at?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          code_hash?: string
          label?: string
          created_at?: string
          expires_at?: string
          consumed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'device_pairing_codes_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      device_pairing_rate_limits: {
        Row: {
          rate_key_hash: string
          window_started_at: string
          attempt_count: number
          updated_at: string
        }
        Insert: {
          rate_key_hash: string
          window_started_at: string
          attempt_count?: number
          updated_at?: string
        }
        Update: {
          rate_key_hash?: string
          window_started_at?: string
          attempt_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          color: string | null
          subject_id: string | null
          personal_group_id: string | null
          tracking_type: HabitTrackingType
          unit: string | null
          goal_value: number
          evaluation_mode: HabitEvaluationMode
          quota_period: HabitQuotaPeriod | null
          miss_policy: HabitMissPolicy
          schedule: Json
          start_date: string
          end_date: string | null
          lifecycle_status: HabitLifecycleStatus
          stats_enabled: boolean
          note_policy: HabitNotePolicy
          calendar_enabled: boolean
          calendar_schedule: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          color?: string | null
          subject_id?: string | null
          personal_group_id?: string | null
          tracking_type: HabitTrackingType
          unit?: string | null
          goal_value: number
          evaluation_mode: HabitEvaluationMode
          quota_period?: HabitQuotaPeriod | null
          miss_policy: HabitMissPolicy
          schedule: Json
          start_date: string
          end_date?: string | null
          lifecycle_status?: HabitLifecycleStatus
          stats_enabled?: boolean
          note_policy?: HabitNotePolicy
          calendar_enabled?: boolean
          calendar_schedule?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          color?: string | null
          subject_id?: string | null
          personal_group_id?: string | null
          tracking_type?: HabitTrackingType
          unit?: string | null
          goal_value?: number
          evaluation_mode?: HabitEvaluationMode
          quota_period?: HabitQuotaPeriod | null
          miss_policy?: HabitMissPolicy
          schedule?: Json
          start_date?: string
          end_date?: string | null
          lifecycle_status?: HabitLifecycleStatus
          stats_enabled?: boolean
          note_policy?: HabitNotePolicy
          calendar_enabled?: boolean
          calendar_schedule?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_schedule_versions: {
        Row: {
          id: string
          owner_id: string
          habit_id: string
          schedule: Json
          evaluation_mode: HabitEvaluationMode
          goal_value: number
          quota_period: HabitQuotaPeriod | null
          miss_policy: HabitMissPolicy
          effective_from: string
          effective_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          habit_id: string
          schedule: Json
          evaluation_mode: HabitEvaluationMode
          goal_value: number
          quota_period?: HabitQuotaPeriod | null
          miss_policy: HabitMissPolicy
          effective_from: string
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          habit_id?: string
          schedule?: Json
          evaluation_mode?: HabitEvaluationMode
          goal_value?: number
          quota_period?: HabitQuotaPeriod | null
          miss_policy?: HabitMissPolicy
          effective_from?: string
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          id: string
          owner_id: string
          habit_id: string
          local_date: string
          value: number
          status: HabitLogStatus
          source: HabitLogSource
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          habit_id: string
          local_date: string
          value: number
          status: HabitLogStatus
          source?: HabitLogSource
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          habit_id?: string
          local_date?: string
          value?: number
          status?: HabitLogStatus
          source?: HabitLogSource
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_notes: {
        Row: {
          id: string
          owner_id: string
          habit_id: string
          entry_date: string | null
          title: string
          content_markdown: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          habit_id: string
          entry_date?: string | null
          title: string
          content_markdown: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          habit_id?: string
          entry_date?: string | null
          title?: string
          content_markdown?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_tasks: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          color: string | null
          subject_id: string | null
          personal_group_id: string | null
          schedule: Json
          start_date: string
          end_date: string | null
          next_due_date: string
          due_time: string | null
          duration_minutes: number | null
          status: HabitLifecycleStatus
          calendar_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description?: string | null
          color?: string | null
          subject_id?: string | null
          personal_group_id?: string | null
          schedule: Json
          start_date: string
          end_date?: string | null
          next_due_date: string
          due_time?: string | null
          duration_minutes?: number | null
          status?: HabitLifecycleStatus
          calendar_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string | null
          color?: string | null
          subject_id?: string | null
          personal_group_id?: string | null
          schedule?: Json
          start_date?: string
          end_date?: string | null
          next_due_date?: string
          due_time?: string | null
          duration_minutes?: number | null
          status?: HabitLifecycleStatus
          calendar_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_task_schedule_versions: {
        Row: {
          id: string
          owner_id: string
          recurring_task_id: string
          schedule: Json
          effective_from: string
          effective_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          recurring_task_id: string
          schedule: Json
          effective_from: string
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          recurring_task_id?: string
          schedule?: Json
          effective_from?: string
          effective_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_task_occurrences: {
        Row: {
          id: string
          owner_id: string
          recurring_task_id: string
          due_date: string
          status: RecurringTaskOccurrenceStatus
          completed_at: string | null
          rescheduled_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          recurring_task_id: string
          due_date: string
          status: RecurringTaskOccurrenceStatus
          completed_at?: string | null
          rescheduled_to?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          recurring_task_id?: string
          due_date?: string
          status?: RecurringTaskOccurrenceStatus
          completed_at?: string | null
          rescheduled_to?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
