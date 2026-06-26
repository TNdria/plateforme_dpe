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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      tdb_cisco: {
        Row: {
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          data: Json
          DREN: string | null
          id: number
          imported_at: string
        }
        Insert: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
        }
        Update: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
        }
        Relationships: []
      }
      tdb_dren: {
        Row: {
          CODE_DREN: number | null
          data: Json
          DREN: string | null
          id: number
          imported_at: string
        }
        Insert: {
          CODE_DREN?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
        }
        Update: {
          CODE_DREN?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
        }
        Relationships: []
      }
      tdb_ecole: {
        Row: {
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          CODE_ETAB: number | null
          CODE_ZAP: number | null
          data: Json
          DREN: string | null
          id: number
          imported_at: string
          NOM_ETAB: string | null
          ZAP: string | null
        }
        Insert: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ETAB?: number | null
          CODE_ZAP?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
          NOM_ETAB?: string | null
          ZAP?: string | null
        }
        Update: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ETAB?: number | null
          CODE_ZAP?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
          NOM_ETAB?: string | null
          ZAP?: string | null
        }
        Relationships: []
      }
      tdb_import_batches: {
        Row: {
          batch_ts_end: string
          batch_ts_start: string
          created_at: string
          file_name: string | null
          id: string
          imported_by: string | null
          notes: string | null
          row_count: number
          status: string
          table_name: string
        }
        Insert: {
          batch_ts_end: string
          batch_ts_start: string
          created_at?: string
          file_name?: string | null
          id?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number
          status?: string
          table_name: string
        }
        Update: {
          batch_ts_end?: string
          batch_ts_start?: string
          created_at?: string
          file_name?: string | null
          id?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number
          status?: string
          table_name?: string
        }
        Relationships: []
      }
      tdb_mada: {
        Row: {
          CODE_MADA: number | null
          data: Json
          id: number
          imported_at: string
        }
        Insert: {
          CODE_MADA?: number | null
          data?: Json
          id?: number
          imported_at?: string
        }
        Update: {
          CODE_MADA?: number | null
          data?: Json
          id?: number
          imported_at?: string
        }
        Relationships: []
      }
      tdb_ref: {
        Row: {
          CODE_ETAB: number | null
          data: Json
          id: number
          imported_at: string
        }
        Insert: {
          CODE_ETAB?: number | null
          data?: Json
          id?: number
          imported_at?: string
        }
        Update: {
          CODE_ETAB?: number | null
          data?: Json
          id?: number
          imported_at?: string
        }
        Relationships: []
      }
      tdb_zap: {
        Row: {
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          CODE_ZAP: number | null
          data: Json
          DREN: string | null
          id: number
          imported_at: string
          ZAP: string | null
        }
        Insert: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ZAP?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
          ZAP?: string | null
        }
        Update: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ZAP?: number | null
          data?: Json
          DREN?: string | null
          id?: number
          imported_at?: string
          ZAP?: string | null
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
