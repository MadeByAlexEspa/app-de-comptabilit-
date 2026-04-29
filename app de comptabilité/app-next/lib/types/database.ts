// Types générés depuis le schéma Supabase.
// En production : utiliser `supabase gen types typescript` pour les avoir exacts.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          activite_type: string | null
          structure_type: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['workspaces']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>
      }
      memberships: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          last_login_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['memberships']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['memberships']['Insert']>
      }
      factures: {
        Row: {
          id: number
          workspace_id: string
          numero: string
          date: string
          client: string
          description: string | null
          montant_ht: number
          taux_tva: number
          montant_tva: number
          montant_ttc: number
          tva_lines: Json | null
          categorie: string
          statut: 'payee' | 'en_attente'
          bank_source: string | null
          has_attachment: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['factures']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['factures']['Insert']>
      }
      depenses: {
        Row: {
          id: number
          workspace_id: string
          date: string
          fournisseur: string
          description: string | null
          montant_ht: number
          taux_tva: number
          montant_tva: number
          montant_ttc: number
          tva_lines: Json | null
          categorie: string
          statut: 'payee' | 'en_attente'
          bank_source: string | null
          has_attachment: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['depenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['depenses']['Insert']>
      }
      ai_config: {
        Row: {
          workspace_id: string
          provider: string
          api_key: string | null
          model: string | null
          system_prompt: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_config']['Row'], 'updated_at'>
        Update: Partial<Database['public']['Tables']['ai_config']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      auth_workspace_ids: { Returns: string[] }
    }
    Enums: Record<string, never>
  }
}

// Raccourcis pratiques
export type Workspace  = Database['public']['Tables']['workspaces']['Row']
export type Membership = Database['public']['Tables']['memberships']['Row']
export type Facture    = Database['public']['Tables']['factures']['Row']
export type Depense    = Database['public']['Tables']['depenses']['Row']
