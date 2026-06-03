export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DocumentStatus = "pending" | "processing" | "synced" | "error";

export type ProspectStatus =
  | "Researching"
  | "Qualified"
  | "Outreach Planned"
  | "Contacted"
  | "Won"
  | "Lost";

export type SyncLogStatus = "success" | "error" | "partial";

export interface Database {
  public: {
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          google_drive_folder_ids: string[] | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          google_drive_folder_ids?: string[] | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      google_tokens: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string | null;
          expiry: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          refresh_token?: string | null;
          expiry?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_tokens"]["Insert"]>;
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          user_id: string;
          google_file_id: string;
          document_name: string;
          last_modified: string | null;
          status: DocumentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_file_id: string;
          document_name: string;
          last_modified?: string | null;
          status?: DocumentStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_documents"]["Insert"]>;
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_text: string;
          project_name: string | null;
          industry: string | null;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          chunk_text: string;
          project_name?: string | null;
          industry?: string | null;
          embedding?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Insert"]>;
        Relationships: [];
      };
      connections: {
        Row: {
          id: string;
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          company: string | null;
          position: string | null;
          email: string | null;
          profile_url: string | null;
          connected_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name?: string | null;
          last_name?: string | null;
          company?: string | null;
          position?: string | null;
          email?: string | null;
          profile_url?: string | null;
          connected_on?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["connections"]["Insert"]>;
        Relationships: [];
      };
      prospects: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          website: string | null;
          country: string | null;
          industry: string | null;
          revenue_range: string | null;
          employee_count: string | null;
          notes: string | null;
          status: ProspectStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          website?: string | null;
          country?: string | null;
          industry?: string | null;
          revenue_range?: string | null;
          employee_count?: string | null;
          notes?: string | null;
          status?: ProspectStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospects"]["Insert"]>;
        Relationships: [];
      };
      prospect_analysis: {
        Row: {
          id: string;
          prospect_id: string;
          analysis: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          analysis: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospect_analysis"]["Insert"]>;
        Relationships: [];
      };
      generated_emails: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          contact_name: string | null;
          subject: string;
          body: string;
          created_at: string;
          provider_used: string | null;
          relationship_type: string | null;
          edited_content: string | null;
          refinement_history: any | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          contact_name?: string | null;
          subject: string;
          body: string;
          created_at?: string;
          provider_used?: string | null;
          relationship_type?: string | null;
          edited_content?: string | null;
          refinement_history?: any | null;
        };
        Update: Partial<Database["public"]["Tables"]["generated_emails"]["Insert"]>;
        Relationships: [];
      };
      sync_logs: {
        Row: {
          id: string;
          user_id: string;
          documents_processed: number;
          status: SyncLogStatus;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          documents_processed?: number;
          status: SyncLogStatus;
          message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_logs"]["Insert"]>;
        Relationships: [];
      };
      company_industry_cache: {
        Row: {
          user_id: string;
          company_name: string;
          industry: string | null;
          country: string | null;
          company_size: string | null;
          revenue_band: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          company_name: string;
          industry?: string | null;
          country?: string | null;
          company_size?: string | null;
          revenue_band?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["company_industry_cache"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Functions: {
      match_knowledge_chunks: {
        Args: {
          p_user_id: string;
          query_embedding: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          document_id: string;
          chunk_text: string;
          project_name: string | null;
          industry: string | null;
          similarity: number;
        }[];
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type KnowledgeDocument =
  Database["public"]["Tables"]["knowledge_documents"]["Row"];
export type KnowledgeChunk =
  Database["public"]["Tables"]["knowledge_chunks"]["Row"];
export type Connection = Database["public"]["Tables"]["connections"]["Row"];
export type Prospect = Database["public"]["Tables"]["prospects"]["Row"];
export type GeneratedEmail =
  Database["public"]["Tables"]["generated_emails"]["Row"];
export type SyncLog = Database["public"]["Tables"]["sync_logs"]["Row"];

export type KnowledgeDocumentWithCount = KnowledgeDocument & {
  chunk_count: number;
};

export type MatchedChunk = {
  id: string;
  document_id: string;
  chunk_text: string;
  project_name: string | null;
  industry: string | null;
  similarity: number;
  reference_link?: string;
};

export type RankedContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  position: string | null;
  email: string | null;
  profile_url: string | null;
  score: number;
};

export type CompanyIndustryCache =
  Database["public"]["Tables"]["company_industry_cache"]["Row"];
