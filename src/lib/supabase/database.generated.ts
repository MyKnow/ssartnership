// Bootstrap pilot derived from supabase/schema.sql (categories only).
// Replace with the complete local DB output using npm run gen:database-types.
// No claim of a live database generation is made for this bootstrap snapshot.
export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { id: string; key: string; label: string; description: string | null; color: string | null; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; key: string; label: string; description?: string | null; color?: string | null; created_at?: string | null; updated_at?: string | null };
        Update: { id?: string; key?: string; label?: string; description?: string | null; color?: string | null; created_at?: string | null; updated_at?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
