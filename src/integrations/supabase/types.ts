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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      deployment_device_status: {
        Row: {
          completed_at: string | null
          created_at: string
          deployment_id: string
          device_id: string
          error_message: string | null
          id: string
          progress: number | null
          stage: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deployment_id: string
          device_id: string
          error_message?: string | null
          id?: string
          progress?: number | null
          stage?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deployment_id?: string
          device_id?: string
          error_message?: string | null
          id?: string
          progress?: number | null
          stage?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployment_device_status_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_device_status_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          bandwidth_limit_mbps: number | null
          completed_at: string | null
          created_at: string
          current_stage: number | null
          id: string
          model_checksum: string | null
          model_id: string
          model_url: string | null
          model_version: string
          name: string
          rollback_version: string | null
          rollout_stages: Json | null
          started_at: string | null
          status: string
          strategy: string
          target_device_ids: Json | null
          target_group_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bandwidth_limit_mbps?: number | null
          completed_at?: string | null
          created_at?: string
          current_stage?: number | null
          id?: string
          model_checksum?: string | null
          model_id: string
          model_url?: string | null
          model_version: string
          name: string
          rollback_version?: string | null
          rollout_stages?: Json | null
          started_at?: string | null
          status?: string
          strategy?: string
          target_device_ids?: Json | null
          target_group_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bandwidth_limit_mbps?: number | null
          completed_at?: string | null
          created_at?: string
          current_stage?: number | null
          id?: string
          model_checksum?: string | null
          model_id?: string
          model_url?: string | null
          model_version?: string
          name?: string
          rollback_version?: string | null
          rollout_stages?: Json | null
          started_at?: string | null
          status?: string
          strategy?: string
          target_device_ids?: Json | null
          target_group_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_groups: {
        Row: {
          auto_scaling_policy: Json | null
          created_at: string
          description: string | null
          id: string
          name: string
          tag_filter: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_scaling_policy?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tag_filter?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_scaling_policy?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tag_filter?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_resource_history: {
        Row: {
          created_at: string
          device_id: string
          id: string
          resource_usage: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          resource_usage?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          resource_usage?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_resource_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          config_overrides: Json | null
          created_at: string
          current_model_id: string | null
          current_model_version: string | null
          device_type: string | null
          firmware_version: string | null
          hardware_specs: Json | null
          id: string
          ip_address: string | null
          last_heartbeat_at: string | null
          last_seen_at: string | null
          metadata: Json | null
          name: string
          registered_at: string | null
          status: string | null
          tags: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config_overrides?: Json | null
          created_at?: string
          current_model_id?: string | null
          current_model_version?: string | null
          device_type?: string | null
          firmware_version?: string | null
          hardware_specs?: Json | null
          id?: string
          ip_address?: string | null
          last_heartbeat_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          name?: string
          registered_at?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config_overrides?: Json | null
          created_at?: string
          current_model_id?: string | null
          current_model_version?: string | null
          device_type?: string | null
          firmware_version?: string | null
          hardware_specs?: Json | null
          id?: string
          ip_address?: string | null
          last_heartbeat_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          name?: string
          registered_at?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fleet_alerts: {
        Row: {
          alert_type: string
          created_at: string
          deployment_id: string | null
          device_id: string | null
          id: string
          message: string
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          deployment_id?: string | null
          device_id?: string | null
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          deployment_id?: string | null
          device_id?: string | null
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_alerts_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          device_id: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      inference_history: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          latency_ms: number | null
          model: string | null
          prompt: string | null
          result: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt?: string | null
          result?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt?: string | null
          result?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      maintenance_windows: {
        Row: {
          created_at: string
          description: string | null
          device_ids: Json | null
          ends_at: string
          group_id: string | null
          id: string
          is_active: boolean | null
          name: string
          recurrence: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          device_ids?: Json | null
          ends_at: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          recurrence?: string | null
          starts_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          device_ids?: Json | null
          ends_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          recurrence?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_windows_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
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
  public: {
    Enums: {},
  },
} as const
