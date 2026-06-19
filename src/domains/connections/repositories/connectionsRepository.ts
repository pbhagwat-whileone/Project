import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRecords } from "@/infrastructure/database/supabase/supabaseUtils";

export class ConnectionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getUserConnections(userId: string) {
    const queryBuilder = this.supabase
      .from("connections")
      .select("id, first_name, last_name, company, position, email, profile_url, connected_on, connection_owner_name, created_at, connection_profiles(*)");

    const records = await fetchAllRecords<any>(queryBuilder);
    
    return records.map((c: any) => {
      const profile = c.connection_profiles || {};
      return {
        ...c,
        location: profile.location || null,
        company: c.company || profile.company || null,
        position: c.position || profile.position || null,
        certifications: profile.certifications || [],
        expertise_tags: profile.expertise_tags || [],
        technology_tags: profile.technology_tags || [],
        activity_signals: profile.activity_signals || [],
        education: profile.education || [],
        raw_tavily_response: profile.raw_tavily_response || null,
      };
    });
  }

  async getConnectionMetrics(contactIds: string[]) {
    if (!contactIds || contactIds.length === 0) return [];
    
    const { data, error } = await this.supabase
      .from("connection_relationship_metrics")
      .select("*")
      .in("connection_id", contactIds);

    if (error) throw error;
    return data || [];
  }

  async getMessagesForUrlPatterns(userId: string, urlPatterns: string[]) {
    if (!urlPatterns || urlPatterns.length === 0) return [];
    
    // Construct the OR query for all patterns
    const orQuery = urlPatterns
      .map(pattern => `from_profile_url.ilike.${pattern},to_profile_url.ilike.${pattern}`)
      .join(',');

    const { data, error } = await this.supabase
      .from("linkedin_messages")
      .select("date")
      .or(orQuery);
      
    if (error) throw error;
    return data || [];
  }
}
