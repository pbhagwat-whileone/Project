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
          source_type: string;
          blog_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_file_id: string;
          document_name: string;
          last_modified?: string | null;
          status?: DocumentStatus;
          source_type?: string;
          blog_url?: string | null;
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
          connection_owner_name: string;
          email_source: string | null;
          email_status: string | null;
          email_confidence: number | null;
          email_last_enriched_at: string | null;
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
          connection_owner_name?: string;
          email_source?: string | null;
          email_status?: string | null;
          email_confidence?: number | null;
          email_last_enriched_at?: string | null;
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
          generation_context: any | null;
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
          generation_context?: any | null;
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
      company_score_cache: {
        Row: {
          user_id: string;
          company_name: string;
          project_relevance_score: number;
          recommendation_score: number;
          matching_project_count: number;
          average_similarity: number;
          connection_score: number;
          seniority_score: number;
          top_project_names: string[];
          industry: string | null;
          last_calculated_at: string;
        };
        Insert: {
          user_id: string;
          company_name: string;
          project_relevance_score?: number;
          recommendation_score?: number;
          matching_project_count?: number;
          average_similarity?: number;
          connection_score?: number;
          seniority_score?: number;
          top_project_names?: string[];
          industry?: string | null;
          last_calculated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["company_score_cache"]["Insert"]
        >;
        Relationships: [];
      };
      linkedin_messages: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          from_profile_url: string | null;
          to_profile_url: string | null;
          from_name: string | null;
          to_name: string | null;
          date: string | null;
          content: string | null;
          message_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          from_profile_url?: string | null;
          to_profile_url?: string | null;
          from_name?: string | null;
          to_name?: string | null;
          date?: string | null;
          content?: string | null;
          message_hash: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["linkedin_messages"]["Insert"]>;
        Relationships: [];
      };
      connection_relationship_metrics: {
        Row: {
          id: string;
          connection_id: string;
          user_id: string;
          message_count: number;
          conversation_count: number;
          first_contact_date: string | null;
          last_contact_date: string | null;
          relationship_score: number;
          conversation_summary: string | null;
          discussion_topics: string | null;
          interaction_timeline: string | null;
          recent_highlights: string | null;
          relationship_classification: string | null;
          key_interests: string[] | null;
          business_context: string | null;
          action_items: string[] | null;
          engagement_quality: string | null;
          recommended_outreach_angle: string | null;
          personalization_points: string[] | null;
          persistent_context: string | null;
          time_bound_context: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          connection_id: string;
          user_id: string;
          message_count?: number;
          conversation_count?: number;
          first_contact_date?: string | null;
          last_contact_date?: string | null;
          relationship_score?: number;
          conversation_summary?: string | null;
          discussion_topics?: string | null;
          interaction_timeline?: string | null;
          recent_highlights?: string | null;
          relationship_classification?: string | null;
          key_interests?: string[] | null;
          business_context?: string | null;
          action_items?: string[] | null;
          engagement_quality?: string | null;
          recommended_outreach_angle?: string | null;
          personalization_points?: string[] | null;
          persistent_context?: string | null;
          time_bound_context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["connection_relationship_metrics"]["Insert"]>;
        Relationships: [];
      };
      company_context_cache: {
        Row: {
          id: string;
          company_name: string;
          summary: string | null;
          raw_context: string | null;
          generated_context: any | null;
          sources: string[] | null;
          created_at: string | null;
          updated_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          company_name: string;
          summary?: string | null;
          raw_context?: string | null;
          generated_context?: any | null;
          sources?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["company_context_cache"]["Insert"]>;
        Relationships: [];
      };
      company_similar_contacts_cache: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          results: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          company_name: string;
          results?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_name?: string;
          results?: any;
          created_at?: string;
        };
        Relationships: [];
      };
      connection_profiles: {
        Row: {
          connection_id: string;
          location: string | null;
          company: string | null;
          position: string | null;
          headline: string | null;
          current_role_start_date: string | null;
          certifications: any | null;
          expertise_tags: any | null;
          technology_tags: any | null;
          activity_signals: any | null;
          education: any | null;
          raw_tavily_response: any | null;
          enriched_at: string | null;
        };
        Insert: {
          connection_id: string;
          location?: string | null;
          company?: string | null;
          position?: string | null;
          headline?: string | null;
          current_role_start_date?: string | null;
          certifications?: any | null;
          expertise_tags?: any | null;
          technology_tags?: any | null;
          activity_signals?: any | null;
          education?: any | null;
          raw_tavily_response?: any | null;
          enriched_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["connection_profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "connection_profiles_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: true;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          }
        ];
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
export type Connection = Database["public"]["Tables"]["connections"]["Row"] & {
  connection_profiles?: ConnectionProfile | null;
};
export type ConnectionProfile = Database["public"]["Tables"]["connection_profiles"]["Row"];
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
  blog_url?: string | null;
};

export type RankedContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  position: string | null;
  location?: string | null;
  expertise_tags?: string[] | null;
  technology_tags?: string[] | null;
  activity_signals?: string[] | null;
  email: string | null;
  profile_url: string | null;
  score: number;
  relationship_score?: number;
  conversation_summary?: string | null;
  discussion_topics?: string | null;
  interaction_timeline?: string | null;
  recent_highlights?: string | null;
  relationship_classification?: string | null;
  key_interests?: string[] | null;
  business_context?: string | null;
  action_items?: string[] | null;
  engagement_quality?: string | null;
  recommended_outreach_angle?: string | null;
  personalization_points?: string[] | null;
  persistent_context?: string | null;
  time_bound_context?: string | null;
  total_messages?: number;
  last_interaction_date?: string | null;
  connection_owner_name?: string;
};

export type CompanyIndustryCache =
  Database["public"]["Tables"]["company_industry_cache"]["Row"];
export type ConnectionRelationshipMetrics =
  Database["public"]["Tables"]["connection_relationship_metrics"]["Row"];
export type LinkedinMessage =
  Database["public"]["Tables"]["linkedin_messages"]["Row"];

export interface CompanyContext {
  companyName: string;
  summary: string;
  keyInitiatives: string[];
  hiringSignals: string[];
  technologySignals: string[];
  businessPriorities: string[];
  outreachOpportunities: string[];
  confidence: "high" | "medium" | "low";
  sources: string[];
}

export interface CompanyContextRelevance {
  relevanceScore: number;
  useCompanyContext: boolean;
  reasoning: string;
  recommendedUsage:
  | "ignore"
  | "light_reference"
  | "conversation_starter"
  | "primary_outreach_angle";
}

export interface RelationshipIntelligence {
  relationshipType: string;
  confidence: number;
  reasoning: string;
  outreachGoal:
  | "reconnect"
  | "follow_up"
  | "introduction_request"
  | "opportunity_exploration"
  | "partnership_discussion"
  | string;
  capabilityProminence: "low" | "medium" | "high";
}
